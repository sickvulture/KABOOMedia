const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class CommentSystem {
    constructor(db, encryptionKey, nodeConfig, networkManager) {
        this.db = db;
        this.encryptionKey = encryptionKey;
        this.nodeConfig = nodeConfig;
        this.networkManager = networkManager;
        
        this.initializeDatabase();
    }

    initializeDatabase() {
        // Create comments table with threading support
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                parent_id TEXT NULL,
                content_encrypted BLOB NOT NULL,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                edited_at INTEGER NULL,
                is_remote INTEGER DEFAULT 0,
                reaction_counts TEXT DEFAULT '{}',
                thread_level INTEGER DEFAULT 0,
                thread_path TEXT DEFAULT '',
                sync_status TEXT DEFAULT 'synced',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS comment_reactions (
                id TEXT PRIMARY KEY,
                comment_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reaction_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
                UNIQUE(comment_id, user_id, reaction_type)
            );

            CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
            CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
            CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_comments_thread_path ON comments(thread_path);
            CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
        `);
    }

    // Create a new comment
    async createComment(postId, content, parentId = null, authorId = null, authorName = null) {
        try {
            // Use node info if author not specified
            authorId = authorId || this.nodeConfig.node_id;
            authorName = authorName || this.nodeConfig.display_name;

            // Validate post exists
            const post = this.db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
            if (!post) {
                throw new Error('Post not found');
            }

            // Validate parent comment if specified
            let parentComment = null;
            let threadLevel = 0;
            let threadPath = '';

            if (parentId) {
                parentComment = this.db.prepare(`
                    SELECT id, thread_level, thread_path, post_id 
                    FROM comments 
                    WHERE id = ?
                `).get(parentId);

                if (!parentComment) {
                    throw new Error('Parent comment not found');
                }

                if (parentComment.post_id !== postId) {
                    throw new Error('Parent comment belongs to different post');
                }

                threadLevel = parentComment.thread_level + 1;
                threadPath = parentComment.thread_path ? 
                    `${parentComment.thread_path}/${parentId}` : 
                    parentId;

                // Limit nesting depth
                if (threadLevel > 10) {
                    throw new Error('Maximum comment nesting depth reached');
                }
            }

            const commentId = uuidv4();
            const timestamp = Date.now();

            // Create comment data
            const commentData = {
                id: commentId,
                content: content,
                author_id: authorId,
                author_name: authorName,
                timestamp: timestamp,
                post_id: postId,
                parent_id: parentId
            };

            // Encrypt comment content
            const encryptedContent = this.encryptData(JSON.stringify(commentData));

            // Insert comment
            const stmt = this.db.prepare(`
                INSERT INTO comments (
                    id, post_id, parent_id, content_encrypted, author_id, author_name,
                    timestamp, thread_level, thread_path, is_remote
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                commentId,
                postId,
                parentId,
                encryptedContent,
                authorId,
                authorName,
                timestamp,
                threadLevel,
                threadPath,
                0 // Local comment
            );

            // Broadcast to connected peers if not private
            if (this.networkManager) {
                const postStmt = this.db.prepare('SELECT permissions FROM posts WHERE id = ?');
                const postData = postStmt.get(postId);
                
                if (postData && postData.permissions !== 'private') {
                    await this.networkManager.broadcastComment(commentData);
                }
            }

            console.log(`💬 Comment created on post ${postId}`);

            return {
                id: commentId,
                content: content,
                author_id: authorId,
                author_name: authorName,
                timestamp: timestamp,
                post_id: postId,
                parent_id: parentId,
                thread_level: threadLevel,
                reaction_counts: {}
            };

        } catch (error) {
            console.error('Error creating comment:', error);
            throw error;
        }
    }

    // Get comments for a post with threading
    async getCommentsForPost(postId, includeRemote = true) {
        try {
            let query = `
                SELECT 
                    id, content_encrypted, author_id, author_name, timestamp,
                    parent_id, thread_level, thread_path, is_remote, 
                    reaction_counts, edited_at
                FROM comments 
                WHERE post_id = ?
            `;

            if (!includeRemote) {
                query += ' AND is_remote = 0';
            }

            query += ' ORDER BY thread_path, timestamp ASC';

            const stmt = this.db.prepare(query);
            const comments = stmt.all(postId);

            // Decrypt and organize comments
            const decryptedComments = comments.map(comment => {
                try {
                    const decryptedContent = this.decryptData(comment.content_encrypted);
                    const contentData = JSON.parse(decryptedContent);
                    
                    return {
                        id: comment.id,
                        content: contentData.content,
                        author_id: comment.author_id,
                        author_name: comment.author_name,
                        timestamp: comment.timestamp,
                        parent_id: comment.parent_id,
                        thread_level: comment.thread_level,
                        is_remote: Boolean(comment.is_remote),
                        reaction_counts: this.parseReactionCounts(comment.reaction_counts),
                        edited_at: comment.edited_at,
                        replies: []
                    };
                } catch (err) {
                    console.error('Failed to decrypt comment:', comment.id, err);
                    return null;
                }
            }).filter(comment => comment !== null);

            // Build threaded structure
            return this.buildCommentTree(decryptedComments);

        } catch (error) {
            console.error('Error getting comments:', error);
            throw error;
        }
    }

    // Build hierarchical comment tree
    buildCommentTree(comments) {
        const commentMap = new Map();
        const rootComments = [];

        // First pass: create map of all comments
        comments.forEach(comment => {
            commentMap.set(comment.id, { ...comment, replies: [] });
        });

        // Second pass: organize into tree structure
        comments.forEach(comment => {
            const commentWithReplies = commentMap.get(comment.id);
            
            if (comment.parent_id && commentMap.has(comment.parent_id)) {
                // Add to parent's replies
                const parent = commentMap.get(comment.parent_id);
                parent.replies.push(commentWithReplies);
            } else {
                // Root level comment
                rootComments.push(commentWithReplies);
            }
        });

        // Sort root comments by timestamp
        rootComments.sort((a, b) => a.timestamp - b.timestamp);

        // Sort replies within each thread
        this.sortRepliesRecursively(rootComments);

        return rootComments;
    }

    sortRepliesRecursively(comments) {
        comments.forEach(comment => {
            if (comment.replies && comment.replies.length > 0) {
                comment.replies.sort((a, b) => a.timestamp - b.timestamp);
                this.sortRepliesRecursively(comment.replies);
            }
        });
    }

    // Edit comment
    async editComment(commentId, newContent, authorId) {
        try {
            // Get existing comment
            const stmt = this.db.prepare(`
                SELECT content_encrypted, author_id, post_id 
                FROM comments 
                WHERE id = ?
            `);
            const comment = stmt.get(commentId);

            if (!comment) {
                throw new Error('Comment not found');
            }

            if (comment.author_id !== authorId) {
                throw new Error('Unauthorized: Cannot edit another user\'s comment');
            }

            // Decrypt existing content to preserve metadata
            const existingData = JSON.parse(this.decryptData(comment.content_encrypted));
            
            // Update content and edited timestamp
            const updatedData = {
                ...existingData,
                content: newContent,
                edited_at: Date.now()
            };

            const encryptedContent = this.encryptData(JSON.stringify(updatedData));

            // Update database
            const updateStmt = this.db.prepare(`
                UPDATE comments 
                SET content_encrypted = ?, edited_at = ?
                WHERE id = ?
            `);

            updateStmt.run(encryptedContent, updatedData.edited_at, commentId);

            // Broadcast edit to peers
            if (this.networkManager) {
                await this.networkManager.broadcastCommentEdit({
                    commentId: commentId,
                    content: newContent,
                    edited_at: updatedData.edited_at,
                    author_id: authorId
                });
            }

            console.log(`✏️ Comment edited: ${commentId}`);
            return true;

        } catch (error) {
            console.error('Error editing comment:', error);
            throw error;
        }
    }

    // Delete comment
    async deleteComment(commentId, authorId) {
        try {
            // Get comment info
            const stmt = this.db.prepare(`
                SELECT author_id, post_id, parent_id 
                FROM comments 
                WHERE id = ?
            `);
            const comment = stmt.get(commentId);

            if (!comment) {
                throw new Error('Comment not found');
            }

            if (comment.author_id !== authorId) {
                throw new Error('Unauthorized: Cannot delete another user\'s comment');
            }

            // Check if comment has replies
            const repliesStmt = this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM comments 
                WHERE parent_id = ?
            `);
            const repliesCount = repliesStmt.get(commentId).count;

            if (repliesCount > 0) {
                // Replace content with [deleted] instead of removing
                const deletedData = {
                    id: commentId,
                    content: '[Comment deleted]',
                    author_id: comment.author_id,
                    author_name: '[Deleted User]',
                    timestamp: Date.now(),
                    post_id: comment.post_id,
                    parent_id: comment.parent_id,
                    deleted: true
                };

                const encryptedContent = this.encryptData(JSON.stringify(deletedData));
                
                const updateStmt = this.db.prepare(`
                    UPDATE comments 
                    SET content_encrypted = ?, author_name = '[Deleted User]'
                    WHERE id = ?
                `);
                updateStmt.run(encryptedContent, commentId);
                
                console.log(`🗑️ Comment marked as deleted: ${commentId}`);
            } else {
                // Safe to delete completely
                const deleteStmt = this.db.prepare('DELETE FROM comments WHERE id = ?');
                deleteStmt.run(commentId);
                
                console.log(`🗑️ Comment deleted: ${commentId}`);
            }

            // Broadcast deletion to peers
            if (this.networkManager) {
                await this.networkManager.broadcastCommentDelete({
                    commentId: commentId,
                    hasReplies: repliesCount > 0,
                    author_id: authorId
                });
            }

            return true;

        } catch (error) {
            console.error('Error deleting comment:', error);
            throw error;
        }
    }

    // Add reaction to comment
    async addReaction(commentId, reactionType, userId) {
        try {
            const reactionId = uuidv4();
            const timestamp = Date.now();

            // Valid reaction types
            const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
            if (!validReactions.includes(reactionType)) {
                throw new Error('Invalid reaction type');
            }

            // Check if comment exists
            const commentStmt = this.db.prepare('SELECT id FROM comments WHERE id = ?');
            if (!commentStmt.get(commentId)) {
                throw new Error('Comment not found');
            }

            // Insert or update reaction
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO comment_reactions 
                (id, comment_id, user_id, reaction_type, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(reactionId, commentId, userId, reactionType, timestamp);

            // Update reaction counts
            await this.updateReactionCounts(commentId);

            console.log(`👍 Reaction added: ${reactionType} on comment ${commentId}`);
            return true;

        } catch (error) {
            console.error('Error adding reaction:', error);
            throw error;
        }
    }

    // Remove reaction from comment
    async removeReaction(commentId, reactionType, userId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM comment_reactions 
                WHERE comment_id = ? AND user_id = ? AND reaction_type = ?
            `);

            stmt.run(commentId, userId, reactionType);

            // Update reaction counts
            await this.updateReactionCounts(commentId);

            console.log(`👎 Reaction removed: ${reactionType} from comment ${commentId}`);
            return true;

        } catch (error) {
            console.error('Error removing reaction:', error);
            throw error;
        }
    }

    // Update reaction counts for a comment
    async updateReactionCounts(commentId) {
        try {
            const stmt = this.db.prepare(`
                SELECT reaction_type, COUNT(*) as count
                FROM comment_reactions 
                WHERE comment_id = ?
                GROUP BY reaction_type
            `);

            const reactions = stmt.all(commentId);
            const reactionCounts = {};

            reactions.forEach(reaction => {
                reactionCounts[reaction.reaction_type] = reaction.count;
            });

            // Update comment with new counts
            const updateStmt = this.db.prepare(`
                UPDATE comments 
                SET reaction_counts = ?
                WHERE id = ?
            `);

            updateStmt.run(JSON.stringify(reactionCounts), commentId);

        } catch (error) {
            console.error('Error updating reaction counts:', error);
        }
    }

    // Handle remote comment from peer
    async handleRemoteComment(commentData, fromPeer) {
        try {
            const { id, content, author_id, author_name, timestamp, post_id, parent_id } = commentData;

            // Check if we already have this comment
            const existingStmt = this.db.prepare('SELECT id FROM comments WHERE id = ?');
            if (existingStmt.get(id)) {
                console.log(`Comment ${id} already exists, skipping`);
                return;
            }

            // Verify post exists
            const postStmt = this.db.prepare('SELECT id FROM posts WHERE id = ?');
            if (!postStmt.get(post_id)) {
                console.log(`Post ${post_id} not found, cannot add remote comment`);
                return;
            }

            // Calculate thread info for remote comment
            let threadLevel = 0;
            let threadPath = '';

            if (parent_id) {
                const parentStmt = this.db.prepare(`
                    SELECT thread_level, thread_path 
                    FROM comments 
                    WHERE id = ?
                `);
                const parentComment = parentStmt.get(parent_id);

                if (parentComment) {
                    threadLevel = parentComment.thread_level + 1;
                    threadPath = parentComment.thread_path ? 
                        `${parentComment.thread_path}/${parent_id}` : 
                        parent_id;
                }
            }

            // Encrypt and store remote comment
            const encryptedContent = this.encryptData(JSON.stringify(commentData));

            const stmt = this.db.prepare(`
                INSERT INTO comments (
                    id, post_id, parent_id, content_encrypted, author_id, author_name,
                    timestamp, thread_level, thread_path, is_remote, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')
            `);

            stmt.run(
                id,
                post_id,
                parent_id,
                encryptedContent,
                author_id,
                author_name,
                timestamp,
                threadLevel,
                threadPath
            );

            console.log(`📥 Remote comment received from ${author_name}`);

        } catch (error) {
            console.error('Error handling remote comment:', error);
        }
    }

    // Get comment statistics
    async getCommentStats(postId = null) {
        try {
            let query = 'SELECT COUNT(*) as total FROM comments';
            let params = [];

            if (postId) {
                query += ' WHERE post_id = ?';
                params.push(postId);
            }

            const totalStmt = this.db.prepare(query);
            const total = totalStmt.get(...params).total;

            // Get stats by thread level
            let levelQuery = `
                SELECT thread_level, COUNT(*) as count 
                FROM comments
            `;
            
            if (postId) {
                levelQuery += ' WHERE post_id = ?';
            }
            
            levelQuery += ' GROUP BY thread_level ORDER BY thread_level';

            const levelStmt = this.db.prepare(levelQuery);
            const levelStats = levelStmt.all(...params);

            // Get recent activity
            let recentQuery = `
                SELECT DATE(timestamp/1000, 'unixepoch') as date, COUNT(*) as count
                FROM comments
            `;
            
            if (postId) {
                recentQuery += ' WHERE post_id = ?';
            }
            
            recentQuery += `
                AND timestamp > ?
                GROUP BY date 
                ORDER BY date DESC 
                LIMIT 7
            `;

            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const recentParams = postId ? [postId, weekAgo] : [weekAgo];
            
            const recentStmt = this.db.prepare(recentQuery);
            const recentActivity = recentStmt.all(...recentParams);

            return {
                total: total,
                byLevel: levelStats,
                recentActivity: recentActivity
            };

        } catch (error) {
            console.error('Error getting comment stats:', error);
            return { total: 0, byLevel: [], recentActivity: [] };
        }
    }

    // Search comments
    async searchComments(searchTerm, postId = null, limit = 50) {
        try {
            // Note: This is a basic search - in production you'd want full-text search
            let query = `
                SELECT id, content_encrypted, author_name, timestamp, post_id
                FROM comments
            `;
            
            let params = [];
            
            if (postId) {
                query += ' WHERE post_id = ?';
                params.push(postId);
            }
            
            query += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);

            const stmt = this.db.prepare(query);
            const comments = stmt.all(...params);

            // Decrypt and filter by search term
            const results = [];
            
            for (const comment of comments) {
                try {
                    const decryptedContent = this.decryptData(comment.content_encrypted);
                    const contentData = JSON.parse(decryptedContent);
                    
                    if (contentData.content.toLowerCase().includes(searchTerm.toLowerCase())) {
                        results.push({
                            id: comment.id,
                            content: contentData.content,
                            author_name: comment.author_name,
                            timestamp: comment.timestamp,
                            post_id: comment.post_id
                        });
                    }
                } catch (err) {
                    // Skip corrupted comments
                }
            }

            return results;

        } catch (error) {
            console.error('Error searching comments:', error);
            return [];
        }
    }

    // Utility methods
    encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
        cipher.setAutoPadding(true);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);
    }

    decryptData(encryptedBuffer) {
        const iv = encryptedBuffer.slice(0, 16);
        const authTag = encryptedBuffer.slice(16, 32);
        const encrypted = encryptedBuffer.slice(32);
        
        const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    parseReactionCounts(reactionCountsStr) {
        try {
            return JSON.parse(reactionCountsStr || '{}');
        } catch (error) {
            return {};
        }
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    // Cleanup old comments (if needed)
    async cleanupOldComments(olderThanDays = 365) {
        try {
            const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
            
            const stmt = this.db.prepare(`
                DELETE FROM comments 
                WHERE timestamp < ? AND is_remote = 1
            `);
            
            const result = stmt.run(cutoffTime);
            
            console.log(`🧹 Cleaned up ${result.changes} old remote comments`);
            return result.changes;
            
        } catch (error) {
            console.error('Error cleaning up old comments:', error);
            return 0;
        }
    }
}

module.exports = CommentSystem;
