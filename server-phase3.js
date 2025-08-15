const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const { P2PNetworkManager } = require('./networking-phase3');
const QRCodeGenerator = require('./qr-generator');
const MediaManager = require('./media-manager');
const CommentSystem = require('./comment-system');
const RealTimeChatManager = require('./real-time-chat');

class KABOOMediaServerPhase3 {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8080;
        this.dataDir = path.join(__dirname, 'kaboomedia');
        this.dbPath = path.join(this.dataDir, 'node.db');
        this.configPath = path.join(this.dataDir, 'config', 'node.json');
        this.keysDir = path.join(this.dataDir, 'config', 'keys');
        
        // Core components
        this.db = null;
        this.nodeConfig = null;
        this.masterKey = null;
        this.networkManager = null;
        this.qrGenerator = null;
        this.mediaManager = null;
        this.commentSystem = null;
        this.chatManager = null;
        
        // WebSocket for real-time features
        this.wsServer = null;
        this.wsClients = new Set();
        
        // Temporary storage
        this.tempCodes = new Map();
        this.activeSessions = new Map();
        
        // File upload configuration
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 100 * 1024 * 1024, // 100MB max
                files: 5 // Max 5 files per request
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = [
                    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                    'video/mp4', 'video/webm', 'video/quicktime',
                    'audio/mpeg', 'audio/ogg', 'audio/wav',
                    'application/pdf', 'text/plain'
                ];
                
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Unsupported file type'), false);
                }
            }
        });
    }

    // Initialize the application
    async initialize() {
        console.log('🚀 Initializing KABOOMedia Server Phase 3...');
        
        await this.createDirectories();
        await this.initializeDatabase();
        await this.loadOrCreateConfig();
        await this.generateOrLoadKeys();
        await this.initializeComponents();
        await this.initializeNetworking();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        
        console.log('✅ KABOOMedia Server Phase 3 initialized successfully');
    }

    // Create necessary directories
    async createDirectories() {
        const dirs = [
            this.dataDir,
            path.join(this.dataDir, 'config'),
            path.join(this.dataDir, 'config', 'keys'),
            path.join(this.dataDir, 'content'),
            path.join(this.dataDir, 'content', 'posts'),
            path.join(this.dataDir, 'content', 'media'),
            path.join(this.dataDir, 'content', 'comments'),
            path.join(this.dataDir, 'cache'),
            path.join(this.dataDir, 'logs')
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (err) {
                if (err.code !== 'EEXIST') throw err;
            }
        }
    }

    // Initialize SQLite database with Phase 3 schema
    async initializeDatabase() {
        this.db = new Database(this.dbPath);
        
        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 10000');
        
        // Create core tables with Phase 3 enhancements
        this.db.exec(`
            -- Enhanced posts table
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                content_encrypted BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                permissions TEXT DEFAULT 'friends_only',
                media_refs TEXT,
                author_id TEXT NOT NULL,
                author_name TEXT,
                is_remote INTEGER DEFAULT 0,
                sync_status TEXT DEFAULT 'synced',
                reaction_counts TEXT DEFAULT '{}',
                comment_count INTEGER DEFAULT 0,
                view_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Enhanced connections table
            CREATE TABLE IF NOT EXISTS connections (
                node_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                permission_level INTEGER DEFAULT 2,
                last_seen INTEGER,
                public_key TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                connection_type TEXT DEFAULT 'direct',
                metadata TEXT DEFAULT '{}',
                is_favorite INTEGER DEFAULT 0,
                blocked_at INTEGER NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Post reactions table
            CREATE TABLE IF NOT EXISTS post_reactions (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                reaction_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
                UNIQUE(post_id, user_id)
            );

            -- Media files table
            CREATE TABLE IF NOT EXISTS media_files (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                author_id TEXT NOT NULL,
                upload_date INTEGER NOT NULL,
                metadata TEXT DEFAULT '{}',
                download_count INTEGER DEFAULT 0,
                is_public INTEGER DEFAULT 0
            );

            -- User sessions table
            CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_activity INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                is_active INTEGER DEFAULT 1
            );

            -- Notification system
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                data TEXT DEFAULT '{}',
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NULL
            );

            -- Activity log
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                metadata TEXT DEFAULT '{}',
                timestamp INTEGER NOT NULL,
                ip_address TEXT
            );

            -- Node metadata
            CREATE TABLE IF NOT EXISTS node_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Sync log
            CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id TEXT NOT NULL,
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                error_message TEXT NULL
            );

            -- Create indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
            CREATE INDEX IF NOT EXISTS idx_posts_permissions ON posts(permissions);
            CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
            CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id);
            CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_media_files_author ON media_files(author_id);
            CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(media_type);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
            CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_sync_log_peer ON sync_log(peer_id, timestamp);
        `);

        console.log('📊 Database initialized with Phase 3 schema');
    }

    // Initialize Phase 3 components
    async initializeComponents() {
        // Initialize media manager
        this.mediaManager = new MediaManager(this.dataDir, this.masterKey);
        console.log('📁 Media Manager initialized');

        // Initialize comment system
        this.commentSystem = new CommentSystem(this.db, this.masterKey, this.nodeConfig, this.networkManager);
        console.log('💬 Comment System initialized');

        // Initialize chat manager
        this.chatManager = new RealTimeChatManager(this.db, this.masterKey, this.nodeConfig, this.networkManager);
        console.log('💬 Real-time Chat Manager initialized');

        // Set up event handlers
        this.setupComponentEventHandlers();
    }

    setupComponentEventHandlers() {
        // Chat events
        this.chatManager.on('messageReceived', (data) => {
            this.broadcastToWebSockets('chat:message', data);
            if (data.isRemote) {
                this.createNotification(data.sessionId, 'New message', `New message from ${data.message.sender_name}`, {
                    type: 'chat',
                    sessionId: data.sessionId,
                    messageId: data.message.id
                });
            }
        });

        this.chatManager.on('typingIndicator', (data) => {
            this.broadcastToWebSockets('chat:typing', data);
        });

        this.chatManager.on('messageEdited', (data) => {
            this.broadcastToWebSockets('chat:edit', data);
        });

        this.chatManager.on('messageDeleted', (data) => {
            this.broadcastToWebSockets('chat:delete', data);
        });
    }

    // Setup WebSocket server for real-time features
    setupWebSocket() {
        const wsPort = this.port + 2; // Use port+2 for WebSocket
        this.wsServer = new WebSocket.Server({ port: wsPort });

        this.wsServer.on('connection', (ws, req) => {
            console.log('🔌 WebSocket client connected');
            this.wsClients.add(ws);

            // Handle WebSocket messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.wsClients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.wsClients.delete(ws);
            });

            // Send initial connection data
            ws.send(JSON.stringify({
                type: 'connected',
                nodeId: this.nodeConfig.node_id,
                displayName: this.nodeConfig.display_name
            }));
        });

        console.log(`🔌 WebSocket server listening on port ${wsPort}`);
    }

    // Handle WebSocket messages
    async handleWebSocketMessage(ws, data) {
        try {
            switch (data.type) {
                case 'chat:join_session':
                    await this.handleJoinChatSession(ws, data.sessionId);
                    break;
                case 'chat:leave_session':
                    await this.handleLeaveChatSession(ws, data.sessionId);
                    break;
                case 'chat:typing':
                    await this.chatManager.sendTypingIndicator(data.sessionId, data.isTyping);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                default:
                    console.log('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    }

    // Broadcast message to all WebSocket clients
    broadcastToWebSockets(type, data) {
        const message = JSON.stringify({ type, data });
        this.wsClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Load or create node configuration
    async loadOrCreateConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.nodeConfig = JSON.parse(configData);
            
            // Upgrade config for Phase 3
            if (!this.nodeConfig.phase3_features) {
                this.nodeConfig.phase3_features = {
                    media_enabled: true,
                    comments_enabled: true,
                    chat_enabled: true,
                    reactions_enabled: true,
                    notifications_enabled: true
                };
                await fs.writeFile(this.configPath, JSON.stringify(this.nodeConfig, null, 2));
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Create new configuration with Phase 3 features
                this.nodeConfig = {
                    node_id: `kaboo_${crypto.randomBytes(32).toString('hex')}`,
                    display_name: "KABOOMedia Node",
                    port: this.port,
                    version: "1.2.0", // Phase 3 version
                    encryption: {
                        algorithm: "AES-256-GCM",
                        key_derivation: "PBKDF2",
                        iterations: 100000
                    },
                    discovery: {
                        mdns_enabled: true,
                        upnp_enabled: false,
                        manual_address: null
                    },
                    permissions: {
                        default_permission: "friends_only",
                        permissions: {
                            owner: ["view_private", "view_public", "comment", "react", "admin", "upload_media", "create_chat"],
                            friend: ["view_private", "view_public", "comment", "react", "upload_media", "create_chat"],
                            visitor: ["view_public", "react"],
                            blocked: []
                        },
                        content_visibility: {
                            posts: "friends_only",
                            media: "friends_only",
                            comments: "friends_only",
                            chat: "friends_only"
                        }
                    },
                    phase3_features: {
                        media_enabled: true,
                        comments_enabled: true,
                        chat_enabled: true,
                        reactions_enabled: true,
                        notifications_enabled: true,
                        max_file_size: 100 * 1024 * 1024, // 100MB
                        max_chat_history: 10000 // messages
                    }
                };

                await fs.writeFile(this.configPath, JSON.stringify(this.nodeConfig, null, 2));
                console.log('🔧 Created new Phase 3 node configuration');
            } else {
                throw err;
            }
        }
    }

    // Generate or load cryptographic keys
    async generateOrLoadKeys() {
        const privateKeyPath = path.join(this.keysDir, 'private.pem');
        const publicKeyPath = path.join(this.keysDir, 'public.pem');
        const masterKeyPath = path.join(this.keysDir, 'master.key');

        try {
            // Load existing keys
            const privateKey = await fs.readFile(privateKeyPath, 'utf8');
            const publicKey = await fs.readFile(publicKeyPath, 'utf8');
            const masterKeyData = await fs.readFile(masterKeyPath, 'utf8');
            
            this.privateKey = privateKey;
            this.publicKey = publicKey;
            this.masterKey = Buffer.from(masterKeyData, 'hex');
            
            // Update config with public key
            this.nodeConfig.publicKey = publicKey;
            
            console.log('🔑 Loaded existing cryptographic keys');
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Generate new RSA key pair with stronger keys for Phase 3
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 4096, // Upgraded to 4096-bit for Phase 3
                    publicKeyEncoding: {
                        type: 'spki',
                        format: 'pem'
                    },
                    privateKeyEncoding: {
                        type: 'pkcs8',
                        format: 'pem'
                    }
                });

                // Generate master key for AES encryption
                this.masterKey = crypto.randomBytes(32);
                
                // Save keys with proper permissions
                await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
                await fs.writeFile(publicKeyPath, publicKey);
                await fs.writeFile(masterKeyPath, this.masterKey.toString('hex'), { mode: 0o600 });
                
                this.privateKey = privateKey;
                this.publicKey = publicKey;
                this.nodeConfig.publicKey = publicKey;
                
                console.log('🔐 Generated new 4096-bit RSA keys for Phase 3');
            } else {
                throw err;
            }
        }
    }

    // Initialize P2P networking with Phase 3 enhancements
    async initializeNetworking() {
        try {
            this.networkManager = new P2PNetworkManager(this.nodeConfig, this.db, this.masterKey);
            this.qrGenerator = new QRCodeGenerator(this.nodeConfig);
            
            // Set up enhanced event handlers for Phase 3
            this.networkManager.on('peerConnected', (peer) => {
                console.log(`🤝 Peer connected: ${peer.displayName || peer.nodeId}`);
                this.handlePeerConnected(peer);
                this.broadcastToWebSockets('peer:connected', { peer });
            });

            this.networkManager.on('peerDisconnected', (peer) => {
                console.log(`👋 Peer disconnected: ${peer.displayName || peer.nodeId}`);
                this.handlePeerDisconnected(peer);
                this.broadcastToWebSockets('peer:disconnected', { peer });
            });

            this.networkManager.on('contentReceived', (data) => {
                console.log(`📨 Content received from peer: ${data.fromPeer}`);
                this.handleRemoteContent(data);
                this.broadcastToWebSockets('content:received', data);
            });

            this.networkManager.on('commentReceived', (data) => {
                console.log(`💬 Comment received from peer: ${data.fromPeer}`);
                this.commentSystem.handleRemoteComment(data.comment, data.fromPeer);
                this.broadcastToWebSockets('comment:received', data);
            });

            this.networkManager.on('chatMessageReceived', (data) => {
                console.log(`💬 Chat message received from peer: ${data.fromPeer}`);
                this.chatManager.handleRemoteChatMessage(data);
            });

            this.networkManager.on('reactionReceived', (data) => {
                console.log(`👍 Reaction received from peer: ${data.fromPeer}`);
                this.handleRemoteReaction(data);
                this.broadcastToWebSockets('reaction:received', data);
            });

            await this.networkManager.initialize();
            
        } catch (error) {
            console.error('Failed to initialize networking:', error);
            // Continue without networking for graceful degradation
        }
    }

    // Setup Express middleware with Phase 3 enhancements
    setupMiddleware() {
        // Enhanced rate limiting
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 200, // Increased for Phase 3 features
            message: { error: 'Too many requests from this IP' },
            standardHeaders: true,
            legacyHeaders: false
        });

        const uploadLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 50, // 50 uploads per hour
            message: { error: 'Upload rate limit exceeded' }
        });

        this.app.use('/api/', apiLimiter);
        this.app.use('/api/media/upload', uploadLimiter);

        // Enhanced security headers for Phase 3
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    mediaSrc: ["'self'", "blob:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    workerSrc: ["'self'", "blob:"],
                    objectSrc: ["'none'"],
                    frameSrc: ["'none'"]
                },
            },
            crossOriginEmbedderPolicy: false // Needed for some media features
        }));

        // Body parsing with increased limits for media
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Static files with enhanced caching
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: '1d',
            etag: true
        }));

        // Request logging with more details
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            const userAgent = req.get('User-Agent') || 'Unknown';
            console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip} - ${userAgent.substring(0, 50)}`);
            next();
        });

        // CORS handling for WebSocket and API
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
    }

    // Setup enhanced API routes for Phase 3
    setupRoutes() {
        // Enhanced node status endpoint
        this.app.get('/api/status', async (req, res) => {
            try {
                const mediaStats = await this.mediaManager.getMediaStats();
                const chatStats = await this.chatManager.getChatStats();
                const commentStats = await this.commentSystem.getCommentStats();

                res.json({
                    status: 'online',
                    node_id: this.nodeConfig.node_id,
                    display_name: this.nodeConfig.display_name,
                    version: this.nodeConfig.version,
                    phase: 3,
                    connections: this.getConnectionCount(),
                    uptime: process.uptime(),
                    encryption_status: 'enabled',
                    p2p_status: this.networkManager ? 'enabled' : 'disabled',
                    peer_count: this.networkManager ? this.networkManager.getPeerCount() : 0,
                    websocket_clients: this.wsClients.size,
                    features: {
                        media: this.nodeConfig.phase3_features?.media_enabled || false,
                        comments: this.nodeConfig.phase3_features?.comments_enabled || false,
                        chat: this.nodeConfig.phase3_features?.chat_enabled || false,
                        reactions: this.nodeConfig.phase3_features?.reactions_enabled || false
                    },
                    stats: {
                        media: mediaStats,
                        chat: chatStats,
                        comments: commentStats
                    }
                });
            } catch (error) {
                console.error('Error getting status:', error);
                res.status(500).json({ error: 'Failed to get status' });
            }
        });

        // Enhanced content creation with media support
        this.app.post('/api/content', this.upload.array('media', 5), async (req, res) => {
            try {
                const { content, permissions = 'friends_only' } = req.body;
                
                if (!content && (!req.files || req.files.length === 0)) {
                    return res.status(400).json({ error: 'Content or media is required' });
                }

                const postId = crypto.randomUUID();
                let mediaRefs = [];

                // Process uploaded media files
                if (req.files && req.files.length > 0) {
                    for (const file of req.files) {
                        try {
                            const mediaResult = await this.mediaManager.uploadMedia(
                                file.buffer,
                                file.originalname,
                                file.mimetype,
                                this.nodeConfig.node_id
                            );
                            mediaRefs.push(mediaResult);
                        } catch (error) {
                            console.error('Error uploading media:', error);
                            // Continue with other files
                        }
                    }
                }

                const postData = {
                    id: postId,
                    text: content || '',
                    author_id: this.nodeConfig.node_id,
                    author_name: this.nodeConfig.display_name,
                    timestamp: Date.now(),
                    permissions: permissions,
                    media_refs: mediaRefs.length > 0 ? JSON.stringify(mediaRefs) : null
                };

                const encryptedContent = this.encryptData(JSON.stringify(postData));
                const timestamp = Date.now();

                const stmt = this.db.prepare(`
                    INSERT INTO posts (id, content_encrypted, timestamp, permissions, media_refs, author_id, author_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                stmt.run(
                    postId, 
                    encryptedContent, 
                    timestamp, 
                    permissions, 
                    postData.media_refs, 
                    this.nodeConfig.node_id,
                    this.nodeConfig.display_name
                );

                // Log activity
                this.logActivity('post_created', 'post', postId, { 
                    content_length: content?.length || 0,
                    media_count: mediaRefs.length 
                });

                // Broadcast to connected peers
                if (this.networkManager && permissions !== 'private') {
                    await this.networkManager.broadcastContent(postData);
                }

                // Broadcast to WebSocket clients
                this.broadcastToWebSockets('content:created', {
                    post: postData,
                    media: mediaRefs
                });

                res.json({
                    success: true,
                    post_id: postId,
                    timestamp: timestamp,
                    media_count: mediaRefs.length,
                    media_refs: mediaRefs
                });
            } catch (error) {
                console.error('Error creating content:', error);
                res.status(500).json({ error: 'Failed to create content' });
            }
        });

        // Enhanced feed endpoint with reactions and comments
        this.app.get('/api/feed', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 20;
                const offset = parseInt(req.query.offset) || 0;
                const includeRemote = req.query.include_remote !== 'false';

                let query = `
                    SELECT 
                        id, content_encrypted, timestamp, permissions, media_refs, 
                        author_id, author_name, is_remote, reaction_counts, comment_count
                    FROM posts
                `;
                
                if (!includeRemote) {
                    query += ` WHERE is_remote = 0`;
                }
                
                query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

                const stmt = this.db.prepare(query);
                const posts = stmt.all(limit, offset);
                
                const decryptedPosts = [];
                
                for (const post of posts) {
                    try {
                        const decryptedContent = this.decryptData(post.content_encrypted);
                        const contentData = JSON.parse(decryptedContent);
                        
                        // Parse media references
                        let mediaRefs = [];
                        if (post.media_refs) {
                            try {
                                mediaRefs = JSON.parse(post.media_refs);
                            } catch (err) {
                                console.error('Error parsing media refs:', err);
                            }
                        }

                        // Get reactions
                        const reactions = this.parseReactionCounts(post.reaction_counts);

                        // Get recent comments preview
                        const comments = await this.commentSystem.getCommentsForPost(post.id);
                        const commentPreview = comments.slice(0, 3); // Show first 3 comments

                        decryptedPosts.push({
                            id: post.id,
                            content: contentData.text || contentData.content,
                            timestamp: post.timestamp,
                            permissions: post.permissions,
                            media_refs: mediaRefs,
                            author_id: post.author_id,
                            author_name: post.author_name || contentData.author_name || 'Unknown',
                            is_remote: Boolean(post.is_remote),
                            reactions: reactions,
                            comment_count: post.comment_count || 0,
                            comment_preview: commentPreview
                        });
                    } catch (err) {
                        console.error('Failed to decrypt post:', post.id, err);
                    }
                }

                res.json({
                    posts: decryptedPosts,
                    total: this.getPostCount(),
                    limit: limit,
                    offset: offset,
                    has_more: decryptedPosts.length === limit
                });
            } catch (error) {
                console.error('Error fetching feed:', error);
                res.status(500).json({ error: 'Failed to fetch feed' });
            }
        });

        // Media upload endpoint
        this.app.post('/api/media/upload', this.upload.single('file'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No file uploaded' });
                }

                const result = await this.mediaManager.uploadMedia(
                    req.file.buffer,
                    req.file.originalname,
                    req.file.mimetype,
                    this.nodeConfig.node_id
                );

                this.logActivity('media_uploaded', 'media', result.mediaId, {
                    file_name: req.file.originalname,
                    file_size: req.file.size,
                    media_type: result.mediaType
                });

                res.json(result);
            } catch (error) {
                console.error('Error uploading media:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Media retrieval endpoint
        this.app.get('/api/media/:mediaId', async (req, res) => {
            try {
                const { mediaId } = req.params;
                const getThumbnail = req.query.thumbnail === 'true';

                const result = await this.mediaManager.getMedia(mediaId, getThumbnail);
                
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.buffer.length,
                    'Cache-Control': 'public, max-age=86400', // 1 day cache
                    'Last-Modified': new Date(result.metadata.uploadedAt).toUTCString()
                });

                res.send(result.buffer);
            } catch (error) {
                console.error('Error retrieving media:', error);
                res.status(404).json({ error: 'Media not found' });
            }
        });

        // Media thumbnail endpoint
        this.app.get('/api/media/:mediaId/thumbnail', async (req, res) => {
            try {
                const { mediaId } = req.params;
                const result = await this.mediaManager.getMedia(mediaId, true);
                
                res.set({
                    'Content-Type': 'image/jpeg',
                    'Content-Length': result.buffer.length,
                    'Cache-Control': 'public, max-age=86400'
                });

                res.send(result.buffer);
            } catch (error) {
                res.status(404).json({ error: 'Thumbnail not found' });
            }
        });
      // Enhanced utility methods for Phase 3

    // Post reaction management
    async addPostReaction(postId, reactionType, userId, userName) {
        try {
            // Remove existing reaction from this user
            const deleteStmt = this.db.prepare(`
                DELETE FROM post_reactions 
                WHERE post_id = ? AND user_id = ?
            `);
            deleteStmt.run(postId, userId);

            // Add new reaction
            const insertStmt = this.db.prepare(`
                INSERT INTO post_reactions (id, post_id, user_id, user_name, reaction_type, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            insertStmt.run(crypto.randomUUID(), postId, userId, userName, reactionType, Date.now());

            // Update reaction counts on post
            await this.updatePostReactionCounts(postId);

            // Broadcast reaction to peers
            if (this.networkManager) {
                await this.networkManager.broadcastReaction({
                    postId: postId,
                    reactionType: reactionType,
                    userId: userId,
                    userName: userName,
                    timestamp: Date.now()
                });
            }

            // Broadcast to WebSocket clients
            this.broadcastToWebSockets('reaction:added', {
                postId: postId,
                reactionType: reactionType,
                userId: userId,
                userName: userName
            });

        } catch (error) {
            console.error('Error adding post reaction:', error);
            throw error;
        }
    }

    async removePostReaction(postId, reactionType, userId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM post_reactions 
                WHERE post_id = ? AND user_id = ? AND reaction_type = ?
            `);
            
            stmt.run(postId, userId, reactionType);
            await this.updatePostReactionCounts(postId);

            // Broadcast removal to WebSocket clients
            this.broadcastToWebSockets('reaction:removed', {
                postId: postId,
                reactionType: reactionType,
                userId: userId
            });

        } catch (error) {
            console.error('Error removing post reaction:', error);
            throw error;
        }
    }

    async updatePostReactionCounts(postId) {
        try {
            const stmt = this.db.prepare(`
                SELECT reaction_type, COUNT(*) as count, 
                       GROUP_CONCAT(user_name) as user_names
                FROM post_reactions 
                WHERE post_id = ?
                GROUP BY reaction_type
            `);

            const reactions = stmt.all(postId);
            const reactionCounts = {};

            reactions.forEach(reaction => {
                reactionCounts[reaction.reaction_type] = {
                    count: reaction.count,
                    users: reaction.user_names.split(',')
                };
            });

            // Update post with new counts
            const updateStmt = this.db.prepare(`
                UPDATE posts 
                SET reaction_counts = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            updateStmt.run(JSON.stringify(reactionCounts), postId);

        } catch (error) {
            console.error('Error updating post reaction counts:', error);
        }
    }

    async updatePostCommentCount(postId) {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM comments WHERE post_id = ?
            `);
            
            const result = stmt.get(postId);
            
            const updateStmt = this.db.prepare(`
                UPDATE posts 
                SET comment_count = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            
            updateStmt.run(result.count, postId);

        } catch (error) {
            console.error('Error updating comment count:', error);
        }
    }

    // Search functionality
    async searchPosts(query, limit = 20) {
        try {
            const stmt = this.db.prepare(`
                SELECT id, content_encrypted, timestamp, author_name, permissions
                FROM posts
                ORDER BY timestamp DESC
                LIMIT ?
            `);

            const posts = stmt.all(limit * 2); // Get extra to filter
            const results = [];
            const searchTerm = query.toLowerCase();

            for (const post of posts) {
                try {
                    const decryptedContent = this.decryptData(post.content_encrypted);
                    const contentData = JSON.parse(decryptedContent);
                    
                    if (contentData.text && contentData.text.toLowerCase().includes(searchTerm)) {
                        results.push({
                            id: post.id,
                            content: contentData.text.substring(0, 200), // Preview
                            timestamp: post.timestamp,
                            author_name: post.author_name,
                            permissions: post.permissions
                        });

                        if (results.length >= limit) break;
                    }
                } catch (err) {
                    // Skip corrupted posts
                }
            }

            return results;

        } catch (error) {
            console.error('Error searching posts:', error);
            return [];
        }
    }

    // Notification system
    async createNotification(userId, title, message, data = {}) {
        try {
            if (!this.nodeConfig.phase3_features?.notifications_enabled) {
                return;
            }

            const notificationId = crypto.randomUUID();
            const timestamp = Date.now();

            const stmt = this.db.prepare(`
                INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                notificationId,
                userId,
                data.type || 'general',
                title,
                message,
                JSON.stringify(data),
                timestamp
            );

            // Broadcast to WebSocket clients
            this.broadcastToWebSockets('notification:new', {
                id: notificationId,
                title: title,
                message: message,
                data: data,
                timestamp: timestamp
            });

            return notificationId;

        } catch (error) {
            console.error('Error creating notification:', error);
        }
    }

    async getNotifications(limit = 20, offset = 0, unreadOnly = false) {
        try {
            let query = `
                SELECT id, type, title, message, data, is_read, created_at
                FROM notifications 
                WHERE user_id = ?
            `;

            let params = [this.nodeConfig.node_id];

            if (unreadOnly) {
                query += ' AND is_read = 0';
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const stmt = this.db.prepare(query);
            const notifications = stmt.all(...params);

            return notifications.map(notif => ({
                ...notif,
                data: this.parseJsonField(notif.data),
                is_read: Boolean(notif.is_read)
            }));

        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            const stmt = this.db.prepare(`
                UPDATE notifications 
                SET is_read = 1 
                WHERE id = ? AND user_id = ?
            `);

            stmt.run(notificationId, this.nodeConfig.node_id);

        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllNotificationsAsRead() {
        try {
            const stmt = this.db.prepare(`
                UPDATE notifications 
                SET is_read = 1 
                WHERE user_id = ? AND is_read = 0
            `);

            stmt.run(this.nodeConfig.node_id);

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Activity logging
    logActivity(action, targetType, targetId, metadata = {}) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO activity_log (user_id, action, target_type, target_id, metadata, timestamp, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                this.nodeConfig.node_id,
                action,
                targetType,
                targetId,
                JSON.stringify(metadata),
                Date.now(),
                'localhost' // In a real deployment, this would be the actual IP
            );

        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    // Analytics
    async getAnalyticsOverview(timeframe) {
        try {
            const timeframes = {
                '1d': Date.now() - (24 * 60 * 60 * 1000),
                '7d': Date.now() - (7 * 24 * 60 * 60 * 1000),
                '30d': Date.now() - (30 * 24 * 60 * 60 * 1000)
            };

            const since = timeframes[timeframe] || timeframes['7d'];

            // Posts created
            const postsStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM posts 
                WHERE timestamp > ? AND author_id = ?
            `);
            const postsCount = postsStmt.get(since, this.nodeConfig.node_id).count;

            // Comments made
            const commentsStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM comments 
                WHERE timestamp > ? AND author_id = ?
            `);
            const commentsCount = commentsStmt.get(since, this.nodeConfig.node_id).count;

            // Chat messages sent
            const chatStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_messages 
                WHERE timestamp > ? AND sender_id = ?
            `);
            const chatCount = chatStmt.get(since, this.nodeConfig.node_id).count;

            // Media uploaded
            const mediaStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM media_files 
                WHERE upload_date > ? AND author_id = ?
            `);
            const mediaCount = mediaStmt.get(since, this.nodeConfig.node_id).count;

            // Activity by day
            const activityStmt = this.db.prepare(`
                SELECT DATE(timestamp/1000, 'unixepoch') as date, COUNT(*) as count
                FROM activity_log
                WHERE timestamp > ? AND user_id = ?
                GROUP BY date
                ORDER BY date
            `);
            const dailyActivity = activityStmt.all(since, this.nodeConfig.node_id);

            return {
                timeframe: timeframe,
                period_start: since,
                period_end: Date.now(),
                summary: {
                    posts_created: postsCount,
                    comments_made: commentsCount,
                    chat_messages: chatCount,
                    media_uploaded: mediaCount
                },
                daily_activity: dailyActivity
            };

        } catch (error) {
            console.error('Error getting analytics:', error);
            return {};
        }
    }

    // Export functionality
    async exportNodeData(type = 'all') {
        try {
            const exportData = {
                node_info: {
                    id: this.nodeConfig.node_id,
                    display_name: this.nodeConfig.display_name,
                    version: this.nodeConfig.version,
                    exported_at: Date.now()
                },
                data: {}
            };

            if (type === 'all' || type === 'posts') {
                const postsStmt = this.db.prepare(`
                    SELECT id, content_encrypted, timestamp, permissions, media_refs, author_id, author_name
                    FROM posts 
                    WHERE author_id = ?
                    ORDER BY timestamp DESC
                `);
                
                const posts = postsStmt.all(this.nodeConfig.node_id);
                exportData.data.posts = posts.map(post => {
                    try {
                        const decryptedContent = this.decryptData(post.content_encrypted);
                        const contentData = JSON.parse(decryptedContent);
                        return {
                            id: post.id,
                            content: contentData.text || contentData.content,
                            timestamp: post.timestamp,
                            permissions: post.permissions,
                            media_refs: post.media_refs ? JSON.parse(post.media_refs) : []
                        };
                    } catch (err) {
                        return {
                            id: post.id,
                            content: '[Corrupted content]',
                            timestamp: post.timestamp,
                            permissions: post.permissions
                        };
                    }
                });
            }

            if (type === 'all' || type === 'connections') {
                const connectionsStmt = this.db.prepare(`
                    SELECT node_id, display_name, permission_level, status, connection_type, created_at
                    FROM connections
                    ORDER BY created_at DESC
                `);
                exportData.data.connections = connectionsStmt.all();
            }

            if (type === 'all' || type === 'media') {
                const mediaStmt = this.db.prepare(`
                    SELECT id, original_name, mime_type, file_size, media_type, upload_date
                    FROM media_files
                    WHERE author_id = ?
                    ORDER BY upload_date DESC
                `);
                exportData.data.media = mediaStmt.all(this.nodeConfig.node_id);
            }

            return exportData;

        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    // Handle peer events (enhanced from Phase 2)
    handlePeerConnected(peer) {
        // Update database
        const stmt = this.db.prepare(`
            UPDATE connections 
            SET status = 'connected', last_seen = ?, updated_at = CURRENT_TIMESTAMP
            WHERE node_id = ?
        `);
        stmt.run(Date.now(), peer.nodeId);

        // Create notification
        this.createNotification(
            this.nodeConfig.node_id,
            'Peer Connected',
            `${peer.displayName || peer.nodeId} has connected`,
            { type: 'peer_connected', peer_id: peer.nodeId }
        );
    }

    handlePeerDisconnected(peer) {
        // Update database
        const stmt = this.db.prepare(`
            UPDATE connections 
            SET status = 'disconnected', last_seen = ?, updated_at = CURRENT_TIMESTAMP
            WHERE node_id = ?
        `);
        stmt.run(Date.now(), peer.nodeId);
    }

    async handleRemoteContent(data) {
        try {
            const { content, fromPeer, timestamp } = data;
            
            // Check if we already have this content
            const existingStmt = this.db.prepare('SELECT id FROM posts WHERE id = ?');
            if (existingStmt.get(content.id)) {
                console.log(`Content ${content.id} already exists, skipping`);
                return;
            }

            // Encrypt and store remote content
            const encryptedContent = this.encryptData(JSON.stringify(content));
            
            const stmt = this.db.prepare(`
                INSERT INTO posts (
                    id, content_encrypted, timestamp, permissions, media_refs, 
                    author_id, author_name, is_remote, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'synced')
            `);

            stmt.run(
                content.id,
                encryptedContent,
                content.timestamp,
                content.permissions || 'friends_only',
                content.media_refs,
                content.author_id,
                content.author_name,
            );

            console.log(`📥 Stored remote content from ${content.author_name}`);
            
            // Log sync activity
            const logStmt = this.db.prepare(`
                INSERT INTO sync_log (peer_id, content_id, content_type, action, timestamp, status)
                VALUES (?, ?, 'post', 'received', ?, 'completed')
            `);
            logStmt.run(fromPeer, content.id, Date.now());

            // Create notification for remote content
            this.createNotification(
                this.nodeConfig.node_id,
                'New Post',
                `New post from ${content.author_name}`,
                { type: 'remote_content', post_id: content.id, author: content.author_name }
            );

        } catch (error) {
            console.error('Error handling remote content:', error);
        }
    }

    async handleRemoteReaction(data) {
        try {
            const { postId, reactionType, userId, userName, fromPeer } = data;

            // Check if post exists
            const postStmt = this.db.prepare('SELECT id FROM posts WHERE id = ?');
            if (!postStmt.get(postId)) {
                console.log(`Post ${postId} not found, cannot add remote reaction`);
                return;
            }

            // Add remote reaction
            await this.addPostReaction(postId, reactionType, userId, userName);

            console.log(`👍 Remote reaction received: ${reactionType} on post ${postId}`);

        } catch (error) {
            console.error('Error handling remote reaction:', error);
        }
    }

    // WebSocket chat session management
    async handleJoinChatSession(ws, sessionId) {
        try {
            const session = await this.chatManager.getChatSession(sessionId);
            if (!session) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Chat session not found'
                }));
                return;
            }

            // Check if user is a participant
            const isParticipant = session.participants.some(p => p.user_id === this.nodeConfig.node_id);
            if (!isParticipant) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Not authorized to join this session'
                }));
                return;
            }

            // Add to active sessions
            if (!this.activeSessions.has(sessionId)) {
                this.activeSessions.set(sessionId, new Set());
            }
            this.activeSessions.get(sessionId).add(ws);

            // Store session info on WebSocket
            ws.sessionId = sessionId;

            // Send confirmation
            ws.send(JSON.stringify({
                type: 'chat:joined',
                sessionId: sessionId
            }));

        } catch (error) {
            console.error('Error joining chat session:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to join chat session'
            }));
        }
    }

    async handleLeaveChatSession(ws, sessionId) {
        if (this.activeSessions.has(sessionId)) {
            this.activeSessions.get(sessionId).delete(ws);
            if (this.activeSessions.get(sessionId).size === 0) {
                this.activeSessions.delete(sessionId);
            }
        }

        ws.sessionId = null;

        ws.send(JSON.stringify({
            type: 'chat:left',
            sessionId: sessionId
        }));
    }

    // Enhanced utility methods
    getConnectionCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM connections WHERE status = "connected"');
        return stmt.get().count;
    }

    getPostCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM posts');
        return stmt.get().count;
    }

    async getMediaFileCount() {
        try {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM media_files');
            return stmt.get().count;
        } catch (error) {
            return 0;
        }
    }

    async getChatSessionCount() {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_sessions cs
                JOIN chat_participants cp ON cs.id = cp.session_id
                WHERE cp.user_id = ?
            `);
            return stmt.get(this.nodeConfig.node_id).count;
        } catch (error) {
            return 0;
        }
    }

    async getUsedMediaIds() {
        try {
            const stmt = this.db.prepare(`
                SELECT DISTINCT id FROM media_files
                WHERE id IN (
                    SELECT json_extract(value, '$.mediaId') 
                    FROM posts, json_each(media_refs)
                    WHERE media_refs IS NOT NULL
                )
            `);
            return stmt.all().map(row => row.id);
        } catch (error) {
            console.error('Error getting used media IDs:', error);
            return [];
        }
    }

    // Encryption/Decryption methods (enhanced from Phase 1)
    encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.masterKey);
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
        
        const decipher = crypto.createDecipher('aes-256-gcm', this.masterKey);
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

    parseJsonField(jsonStr) {
        try {
            return JSON.parse(jsonStr || '{}');
        } catch (error) {
            return {};
        }
    }

    // Start the enhanced server
    async start() {
        await this.initialize();
        
        this.server = this.app.listen(this.port, () => {
            console.log(`\n🌟 KABOOMedia Server Phase 3 running on port ${this.port}`);
            console.log(`📱 Web Interface: http://localhost:${this.port}`);
            console.log(`🔗 P2P Port: ${this.port + 1}`);
            console.log(`🔌 WebSocket Port: ${this.port + 2}`);
            console.log(`🔑 Node ID: ${this.nodeConfig.node_id}`);
            console.log(`🌐 P2P Network: ${this.networkManager ? 'Enabled' : 'Disabled'}`);
            console.log(`📊 API Status: http://localhost:${this.port}/api/status`);
            console.log(`\n✨ Phase 3 Features Active:`);
            console.log(`   📁 Media Upload & Sharing`);
            console.log(`   💬 Threaded Comments`);
            console.log(`   💬 Real-time Chat`);
            console.log(`   👍 Reactions & Emotions`);
            console.log(`   🔔 Notifications`);
            console.log(`   📊 Analytics & Search`);
            console.log(`   🔌 Real-time WebSocket Updates\n`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    // Enhanced shutdown with cleanup
    async shutdown() {
        console.log('\n🛑 Shutting down KABOOMedia Server Phase 3...');
        
        // Close WebSocket connections
        if (this.wsServer) {
            this.wsClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.close();
                }
            });
            this.wsServer.close();
        }
        
        // Shutdown network manager
        if (this.networkManager) {
            await this.networkManager.shutdown();
        }
        
        // Close HTTP server
        if (this.server) {
            this.server.close();
        }
        
        // Close database connection
        if (this.db) {
            this.db.close();
        }
        
        // Clear intervals and timeouts
        this.tempCodes.clear();
        this.activeSessions.clear();
        
        console.log('✅ Shutdown complete');
        process.exit(0);
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    const server = new KABOOMediaServerPhase3();
    server.start().catch(console.error);
}

