const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { CryptoManager } = require('./utils/cryptoManager');
const { NetworkManager } = require('./utils/networkManager');
const { PermissionManager } = require('./utils/permissionManager');
const { FileManager } = require('./utils/fileManager');
const { Logger } = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const logger = new Logger();
const cryptoManager = new CryptoManager();
const networkManager = new NetworkManager();
const permissionManager = new PermissionManager();
const fileManager = new FileManager();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/files', require('./routes/files'));
app.use('/api/network', require('./routes/network'));
app.use('/api/permissions', require('./routes/permissions'));

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-network', async (data) => {
    try {
      const { networkId, userId, publicKey } = data;
      await networkManager.joinNetwork(networkId, userId, publicKey, socket);
      socket.emit('network-joined', { networkId, peers: networkManager.getNetworkPeers(networkId) });
    } catch (error) {
      logger.error('Error joining network:', error.message);
      socket.emit('error', { message: 'Failed to join network' });
    }
  });

  socket.on('discover-peers', async (data) => {
    try {
      const { networkId } = data;
      const peers = await networkManager.discoverPeers(networkId);
      socket.emit('peers-discovered', { peers });
    } catch (error) {
      logger.error('Error discovering peers:', error.message);
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const { to, encryptedMessage, signature } = data;
      const verified = await cryptoManager.verifySignature(encryptedMessage, signature, data.publicKey);
      
      if (verified) {
        io.to(to).emit('message-received', { 
          from: socket.id, 
          encryptedMessage, 
          timestamp: Date.now() 
        });
      }
    } catch (error) {
      logger.error('Error sending message:', error.message);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    networkManager.removeFromAllNetworks(socket.id);
  });
});

// Catch all handler for React Router
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

server.listen(PORT, () => {
  logger.info(`KABOOMedia server running on port ${PORT}`);
});
