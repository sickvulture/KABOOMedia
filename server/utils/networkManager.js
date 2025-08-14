const { v4: uuidv4 } = require('uuid');
const { CryptoManager } = require('./cryptoManager');

class NetworkManager {
  constructor() {
    this.networks = new Map();
    this.peers = new Map();
    this.cryptoManager = new CryptoManager();
  }

  // Create a new network
  createNetwork(creatorId, creatorPublicKey) {
    const networkId = uuidv4();
    const network = {
      id: networkId,
      creatorId,
      createdAt: Date.now(),
      peers: new Map(),
      settings: {
        isPrivate: true,
        requireApproval: true,
        maxPeers: 100
      }
    };

    this.networks.set(networkId, network);
    this.joinNetwork(networkId, creatorId, creatorPublicKey);
    
    return networkId;
  }

  // Join an existing network
  async joinNetwork(networkId, userId, publicKey, socket = null) {
    if (!this.networks.has(networkId)) {
      throw new Error('Network not found');
    }

    const network = this.networks.get(networkId);
    
    // Check if network is full
    if (network.peers.size >= network.settings.maxPeers) {
      throw new Error('Network is full');
    }

    const peer = {
      id: userId,
      publicKey,
      joinedAt: Date.now(),
      isOnline: true,
      socket: socket,
      lastSeen: Date.now(),
      address: socket?.handshake?.address || 'unknown'
    };

    network.peers.set(userId, peer);
    this.peers.set(userId, { networkId, peer });

    // Notify other peers
    if (socket) {
      this.broadcastToNetwork(networkId, 'peer-joined', {
        peerId: userId,
        publicKey: publicKey
      }, userId);
    }

    return peer;
  }

  // Leave a network
  leaveNetwork(networkId, userId) {
    if (!this.networks.has(networkId)) {
      return false;
    }

    const network = this.networks.get(networkId);
    const peer = network.peers.get(userId);
    
    if (peer) {
      network.peers.delete(userId);
      this.peers.delete(userId);
      
      // Notify other peers
      this.broadcastToNetwork(networkId, 'peer-left', {
        peerId: userId
      }, userId);

      // If creator left and network is empty, remove network
      if (network.creatorId === userId && network.peers.size === 0) {
        this.networks.delete(networkId);
      }
      
      return true;
    }
    
    return false;
  }

  // Remove peer from all networks (for disconnection)
  removeFromAllNetworks(socketId) {
    for (const [userId, data] of this.peers.entries()) {
      if (data.peer.socket?.id === socketId) {
        this.leaveNetwork(data.networkId, userId);
        break;
      }
    }
  }

  // Get network peers
  getNetworkPeers(networkId) {
    const network = this.networks.get(networkId);
    if (!network) return [];

    return Array.from(network.peers.values()).map(peer => ({
      id: peer.id,
      publicKey: peer.publicKey,
      isOnline: peer.isOnline,
      joinedAt: peer.joinedAt,
      lastSeen: peer.lastSeen
    }));
  }

  // Discover peers in network
  async discoverPeers(networkId) {
    const network = this.networks.get(networkId);
    if (!network) return [];

    const peers = [];
    for (const [peerId, peer] of network.peers.entries()) {
      // Ping peer to check if still online
      if (peer.socket && peer.socket.connected) {
        peer.isOnline = true;
        peer.lastSeen = Date.now();
        peers.push({
          id: peerId,
          publicKey: peer.publicKey,
          isOnline: true,
          address: peer.address
        });
      } else {
        peer.isOnline = false;
      }
    }

    return peers;
  }

  // Broadcast message to network
  broadcastToNetwork(networkId, event, data, excludeUserId = null) {
    const network = this.networks.get(networkId);
    if (!network) return;

    for (const [peerId, peer] of network.peers.entries()) {
      if (peerId !== excludeUserId && peer.socket && peer.socket.connected) {
        peer.socket.emit(event, data);
      }
    }
  }

  // Send direct message to peer
  sendToPeer(networkId, fromUserId, toUserId, encryptedMessage) {
    const network = this.networks.get(networkId);
    if (!network) return false;

    const toPeer = network.peers.get(toUserId);
    const fromPeer = network.peers.get(fromUserId);
    
    if (toPeer && fromPeer && toPeer.socket && toPeer.socket.connected) {
      toPeer.socket.emit('direct-message', {
        from: fromUserId,
        fromPublicKey: fromPeer.publicKey,
        message: encryptedMessage,
        timestamp: Date.now()
      });
      return true;
    }
    
    return false;
  }

  // Generate network invitation
  generateInvitation(networkId, inviterId, permissions = {}) {
    const network = this.networks.get(networkId);
    if (!network) throw new Error('Network not found');

    const inviter = network.peers.get(inviterId);
    if (!inviter) throw new Error('Inviter not in network');

    const invitationData = {
      networkId,
      inviterId,
      inviterPublicKey: inviter.publicKey,
      permissions,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      invitationId: uuidv4()
    };

    return this.cryptoManager.generateSecureQRData(
      invitationData.networkId,
      invitationData.inviterPublicKey,
      invitationData
    );
  }

  // Validate and process invitation
  processInvitation(qrCode) {
    try {
      const invitationData = this.cryptoManager.decryptQRData(qrCode);
      
      // Check expiration
      if (invitationData.expiresAt && Date.now() > invitationData.expiresAt) {
        throw new Error('Invitation expired');
      }

      // Validate network exists
      if (!this.networks.has(invitationData.networkId)) {
        throw new Error('Network no longer exists');
      }

      return invitationData;
    } catch (error) {
      throw new Error('Invalid invitation: ' + error.message);
    }
  }

  // Get network statistics
  getNetworkStats(networkId) {
    const network = this.networks.get(networkId);
    if (!network) return null;

    const onlinePeers = Array.from(network.peers.values())
      .filter(peer => peer.isOnline).length;

    return {
      id: networkId,
      totalPeers: network.peers.size,
      onlinePeers,
      createdAt: network.createdAt,
      settings: network.settings
    };
  }

  // Update network settings
  updateNetworkSettings(networkId, userId, newSettings) {
    const network = this.networks.get(networkId);
    if (!network) throw new Error('Network not found');

    // Only creator can update settings
    if (network.creatorId !== userId) {
      throw new Error('Only network creator can update settings');
    }

    network.settings = { ...network.settings, ...newSettings };
    
    // Notify all peers
    this.broadcastToNetwork(networkId, 'network-settings-updated', {
      settings: network.settings
    });

    return network.settings;
  }

  // Cleanup inactive networks
  cleanupInactiveNetworks() {
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [networkId, network] of this.networks.entries()) {
      const hasActivePeers = Array.from(network.peers.values())
        .some(peer => (now - peer.lastSeen) < inactiveThreshold);

      if (!hasActivePeers) {
        this.networks.delete(networkId);
      }
    }
  }
}

module.exports = { NetworkManager };