module.exports = KABOOMediaServerPhase3;
                                        this.logActivity('chat_session_created', 'chat_session', session.id, {
                    type: type,
                    participant_count: participantIds.length + 1
                });

                res.json({ session });
            } catch (error) {
                console.error('Error creating chat session:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/chat/sessions/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = await this.chatManager.getChatSession(sessionId);
                
                if (!session) {
                    return res.status(404).json({ error: 'Chat session not found' });
                }

                res.json({ session });
            } catch (error) {
                console.error('Error getting chat session:', error);
                res.status(500).json({ error: 'Failed to get chat session' });
            }
        });

        this.app.get('/api/chat/sessions/:sessionId/messages', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const limit = parseInt(req.query.limit) || 50;
                const offset = parseInt(req.query.offset) || 0;
                const beforeTimestamp = req.query.before ? parseInt(req.query.before) : null;

                const messages = await this.chatManager.getMessages(sessionId, limit, offset, beforeTimestamp);
                res.json({ messages });
            } catch (error) {
                console.error('Error getting chat messages:', error);
                res.status(500).json({ error: 'Failed to get messages' });
            }
        });

        this.app.post('/api/chat/sessions/:sessionId/messages', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { content, messageType = 'text', replyTo } = req.body;

                if (!content || content.trim().length === 0) {
                    return res.status(400).json({ error: 'Message content is required' });
                }

                const message = await this.chatManager.sendMessage(
                    sessionId,
                    content.trim(),
                    messageType,
                    replyTo
                );

                this.logActivity('chat_message_sent', 'chat_message', message.id, {
                    session_id: sessionId,
                    message_type: messageType,
                    content_length: content.length
                });

                res.json({ message });
            } catch (error) {
                console.error('Error sending chat message:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/chat/sessions/:sessionId/read', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { messageId } = req.body;

                await this.chatManager.markAsRead(sessionId, messageId);
                res.json({ success: true });
            } catch (error) {
                console.error('Error marking as read:', error);
                res.status(500).json({ error: 'Failed to mark as read' });
            }
        });

        this.app.put('/api/chat/messages/:messageId', async (req, res) => {
            try {
                const { messageId } = req.params;
                const { content } = req.body;

                if (!content || content.trim().length === 0) {
                    return res.status(400).json({ error: 'Message content is required' });
                }

                await this.chatManager.editMessage(messageId, content.trim());

                this.logActivity('chat_message_edited', 'chat_message', messageId, {
                    content_length: content.length
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error editing chat message:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/chat/messages/:messageId', async (req, res) => {
            try {
                const { messageId } = req.params;
                await this.chatManager.deleteMessage(messageId);

                this.logActivity('chat_message_deleted', 'chat_message', messageId);

                res.json({ success: true });
            } catch (error) {
                console.error('Error deleting chat message:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/chat/messages/:messageId/reactions', async (req, res) => {
            try {
                const { messageId } = req.params;
                const { reactionType } = req.body;

                await this.chatManager.addReaction(messageId, reactionType);

                this.logActivity('chat_message_reaction_added', 'chat_message', messageId, {
                    reaction_type: reactionType
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error adding chat message reaction:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Search endpoints
        this.app.get('/api/search', async (req, res) => {
            try {
                const { q: query, type = 'all', limit = 20 } = req.query;

                if (!query || query.trim().length < 2) {
                    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
                }

                const results = {
                    posts: [],
                    comments: [],
                    chat_messages: []
                };

                if (type === 'all' || type === 'posts') {
                    results.posts = await this.searchPosts(query, limit);
                }

                if (type === 'all' || type === 'comments') {
                    results.comments = await this.commentSystem.searchComments(query, null, limit);
                }

                if (type === 'all' || type === 'chat') {
                    results.chat_messages = await this.chatManager.searchMessages(query, null, limit);
                }

                this.logActivity('search_performed', 'search', null, {
                    query: query,
                    type: type,
                    results_count: results.posts.length + results.comments.length + results.chat_messages.length
                });

                res.json(results);
            } catch (error) {
                console.error('Error performing search:', error);
                res.status(500).json({ error: 'Search failed' });
            }
        });

        // Notification endpoints
        this.app.get('/api/notifications', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 20;
                const offset = parseInt(req.query.offset) || 0;
                const unreadOnly = req.query.unread_only === 'true';

                const notifications = await this.getNotifications(limit, offset, unreadOnly);
                res.json({ notifications });
            } catch (error) {
                console.error('Error getting notifications:', error);
                res.status(500).json({ error: 'Failed to get notifications' });
            }
        });

        this.app.post('/api/notifications/:notificationId/read', async (req, res) => {
            try {
                const { notificationId } = req.params;
                await this.markNotificationAsRead(notificationId);
                res.json({ success: true });
            } catch (error) {
                console.error('Error marking notification as read:', error);
                res.status(500).json({ error: 'Failed to mark notification as read' });
            }
        });

        this.app.post('/api/notifications/read-all', async (req, res) => {
            try {
                await this.markAllNotificationsAsRead();
                res.json({ success: true });
            } catch (error) {
                console.error('Error marking all notifications as read:', error);
                res.status(500).json({ error: 'Failed to mark all notifications as read' });
            }
        });

        // Enhanced connections endpoint
        this.app.get('/api/connections', async (req, res) => {
            try {
                const stmt = this.db.prepare(`
                    SELECT 
                        node_id, display_name, permission_level, last_seen, status, 
                        connection_type, is_favorite, blocked_at, created_at
                    FROM connections
                    WHERE blocked_at IS NULL
                    ORDER BY is_favorite DESC, last_seen DESC
                `);

                const connections = stmt.all();
                
                // Add live connection status from network manager
                const liveConnections = this.networkManager ? this.networkManager.getConnectedPeers() : [];
                const livePeerIds = new Set(liveConnections.map(peer => peer.nodeId));
                
                const enrichedConnections = connections.map(conn => ({
                    ...conn,
                    is_online: livePeerIds.has(conn.node_id),
                    last_seen_formatted: conn.last_seen ? new Date(conn.last_seen).toISOString() : null,
                    connection_duration: conn.last_seen ? Date.now() - conn.last_seen : null
                }));

                res.json({ 
                    connections: enrichedConnections,
                    live_count: liveConnections.length,
                    total_count: connections.length
                });
            } catch (error) {
                console.error('Error fetching connections:', error);
                res.status(500).json({ error: 'Failed to fetch connections' });
            }
        });

        this.app.post('/api/connections/:nodeId/favorite', async (req, res) => {
            try {
                const { nodeId } = req.params;
                const { isFavorite } = req.body;

                const stmt = this.db.prepare(`
                    UPDATE connections 
                    SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE node_id = ?
                `);

                stmt.run(isFavorite ? 1 : 0, nodeId);

                this.logActivity('connection_favorited', 'connection', nodeId, {
                    is_favorite: isFavorite
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error updating favorite status:', error);
                res.status(500).json({ error: 'Failed to update favorite status' });
            }
        });

        this.app.post('/api/connections/:nodeId/block', async (req, res) => {
            try {
                const { nodeId } = req.params;
                const { blocked } = req.body;

                const stmt = this.db.prepare(`
                    UPDATE connections 
                    SET blocked_at = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE node_id = ?
                `);

                stmt.run(blocked ? Date.now() : null, nodeId);

                if (blocked && this.networkManager) {
                    this.networkManager.disconnectFromPeer(nodeId);
                }

                this.logActivity('connection_blocked', 'connection', nodeId, {
                    blocked: blocked
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error blocking/unblocking connection:', error);
                res.status(500).json({ error: 'Failed to update block status' });
            }
        });

        // Analytics and stats endpoints
        this.app.get('/api/analytics/overview', async (req, res) => {
            try {
                const timeframe = req.query.timeframe || '7d'; // 1d, 7d, 30d
                const analytics = await this.getAnalyticsOverview(timeframe);
                res.json(analytics);
            } catch (error) {
                console.error('Error getting analytics:', error);
                res.status(500).json({ error: 'Failed to get analytics' });
            }
        });

        // System management endpoints
        this.app.post('/api/system/cleanup', async (req, res) => {
            try {
                const { type } = req.body;
                let result = 0;

                switch (type) {
                    case 'media':
                        const usedMediaIds = await this.getUsedMediaIds();
                        result = await this.mediaManager.cleanupOrphanedMedia(usedMediaIds);
                        break;
                    case 'chat':
                        result = await this.chatManager.cleanupOldMessages(90); // 90 days
                        break;
                    case 'comments':
                        result = await this.commentSystem.cleanupOldComments(365); // 1 year
                        break;
                    default:
                        return res.status(400).json({ error: 'Invalid cleanup type' });
                }

                this.logActivity('system_cleanup', 'system', null, {
                    cleanup_type: type,
                    items_cleaned: result
                });

                res.json({ success: true, items_cleaned: result });
            } catch (error) {
                console.error('Error during cleanup:', error);
                res.status(500).json({ error: 'Cleanup failed' });
            }
        });

        // Export data endpoint
        this.app.get('/api/export', async (req, res) => {
            try {
                const { type = 'all', format = 'json' } = req.query;
                const exportData = await this.exportNodeData(type);

                const filename = `kaboomedia-export-${Date.now()}.${format}`;
                
                res.set({
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}"`
                });

                if (format === 'json') {
                    res.json(exportData);
                } else {
                    res.status(400).json({ error: 'Unsupported export format' });
                }

                this.logActivity('data_exported', 'system', null, {
                    export_type: type,
                    format: format
                });
            } catch (error) {
                console.error('Error exporting data:', error);
                res.status(500).json({ error: 'Export failed' });
            }
        });

        // Enhanced QR code endpoints (existing routes enhanced)
        this.app.get('/api/qr/generate', async (req, res) => {
            try {
                const type = req.query.type || 'permanent';
                const expires = parseInt(req.query.expires) || 30;
                
                if (type === 'temporary') {
                    const tempData = this.qrGenerator.generateTempConnectionCode(expires);
                    
                    // Store temporary code with enhanced metadata
                    this.tempCodes.set(tempData.code, {
                        ...tempData,
                        created_by: this.nodeConfig.node_id,
                        created_at: Date.now(),
                        usage_count: 0,
                        max_uses: 1
                    });
                    
                    // Clean up expired codes
                    setTimeout(() => {
                        this.tempCodes.delete(tempData.code);
                    }, expires * 60 * 1000);
                    
                    res.json({
                        qr_data: tempData.qrData,
                        temp_code: tempData.code,
                        expires_at: tempData.expiresAt,
                        svg: this.qrGenerator.generateSVGQRCode(tempData.qrData),
                        expires_in_minutes: expires
                    });
                } else {
                    const connectionData = this.qrGenerator.generateConnectionURI();
                    
                    res.json({
                        qr_data: connectionData.qrData,
                        uri: connectionData.uri,
                        svg: this.qrGenerator.generateSVGQRCode(connectionData.qrData),
                        node_info: {
                            id: this.nodeConfig.node_id,
                            name: this.nodeConfig.display_name,
                            version: this.nodeConfig.version
                        }
                    });
                }

                this.logActivity('qr_code_generated', 'qr_code', null, {
                    type: type,
                    expires_minutes: type === 'temporary' ? expires : null
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
                res.status(500).json({ error: 'Failed to generate QR code' });
            }
        });

        // Serve main application with enhanced features
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index-phase3.html'));
        });

        // Health check with detailed information
        this.app.get('/health', async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: this.nodeConfig.version,
                    phase: 3,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    connections: this.getConnectionCount(),
                    websocket_clients: this.wsClients.size,
                    features: {
                        p2p_enabled: Boolean(this.networkManager),
                        media_enabled: this.nodeConfig.phase3_features?.media_enabled || false,
                        comments_enabled: this.nodeConfig.phase3_features?.comments_enabled || false,
                        chat_enabled: this.nodeConfig.phase3_features?.chat_enabled || false
                    },
                    database: {
                        posts: this.getPostCount(),
                        connections: this.getConnectionCount(),
                        media_files: await this.getMediaFileCount(),
                        chat_sessions: await this.getChatSessionCount()
                    }
                };

                res.json(health);
            } catch (error) {
                console.error('Health check error:', error);
                res.status(500).json({ 
                    status: 'unhealthy', 
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            
            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large' });
                }
                if (error.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ error: 'Too many files' });
                }
            }

            res.status(500).json({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
    }

        // Comment system endpoints
        this.app.post('/api/posts/:postId/comments', async (req, res) => {
            try {
                const { postId } = req.params;
                const { content, parentId } = req.body;

                if (!content || content.trim().length === 0) {
                    return res.status(400).json({ error: 'Comment content is required' });
                }

                const comment = await this.commentSystem.createComment(
                    postId,
                    content.trim(),
                    parentId,
                    this.nodeConfig.node_id,
                    this.nodeConfig.display_name
                );

                // Update post comment count
                this.updatePostCommentCount(postId);

                // Log activity
                this.logActivity('comment_created', 'comment', comment.id, {
                    post_id: postId,
                    parent_id: parentId,
                    content_length: content.length
                });

                // Broadcast to WebSocket clients
                this.broadcastToWebSockets('comment:created', {
                    postId: postId,
                    comment: comment
                });

                res.json(comment);
            } catch (error) {
                console.error('Error creating comment:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/posts/:postId/comments', async (req, res) => {
            try {
                const { postId } = req.params;
                const includeRemote = req.query.include_remote !== 'false';

                const comments = await this.commentSystem.getCommentsForPost(postId, includeRemote);
                res.json({ comments });
            } catch (error) {
                console.error('Error getting comments:', error);
                res.status(500).json({ error: 'Failed to get comments' });
            }
        });

        this.app.put('/api/comments/:commentId', async (req, res) => {
            try {
                const { commentId } = req.params;
                const { content } = req.body;

                if (!content || content.trim().length === 0) {
                    return res.status(400).json({ error: 'Comment content is required' });
                }

                await this.commentSystem.editComment(commentId, content.trim(), this.nodeConfig.node_id);

                this.logActivity('comment_edited', 'comment', commentId, {
                    content_length: content.length
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error editing comment:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/comments/:commentId', async (req, res) => {
            try {
                const { commentId } = req.params;
                await this.commentSystem.deleteComment(commentId, this.nodeConfig.node_id);

                this.logActivity('comment_deleted', 'comment', commentId);

                res.json({ success: true });
            } catch (error) {
                console.error('Error deleting comment:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Reaction system endpoints
        this.app.post('/api/posts/:postId/reactions', async (req, res) => {
            try {
                const { postId } = req.params;
                const { reactionType } = req.body;

                const validReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
                if (!validReactions.includes(reactionType)) {
                    return res.status(400).json({ error: 'Invalid reaction type' });
                }

                await this.addPostReaction(postId, reactionType, this.nodeConfig.node_id, this.nodeConfig.display_name);

                this.logActivity('reaction_added', 'post', postId, {
                    reaction_type: reactionType
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error adding reaction:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/posts/:postId/reactions/:reactionType', async (req, res) => {
            try {
                const { postId, reactionType } = req.params;
                await this.removePostReaction(postId, reactionType, this.nodeConfig.node_id);

                this.logActivity('reaction_removed', 'post', postId, {
                    reaction_type: reactionType
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error removing reaction:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/comments/:commentId/reactions', async (req, res) => {
            try {
                const { commentId } = req.params;
                const { reactionType } = req.body;

                await this.commentSystem.addReaction(commentId, reactionType, this.nodeConfig.node_id);

                this.logActivity('comment_reaction_added', 'comment', commentId, {
                    reaction_type: reactionType
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Error adding comment reaction:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Chat system endpoints
        this.app.get('/api/chat/sessions', async (req, res) => {
            try {
                const sessions = await this.chatManager.getChatSessions();
                res.json({ sessions });
            } catch (error) {
                console.error('Error getting chat sessions:', error);
                res.status(500).json({ error: 'Failed to get chat sessions' });
            }
        });

        this.app.post('/api/chat/sessions', async (req, res) => {
            try {
                const { type, participantIds, participantNames, sessionName } = req.body;

                let session;
                if (type === 'direct' && participantIds.length === 1) {
                    session = await this.chatManager.createDirectChat(
                        participantIds[0],
                        participantNames[0]
                    );
                } else if (type === 'group') {
                    session = await this.chatManager.createGroupChat(
                        sessionName,
                        participantIds,
                        participantNames
                    );
                } else {
                    return res.status(400).json({ error: 'Invalid chat session type' });
                }

                this.logActivity('chat_session_created', 'chat_session', session.id, {
                    type: type,
                    participant_count: participantIds.length + 1const express = require('express');
            });
        }
