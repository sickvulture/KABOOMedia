const crypto = require('crypto');
const { EventEmitter } = require('events');
const dgram = require('dgram');
const WebSocket = require('ws');
const QRCodeGenerator = require('./qr-generator');

class P2PNetworkManager extends EventEmitter {
    constructor(nodeConfig, db, encryptionKey) {
        super();
        this.nodeConfig = nodeConfig;
        this.db = db;
        this.encryptionKey = encryptionKey;
        
        // Network state
        this.peers = new Map(); // nodeId -> PeerConnection
        this.discoverySocket = null;
        this.wsServer = null;
        this.isDiscoveryEnabled = nodeConfig.discovery?.mdns_enabled || false;
        
        // Discovery settings
        this.discoveryPort = 5353; // mDNS-like port
        this.broadcastInterval = 30000; // 30 seconds
        this.discoveryInterval = null;
        
        // Connection settings
        this.maxConnections = 50;
        this.connectionTimeout = 10000; // 10 seconds
        
        console.log('🌐 P2P Network Manager initialized');
    }

    async initialize() {
        try {
            // Start WebSocket server for incoming connections
            await this.startWebSocketServer();
            
            // Start discovery if enabled
            if (this.isDiscoveryEnabled) {
                await this.startDiscovery();
            }
            
            // Load existing connections from database
            await this.loadExistingConnections();
            
            console.log('✅ P2P Network Manager started successfully');
            this.emit('networkReady');
        } catch (error) {
            console.error('❌ Failed to initialize P2P network:', error);
            throw error;
        }
    }

    // WebSocket Server for incoming connections
    async startWebSocketServer() {
        const port = this.nodeConfig.port + 1; // Use port+1 for P2P
        
        this.wsServer = new WebSocket.Server({ 
            port: port,
            verifyClient: (info) => {
                // Basic verification - could be enhanced
                return true;
            }
        });

        this.wsServer.on('connection', (ws, req) => {
            console.log('📞 Incoming P2P connection from:', req.connection.remoteAddress);
            this.handleIncomingConnection(ws, req);
        });

        this.wsServer.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        console.log(`🔗 P2P WebSocket server listening on port ${port}`);
    }

    // Network Discovery using UDP broadcast
    async startDiscovery() {
        this.discoverySocket = dgram.createSocket('udp4');
        
        this.discoverySocket.on('message', (msg, rinfo) => {
            this.handleDiscoveryMessage(msg, rinfo);
        });

        this.discoverySocket.on('error', (error) => {
            console.error('Discovery socket error:', error);
        });

        // Bind to discovery port
        this.discoverySocket.bind(this.discoveryPort, () => {
            this.discoverySocket.setBroadcast(true);
            console.log(`🔍 Network discovery listening on port ${this.discoveryPort}`);
        });

        // Start periodic announcements
        this.startPeriodicAnnouncements();
    }

    startPeriodicAnnouncements() {
        this.discoveryInterval = setInterval(() => {
            this.broadcastPresence();
        }, this.broadcastInterval);

        // Send initial announcement
        this.broadcastPresence();
    }

    broadcastPresence() {
        const announcement = {
            type: 'presence',
            nodeId: this.nodeConfig.node_id,
            displayName: this.nodeConfig.display_name,
            publicKey: this.getPublicKey(),
            port: this.nodeConfig.port + 1, // P2P port
            timestamp: Date.now(),
            version: this.nodeConfig.version
        };

        const message = Buffer.from(JSON.stringify(announcement));
        
        // Broadcast to local network
        this.discoverySocket.send(message, 0, message.length, this.discoveryPort, '255.255.255.255', (err) => {
            if (err) {
                console.error('Failed to broadcast presence:', err);
            } else {
                console.log('📢 Broadcasted presence to local network');
            }
        });
    }

    handleDiscoveryMessage(msg, rinfo) {
        try {
            const announcement = JSON.parse(msg.toString());
            
            if (announcement.type === 'presence' && announcement.nodeId !== this.nodeConfig.node_id) {
                console.log(`🔍 Discovered peer: ${announcement.displayName} (${announcement.nodeId.substring(0, 12)}...)`);
                
                this.emit('peerDiscovered', {
                    nodeId: announcement.nodeId,
                    displayName: announcement.displayName,
                    address: rinfo.address,
                    port: announcement.port,
                    publicKey: announcement.publicKey,
                    timestamp: announcement.timestamp
                });
            }
        } catch (error) {
            console.error('Failed to parse discovery message:', error);
        }
    }

