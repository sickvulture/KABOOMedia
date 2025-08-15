const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const helmet = require('helmet');

class KABOOMediaServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8080;
        this.dataDir = path.join(__dirname, 'kaboomedia');
        this.dbPath = path.join(this.dataDir, 'node.db');
        this.configPath = path.join(this.dataDir, 'config', 'node.json');
        this.keysDir = path.join(this.dataDir, 'config', 'keys');
        this.db = null;
        this.nodeConfig = null;
        this.masterKey = null;
    }

    // Initialize the application
    async initialize() {
        console.log('🚀 Initializing KABOOMedia Node...');
        
        await this.createDirectories();
        await this.initializeDatabase();
        await this.loadOrCreateConfig();
        await this.generateOrLoadKeys();
        this.setupMiddleware();
        this.setupRoutes();
        
        console.log('✅ KABOOMedia Node initialized successfully');
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

    // Initialize SQLite database
    async initializeDatabase() {
        this.db = new Database(this.dbPath);
        
        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        
        // Create core tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                content_encrypted BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                permissions TEXT DEFAULT 'friends_only',
                media_refs TEXT,
                author_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS connections (
                node_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                permission_level INTEGER DEFAULT 2,
                last_seen INTEGER,
                public_key TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS node_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_connections_permission ON connections(permission_level);
        `);
    }

    // Load or create node configuration
    async loadOrCreateConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.nodeConfig = JSON.parse(configData);
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Create new configuration
                this.nodeConfig = {
                    node_id: `kaboo_${crypto.randomBytes(32).toString('hex')}`,
                    display_name: "KABOOMedia Node",
                    port: this.port,
                    version: "1.0.0",
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
                        default_permission: "visitor",
                        permissions: {
                            owner: ["view_private", "view_public", "comment", "react", "admin"],
                            friend: ["view_private", "view_public", "comment", "react"],
                            visitor: ["view_public"],
                            blocked: []
                        },
                        content_visibility: {
                            posts: "friends_only",
                            media: "public",
                            comments: "friends_only"
                        }
                    }
                };

                await fs.writeFile(this.configPath, JSON.stringify(this.nodeConfig, null, 2));
                console.log('📝 Created new node configuration');
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
            
            console.log('🔑 Loaded existing cryptographic keys');
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Generate new RSA key pair
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 2048,
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
                
                // Save keys
                await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
                await fs.writeFile(publicKeyPath, publicKey);
                await fs.writeFile(masterKeyPath, this.masterKey.toString('hex'), { mode: 0o600 });
                
                this.privateKey = privateKey;
                this.publicKey = publicKey;
                
                console.log('🔐 Generated new cryptographic keys');
            } else {
                throw err;
            }
        }
    }

    // Setup Express middleware
    setupMiddleware() {
        // Security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    connectSrc: ["'self'"],
                },
            },
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Static files
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.path}`);
            next();
        });
    }

    // Setup API routes
    setupRoutes() {
        // Node status endpoint
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                node_id: this.nodeConfig.node_id,
                display_name: this.nodeConfig.display_name,
                version: this.nodeConfig.version,
                connections: this.getConnectionCount(),
                uptime: process.uptime(),
                encryption_status: 'enabled'
            });
        });

        // Get node configuration (public parts only)
        this.app.get('/api/config', (req, res) => {
            res.json({
                node_id: this.nodeConfig.node_id,
                display_name: this.nodeConfig.display_name,
                public_key: this.publicKey,
                permissions: this.nodeConfig.permissions
            });
        });

        // Create new content
        this.app.post('/api/content', async (req, res) => {
            try {
                const { content, permissions = 'friends_only', media_refs = null } = req.body;
                
                if (!content) {
                    return res.status(400).json({ error: 'Content is required' });
                }

                const postId = crypto.randomUUID();
                const encryptedContent = this.encryptData(JSON.stringify({ text: content }));
                const timestamp = Date.now();

                const stmt = this.db.prepare(`
                    INSERT INTO posts (id, content_encrypted, timestamp, permissions, media_refs, author_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                stmt.run(postId, encryptedContent, timestamp, permissions, media_refs, this.nodeConfig.node_id);

                res.json({
                    success: true,
                    post_id: postId,
                    timestamp: timestamp
                });
            } catch (error) {
                console.error('Error creating content:', error);
                res.status(500).json({ error: 'Failed to create content' });
            }
        });

        // Get content feed
        this.app.get('/api/feed', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 20;
                const offset = parseInt(req.query.offset) || 0;

                const stmt = this.db.prepare(`
                    SELECT id, content_encrypted, timestamp, permissions, media_refs, author_id
                    FROM posts
                    ORDER BY timestamp DESC
                    LIMIT ? OFFSET ?
                `);

                const posts = stmt.all(limit, offset);
                
                const decryptedPosts = posts.map(post => {
                    try {
                        const decryptedContent = this.decryptData(post.content_encrypted);
                        const contentData = JSON.parse(decryptedContent);
                        
                        return {
                            id: post.id,
                            content: contentData.text,
                            timestamp: post.timestamp,
                            permissions: post.permissions,
                            media_refs: post.media_refs,
                            author_id: post.author_id
                        };
                    } catch (err) {
                        console.error('Failed to decrypt post:', post.id, err);
                        return null;
                    }
                }).filter(post => post !== null);

                res.json({
                    posts: decryptedPosts,
                    total: this.getPostCount(),
                    limit: limit,
                    offset: offset
                });
            } catch (error) {
                console.error('Error fetching feed:', error);
                res.status(500).json({ error: 'Failed to fetch feed' });
            }
        });

        // Get connections
        this.app.get('/api/connections', (req, res) => {
            try {
                const stmt = this.db.prepare(`
                    SELECT node_id, display_name, permission_level, last_seen, status
                    FROM connections
                    ORDER BY last_seen DESC
                `);

                const connections = stmt.all();
                res.json({ connections });
            } catch (error) {
                console.error('Error fetching connections:', error);
                res.status(500).json({ error: 'Failed to fetch connections' });
            }
        });

        // Serve main application
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
    }

    // Encrypt data using AES-256-GCM
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

    // Decrypt data using AES-256-GCM
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

    // Helper methods
    getConnectionCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM connections WHERE status = "connected"');
        return stmt.get().count;
    }

    getPostCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM posts');
        return stmt.get().count;
    }

    // Start the server
    async start() {
        await this.initialize();
        
        this.server = this.app.listen(this.port, () => {
            console.log(`\n🌟 KABOOMedia Node running on port ${this.port}`);
            console.log(`📱 Web Interface: http://localhost:${this.port}`);
            console.log(`🔒 Node ID: ${this.nodeConfig.node_id}`);
            console.log(`📊 API Status: http://localhost:${this.port}/api/status\n`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    // Shutdown gracefully
    async shutdown() {
        console.log('\n🛑 Shutting down KABOOMedia Node...');
        
        if (this.server) {
            this.server.close();
        }
        
        if (this.db) {
            this.db.close();
        }
        
        console.log('✅ Shutdown complete');
        process.exit(0);
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    const server = new KABOOMediaServer();
    server.start().catch(console.error);
}

module.exports = KABOOMediaServer;
