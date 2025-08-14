# KABOOMedia

A decentralized encrypted social media platform with peer-to-peer networking and enhanced privacy controls.

## Features

- **Decentralized Architecture**: No central registry - users connect directly via QR codes or secure links
- **End-to-End Encryption**: All data encrypted at rest and in transit
- **Peer-to-Peer Networking**: Direct connections between users without relying on central servers
- **Dynamic Addressing**: Mobile-friendly with automatic network reconnection
- **Granular Permissions**: Fine-grained control over what visitors can view and do
- **Multi-Media Support**: Share posts, videos, music, and files
- **Privacy-Focused**: Minimal data tracking, all logging done locally only
- **Self-Hosted**: Run your own instance for complete control

## Technology Stack

### Backend
- **Node.js** with Express.js
- **Socket.io** for real-time communication
- **Node-forge** for cryptographic operations
- **Multer** for file uploads
- **JWT** for authentication

### Frontend
- **React 18** with modern hooks
- **React Router** for navigation
- **Socket.io Client** for real-time updates
- **Tailwind CSS** for styling
- **React Player** for media playback

### Security
- **RSA-2048** for asymmetric encryption
- **AES-256-GCM** for symmetric encryption
- **PBKDF2** for password hashing
- **Digital signatures** for message verification

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kaboomedia
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Production Deployment

1. **Build the client**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Security
JWT_SECRET=your-very-secure-jwt-secret-key
ENCRYPTION_KEY=your-32-byte-encryption-key

# File Storage
MAX_FILE_SIZE=104857600
STORAGE_PATH=./storage

# Network
MAX_PEERS_PER_NETWORK=100
NETWORK_TIMEOUT=30000
```

### Security Considerations

- Change default JWT secret in production
- Use HTTPS in production environments
- Regularly rotate encryption keys
- Monitor storage usage and implement cleanup policies
- Set up proper firewall rules for peer connections

## Usage

### Creating Your First Network

1. **Register an account**
   - Generate new cryptographic keys
   - Create username and password
   - Keys are stored locally encrypted

2. **Create a network**
   - Set network name and privacy settings
   - Configure member permissions
   - Generate invitation codes/QR codes

3. **Invite others**
   - Share QR codes or invitation links
   - Set permission levels for new members
   - Monitor network activity

### Connecting to Networks

1. **Scan QR code** or enter invitation code
2. **Review permissions** being granted
3. **Accept invitation** to join network
4. **Start sharing** posts, media, and files

### File Sharing

- **Upload files** with automatic encryption
- **Stream media** directly in browser
- **Share securely** with permission controls
- **Download** with automatic decryption

## Architecture

### Decentralized Design

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User A    │◄──►│   User B    │◄──►│   User C    │
│ (Mobile)    │    │ (Desktop)   │    │ (Server)    │
└─────────────┘    └─────────────┘    └─────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌─────────────┐
                   │   User D    │
                   │  (Laptop)   │
                   └─────────────┘
```

### Security Model

1. **Key Generation**: RSA-2048 key pairs for each user
2. **Identity Verification**: Digital signatures for all messages
3. **Data Encryption**: AES-256 for file storage, RSA for key exchange
4. **Permission System**: Role-based access with granular controls
5. **Network Isolation**: Each network operates independently

### File Storage

```
storage/
├── encrypted/          # Encrypted user files
│   ├── *.enc          # Encrypted file data
│   └── *.meta         # File metadata
├── thumbnails/         # Generated thumbnails
└── temp/              # Temporary upload files
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/verify` - Verify JWT token

### Network Endpoints

- `POST /api/network/create` - Create new network
- `POST /api/network/join` - Join network via invitation
- `GET /api/network/:id` - Get network information
- `POST /api/network/:id/invite` - Generate invitation
- `GET /api/network/:id/peers` - List network peers

### File Endpoints

- `POST /api/files/upload` - Upload encrypted file
- `GET /api/files/:id/download` - Download file
- `GET /api/files/:id/stream` - Stream media file
- `DELETE /api/files/:id` - Delete file

### Posts Endpoints

- `POST /api/posts` - Create new post
- `GET /api/posts/network/:id` - Get network posts
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post

## Development

### Project Structure

```
kaboomedia/
├── server/                 # Backend Node.js application
│   ├── routes/            # API route handlers
│   ├── utils/             # Utility classes
│   └── index.js           # Server entry point
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── styles/        # CSS styles
│   └── public/           # Static assets
├── logs/                  # Application logs
├── storage/               # File storage
└── package.json          # Project dependencies
```

### Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client && npm test

# Run integration tests
npm run test:integration
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Privacy Policy

KABOOMedia is designed with privacy as a core principle:

- **No central data collection** - all data stays on user devices
- **Local-only logging** - debugging information never leaves your system
- **Encrypted storage** - all files encrypted with user-controlled keys
- **Minimal metadata** - only essential information for network operation
- **User-controlled sharing** - granular permissions for all content

## Security

### Reporting Vulnerabilities

Please report security vulnerabilities to: [security@kaboomedia.org]

### Security Features

- End-to-end encryption for all communications
- Digital signatures for message authenticity
- Secure key generation and storage
- Protection against common web vulnerabilities
- Regular security audits and updates

## Roadmap



## Support

### Community
- GitHub Issues: [Report bugs and feature requests]
- Discussions: [Community discussions and help]
- Discord: [Real-time community chat]

### Documentation
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guide](docs/security.md)
- [Developer Guide](docs/development.md)

## Acknowledgments

- **Chris Smith** - Creator and Lead Developer
- **Claude AI** - Development Assistant
- **Open Source Community** - Libraries and inspiration
- **Privacy Advocates** - Guidance on security practices

Built with ❤️ for a more private and decentralized internet.
