class PermissionManager {
  constructor() {
    this.permissions = new Map();
    this.defaultPermissions = {
      canView: true,
      canComment: false,
      canShare: false,
      canUpload: false,
      canCreatePosts: false,
      canModerate: false,
      canInvite: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mp3', 'text/plain']
    };
    
    this.permissionLevels = {
      VISITOR: 'visitor',
      MEMBER: 'member',
      MODERATOR: 'moderator',
      ADMIN: 'admin',
      OWNER: 'owner'
    };
  }

  // Set user permissions for a network
  setUserPermissions(networkId, userId, permissions) {
    const key = `${networkId}:${userId}`;
    const userPermissions = {
      ...this.defaultPermissions,
      ...permissions,
      grantedAt: Date.now(),
      grantedBy: permissions.grantedBy || 'system'
    };
    
    this.permissions.set(key, userPermissions);
    return userPermissions;
  }

  // Get user permissions
  getUserPermissions(networkId, userId) {
    const key = `${networkId}:${userId}`;
    return this.permissions.get(key) || this.getDefaultPermissions('visitor');
  }

  // Get default permissions for a role
  getDefaultPermissions(role) {
    switch (role) {
      case this.permissionLevels.OWNER:
        return {
          ...this.defaultPermissions,
          canView: true,
          canComment: true,
          canShare: true,
          canUpload: true,
          canCreatePosts: true,
          canModerate: true,
          canInvite: true,
          canManagePermissions: true,
          canDeleteAny: true,
          maxFileSize: 100 * 1024 * 1024 // 100MB
        };
        
      case this.permissionLevels.ADMIN:
        return {
          ...this.defaultPermissions,
          canView: true,
          canComment: true,
          canShare: true,
          canUpload: true,
          canCreatePosts: true,
          canModerate: true,
          canInvite: true,
          canManagePermissions: false,
          canDeleteAny: false,
          maxFileSize: 50 * 1024 * 1024 // 50MB
        };
        
      case this.permissionLevels.MODERATOR:
        return {
          ...this.defaultPermissions,
          canView: true,
          canComment: true,
          canShare: true,
          canUpload: true,
          canCreatePosts: true,
          canModerate: true,
          canInvite: false,
          maxFileSize: 25 * 1024 * 1024 // 25MB
        };
        
      case this.permissionLevels.MEMBER:
        return {
          ...this.defaultPermissions,
          canView: true,
          canComment: true,
          canShare: true,
          canUpload: true,
          canCreatePosts: true,
          canModerate: false,
          canInvite: false,
          maxFileSize: 10 * 1024 * 1024 // 10MB
        };
        
      case this.permissionLevels.VISITOR:
      default:
        return {
          ...this.defaultPermissions,
          canView: true,
          canComment: false,
          canShare: false,
          canUpload: false,
          canCreatePosts: false,
          canModerate: false,
          canInvite: false,
          maxFileSize: 0
        };
    }
  }

  // Check if user has specific permission
  hasPermission(networkId, userId, permission) {
    const permissions = this.getUserPermissions(networkId, userId);
    return permissions[permission] === true;
  }

  // Check if user can perform action on content
  canPerformAction(networkId, userId, action, contentOwnerId = null) {
    const permissions = this.getUserPermissions(networkId, userId);
    
    switch (action) {
      case 'view':
        return permissions.canView;
        
      case 'comment':
        return permissions.canComment;
        
      case 'share':
        return permissions.canShare;
        
      case 'upload':
        return permissions.canUpload;
        
      case 'createPost':
        return permissions.canCreatePosts;
        
      case 'moderate':
        return permissions.canModerate;
        
      case 'invite':
        return permissions.canInvite;
        
      case 'delete':
        // Can delete own content or if has delete permission
        return userId === contentOwnerId || permissions.canDeleteAny;
        
      case 'edit':
        // Can edit own content or if moderator/admin
        return userId === contentOwnerId || permissions.canModerate;
        
      default:
        return false;
    }
  }

  // Validate file upload permissions
  validateFileUpload(networkId, userId, fileSize, fileType) {
    const permissions = this.getUserPermissions(networkId, userId);
    
    if (!permissions.canUpload) {
      throw new Error('User does not have upload permissions');
    }
    
    if (fileSize > permissions.maxFileSize) {
      throw new Error(`File size exceeds limit of ${permissions.maxFileSize} bytes`);
    }
    
    if (!permissions.allowedFileTypes.includes(fileType)) {
      throw new Error(`File type ${fileType} is not allowed`);
    }
    
    return true;
  }

