const express = require('express');
const multer = require('multer');
const { FileManager } = require('../utils/fileManager');
const { PermissionManager } = require('../utils/permissionManager');
const { Logger } = require('../utils/logger');
const authRouter = require('./auth');

const router = express.Router();
const fileManager = new FileManager();
const permissionManager = new PermissionManager();
const logger = new Logger();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
      'text/plain', 'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Upload file
router.post('/upload', authRouter.authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { networkId, password } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    if (!networkId) {
      return res.status(400).json({ error: 'Network ID required' });
    }
    
    if (!password) {
      return res.status(400).json({ error: 'Encryption password required' });
    }
    
    // Check upload permissions
    const userPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    
    try {
      fileManager.validateFile(req.file, userPermissions);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    
    // Store encrypted file
    const fileData = await fileManager.storeFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user.userId,
      password
    );
    
    logger.file('File uploaded:', {
      fileId: fileData.fileId,
      fileName: fileData.originalName,
      size: fileData.size,
      userId: req.user.userId,
      networkId
    });
    
    res.status(201).json({
      fileId: fileData.fileId,
      originalName: fileData.originalName,
      size: fileData.size,
      mimeType: fileData.mimeType,
      createdAt: fileData.createdAt
    });
  } catch (error) {
    logger.error('File upload failed:', { 
      error: error.message,
      userId: req.user.userId,
      fileName: req.file?.originalname
    });
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Upload multiple files
router.post('/upload-multiple', authRouter.authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { networkId, password } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    if (!networkId || !password) {
      return res.status(400).json({ error: 'Network ID and password required' });
    }
    
    const userPermissions = permissionManager.getUserPermissions(networkId, req.user.userId);
    const uploadedFiles = [];
    const errors = [];
    
    for (const file of req.files) {
      try {
        fileManager.validateFile(file, userPermissions);
        
        const fileData = await fileManager.storeFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          req.user.userId,
          password
        );
        
        uploadedFiles.push({
          fileId: fileData.fileId,
          originalName: fileData.originalName,
          size: fileData.size,
          mimeType: fileData.mimeType,
          createdAt: fileData.createdAt
        });
        
        logger.file('File uploaded:', {
          fileId: fileData.fileId,
          fileName: fileData.originalName,
          userId: req.user.userId,
          networkId
        });
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      uploadedFiles,
      errors,
      totalUploaded: uploadedFiles.length,
      totalErrors: errors.length
    });
  } catch (error) {
    logger.error('Multiple file upload failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Multiple file upload failed' });
  }
});

// Download file
router.get('/:fileId/download', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { password } = req.query;
    
    if (!password) {
      return res.status(400).json({ error: 'Decryption password required' });
    }
    
    // Get file metadata first to check permissions
    const metadata = await fileManager.getFileMetadata(fileId);
    
    // Basic ownership check (in production, implement proper network permission checking)
    if (metadata.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Insufficient permissions to access file' });
    }
    
    // Retrieve and decrypt file
    const { buffer, metadata: fileMetadata } = await fileManager.retrieveFile(fileId, password);
    
    logger.file('File downloaded:', {
      fileId,
      fileName: fileMetadata.originalName,
      userId: req.user.userId
    });
    
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.originalName}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    logger.error('File download failed:', { 
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user.userId
    });
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'File not found' });
    } else if (error.message.includes('integrity')) {
      res.status(500).json({ error: 'File integrity check failed' });
    } else {
      res.status(500).json({ error: 'File download failed' });
    }
  }
});

// Stream file (for media playback)
router.get('/:fileId/stream', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { password } = req.query;
    
    if (!password) {
      return res.status(400).json({ error: 'Decryption password required' });
    }
    
    const metadata = await fileManager.getFileMetadata(fileId);
    
    // Check permissions
    if (metadata.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Insufficient permissions to access file' });
    }
    
    // Only allow streaming for media files
    if (!metadata.mimeType.startsWith('video/') && !metadata.mimeType.startsWith('audio/')) {
      return res.status(400).json({ error: 'File type not streamable' });
    }
    
    const { buffer } = await fileManager.retrieveFile(fileId, password);
    
    logger.file('File streamed:', {
      fileId,
      fileName: metadata.originalName,
      userId: req.user.userId
    });
    
    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', buffer.length);
    
    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
      res.setHeader('Content-Length', chunksize);
      
      res.send(buffer.slice(start, end + 1));
    } else {
      res.send(buffer);
    }
  } catch (error) {
    logger.error('File streaming failed:', { 
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'File streaming failed' });
  }
});

// Get file thumbnail
router.get('/:fileId/thumbnail', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const metadata = await fileManager.getFileMetadata(fileId);
    
    // Check permissions
    if (metadata.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Insufficient permissions to access file' });
    }
    
    const thumbnailBuffer = await fileManager.getThumbnail(fileId);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    res.send(thumbnailBuffer);
  } catch (error) {
    logger.error('Thumbnail fetch failed:', { 
      error: error.message,
      fileId: req.params.fileId
    });
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

// Get file metadata
router.get('/:fileId/metadata', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = await fileManager.getFileMetadata(fileId);
    
    // Check permissions
    if (metadata.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Insufficient permissions to access file' });
    }
    
    res.json({
      id: metadata.id,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      createdAt: metadata.createdAt,
      ownerId: metadata.ownerId
    });
  } catch (error) {
    logger.error('Metadata fetch failed:', { 
      error: error.message,
      fileId: req.params.fileId
    });
    res.status(404).json({ error: 'File not found' });
  }
});

// List user files
router.get('/', authRouter.authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const files = await fileManager.listUserFiles(
      req.user.userId,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({
      files,
      hasMore: files.length === parseInt(limit)
    });
  } catch (error) {
    logger.error('File list fetch failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch file list' });
  }
});

// Delete file
router.delete('/:fileId', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const success = await fileManager.deleteFile(fileId, req.user.userId);
    
    if (success) {
      logger.file('File deleted:', {
        fileId,
        userId: req.user.userId
      });
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found or insufficient permissions' });
    }
  } catch (error) {
    logger.error('File deletion failed:', { 
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'File deletion failed' });
  }
});

// Verify file integrity
router.post('/:fileId/verify', authRouter.authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const metadata = await fileManager.getFileMetadata(fileId);
    
    // Check permissions
    if (metadata.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Insufficient permissions to verify file' });
    }
    
    const isValid = await fileManager.verifyFileIntegrity(fileId);
    
    res.json({
      fileId,
      isValid,
      message: isValid ? 'File integrity verified' : 'File integrity check failed'
    });
  } catch (error) {
    logger.error('File verification failed:', { 
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'File verification failed' });
  }
});

// Get storage statistics
router.get('/stats/storage', authRouter.authenticateToken, async (req, res) => {
  try {
    const stats = await fileManager.getStorageStats();
    
    res.json(stats);
  } catch (error) {
    logger.error('Storage stats fetch failed:', { 
      error: error.message,
      userId: req.user.userId
    });
    res.status(500).json({ error: 'Failed to fetch storage statistics' });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field' });
    }
  }
  
  if (error.message.includes('not allowed')) {
    return res.status(400).json({ error: error.message });
  }
  
  logger.error('File route error:', { error: error.message });
  res.status(500).json({ error: 'File operation failed' });
});

module.exports = router;
