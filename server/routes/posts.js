const express = require('express');
const { CryptoManager } = require('../utils/cryptoManager');
const { PermissionManager } = require('../utils/permissionManager');
const { Logger } = require('../utils/logger');
const authRouter = require('./auth');

const router = express.Router();
const cryptoManager = new CryptoManager();
const permissionManager = new PermissionManager();
const logger = new Logger();

// In-memory post store (in production, use a proper database)
const posts = new Map();
const comments = new Map();

// Create new post
router.post('/', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, content, mediaIds = [], isPrivate = false } = req.body;
    
    if (!networkId || !content) {
      return res.status(400).json({ error: 'Network ID and content required' });
    }
    
    // Check permissions
    const canCreate = permissionManager.canPerformAction(networkId, req.user.userId, 'createPost');
    if (!canCreate) {
      return res.status(403).json({ error: 'Insufficient permissions to create posts' });
    }
    
    const postId = cryptoManager.generateSecureToken();
    const post = {
      id: postId,
      networkId,
      authorId: req.user.userId,
      authorUsername: req.user.username,
      content,
      mediaIds,
      isPrivate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      likes: new Set(),
      shares: new Set(),
      commentCount: 0
    };
    
    posts.set(postId, post);
    
    logger.info('Post created:', { postId, networkId, authorId: req.user.userId });
    
    res.status(201).json({
      id: post.id,
      networkId: post.networkId,
      authorId: post.authorId,
      authorUsername: post.authorUsername,
      content: post.content,
      mediaIds: post.mediaIds,
      isPrivate: post.isPrivate,
      createdAt: post.createdAt,
      likes: post.likes.size,
      shares: post.shares.size,
      commentCount: post.commentCount
    });
  } catch (error) {
    logger.error('Post creation failed:', { error: error.message });
    res.status(500).json({ error: 'Post creation failed' });
  }
});

// Get posts for network
router.get('/network/:networkId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    // Check view permissions
    const canView = permissionManager.canPerformAction(networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view posts' });
    }
    
    const networkPosts = Array.from(posts.values())
      .filter(post => {
        if (post.networkId !== networkId) return false;
        if (post.isPrivate && post.authorId !== req.user.userId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(post => ({
        id: post.id,
        networkId: post.networkId,
        authorId: post.authorId,
        authorUsername: post.authorUsername,
        content: post.content,
        mediaIds: post.mediaIds,
        isPrivate: post.isPrivate,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likes: post.likes.size,
        shares: post.shares.size,
        commentCount: post.commentCount,
        isLiked: post.likes.has(req.user.userId),
        isShared: post.shares.has(req.user.userId)
      }));
    
    res.json({
      posts: networkPosts,
      hasMore: networkPosts.length === parseInt(limit)
    });
  } catch (error) {
    logger.error('Failed to fetch posts:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
router.get('/:postId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check view permissions
    const canView = permissionManager.canPerformAction(post.networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view post' });
    }
    
    // Check if user can see private post
    if (post.isPrivate && post.authorId !== req.user.userId) {
      return res.status(403).json({ error: 'Cannot view private post' });
    }
    
    res.json({
      id: post.id,
      networkId: post.networkId,
      authorId: post.authorId,
      authorUsername: post.authorUsername,
      content: post.content,
      mediaIds: post.mediaIds,
      isPrivate: post.isPrivate,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likes: post.likes.size,
      shares: post.shares.size,
      commentCount: post.commentCount,
      isLiked: post.likes.has(req.user.userId),
      isShared: post.shares.has(req.user.userId)
    });
  } catch (error) {
    logger.error('Failed to fetch post:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Update post
router.put('/:postId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, mediaIds, isPrivate } = req.body;
    
    const post = posts.get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check edit permissions
    const canEdit = permissionManager.canPerformAction(post.networkId, req.user.userId, 'edit', post.authorId);
    if (!canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions to edit post' });
    }
    
    // Update post
    if (content !== undefined) post.content = content;
    if (mediaIds !== undefined) post.mediaIds = mediaIds;
    if (isPrivate !== undefined) post.isPrivate = isPrivate;
    post.updatedAt = Date.now();
    
    posts.set(postId, post);
    
    logger.info('Post updated:', { postId, authorId: req.user.userId });
    
    res.json({
      id: post.id,
      content: post.content,
      mediaIds: post.mediaIds,
      isPrivate: post.isPrivate,
      updatedAt: post.updatedAt
    });
  } catch (error) {
    logger.error('Post update failed:', { error: error.message });
    res.status(500).json({ error: 'Post update failed' });
  }
});

// Delete post
router.delete('/:postId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check delete permissions
    const canDelete = permissionManager.canPerformAction(post.networkId, req.user.userId, 'delete', post.authorId);
    if (!canDelete) {
      return res.status(403).json({ error: 'Insufficient permissions to delete post' });
    }
    
    // Delete associated comments
    const postComments = Array.from(comments.entries())
      .filter(([id, comment]) => comment.postId === postId);
    
    for (const [commentId] of postComments) {
      comments.delete(commentId);
    }
    
    posts.delete(postId);
    
    logger.info('Post deleted:', { postId, authorId: req.user.userId });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    logger.error('Post deletion failed:', { error: error.message });
    res.status(500).json({ error: 'Post deletion failed' });
  }
});

// Like/unlike post
router.post('/:postId/like', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check view permissions
    const canView = permissionManager.canPerformAction(post.networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const isLiked = post.likes.has(req.user.userId);
    
    if (isLiked) {
      post.likes.delete(req.user.userId);
    } else {
      post.likes.add(req.user.userId);
    }
    
    posts.set(postId, post);
    
    res.json({
      isLiked: !isLiked,
      likesCount: post.likes.size
    });
  } catch (error) {
    logger.error('Like toggle failed:', { error: error.message });
    res.status(500).json({ error: 'Like toggle failed' });
  }
});

// Share/unshare post
router.post('/:postId/share', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check share permissions
    const canShare = permissionManager.canPerformAction(post.networkId, req.user.userId, 'share');
    if (!canShare) {
      return res.status(403).json({ error: 'Insufficient permissions to share' });
    }
    
    const isShared = post.shares.has(req.user.userId);
    
    if (isShared) {
      post.shares.delete(req.user.userId);
    } else {
      post.shares.add(req.user.userId);
    }
    
    posts.set(postId, post);
    
    res.json({
      isShared: !isShared,
      sharesCount: post.shares.size
    });
  } catch (error) {
    logger.error('Share toggle failed:', { error: error.message });
    res.status(500).json({ error: 'Share toggle failed' });
  }
});