  // Create permission grant token
  createPermissionGrant(networkId, granterId, targetUserId, permissions, expiresIn = null) {
    const granterPermissions = this.getUserPermissions(networkId, granterId);
    
    // Check if granter can manage permissions
    if (!granterPermissions.canManagePermissions && !granterPermissions.canModerate) {
      throw new Error('Insufficient permissions to grant access');
    }
    
    const grant = {
      networkId,
      granterId,
      targetUserId,
      permissions,
      createdAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : null,
      isActive: true
    };
    
    return grant;
  }

  // Apply permission grant
  applyPermissionGrant(grant) {
    if (grant.expiresAt && Date.now() > grant.expiresAt) {
      throw new Error('Permission grant has expired');
    }
    
    if (!grant.isActive) {
      throw new Error('Permission grant is not active');
    }
    
    return this.setUserPermissions(grant.networkId, grant.targetUserId, {
      ...grant.permissions,
      grantedBy: grant.granterId
    });
  }

  // Revoke user permissions
  revokePermissions(networkId, revokerId, targetUserId) {
    const revokerPermissions = this.getUserPermissions(networkId, revokerId);
    
    if (!revokerPermissions.canManagePermissions) {
      throw new Error('Insufficient permissions to revoke access');
    }
    
    const key = `${networkId}:${targetUserId}`;
    this.permissions.delete(key);
    
    return true;
  }

  // Get all permissions for a network
  getNetworkPermissions(networkId) {
    const networkPermissions = new Map();
    
    for (const [key, permissions] of this.permissions.entries()) {
      if (key.startsWith(`${networkId}:`)) {
        const userId = key.split(':')[1];
        networkPermissions.set(userId, permissions);
      }
    }
    
    return networkPermissions;
  }

  // Update user role
  updateUserRole(networkId, adminId, targetUserId, newRole) {
    const adminPermissions = this.getUserPermissions(networkId, adminId);
    
    if (!adminPermissions.canManagePermissions) {
      throw new Error('Insufficient permissions to change user roles');
    }
    
    const newPermissions = this.getDefaultPermissions(newRole);
    return this.setUserPermissions(networkId, targetUserId, {
      ...newPermissions,
      role: newRole,
      grantedBy: adminId
    });
  }

  // Create temporary access token
  createTemporaryAccess(networkId, granterId, permissions, duration = 3600000) {
    const granterPermissions = this.getUserPermissions(networkId, granterId);
    
    if (!granterPermissions.canInvite) {
      throw new Error('Insufficient permissions to create temporary access');
    }
    
    const token = {
      networkId,
      granterId,
      permissions,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
      isTemporary: true,
      maxUses: 1,
      usedCount: 0
    };
    
    return token;
  }

  // Validate temporary access token
  validateTemporaryAccess(token) {
    if (Date.now() > token.expiresAt) {
      throw new Error('Temporary access token has expired');
    }
    
    if (token.usedCount >= token.maxUses) {
      throw new Error('Temporary access token has been exhausted');
    }
    
    return true;
  }

  // Log permission change
  logPermissionChange(networkId, adminId, targetUserId, oldPermissions, newPermissions) {
    const logEntry = {
      networkId,
      adminId,
      targetUserId,
      oldPermissions,
      newPermissions,
      timestamp: Date.now(),
      action: 'permission_change'
    };
    
    // In a real implementation, this would be stored in a database
    console.log('Permission change logged:', logEntry);
    return logEntry;
  }

  // Check rate limits for actions
  checkRateLimit(networkId, userId, action) {
    const permissions = this.getUserPermissions(networkId, userId);
    const key = `${networkId}:${userId}:${action}`;
    
    // Rate limiting logic would be implemented here
    // For now, just return true
    return true;
  }

  // Clean up expired permissions
  cleanupExpiredPermissions() {
    const now = Date.now();
    
    for (const [key, permissions] of this.permissions.entries()) {
      if (permissions.expiresAt && now > permissions.expiresAt) {
        this.permissions.delete(key);
      }
    }
  }
}

module.exports = { PermissionManager };
