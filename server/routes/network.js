const express = require('express');
const QRCode = require('qrcode');
const { NetworkManager } = require('../utils/networkManager');
const { CryptoManager } = require('../utils/cryptoManager');
const { PermissionManager } = require('../utils/permissionManager');
const { Logger } = require('../utils/logger');
const authRouter = require('./auth');

const router = express.Router();
const networkManager = new NetworkManager();
const cryptoManager = new CryptoManager();
const permissionManager = new PermissionManager();
const logger = new Logger();

// Create new network
router.post('/create', authRouter.authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate = true, maxPeers = 100 } = req.body;
    
    // Get user's public key (in a real app, this would come from user profile)
    const userPublicKey = req.body.publicKey;
    if (!userPublicKey) {
      return res.status(400).json({ error: 'Public key required' });
    }
    
    const networkId = networkManager.createNetwork(req.user.userId, userPublicKey);
    
    // Set creator permissions
    permissionManager.setUserPermissions(networkId, req.user.userId, 
      permissionManager.getDefaultPermissions('owner')
    );
    
    // Update network settings
    await networkManager.updateNetworkSettings(networkId, req.user.userId, {
      name,
      description,
      isPrivate,
      maxPeers
    });
    
    logger.network('Network created:', {
      networkId,
      creatorId: req.user.userId,
      name,
      isPrivate
    });
    
    res.status(201).json({
      networkId,
      name,
      description,
      isPrivate,
      maxPeers,
      createdAt: Date.now(),
      role: 'owner'
    });
  } catch (error) {
    logger.error('Network creation failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Network creation failed' });
  }
});

// Join network via invitation
router.post('/join', authRouter.authenticateToken, async (req, res) => {
  try {
    const { invitationCode, publicKey } = req.body;
    
    if (!invitationCode || !publicKey) {
      return res.status(400).json({ error: 'Invitation code and public key required' });
    }
    
    // Process invitation
    const invitationData = networkManager.processInvitation(invitationCode);
    const networkId = invitationData.networkId;
    
    // Join network
    const peer = await networkManager.joinNetwork(networkId, req.user.userId, publicKey);
    
    // Set user permissions based on invitation
    const permissions = invitationData.permissions || permissionManager.getDefaultPermissions('member');
    permissionManager.setUserPermissions(networkId, req.user.userId, permissions);
    
    logger.network('User joined network:', {
      networkId,
      userId: req.user.userId,
      inviterId: invitationData.inviterId
    });
    
    res.json({
      networkId,
      joinedAt: peer.joinedAt,
      permissions: permissions,
      peers: networkManager.getNetworkPeers(networkId).length
    });
  } catch (error) {
    logger.error('Network join failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to join network' });
    }
  }
});

// Leave network
router.post('/:networkId/leave', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    const success = networkManager.leaveNetwork(networkId, req.user.userId);
    
    if (success) {
      logger.network('User left network:', {
        networkId,
        userId: req.user.userId
      });
      res.json({ message: 'Left network successfully' });
    } else {
      res.status(404).json({ error: 'Network not found or user not in network' });
    }
  } catch (error) {
    logger.error('Network leave failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to leave network' });
  }
});

// Get network information
router.get('/:networkId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    // Check if user is in network
    const userPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!userPermissions.canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view network' });
    }
    
    const stats = networkManager.getNetworkStats(networkId);
    if (!stats) {
      return res.status(404).json({ error: 'Network not found' });
    }
    
    const peers = networkManager.getNetworkPeers(networkId);
    
    res.json({
      ...stats,
      peers: peers.map(peer => ({
        id: peer.id,
        isOnline: peer.isOnline,
        joinedAt: peer.joinedAt,
        lastSeen: peer.lastSeen
      })),
      userPermissions
    });
  } catch (error) {
    logger.error('Network info fetch failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch network information' });
  }
});