// Add comment
router.post('/:postId/comments', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Comment content required' });
    }
    
    const post = posts.get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check comment permissions
    const canComment = permissionManager.canPerformAction(post.networkId, req.user.userId, 'comment');
    if (!canComment) {
      return res.status(403).json({ error: 'Insufficient permissions to comment' });
    }
    
    const commentId = cryptoManager.generateSecureToken();
    const comment = {
      id: commentId,
      postId,
      authorId: req.user.userId,
      authorUsername: req.user.username,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    comments.set(commentId, comment);
    post.commentCount++;
    posts.set(postId, post);
    
    logger.info('Comment added:', { commentId, postId, authorId: req.user.userId });
    
    res.status(201).json({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorUsername: comment.authorUsername,
      content: comment.content,
      createdAt: comment.createdAt
    });
  } catch (error) {
    logger.error('Comment creation failed:', { error: error.message });
    res.status(500).json({ error: 'Comment creation failed' });
  }
});

// Get comments for post
router.get('/:postId/comments', authRouter.authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const post = posts.get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check view permissions
    const canView = permissionManager.canPerformAction(post.networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view comments' });
    }
    
    const postComments = Array.from(comments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(comment => ({
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        authorUsername: comment.authorUsername,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      }));
    
    res.json({
      comments: postComments,
      hasMore: postComments.length === parseInt(limit)
    });
  } catch (error) {
    logger.error('Failed to fetch comments:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete comment
router.delete('/comments/:commentId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = comments.get(commentId);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const post = posts.get(comment.postId);
    if (!post) {
      return res.status(404).json({ error: 'Associated post not found' });
    }
    
    // Check delete permissions
    const canDelete = permissionManager.canPerformAction(post.networkId, req.user.userId, 'delete', comment.authorId);
    if (!canDelete) {
      return res.status(403).json({ error: 'Insufficient permissions to delete comment' });
    }
    
    comments.delete(commentId);
    post.commentCount = Math.max(0, post.commentCount - 1);
    posts.set(post.id, post);
    
    logger.info('Comment deleted:', { commentId, authorId: req.user.userId });
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Comment deletion failed:', { error: error.message });
    res.status(500).json({ error: 'Comment deletion failed' });
  }
});

module.exports = router;