    // Connection Management
    async connectToPeer(connectionInfo) {
        const { nodeId, address, port, publicKey } = connectionInfo;
        
        if (this.peers.has(nodeId)) {
            console.log(`Already connected to peer ${nodeId}`);
            return this.peers.get(nodeId);
        }

        if (this.peers.size >= this.maxConnections) {
            throw new Error('Maximum connections reached');
        }

        try {
            console.log(`🔗 Connecting to peer ${nodeId} at ${address}:${port}`);
            
            const ws = new WebSocket(`ws://${address}:${port}`);
            const peer = new PeerConnection(nodeId, ws, publicKey, this.encryptionKey);
            
            await this.establishConnection(peer);
            
            // Store in database
            await this.storePeerConnection(connectionInfo);
            
            this.peers.set(nodeId, peer);
            this.emit('peerConnected', peer);
            
            console.log(`✅ Successfully connected to peer ${nodeId}`);
            return peer;
            
        } catch (error) {
            console.error(`❌ Failed to connect to peer ${nodeId}:`, error);
            throw error;
        }
    }

    async handleIncomingConnection(ws, req) {
        try {
            // Create temporary peer for handshake
            const tempPeer = new PeerConnection(null, ws, null, this.encryptionKey);
            
            // Perform handshake
            const handshakeResult = await this.performHandshake(tempPeer, false);
            
            if (handshakeResult.success) {
                const { nodeId, publicKey, displayName } = handshakeResult;
                
                // Check if already connected
                if (this.peers.has(nodeId)) {
                    console.log(`Duplicate connection from ${nodeId}, closing`);
                    ws.close();
                    return;
                }

                // Update peer with real info
                tempPeer.nodeId = nodeId;
                tempPeer.publicKey = publicKey;
                tempPeer.displayName = displayName;
                
                this.peers.set(nodeId, tempPeer);
                this.emit('peerConnected', tempPeer);
                
                console.log(`✅ Accepted incoming connection from ${displayName} (${nodeId.substring(0, 12)}...)`);
            } else {
                console.log('❌ Handshake failed for incoming connection');
                ws.close();
            }
        } catch (error) {
            console.error('Error handling incoming connection:', error);
            ws.close();
        }
    }

