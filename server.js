const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { P2PNetworkManager } = require('./networking');
const QRCodeGenerator = require('./qr-generator');

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
        this.networkManager = null;
        this.qrGenerator = null;
        this.tempCodes = new Map(); // Store temporary connection codes
    }

    // Initialize the application
    async initialize() {
        console.log('🚀 Initializing KABOOMedia Node...');
        
        await this.createDirectories();
        await this.initializeDatabase();
        await this.loadOrCreateConfig();
        await this.generateOrLoadKeys();
        await this.initializeNetworking();
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
                author_name TEXT,
                is_remote INTEGER DEFAULT 0,
                sync_status TEXT DEFAULT 'synced',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS connections (
                node_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                permission_level INTEGER DEFAULT 2,
                last_seen INTEGER,
                public_key TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                connection_type TEXT DEFAULT 'direct',
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS node_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id TEXT NOT NULL,
                content_id TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                status TEXT DEFAULT 'pending'
            );

            CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_posts_author
