const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class RealTimeChatManager extends EventEmitter {
    constructor(db, encryptionKey, nodeConfig, networkManager) {
        super();
        this.db = db;
        this.encryptionKey = encryptionKey;
        this.nodeConfig = nodeConfig;
        this.networkManager = networkManager;
        
        // Chat sessions: Map<sessionId, ChatSession>
        this.activeSessions = new Map();
        
        // Typing indicators: Map<sessionId, Set<userId>>
        this.typingUsers = new Map();
        
        // Message queue for offline users
        this.messageQueue = new Map();
        
        this.initializeDatabase();
        this.setupNetworkHandlers();
    }

    initializeDatabase() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                participants TEXT NOT NULL,
                session_name TEXT,
                created_by TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_activity INTEGER NOT NULL,
                session_type TEXT DEFAULT 'direct',
                metadata TEXT DEFAULT '{}',
                is_group INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                content_encrypted BLOB NOT NULL,
                message_type TEXT DEFAULT 'text',
                timestamp INTEGER NOT NULL,
                edited_at INTEGER NULL,
                reply_to TEXT NULL,
                read_by TEXT DEFAULT '{}',
                reactions TEXT DEFAULT '{}',
                is_deleted INTEGER DEFAULT 0,
                sync_status TEXT DEFAULT 'pending',
                FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chat_participants (
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                joined_at INTEGER NOT NULL,
                role TEXT DEFAULT 'member',
                last_read INTEGER DEFAULT 0,
                notification_settings TEXT DEFAULT '{}',
                PRIMARY KEY (session_id, user_id),
                FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_participants ON chat_sessions(participants);
            CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
        `);
    }

    setupNetworkHandlers() {
        if (this.networkManager) {
            this.networkManager.on('chatMessageReceived', (data) => {
                this.handleRemoteChatMessage(data);
            });

            this.networkManager.on('typingIndicator', (data) => {
                this.handleTypingIndicator(data);
            });

            this.networkManager.on('peerConnected', (peer) => {
                this.handlePeerConnected(peer);
            });

            this.networkManager.on('peerDisconnected', (peer) => {
                this.handlePeerDisconnected(peer);
            });
        }
    }

    // Create or get direct chat session
    async createDirectChat(participantId, participantName) {
        try {
            const participants = [this.nodeConfig.node_id, participantId].sort();
            const participantsStr = JSON.stringify(participants);

            // Check if session already exists
            const existingStmt = this.db.prepare(`
                SELECT id FROM chat_sessions 
                WHERE participants = ? AND is_group = 0
            `);
            
            const existing = existingStmt.get(participantsStr);
            if (existing) {
                return await this.getChatSession(existing.id);
            }

            // Create new session
            const sessionId = uuidv4();
            const now = Date.now();

            const sessionStmt = this.db.prepare(`
                INSERT INTO chat_sessions (
                    id, participants, created_by, created_at, last_activity, session_type
                ) VALUES (?, ?, ?, ?, ?, 'direct')
            `);

            sessionStmt.run(sessionId, participantsStr, this.nodeConfig.node_id, now, now);

            // Add participants
            const participantStmt = this.db.prepare(`
                INSERT INTO chat_participants (session_id, user_id, user_name, joined_at)
                VALUES (?, ?, ?, ?)
            `);

            participantStmt.run(sessionId, this.nodeConfig.node_id, this.nodeConfig.display_name, now);
            participantStmt.run(sessionId, participantId, participantName, now);

            console.log(`💬 Direct chat created with ${participantName}`);
            
            return await this.getChatSession(sessionId);

        } catch (error) {
            console.error('Error creating direct chat:', error);
            throw error;
        }
    }

    // Create group chat session
    async createGroupChat(sessionName, participantIds, participantNames) {
        try {
            const sessionId = uuidv4();
            const now = Date.now();
            
            // Include self in participants
            const allParticipants = [this.nodeConfig.node_id, ...participantIds];
            const participantsStr = JSON.stringify(allParticipants);

            const sessionStmt = this.db.prepare(`
                INSERT INTO chat_sessions (
                    id, participants, session_name, created_by, created_at, 
                    last_activity, session_type, is_group
                ) VALUES (?, ?, ?, ?, ?, ?, 'group', 1)
            `);

            sessionStmt.run(sessionId, participantsStr, sessionName, this.nodeConfig.node_id, now, now);

            // Add participants
            const participantStmt = this.db.prepare(`
                INSERT INTO chat_participants (session_id, user_id, user_name, joined_at, role)
                VALUES (?, ?, ?, ?, ?)
            `);

            // Add creator as admin
            participantStmt.run(sessionId, this.nodeConfig.node_id, this.nodeConfig.display_name, now, 'admin');

            // Add other participants
            participantIds.forEach((userId, index) => {
                const userName = participantNames[index] || 'Unknown User';
                participantStmt.run(sessionId, userId, userName, now, 'member');
            });

            // Send initial system message
            await this.sendSystemMessage(sessionId, `Group chat "${sessionName}" created`);

            console.log(`👥 Group chat created: ${sessionName}`);
            
            return await this.getChatSession(sessionId);

        } catch (error) {
            console.error('Error creating group chat:', error);
            throw error;
        }
    }

    // Send message to chat session
    async sendMessage(sessionId, content, messageType = 'text', replyTo = null) {
        try {
            const messageId = uuidv4();
            const timestamp = Date.now();

            // Validate session exists and user is participant
            const session = await this.getChatSession(sessionId);
            if (!session) {
                throw new Error('Chat session not found');
            }

            const isParticipant = session.participants.some(p => p.user_id === this.nodeConfig.node_id);
            if (!isParticipant) {
                throw new Error('Not a participant in this chat session');
            }

            // Create message data
            const messageData = {
                id: messageId,
                content: content,
                messageType: messageType,
                sender_id: this.nodeConfig.node_id,
                sender_name: this.nodeConfig.display_name,
                timestamp: timestamp,
                replyTo: replyTo
            };

            // Encrypt message content
            const encryptedContent = this.encryptData(JSON.stringify(messageData));

            // Store message
            const messageStmt = this.db.prepare(`
                INSERT INTO chat_messages (
                    id, session_id, sender_id, sender_name, content_encrypted,
                    message_type, timestamp, reply_to, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `);

            messageStmt.run(
                messageId,
                sessionId,
                this.nodeConfig.node_id,
                this.nodeConfig.display_name,
                encryptedContent,
                messageType,
                timestamp,
                replyTo
            );

            // Update session last activity
            const updateSessionStmt = this.db.prepare(`
                UPDATE chat_sessions SET last_activity = ? WHERE id = ?
            `);
            updateSessionStmt.run(timestamp, sessionId);

            // Broadcast to peers
            await this.broadcastMessage(sessionId, messageData);

            // Mark as read by sender
            await this.markAsRead(sessionId, messageId, this.nodeConfig.node_id);

            // Emit event for real-time updates
            this.emit('messageReceived', {
                sessionId: sessionId,
                message: messageData
            });

            console.log(`💬 Message sent to session ${sessionId}`);

            return messageData;

        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Get messages for a chat session
    async getMessages(sessionId, limit = 50, offset = 0, beforeTimestamp = null) {
        try {
            let query = `
                SELECT 
                    id, sender_id, sender_name, content_encrypted, message_type,
                    timestamp, edited_at, reply_to, read_by, reactions, is_deleted
                FROM chat_messages 
                WHERE session_id = ?
            `;
            
            let params = [sessionId];

            if (beforeTimestamp) {
                query += ' AND timestamp < ?';
                params.push(beforeTimestamp);
            }

            query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const stmt = this.db.prepare(query);
            const messages = stmt.all(...params);

            // Decrypt messages
            const decryptedMessages = messages.map(msg => {
                try {
                    if (msg.is_deleted) {
                        return {
                            id: msg.id,
                            content: '[Message deleted]',
                            sender_id: msg.sender_id,
                            sender_name: msg.sender_name,
                            message_type: 'system',
                            timestamp: msg.timestamp,
                            edited_at: msg.edited_at,
                            reply_to: msg.reply_to,
                            read_by: this.parseJsonField(msg.read_by),
                            reactions: this.parseJsonField(msg.reactions),
                            is_deleted: true
                        };
                    }

                    const decryptedContent = this.decryptData(msg.content_encrypted);
                    const messageData = JSON.parse(decryptedContent);

                    return {
                        id: msg.id,
                        content: messageData.content,
                        sender_id: msg.sender_id,
                        sender_name: msg.sender_name,
                        message_type: msg.message_type,
                        timestamp: msg.timestamp,
                        edited_at: msg.edited_at,
                        reply_to: msg.reply_to,
                        read_by: this.parseJsonField(msg.read_by),
                        reactions: this.parseJsonField(msg.reactions),
                        is_deleted: false
                    };
                } catch (err) {
                    console.error('Failed to decrypt message:', msg.id, err);
                    return null;
                }
            }).filter(msg => msg !== null);

            // Reverse to get chronological order
            return decryptedMessages.reverse();

        } catch (error) {
            console.error('Error getting messages:', error);
            return [];
        }
    }

    // Get chat session info
    async getChatSession(sessionId) {
        try {
            const sessionStmt = this.db.prepare(`
                SELECT * FROM chat_sessions WHERE id = ?
            `);
            const session = sessionStmt.get(sessionId);

            if (!session) {
                return null;
            }

            // Get participants
            const participantsStmt = this.db.prepare(`
                SELECT user_id, user_name, joined_at, role, last_read, notification_settings
                FROM chat_participants 
                WHERE session_id = ?
            `);
            const participants = participantsStmt.all(sessionId);

            // Get unread count for current user
            const unreadStmt = this.db.prepare(`
                SELECT COUNT(*) as count
                FROM chat_messages cm
                LEFT JOIN chat_participants cp ON cp.session_id = cm.session_id AND cp.user_id = ?
                WHERE cm.session_id = ? AND cm.timestamp > COALESCE(cp.last_read, 0)
                AND cm.sender_id != ?
            `);
            const unreadCount = unreadStmt.get(this.nodeConfig.node_id, sessionId, this.nodeConfig.node_id).count;

            // Get last message
            const lastMessageStmt = this.db.prepare(`
                SELECT sender_name, content_encrypted, timestamp, message_type
                FROM chat_messages 
                WHERE session_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            `);
            const lastMessageRow = lastMessageStmt.get(sessionId);
            
            let lastMessage = null;
            if (lastMessageRow) {
                try {
                    const decryptedContent = this.decryptData(lastMessageRow.content_encrypted);
                    const messageData = JSON.parse(decryptedContent);
                    lastMessage = {
                        sender_name: lastMessageRow.sender_name,
                        content: messageData.content.substring(0, 100), // Preview
                        timestamp: lastMessageRow.timestamp,
                        message_type: lastMessageRow.message_type
                    };
                } catch (err) {
                    lastMessage = {
                        sender_name: lastMessageRow.sender_name,
                        content: '[Encrypted message]',
                        timestamp: lastMessageRow.timestamp,
                        message_type: lastMessageRow.message_type
                    };
                }
            }

            return {
                id: session.id,
                participants: participants,
                session_name: session.session_name,
                created_by: session.created_by,
                created_at: session.created_at,
                last_activity: session.last_activity,
                session_type: session.session_type,
                is_group: Boolean(session.is_group),
                metadata: this.parseJsonField(session.metadata),
                unread_count: unreadCount,
                last_message: lastMessage
            };

        } catch (error) {
            console.error('Error getting chat session:', error);
            return null;
        }
    }

    // Get all chat sessions for current user
    async getChatSessions() {
        try {
            const stmt = this.db.prepare(`
                SELECT DISTINCT cs.*
                FROM chat_sessions cs
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ?
                ORDER BY cs.last_activity DESC
            `);

            const sessions = stmt.all(this.nodeConfig.node_id);
            
            // Get detailed info for each session
            const detailedSessions = [];
            for (const session of sessions) {
                const detailed = await this.getChatSession(session.id);
                if (detailed) {
                    detailedSessions.push(detailed);
                }
            }

            return detailedSessions;

        } catch (error) {
            console.error('Error getting chat sessions:', error);
            return [];
        }
    }

    // Mark messages as read
    async markAsRead(sessionId, messageId = null, userId = null) {
        try {
            userId = userId || this.nodeConfig.node_id;
            const timestamp = Date.now();

            if (messageId) {
                // Mark specific message as read
                const messageStmt = this.db.prepare(`
                    SELECT read_by FROM chat_messages WHERE id = ?
                `);
                const message = messageStmt.get(messageId);
                
                if (message) {
                    const readBy = this.parseJsonField(message.read_by);
                    readBy[userId] = timestamp;

                    const updateStmt = this.db.prepare(`
                        UPDATE chat_messages SET read_by = ? WHERE id = ?
                    `);
                    updateStmt.run(JSON.stringify(readBy), messageId);
                }
            }

            // Update participant's last read timestamp
            const participantStmt = this.db.prepare(`
                UPDATE chat_participants 
                SET last_read = ? 
                WHERE session_id = ? AND user_id = ?
            `);
            participantStmt.run(timestamp, sessionId, userId);

            // Broadcast read receipt
            if (this.networkManager) {
                await this.networkManager.broadcastReadReceipt({
                    sessionId: sessionId,
                    messageId: messageId,
                    userId: userId,
                    timestamp: timestamp
                });
            }

        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }

    // Send typing indicator
    async sendTypingIndicator(sessionId, isTyping = true) {
        try {
            const session = await this.getChatSession(sessionId);
            if (!session) return;

            if (isTyping) {
                // Add to typing users
                if (!this.typingUsers.has(sessionId)) {
                    this.typingUsers.set(sessionId, new Set());
                }
                this.typingUsers.get(sessionId).add(this.nodeConfig.node_id);

                // Auto-clear typing indicator after 3 seconds
                setTimeout(() => {
                    this.sendTypingIndicator(sessionId, false);
                }, 3000);
            } else {
                // Remove from typing users
                if (this.typingUsers.has(sessionId)) {
                    this.typingUsers.get(sessionId).delete(this.nodeConfig.node_id);
                    if (this.typingUsers.get(sessionId).size === 0) {
                        this.typingUsers.delete(sessionId);
                    }
                }
            }

            // Broadcast typing indicator
            if (this.networkManager) {
                await this.networkManager.broadcastTypingIndicator({
                    sessionId: sessionId,
                    userId: this.nodeConfig.node_id,
                    userName: this.nodeConfig.display_name,
                    isTyping: isTyping,
                    timestamp: Date.now()
                });
            }

            // Emit local event
            this.emit('typingIndicator', {
                sessionId: sessionId,
                userId: this.nodeConfig.node_id,
                isTyping: isTyping
            });

        } catch (error) {
            console.error('Error sending typing indicator:', error);
        }
    }

    // Edit message
    async editMessage(messageId, newContent, userId = null) {
        try {
            userId = userId || this.nodeConfig.node_id;

            // Get existing message
            const messageStmt = this.db.prepare(`
                SELECT content_encrypted, sender_id, session_id 
                FROM chat_messages 
                WHERE id = ?
            `);
            const message = messageStmt.get(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.sender_id !== userId) {
                throw new Error('Unauthorized: Cannot edit another user\'s message');
            }

            // Decrypt existing content
            const existingData = JSON.parse(this.decryptData(message.content_encrypted));
            
            // Update content and edited timestamp
            const updatedData = {
                ...existingData,
                content: newContent,
                edited_at: Date.now()
            };

            const encryptedContent = this.encryptData(JSON.stringify(updatedData));

            // Update database
            const updateStmt = this.db.prepare(`
                UPDATE chat_messages 
                SET content_encrypted = ?, edited_at = ?
                WHERE id = ?
            `);

            updateStmt.run(encryptedContent, updatedData.edited_at, messageId);

            // Broadcast edit
            if (this.networkManager) {
                await this.networkManager.broadcastMessageEdit({
                    messageId: messageId,
                    sessionId: message.session_id,
                    newContent: newContent,
                    edited_at: updatedData.edited_at,
                    userId: userId
                });
            }

            // Emit event
            this.emit('messageEdited', {
                messageId: messageId,
                sessionId: message.session_id,
                newContent: newContent,
                edited_at: updatedData.edited_at
            });

            console.log(`✏️ Message edited: ${messageId}`);
            return true;

        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }

    // Delete message
    async deleteMessage(messageId, userId = null) {
        try {
            userId = userId || this.nodeConfig.node_id;

            // Get message info
            const messageStmt = this.db.prepare(`
                SELECT sender_id, session_id FROM chat_messages WHERE id = ?
            `);
            const message = messageStmt.get(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.sender_id !== userId) {
                throw new Error('Unauthorized: Cannot delete another user\'s message');
            }

            // Mark as deleted
            const deleteStmt = this.db.prepare(`
                UPDATE chat_messages SET is_deleted = 1 WHERE id = ?
            `);
            deleteStmt.run(messageId);

            // Broadcast deletion
            if (this.networkManager) {
                await this.networkManager.broadcastMessageDelete({
                    messageId: messageId,
                    sessionId: message.session_id,
                    userId: userId,
                    timestamp: Date.now()
                });
            }

            // Emit event
            this.emit('messageDeleted', {
                messageId: messageId,
                sessionId: message.session_id
            });

            console.log(`🗑️ Message deleted: ${messageId}`);
            return true;

        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    // Add reaction to message
    async addReaction(messageId, reactionType, userId = null) {
        try {
            userId = userId || this.nodeConfig.node_id;

            // Valid reaction types
            const validReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '👎'];
            if (!validReactions.includes(reactionType)) {
                throw new Error('Invalid reaction type');
            }

            // Get message
            const messageStmt = this.db.prepare(`
                SELECT reactions, session_id FROM chat_messages WHERE id = ?
            `);
            const message = messageStmt.get(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            // Update reactions
            const reactions = this.parseJsonField(message.reactions);
            if (!reactions[reactionType]) {
                reactions[reactionType] = [];
            }

            // Remove existing reaction from this user
            Object.keys(reactions).forEach(reaction => {
                reactions[reaction] = reactions[reaction].filter(id => id !== userId);
                if (reactions[reaction].length === 0) {
                    delete reactions[reaction];
                }
            });

            // Add new reaction
            if (!reactions[reactionType]) {
                reactions[reactionType] = [];
            }
            reactions[reactionType].push(userId);

            // Update database
            const updateStmt = this.db.prepare(`
                UPDATE chat_messages SET reactions = ? WHERE id = ?
            `);
            updateStmt.run(JSON.stringify(reactions), messageId);

            // Broadcast reaction
            if (this.networkManager) {
                await this.networkManager.broadcastMessageReaction({
                    messageId: messageId,
                    sessionId: message.session_id,
                    reactionType: reactionType,
                    userId: userId,
                    timestamp: Date.now()
                });
            }

            // Emit event
            this.emit('messageReaction', {
                messageId: messageId,
                sessionId: message.session_id,
                reactionType: reactionType,
                userId: userId
            });

            return true;

        } catch (error) {
            console.error('Error adding reaction:', error);
            throw error;
        }
    }

    // Send system message
    async sendSystemMessage(sessionId, content) {
        try {
            const messageId = uuidv4();
            const timestamp = Date.now();

            const messageData = {
                id: messageId,
                content: content,
                messageType: 'system',
                sender_id: 'system',
                sender_name: 'System',
                timestamp: timestamp
            };

            const encryptedContent = this.encryptData(JSON.stringify(messageData));

            const messageStmt = this.db.prepare(`
                INSERT INTO chat_messages (
                    id, session_id, sender_id, sender_name, content_encrypted,
                    message_type, timestamp, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
            `);

            messageStmt.run(
                messageId,
                sessionId,
                'system',
                'System',
                encryptedContent,
                'system',
                timestamp
            );

            // Emit event
            this.emit('messageReceived', {
                sessionId: sessionId,
                message: messageData
            });

            return messageData;

        } catch (error) {
            console.error('Error sending system message:', error);
            throw error;
        }
    }

    // Handle remote messages from peers
    async handleRemoteChatMessage(data) {
        try {
            const { sessionId, message, fromPeer } = data;

            // Check if we already have this message
            const existingStmt = this.db.prepare('SELECT id FROM chat_messages WHERE id = ?');
            if (existingStmt.get(message.id)) {
                return; // Already have this message
            }

            // Verify we're a participant in this session
            const participantStmt = this.db.prepare(`
                SELECT session_id FROM chat_participants 
                WHERE session_id = ? AND user_id = ?
            `);
            
            if (!participantStmt.get(sessionId, this.nodeConfig.node_id)) {
                console.log(`Not a participant in session ${sessionId}, ignoring message`);
                return;
            }

            // Encrypt and store remote message
            const encryptedContent = this.encryptData(JSON.stringify(message));

            const messageStmt = this.db.prepare(`
                INSERT INTO chat_messages (
                    id, session_id, sender_id, sender_name, content_encrypted,
                    message_type, timestamp, reply_to, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
            `);

            messageStmt.run(
                message.id,
                sessionId,
                message.sender_id,
                message.sender_name,
                encryptedContent,
                message.messageType || 'text',
                message.timestamp,
                message.replyTo || null
            );

            // Update session last activity
            const updateSessionStmt = this.db.prepare(`
                UPDATE chat_sessions SET last_activity = ? WHERE id = ?
            `);
            updateSessionStmt.run(message.timestamp, sessionId);

            // Emit event for real-time UI updates
            this.emit('messageReceived', {
                sessionId: sessionId,
                message: message,
                isRemote: true
            });

            console.log(`📨 Remote message received in session ${sessionId}`);

        } catch (error) {
            console.error('Error handling remote chat message:', error);
        }
    }

    // Handle typing indicators from peers
    handleTypingIndicator(data) {
        const { sessionId, userId, userName, isTyping } = data;

        if (isTyping) {
            if (!this.typingUsers.has(sessionId)) {
                this.typingUsers.set(sessionId, new Set());
            }
            this.typingUsers.get(sessionId).add(userId);
        } else {
            if (this.typingUsers.has(sessionId)) {
                this.typingUsers.get(sessionId).delete(userId);
                if (this.typingUsers.get(sessionId).size === 0) {
                    this.typingUsers.delete(sessionId);
                }
            }
        }

        // Emit event for UI updates
        this.emit('typingIndicator', {
            sessionId: sessionId,
            userId: userId,
            userName: userName,
            isTyping: isTyping
        });
    }

    // Handle peer connection events
    handlePeerConnected(peer) {
        // Send queued messages for this peer
        if (this.messageQueue.has(peer.nodeId)) {
            const queuedMessages = this.messageQueue.get(peer.nodeId);
            queuedMessages.forEach(async (messageData) => {
                await this.networkManager.sendToPeer(peer.nodeId, messageData);
            });
            this.messageQueue.delete(peer.nodeId);
        }
    }

    handlePeerDisconnected(peer) {
        // Remove from typing indicators
        this.typingUsers.forEach((typingSet, sessionId) => {
            if (typingSet.has(peer.nodeId)) {
                typingSet.delete(peer.nodeId);
                this.emit('typingIndicator', {
                    sessionId: sessionId,
                    userId: peer.nodeId,
                    isTyping: false
                });
            }
        });
    }

    // Broadcast message to all session participants
    async broadcastMessage(sessionId, messageData) {
        if (!this.networkManager) return;

        try {
            const session = await this.getChatSession(sessionId);
            if (!session) return;

            const broadcastData = {
                type: 'chat_message',
                sessionId: sessionId,
                message: messageData,
                fromPeer: this.nodeConfig.node_id
            };

            // Send to each participant (excluding self)
            for (const participant of session.participants) {
                if (participant.user_id !== this.nodeConfig.node_id) {
                    if (this.networkManager.isPeerConnected(participant.user_id)) {
                        await this.networkManager.sendToPeer(participant.user_id, broadcastData);
                    } else {
                        // Queue for when peer comes online
                        if (!this.messageQueue.has(participant.user_id)) {
                            this.messageQueue.set(participant.user_id, []);
                        }
                        this.messageQueue.get(participant.user_id).push(broadcastData);
                    }
                }
            }

        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    }

    // Get typing users for a session
    getTypingUsers(sessionId) {
        const typingSet = this.typingUsers.get(sessionId);
        return typingSet ? Array.from(typingSet) : [];
    }

    // Get chat statistics
    async getChatStats() {
        try {
            const stats = {};

            // Total sessions
            const sessionsStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_sessions cs
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ?
            `);
            stats.totalSessions = sessionsStmt.get(this.nodeConfig.node_id).count;

            // Total messages
            const messagesStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_messages cm
                JOIN chat_sessions cs ON cm.session_id = cs.id
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ?
            `);
            stats.totalMessages = messagesStmt.get(this.nodeConfig.node_id).count;

            // Unread messages
            const unreadStmt = this.db.prepare(`
                SELECT COUNT(*) as count
                FROM chat_messages cm
                JOIN chat_participants cp ON cp.session_id = cm.session_id
                WHERE cp.user_id = ? AND cm.timestamp > cp.last_read 
                AND cm.sender_id != ?
            `);
            stats.unreadMessages = unreadStmt.get(this.nodeConfig.node_id, this.nodeConfig.node_id).count;

            // Active sessions (last 24 hours)
            const activeStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_sessions cs
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ? AND cs.last_activity > ?
            `);
            const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
            stats.activeSessions = activeStmt.get(this.nodeConfig.node_id, dayAgo).count;

            return stats;

        } catch (error) {
            console.error('Error getting chat stats:', error);
            return { totalSessions: 0, totalMessages: 0, unreadMessages: 0, activeSessions: 0 };
        }
    }

    // Search messages
    async searchMessages(query, sessionId = null, limit = 50) {
        try {
            let sql = `
                SELECT cm.id, cm.session_id, cm.content_encrypted, cm.sender_name, cm.timestamp,
                       cs.session_name, cs.is_group
                FROM chat_messages cm
                JOIN chat_sessions cs ON cm.session_id = cs.id
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ? AND cm.is_deleted = 0
            `;
            
            let params = [this.nodeConfig.node_id];
            
            if (sessionId) {
                sql += ' AND cm.session_id = ?';
                params.push(sessionId);
            }
            
            sql += ' ORDER BY cm.timestamp DESC LIMIT ?';
            params.push(limit);

            const stmt = this.db.prepare(sql);
            const messages = stmt.all(...params);

            // Decrypt and filter by search term
            const results = [];
            const searchTerm = query.toLowerCase();
            
            for (const message of messages) {
                try {
                    const decryptedContent = this.decryptData(message.content_encrypted);
                    const messageData = JSON.parse(decryptedContent);
                    
                    if (messageData.content.toLowerCase().includes(searchTerm)) {
                        results.push({
                            id: message.id,
                            session_id: message.session_id,
                            session_name: message.session_name,
                            is_group: Boolean(message.is_group),
                            content: messageData.content,
                            sender_name: message.sender_name,
                            timestamp: message.timestamp
                        });
                    }
                } catch (err) {
                    // Skip corrupted messages
                }
            }

            return results;

        } catch (error) {
            console.error('Error searching messages:', error);
            return [];
        }
    }

    // Utility methods
    encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
        
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

    parseJsonField(jsonStr) {
        try {
            return JSON.parse(jsonStr || '{}');
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

    // Cleanup old messages
    async cleanupOldMessages(olderThanDays = 90) {
        try {
            const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
            
            const stmt = this.db.prepare(`
                DELETE FROM chat_messages 
                WHERE timestamp < ? AND message_type != 'system'
            `);
            
            const result = stmt.run(cutoffTime);
            
            console.log(`🧹 Cleaned up ${result.changes} old chat messages`);
            return result.changes;
            
        } catch (error) {
            console.error('Error cleaning up old messages:', error);
            return 0;
        }
    }
}

module.exports = RealTimeChatManager;
