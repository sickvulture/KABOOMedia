const express = require('express');
const jwt = require('jsonwebtoken');
const { CryptoManager } = require('../utils/cryptoManager');
const { Logger } = require('../utils/logger');

const router = express.Router();
const cryptoManager = new CryptoManager();
const logger = new Logger();

// In-memory user store (in production, use a proper database)
const users = new Map();
const sessions = new Map();

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate new key pair for user
router.post('/generate-keys', async (req, res) => {
  try {
    const keyPair = cryptoManager.generateKeyPair();
    logger.info('Key pair generated');
    
    res.json({
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    });
  } catch (error) {
    logger.error('Key generation failed:', { error: error.message });
    res.status(500).json({ error: 'Key generation failed' });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey, privateKey } = req.body;
    
    if (!username || !password || !publicKey || !privateKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    if (users.has(username)) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const { hash, salt } = cryptoManager.hashPassword(password);
    
    // Create user
    const user = {
      id: cryptoManager.generateSecureToken(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      publicKey,
      privateKey, // In production, this should be encrypted with user's password
      createdAt: Date.now(),
      isActive: true
    };
    
    users.set(username, user);
    
    logger.info('User registered:', { username, userId: user.id });
    
    res.status(201).json({
      message: 'User registered successfully',
      userId: user.id,
      publicKey: user.publicKey
    });
  } catch (error) {
    logger.error('Registration failed:', { error: error.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Find user
    const user = users.get(username);
    if (!user) {
      logger.security('Login attempt with invalid username:', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValid = cryptoManager.verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      logger.security('Login attempt with invalid password:', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Create session
    const sessionId = cryptoManager.generateSecureToken();
    sessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    
    logger.info('User logged in:', { username, userId: user.id });
    
    res.json({
      token,
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Login failed:', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId) {
      sessions.delete(sessionId);
    }
    
    logger.info('User logged out:', { userId: req.user.userId });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout failed:', { error: error.message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      publicKey: user.publicKey,
      createdAt: user.createdAt,
      isActive: user.isActive
    });
  } catch (error) {
    logger.error('Profile fetch failed:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body;
    
    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }
      
      const isValid = cryptoManager.verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid current password' });
      }
      
      // Hash new password
      const { hash, salt } = cryptoManager.hashPassword(newPassword);
      user.passwordHash = hash;
      user.passwordSalt = salt;
      
      logger.security('Password changed:', { userId: user.id });
    }
    
    users.set(user.username, user);
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Profile update failed:', { error: error.message });
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Verify token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({
      valid: true,
      user: {
        userId: decoded.userId,
        username: decoded.username
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token
    const newToken = jwt.sign(
      { userId: req.user.userId, username: req.user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token: newToken });
  } catch (error) {
    logger.error('Token refresh failed:', { error: error.message });
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
}

// Export middleware for use in other routes
router.authenticateToken = authenticateToken;

module.exports = router;
