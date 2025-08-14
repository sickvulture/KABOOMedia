const express = require('express');
const { PermissionManager } = require('../utils/permissionManager');
const { Logger } = require('../utils/logger');
const authRouter = require('./auth');

const router = express.Router();
const permissionManager = new PermissionManager();
const logger = new Logger();

// Get user permissions for network
router.get('/:networkId/user/:userId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, userId } = req.params;
    
    // Check if requester can view permissions
    const requesterPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!requesterPermissions.canView && req.user.userId !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions to view user permissions' });
    }
    
    const permissions = permissionManager.getUserPermissions(networkId, userId);
    
    res.json({
      networkId,
      userId,
      permissions
    });
  } catch (error) {
    logger.error('Permission fetch failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.params.userId,
      requesterId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update user permissions (admin only)
router.put('/:networkId/user/:userId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, userId } = req.params;
    const { permissions } = req.body;
    
    if (!permissions) {
      return res.status(400).json({ error: 'Permissions object required' });
    }
    
    // Check if requester can manage permissions
    const requesterPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!requesterPermissions.canManagePermissions) {
      return res.status(403).json({ error: 'Insufficient permissions to update user permissions' });
    }
    
    // Cannot modify own permissions
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot modify your own permissions' });
    }
    
    const updatedPermissions = permissionManager.setUserPermissions(networkId, userId, {
      ...permissions,
      grantedBy: req.user.userId
    });
    
    logger.info('User permissions updated:', {
      networkId,
      targetUserId: userId,
      updatedBy: req.user.userId,
      newPermissions: Object.keys(permissions)
    });
    
    res.json({
      message: 'Permissions updated successfully',
      permissions: updatedPermissions
    });
  } catch (error) {
    logger.error('Permission update failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.params.userId,
      requesterId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Update user role
router.put('/:networkId/user/:userId/role', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, userId } = req.params;
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: 'Role required' });
    }
    
    const validRoles = Object.values(permissionManager.permissionLevels);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if requester can manage permissions
    const requesterPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!requesterPermissions.canManagePermissions) {
      return res.status(403).json({ error: 'Insufficient permissions to change user roles' });
    }
    
    // Cannot change own role
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    // Cannot assign owner role
    if (role === permissionManager.permissionLevels.OWNER) {
      return res.status(400).json({ error: 'Cannot assign owner role' });
    }
    
    const updatedPermissions = permissionManager.updateUserRole(networkId, req.user.userId, userId, role);
    
    logger.info('User role updated:', {
      networkId,
      targetUserId: userId,
      updatedBy: req.user.userId,
      newRole: role
    });
    
    res.json({
      message: 'Role updated successfully',
      role,
      permissions: updatedPermissions
    });
  } catch (error) {
    logger.error('Role update failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.params.userId,
      requesterId: req.user.userId
    });
    
    if (error.message.includes('Insufficient permissions')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
});

// Revoke user permissions
router.delete('/:networkId/user/:userId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, userId } = req.params;
    
    // Check if requester can manage permissions
    const requesterPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!requesterPermissions.canManagePermissions) {
      return res.status(403).json({ error: 'Insufficient permissions to revoke access' });
    }
    
    // Cannot revoke own permissions
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot revoke your own permissions' });
    }
    
    const success = permissionManager.revokePermissions(networkId, req.user.userId, userId);
    
    if (success) {
      logger.info('User permissions revoked:', {
        networkId,
        targetUserId: userId,
        revokedBy: req.user.userId
      });
      
      res.json({ message: 'Permissions revoked successfully' });
    } else {
      res.status(404).json({ error: 'User permissions not found' });
    }
  } catch (error) {
    logger.error('Permission revocation failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.params.userId,
      requesterId: req.user.userId
    });
    
    if (error.message.includes('Insufficient permissions')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to revoke permissions' });
    }
  }
});

// Create temporary access grant
router.post('/:networkId/temporary-access', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { permissions, duration = 3600000 } = req.body; // 1 hour default
    
    if (!permissions) {
      return res.status(400).json({ error: 'Permissions required' });
    }
    
    const token = permissionManager.createTemporaryAccess(
      networkId, 
      req.user.userId, 
      permissions, 
      duration
    );
    
    logger.info('Temporary access created:', {
      networkId,
      granterId: req.user.userId,
      duration,
      permissions: Object.keys(permissions)
    });
    
    res.json({
      token,
      message: 'Temporary access token created successfully'
    });
  } catch (error) {
    logger.error('Temporary access creation failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      requesterId: req.user.userId
    });
    
    if (error.message.includes('Insufficient permissions')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create temporary access' });
    }
  }
});

// Validate temporary access token
router.post('/validate-temporary', authRouter.authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const isValid = permissionManager.validateTemporaryAccess(token);
    
    if (isValid) {
      res.json({
        valid: true,
        token,
        message: 'Token is valid'
      });
    } else {
      res.status(400).json({
        valid: false,
        message: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    logger.error('Temporary access validation failed:', { 
      error: error.message,
      requesterId: req.user.userId
    });
    
    res.status(400).json({
      valid: false,
      error: error.message
    });
  }
});

// Get all permissions for a network (admin only)
router.get('/:networkId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    // Check if requester can view all permissions
    const requesterPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!requesterPermissions.canManagePermissions && !requesterPermissions.canModerate) {
      return res.status(403).json({ error: 'Insufficient permissions to view network permissions' });
    }
    
    const networkPermissions = permissionManager.getNetworkPermissions(networkId);
    
    // Convert Map to object for JSON response
    const permissionsObject = {};
    for (const [userId, permissions] of networkPermissions.entries()) {
      permissionsObject[userId] = {
        ...permissions,
        // Remove sensitive fields
        grantedBy: permissions.grantedBy,
        grantedAt: permissions.grantedAt
      };
    }
    
    res.json({
      networkId,
      permissions: permissionsObject,
      totalUsers: networkPermissions.size
    });
  } catch (error) {
    logger.error('Network permissions fetch failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      requesterId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch network permissions' });
  }
});

// Check specific permission
router.get('/:networkId/check/:action', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, action } = req.params;
    const { targetUserId } = req.query;
    
    const hasPermission = permissionManager.canPerformAction(
      networkId, 
      req.user.userId, 
      action,
      targetUserId
    );
    
    res.json({
      networkId,
      userId: req.user.userId,
      action,
      hasPermission,
      targetUserId: targetUserId || null
    });
  } catch (error) {
    logger.error('Permission check failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      action: req.params.action,
      requesterId: req.user.userId
    });
    res.status(500).json({ error: 'Permission check failed' });
  }
});

// Get available permission levels
router.get('/levels', async (req, res) => {
  try {
    const levels = {};
    
    for (const [key, value] of Object.entries(permissionManager.permissionLevels)) {
      levels[key] = {
        name: value,
        permissions: permissionManager.getDefaultPermissions(value)
      };
    }
    
    res.json({
      levels,
      description: 'Available permission levels and their default permissions'
    });
  } catch (error) {
    logger.error('Permission levels fetch failed:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch permission levels' });
  }
});

module.exports = router;
