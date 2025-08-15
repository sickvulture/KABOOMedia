#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

class KABOOMediaSetup {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run() {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     KABOOMedia Setup v1.0                    ║
║               Decentralized Social Media Platform             ║
║                                                               ║
║  Licensed under GNU GPL v3.0                                 ║
║  Created by Chris Smith with Claude AI                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

        try {
            console.log('🚀 Starting KABOOMedia setup...\n');

            // Check system requirements
            await this.checkSystemRequirements();

            // Get user configuration
            const config = await this.getUserConfiguration();

            // Create directories and files
            await this.createDirectoryStructure();
            await this.createConfigurationFiles(config);
            await this.createPublicDirectory();
            await this.generateSecurityFiles();

            console.log('\n✅ KABOOMedia setup completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('   1. Install dependencies: npm install');
            console.log('   2. Start the server: npm start');
            console.log(`   3. Open your browser: http://localhost:${config.port}`);
            console.log('\n🔒 Your node is secured with end-to-end encryption');
            console.log('🌐 Share your node address with friends to connect\n');

        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    async checkSystemRequirements() {
        console.log('🔍 Checking system requirements...');

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 16) {
            throw new Error(`Node.js 16.0.0 or higher required. Current version: ${nodeVersion}`);
        }

        // Check available disk space (simplified check)
        try {
            const stats = await fs.stat('.');
            console.log('   ✓ Disk access verified');
        } catch (error) {
            throw new Error('Cannot access current directory');
        }

        console.log(`   ✓ Node.js ${nodeVersion} detected`);
        console.log('   ✓ System requirements met\n');
    }

    async getUserConfiguration() {
        console.log('⚙️  Configuration setup...\n');

        const config = {};

        // Node display name
        config.displayName = await this.question(
            'Enter a display name for your node (default: "My KABOOMedia Node"): '
        ) || 'My KABOOMedia Node';

        // Port configuration
        const portInput = await this.question('Enter port number (default: 8080): ');
        config.port = parseInt(portInput) || 8080;

        if (config.port < 1024 || config.port > 65535) {
            throw new Error('Port must be between 1024 and 65535');
        }

        // Network discovery
        const enableDiscovery = await this.question(
            'Enable local network discovery? (y/N): '
        );
        config.discoveryEnabled = enableDiscovery.toLowerCase() === 'y';

        // Content settings
        const defaultPermission = await this.question(
            'Default content permission (public/friends/private) [friends]: '
        ) || 'friends';
        
        if (!['public', 'friends', 'private'].includes(defaultPermission)) {
            throw new Error('Invalid permission level');
        }
        config.defaultPermission = defaultPermission;

        return config;
    }

    async createDirectoryStructure() {
        console.log('\n📁 Creating directory structure...');

        const directories = [
            'kaboomedia',
            'kaboomedia/config',
            'kaboomedia/config/keys',
            'kaboomedia/content',
            'kaboomedia/content/posts',
            'kaboomedia/content/media',
            'kaboomedia/content/comments',
            'kaboomedia/cache',
            'kaboomedia/logs',
            'public'
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`   ✓ Created ${dir}/`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw new Error(`Failed to create directory ${dir}: ${error.message}`);
                }
            }
        }
    }

    async createConfigurationFiles(userConfig) {
        console.log('\n⚙️  Creating configuration files...');

        // Generate node ID
        const nodeId = `kaboo_${crypto.randomBytes(32).toString('hex')}`;

        // Main node configuration
        const nodeConfig = {
            node_id: nodeId,
            display_name: userConfig.displayName,
            port: userConfig.port,
            version: "1.0.0",
            created_at: new Date().toISOString(),
            encryption: {
                algorithm: "AES-256-GCM",
                key_derivation: "PBKDF2",
                iterations: 100000
            },
            discovery: {
                mdns_enabled: userConfig.discoveryEnabled,
                upnp_enabled: false,
                manual_address: null
            },
            permissions: {
                default_permission: userConfig.defaultPermission,
                permissions: {
                    owner: ["view_private", "view_public", "comment", "react", "admin"],
                    friend: ["view_private", "view_public", "comment", "react"],
                    visitor: ["view_public"],
                    blocked: []
                },
                content_visibility: {
                    posts: userConfig.defaultPermission === 'public' ? 'public' : 'friends_only',
                    media: "public",
                    comments: "friends_only"
                }
            }
        };

        await fs.writeFile(
            'kaboomedia/config/node.json',
            JSON.stringify(nodeConfig, null, 2)
        );
        console.log('   ✓ Created node.json');

        // Environment configuration
        const envConfig = `# KABOOMedia Environment Configuration
# Generated on ${new Date().toISOString()}

NODE_ENV=production
PORT=${userConfig.port}
LOG_LEVEL=info

# Security settings
BCRYPT_ROUNDS=12
SESSION_SECRET=${crypto.randomBytes(64).toString('hex')}

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
`;

        await fs.writeFile('.env', envConfig);
        console.log('   ✓ Created .env file');
    }

    async createPublicDirectory() {
        console.log('\n🌐 Setting up web interface...');

        // Create a basic index.html if it doesn't exist
        const indexPath = 'public/index.html';
        try {
            await fs.access(indexPath);
            console.log('   ✓ Web interface already exists');
        } catch (error) {
            // Create a placeholder index.html
            const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KABOOMedia Setup</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .logo { font-size: 2.5em; color: #2c3e50; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">KABOOMedia</div>
        <h2>Setup Complete!</h2>
        <p>Your KABOOMedia node is ready. Please restart the server to load the full interface.</p>
        <p><strong>Node ID:</strong> <code id="nodeId">Loading...</code></p>
        <button onclick="window.location.reload()">Refresh</button>
    </div>
    <script>
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                document.getElementById('nodeId').textContent = data.node_id;
            })
            .catch(() => {
                document.getElementById('nodeId').textContent = 'Server not running';
            });
    </script>
</body>
</html>`;

            await fs.writeFile(indexPath, placeholderHtml);
            console.log('   ✓ Created placeholder web interface');
        }
    }

    async generateSecurityFiles() {
        console.log('\n🔐 Generating security keys...');

        // Generate RSA key pair
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

        // Generate master encryption key
        const masterKey = crypto.randomBytes(32);

        // Save keys with proper permissions
        await fs.writeFile('kaboomedia/config/keys/private.pem', privateKey, { mode: 0o600 });
        await fs.writeFile('kaboomedia/config/keys/public.pem', publicKey);
        await fs.writeFile('kaboomedia/config/keys/master.key', masterKey.toString('hex'), { mode: 0o600 });

        console.log('   ✓ Generated RSA key pair (2048-bit)');
        console.log('   ✓ Generated master encryption key (256-bit)');
        console.log('   ✓ Set secure file permissions');

        // Create .gitignore to protect sensitive files
        const gitignore = `# KABOOMedia Security Files
kaboomedia/config/keys/
kaboomedia/logs/
.env
*.log

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db
`;

        await fs.writeFile('.gitignore', gitignore);
        console.log('   ✓ Created .gitignore for security');
    }

    question(prompt) {
        return new Promise(resolve => {
            this.rl.question(prompt, resolve);
        });
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new KABOOMediaSetup();
    setup.run().catch(console.error);
}

module.exports = KABOOMediaSetup;
