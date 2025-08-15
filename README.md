# KABOOMedia - Phase 1 Implementation

A decentralized, self-hosted, peer-to-peer social media platform built with privacy and security at its core.

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- 5GB available disk space

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd kaboomedia
   ```

2. **Run the setup wizard**
   ```bash
   node setup.js
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080` (or your configured port)

## 📋 Phase 1 Features ✅

This release implements the core infrastructure as specified in the technical framework:

### ✅ Core Infrastructure
- **Web Server**: Express.js-based server with security headers
- **Encryption**: AES-256-GCM for data at rest, secure key management
- **Local Storage**: SQLite database with encrypted content storage
- **Web Interface**: Modern, responsive single-page application

### ✅ Security Features
- End-to-end encryption for all stored content
- RSA-2048 key pair generation for node identity
- PBKDF2 key derivation for password-based encryption
- Secure file permissions for sensitive data
- Helmet.js security headers

### ✅ Data Management
- Encrypted post storage and retrieval
- Metadata management (timestamps, permissions, author info)
- Content feed with chronological ordering
- Permission-based content visibility

### ✅ User Interface
- Clean, modern design with dark/light theme support
- Real-time node status monitoring
- Content creation with rich text support
- Responsive design for mobile and desktop
- Security indicators and encryption status

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │◄──►│   Express.js     │◄──►│   SQLite DB     │
│  (Frontend UI)  │    │   Web Server     │    │ (Encrypted Data)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │ Encryption Layer│
                       │ AES-256-GCM +   │
                       │ RSA-2048        │
                       └─────────────────┘
```

## 📁 Project Structure

```
kaboomedia/
├── server.js              # Main server application
├── setup.js               # Interactive setup wizard
├── package.json           # Dependencies and scripts
├── README.md              # This documentation
├── .env                   # Environment configuration (generated)
├── .gitignore            # Git ignore rules
├── public/
│   └── index.html        # Web interface
└── kaboomedia/           # Data directory (generated)
    ├── config/
    │   ├── node.json     # Node configuration
    │   └── keys/         # Cryptographic keys
    │       ├── private.pem
    │       ├── public.pem
    │       └── master.key
    ├── content/
    │   ├── posts/        # Post storage
    │   ├── media/        # Media files
    │   └── comments/     # Comments
    ├── cache/            # Temporary files
    └── logs/             # Application logs
```

## 🔐 Security Implementation

### Encryption at Rest
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Key Storage**: Encrypted master keys with secure file permissions
- **Content Protection**: All user content encrypted before database storage

### Network Security
- **TLS Support**: Ready for HTTPS deployment
- **Security Headers**: Comprehensive CSP and security headers via Helmet.js
- **Rate Limiting**: Built-in protection against abuse
- **Input Validation**: Sanitized user inputs

### Key Management
- **Node Identity**: RSA-2048 key pairs for node identification
- **Session Keys**: Ephemeral keys for temporary operations
- **Master Key**: AES-256 key for content encryption
- **Backup Support**: Secure key export/import capabilities

## 🌐 API Endpoints

### Core Endpoints
- `GET /api/status` - Node status and health information
- `GET /api/config` - Public node configuration
- `POST /api/content` - Create new encrypted content
- `GET /api/feed` - Retrieve decrypted content feed
- `GET /api/connections` - List active connections (placeholder)
- `GET /health` - Basic health check

### Authentication
Currently uses local-only authentication. Multi-user support and peer authentication will be implemented in Phase 2.

## ⚙️ Configuration

### Node Configuration (`kaboomedia/config/node.json`)
```json
{
  "node_id": "kaboo_[64-char-hex]",
  "display_name": "Your Node Name",
  "port": 8080,
  "version": "1.0.0",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "key_derivation": "PBKDF2",
    "iterations": 100000
  },
  "permissions": {
    "default_permission": "friends_only",
    "content_visibility": {
      "posts": "friends_only",
      "media": "public",
      "comments": "friends_only"
    }
  }
}
```

### Environment Variables (`.env`)
```bash
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
BCRYPT_ROUNDS=12
SESSION_SECRET=[auto-generated]
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## 🚦 Running the Application

### Development Mode
```bash
npm run dev
```
Uses nodemon for automatic restarts during development.

### Production Mode
```bash
npm start
```
Runs the server in production mode with optimizations.

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run test suite (Phase 2)
- `npm run setup` - Run setup wizard
- `npm run clean` - Remove all data (⚠️ destructive)
- `npm run backup` - Backup node data (Phase 2)
- `npm run restore` - Restore node data (Phase 2)

## 🔧 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
Error: listen EADDRINUSE: address already in use :::8080
```
Solution: Change the port in your configuration or kill the existing process.

**Permission Denied**
```bash
Error: EACCES: permission denied, open 'kaboomedia/config/keys/private.pem'
```
Solution: Ensure you have write permissions in the project directory.

**Database Locked**
```bash
Error: SQLITE_BUSY: database is locked
```
Solution: Ensure no other instances are running, restart the application.

### Logs
Application logs are stored in `kaboomedia/logs/` directory:
- `error.log` - Error messages
- `access.log` - HTTP access logs
- `debug.log` - Debug information (development mode)

## 📊 Performance

### System Requirements
- **Minimum**: 1GB RAM, 5GB storage
- **Recommended**: 2GB RAM, 20GB storage
- **Network**: Broadband internet connection
- **OS**: Linux, macOS, Windows (Node.js supported platforms)

### Database Performance
- SQLite with WAL mode for better concurrency
- Indexed queries for optimal feed performance
- Prepared statements for security and speed
- Automatic vacuum and optimization

## 🔄 Phase 2 Preview

The next phase will implement:

### Networking Features
- P2P connection establishment
- WebRTC for direct peer communication
- Dynamic address resolution
- mDNS local network discovery
- QR code connection sharing

### Social Features
- Real-time messaging between nodes
- Comment system with threading
- Media upload and sharing
- Reaction system (likes, shares)
- Connection management UI

### Advanced Security
- Perfect forward secrecy
- Peer authentication protocols
- Anonymous connection options
- Advanced permission granularity

## 🐛 Known Limitations (Phase 1)

- **Single User**: Currently supports one user per node
- **No P2P**: Connections and networking not yet implemented
- **Local Only**: No external network communication
- **Basic UI**: Limited social interaction features
- **No Media**: File upload system pending Phase 3

## 🤝 Contributing

KABOOMedia is open source under the GNU GPL v3.0 license.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

### Code Style
- ESLint configuration included
- Prettier for code formatting
- JSDoc comments for functions
- Comprehensive error handling

## 📜 License

This project is licensed under the GNU General Public License v3.0.

### License Requirements
- Source code must remain open source
- Modifications must be released under GPL v3
- Copyright notices must be preserved
- Patent grants are included

See `LICENSE` file for full terms.

## 👥 Authors

- **Chris Smith** - Project Creator
- **Claude AI** - Development Assistant

## 🙏 Acknowledgments

- **SQLite** - Embedded database engine
- **Express.js** - Web application framework
- **Node.js** - JavaScript runtime
- **Better-SQLite3** - Synchronous SQLite3 bindings
- **Helmet.js** - Security middleware

## 📞 Support

For issues, questions, or contributions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Join our community discussions

---

**🌟 KABOOMedia Phase 1 - Core Infrastructure Complete ✅**

*Built with privacy, security, and decentralization at the core.*
