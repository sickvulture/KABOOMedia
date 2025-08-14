const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { CryptoManager } = require('./cryptoManager');

class FileManager {
  constructor() {
    this.cryptoManager = new CryptoManager();
    this.storagePath = path.join(__dirname, '../../storage');
    this.tempPath = path.join(__dirname, '../../temp');
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
      'text/plain', 'application/pdf'
    ];
    
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(this.tempPath, { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'encrypted'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'thumbnails'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  // Generate unique file ID
  generateFileId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Validate file
  validateFile(file, userPermissions) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    if (file.size > userPermissions.maxFileSize) {
      throw new Error(`File size exceeds user limit of ${userPermissions.maxFileSize} bytes`);
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    return true;
  }

  // Store encrypted file
  async storeFile(fileBuffer, fileName, mimeType, ownerId, password) {
    const fileId = this.generateFileId();
    const encryptedData = this.cryptoManager.encryptFile(fileBuffer, password);
    
    const metadata = {
      id: fileId,
      originalName: fileName,
      mimeType,
      size: fileBuffer.length,
      encryptedSize: encryptedData.encrypted.length,
      ownerId,
      createdAt: Date.now(),
      iv: encryptedData.iv,
      salt: encryptedData.salt,
      checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex')
    };

    // Store encrypted file
    const filePath = path.join(this.storagePath, 'encrypted', `${fileId}.enc`);
    await fs.writeFile(filePath, encryptedData.encrypted);

    // Store metadata
    const metadataPath = path.join(this.storagePath, 'encrypted', `${fileId}.meta`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Generate thumbnail for images/videos
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      await this.generateThumbnail(fileBuffer, fileId, mimeType);
    }

    return {
      fileId,
      originalName: fileName,
      size: fileBuffer.length,
      mimeType,
      createdAt: metadata.createdAt
    };
  }

  // Retrieve and decrypt file
  async retrieveFile(fileId, password) {
    try {
      // Load metadata
      const metadataPath = path.join(this.storagePath, 'encrypted', `${fileId}.meta`);
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Load encrypted file
      const filePath = path.join(this.storagePath, 'encrypted', `${fileId}.enc`);
      const encryptedData = await fs.readFile(filePath);

      // Decrypt file
      const decryptedBuffer = this.cryptoManager.decryptFile({
        encrypted: encryptedData,
        iv: metadata.iv,
        salt: metadata.salt
      }, password);

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('File integrity check failed');
      }

      return {
        buffer: decryptedBuffer,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to retrieve file: ${error.message}`);
    }
  }

  // Delete file
  async deleteFile(fileId, userId) {
    try {
      // Load metadata to check ownership
      const metadataPath = path.join(this.storagePath, 'encrypted', `${fileId}.meta`);
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Check ownership (in real app, also check permissions)
      if (metadata.ownerId !== userId) {
        throw new Error('Insufficient permissions to delete file');
      }

      // Delete files
      const filePath = path.join(this.storagePath, 'encrypted', `${fileId}.enc`);
      const thumbnailPath = path.join(this.storagePath, 'thumbnails', `${fileId}.thumb`);

      await fs.unlink(filePath).catch(() => {}); // Ignore if doesn't exist
      await fs.unlink(metadataPath).catch(() => {});
      await fs.unlink(thumbnailPath).catch(() => {});

      return true;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Generate thumbnail
  async generateThumbnail(fileBuffer, fileId, mimeType) {
    // This is a placeholder - in a real implementation, you'd use
    // libraries like sharp for images or ffmpeg for videos
    try {
      const thumbnailPath = path.join(this.storagePath, 'thumbnails', `${fileId}.thumb`);
      
      if (mimeType.startsWith('image/')) {
        // For now, just copy the original (in real app, resize it)
        await fs.writeFile(thumbnailPath, fileBuffer);
      }
      
      return thumbnailPath;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }
  }

  // Get file metadata
  async getFileMetadata(fileId) {
    try {
      const metadataPath = path.join(this.storagePath, 'encrypted', `${fileId}.meta`);
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      throw new Error('File not found');
    }
  }

  // Get thumbnail
  async getThumbnail(fileId) {
    try {
      const thumbnailPath = path.join(this.storagePath, 'thumbnails', `${fileId}.thumb`);
      return await fs.readFile(thumbnailPath);
    } catch (error) {
      throw new Error('Thumbnail not found');
    }
  }

  // List user files
  async listUserFiles(userId, limit = 50, offset = 0) {
    try {
      const encryptedDir = path.join(this.storagePath, 'encrypted');
      const files = await fs.readdir(encryptedDir);
      const metaFiles = files.filter(f => f.endsWith('.meta'));
      
      const userFiles = [];
      
      for (const metaFile of metaFiles) {
        try {
          const metadataPath = path.join(encryptedDir, metaFile);
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          
          if (metadata.ownerId === userId) {
            userFiles.push({
              id: metadata.id,
              originalName: metadata.originalName,
              mimeType: metadata.mimeType,
              size: metadata.size,
              createdAt: metadata.createdAt
            });
          }
        } catch (error) {
          // Skip corrupted metadata files
          continue;
        }
      }
      
      // Sort by creation date (newest first)
      userFiles.sort((a, b) => b.createdAt - a.createdAt);
      
      // Apply pagination
      return userFiles.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  // Clean up temporary files
  async cleanupTempFiles() {
    try {
      const tempFiles = await fs.readdir(this.tempPath);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of tempFiles) {
        const filePath = path.join(this.tempPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  // Get storage statistics
  async getStorageStats() {
    try {
      const encryptedDir = path.join(this.storagePath, 'encrypted');
      const files = await fs.readdir(encryptedDir);
      const encFiles = files.filter(f => f.endsWith('.enc'));
      
      let totalSize = 0;
      let fileCount = 0;
      
      for (const file of encFiles) {
        try {
          const filePath = path.join(encryptedDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        } catch (error) {
          continue;
        }
      }
      
      return {
        totalFiles: fileCount,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        totalSizeMB: 0
      };
    }
  }

  // Verify file integrity
  async verifyFileIntegrity(fileId) {
    try {
      const metadata = await this.getFileMetadata(fileId);
      const filePath = path.join(this.storagePath, 'encrypted', `${fileId}.enc`);
      
      // Check if file exists
      await fs.access(filePath);
      
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size !== metadata.encryptedSize) {
        throw new Error('File size mismatch');
      }
      
      return true;
    } catch (error) {
      throw new Error(`File integrity check failed: ${error.message}`);
    }
  }
}

module.exports = { FileManager };