    async establishConnection(peer) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, this.connectionTimeout);

            peer.ws.on('open', async () => {
                try {
                    clearTimeout(timeout);
                    
                    // Perform handshake
                    const result = await this.performHandshake(peer, true);
                    
                    if (result.success) {
                        this.setupPeerEventHandlers(peer);
                        resolve(peer);
                    } else {
                        reject(new Error('Handshake failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            });

            peer.ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async performHandshake(peer, isInitiator) {
        return new Promise((resolve, reject) => {
            const handshakeTimeout = setTimeout(() => {
                reject(new Error('Handshake timeout'));
            }, 5000);

            if (isInitiator) {
                // Send handshake request
                const handshakeRequest = {
                    type: 'handshake_request',
                    nodeId: this.nodeConfig.node_id,
                    displayName: this.nodeConfig.display_name,
                    publicKey: this.getPublicKey(),
                    timestamp: Date.now(),
                    version: this.nodeConfig.version
                };

                peer.sendMessage(handshakeRequest);
            }

            const messageHandler = (message) => {
                try {
                    const data = JSON.parse(message);
                    
                    if (data.type === 'handshake_request' && !isInitiator) {
                        // Respond to handshake
                        const handshakeResponse = {
                            type: 'handshake_response',
                            nodeId: this.nodeConfig.node_id,
                            displayName: this.nodeConfig.display_name,
                            publicKey: this.getPublicKey(),
                            timestamp: Date.now(),
                            version: this.nodeConfig.version,
                            success: true
                        };

                        peer.sendMessage(handshakeResponse);
                        
                        // Update peer info
                        peer.nodeId = data.nodeId;
                        peer.publicKey = data.publicKey;
                        peer.displayName = data.displayName;
                        
                        clearTimeout(handshakeTimeout);
                        peer.ws.removeListener('message', messageHandler);
                        resolve({ success: true, nodeId: data.nodeId, publicKey: data.publicKey, displayName: data.displayName });
                        
                    } else if (data.type === 'handshake_response' && isInitiator) {
                        clearTimeout(handshakeTimeout);
                        peer.ws.removeListener('message', messageHandler);
                        
                        if (data.success) {
                            resolve({ success: true, nodeId: data.nodeId, publicKey: data.publicKey, displayName: data.displayName });
                        } else {
                            resolve({ success: false });
                        }
                    }
                } catch (error) {
                    console.error('Handshake message parsing error:', error);
                }
            };

            peer.ws.on('message', messageHandler);
        });
    }

    setupPeerEventHandlers(peer) {
        peer.ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handlePeerMessage(peer, data);
            } catch (error) {
                console.error('Failed to parse peer message:', error);
            }
        });

        peer.ws.on('close', () => {
            console.log(`🔌 Peer ${peer.nodeId} disconnected`);
            this.peers.delete(peer.nodeId);
            this.emit('peerDisconnected', peer);
        });

        peer.ws.on('error', (error) => {
            console.error(`Peer ${peer.nodeId} error:`, error);
        });
    }

    handlePeerMessage(peer, data) {
        switch (data.type) {
            case 'content_sync':
                this.handleContentSync(peer, data);
                break;
            case 'content_request':
                this.handleContentRequest(peer, data);
                break;
            case 'status_update':
                this.handleStatusUpdate(peer, data);
                break;
            default:
                console.log(`Unknown message type from ${peer.nodeId}: ${data.type}`);
        }
    }

    // Content Synchronization
    async syncContentWithPeer(peer, content) {
        const syncMessage = {
            type: 'content_sync',
            content: content,
            timestamp: Date.now(),
            signature: this.signContent(content)
        };

        peer.sendMessage(syncMessage);
    }

    async broadcastContent(content) {
        const connectedPeers = Array.from(this.peers.values()).filter(peer => peer.isConnected());
        
        console.log(`📢 Broadcasting content to ${connectedPeers.length} peers`);
        
        for (const peer of connectedPeers) {
            try {
                await this.syncContentWithPeer(peer, content);
            } catch (error) {
                console.error(`Failed to sync content with peer ${peer.nodeId}:`, error);
            }
        }
    }

    handleContentSync(peer, data) {
        // Verify signature
        if (!this.verifyContentSignature(data.content, data.signature, peer.publicKey)) {
            console.warn(`Invalid content signature from peer ${peer.nodeId}`);
            return;
        }

        // Store received content
        this.emit('contentReceived', {
            content: data.content,
            fromPeer: peer.nodeId,
            timestamp: data.timestamp
        });
    }

    // Database operations
    async storePeerConnection(connectionInfo) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO connections 
            (node_id, display_name, permission_level, last_seen, public_key, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            connectionInfo.nodeId,
            connectionInfo.displayName || 'Unknown',
            2, // Friend level
            Date.now(),
            connectionInfo.publicKey,
            'connected'
        );
    }

    async loadExistingConnections() {
        const stmt = this.db.prepare(`
            SELECT node_id, display_name, public_key 
            FROM connections 
            WHERE status = 'connected'
        `);

        const connections = stmt.all();
        console.log(`📂 Loaded ${connections.length} existing connections from database`);
        
        // Note: In a full implementation, you'd attempt to reconnect to these peers
        // For now, we just load them as potential connection targets
    }

    // Utility methods
    getPublicKey() {
        // This should return the actual public key from the node
        // For now, returning a placeholder
        return this.nodeConfig.publicKey || 'PUBLIC_KEY_PLACEHOLDER';
    }

    signContent(content) {
        // Create signature for content verification
        const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
        return hash; // Simplified - should use actual cryptographic signing
    }

    verifyContentSignature(content, signature, publicKey) {
        // Verify content signature
        const expectedSignature = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
        return signature === expectedSignature; // Simplified verification
    }

    // Connection management
    disconnectFromPeer(nodeId) {
        const peer = this.peers.get(nodeId);
        if (peer) {
            peer.disconnect();
            this.peers.delete(nodeId);
            
            // Update database status
            const stmt = this.db.prepare(`
                UPDATE connections 
                SET status = 'disconnected', last_seen = ?
                WHERE node_id = ?
            `);
            stmt.run(Date.now(), nodeId);
        }
    }

    getConnectedPeers() {
        return Array.from(this.peers.values()).filter(peer => peer.isConnected());
    }

    getPeerCount() {
        return this.getConnectedPeers().length;
    }

    // Cleanup
    async shutdown() {
        console.log('🛑 Shutting down P2P Network Manager...');
        
        // Stop discovery
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
        }
        
        if (this.discoverySocket) {
            this.discoverySocket.close();
        }

        // Disconnect all peers
        for (const peer of this.peers.values()) {
            peer.disconnect();
        }
        this.peers.clear();

        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }

        console.log('✅ P2P Network Manager shutdown complete');
    }
}

class PeerConnection {
    constructor(nodeId, ws, publicKey, encryptionKey) {
        this.nodeId = nodeId;
        this.ws = ws;
        this.publicKey = publicKey;
        this.encryptionKey = encryptionKey;
        this.displayName = null;
        this.connectedAt = Date.now();
        this.lastActivity = Date.now();
    }

    sendMessage(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            const encryptedMessage = this.encryptMessage(message);
            this.ws.send(JSON.stringify(encryptedMessage));
            this.lastActivity = Date.now();
        } else {
            throw new Error('WebSocket not open');
        }
    }

    encryptMessage(message) {
        // Simplified encryption - in production, use proper end-to-end encryption
        return {
            encrypted: false, // Set to true when implementing actual encryption
            data: message
        };
    }

    decryptMessage(encryptedMessage) {
        // Simplified decryption
        return encryptedMessage.data;
    }

    isConnected() {
        return this.ws.readyState === WebSocket.OPEN;
    }

    disconnect() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }

    getConnectionInfo() {
        return {
            nodeId: this.nodeId,
            displayName: this.displayName,
            connectedAt: this.connectedAt,
            lastActivity: this.lastActivity,
            isConnected: this.isConnected()
        };
    }
}

module.exports = { P2PNetworkManager, PeerConnection };