// Generate network invitation
router.post('/:networkId/invite', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { permissions = {}, expiresIn = 24 * 60 * 60 * 1000 } = req.body; // 24 hours default
    
    // Check invite permissions
    const canInvite = permissionManager.canPerformAction(networkId, req.user.userId, 'invite');
    if (!canInvite) {
      return res.status(403).json({ error: 'Insufficient permissions to create invitations' });
    }
    
    const invitationCode = networkManager.generateInvitation(networkId, req.user.userId, {
      ...permissions,
      expiresAt: Date.now() + expiresIn
    });
    
    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(invitationCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    logger.network('Invitation created:', {
      networkId,
      inviterId: req.user.userId,
      expiresIn
    });
    
    res.json({
      invitationCode,
      qrCode: qrCodeDataURL,
      expiresAt: Date.now() + expiresIn,
      permissions
    });
  } catch (error) {
    logger.error('Invitation creation failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Discover peers in network
router.get('/:networkId/peers', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    // Check view permissions
    const canView = permissionManager.canPerformAction(networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view peers' });
    }
    
    const peers = await networkManager.discoverPeers(networkId);
    
    res.json({
      peers: peers.map(peer => ({
        id: peer.id,
        isOnline: peer.isOnline,
        address: peer.address === 'unknown' ? null : peer.address
      }))
    });
  } catch (error) {
    logger.error('Peer discovery failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Peer discovery failed' });
  }
});

// Update network settings
router.put('/:networkId/settings', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { name, description, isPrivate, maxPeers, requireApproval } = req.body;
    
    const newSettings = {};
    if (name !== undefined) newSettings.name = name;
    if (description !== undefined) newSettings.description = description;
    if (isPrivate !== undefined) newSettings.isPrivate = isPrivate;
    if (maxPeers !== undefined) newSettings.maxPeers = maxPeers;
    if (requireApproval !== undefined) newSettings.requireApproval = requireApproval;
    
    const updatedSettings = networkManager.updateNetworkSettings(networkId, req.user.userId, newSettings);
    
    logger.network('Network settings updated:', {
      networkId,
      updatedBy: req.user.userId,
      changes: Object.keys(newSettings)
    });
    
    res.json({
      message: 'Network settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    logger.error('Network settings update failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    
    if (error.message.includes('Only network creator')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update network settings' });
    }
  }
});

// Get user's networks
router.get('/', authRouter.authenticateToken, async (req, res) => {
  try {
    const userNetworks = [];
    
    // This is a simplified implementation
    // In a real app, you'd have a proper database query
    for (const [networkId, network] of networkManager.networks.entries()) {
      if (network.peers.has(req.user.userId)) {
        const permissions = permissionManager.getUserPermissions(networkId, req.user.userId);
        const stats = networkManager.getNetworkStats(networkId);
        
        userNetworks.push({
          networkId,
          ...stats,
          role: permissions.role || 'member',
          permissions
        });
      }
    }
    
    res.json({
      networks: userNetworks
    });
  } catch (error) {
    logger.error('User networks fetch failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch user networks' });
  }
});

// Remove user from network (admin only)
router.delete('/:networkId/users/:targetUserId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId, targetUserId } = req.params;
    
    // Check admin permissions
    const adminPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    if (!adminPermissions.canManagePermissions && !adminPermissions.canModerate) {
      return res.status(403).json({ error: 'Insufficient permissions to remove users' });
    }
    
    // Cannot remove network creator
    const stats = networkManager.getNetworkStats(networkId);
    if (stats && stats.creatorId === targetUserId) {
      return res.status(400).json({ error: 'Cannot remove network creator' });
    }
    
    const success = networkManager.leaveNetwork(networkId, targetUserId);
    
    if (success) {
      // Revoke permissions
      permissionManager.revokePermissions(networkId, req.user.userId, targetUserId);
      
      logger.network('User removed from network:', {
        networkId,
        removedUserId: targetUserId,
        removedBy: req.user.userId
      });
      
      res.json({ message: 'User removed from network successfully' });
    } else {
      res.status(404).json({ error: 'User not found in network' });
    }
  } catch (error) {
    logger.error('User removal failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      targetUserId: req.params.targetUserId,
      adminId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to remove user from network' });
  }
});

// Network health check
router.get('/:networkId/health', authRouter.authenticateToken, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    const canView = permissionManager.canPerformAction(networkId, req.user.userId, 'view');
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const stats = networkManager.getNetworkStats(networkId);
    if (!stats) {
      return res.status(404).json({ error: 'Network not found' });
    }
    
    const peers = await networkManager.discoverPeers(networkId);
    const onlinePeers = peers.filter(peer => peer.isOnline);
    
    const health = {
      networkId,
      isHealthy: onlinePeers.length > 0,
      totalPeers: peers.length,
      onlinePeers: onlinePeers.length,
      uptime: Date.now() - stats.createdAt,
      lastCheck: Date.now()
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Network health check failed:', { 
      error: error.message,
      networkId: req.params.networkId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Network health check failed' });
  }
});

module.exports = router;
