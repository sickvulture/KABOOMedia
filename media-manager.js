const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

class MediaManager {
    constructor(dataDir, encryptionKey) {
        this.dataDir = dataDir;
        this.mediaDir = path.join(dataDir, 'content', 'media');
        this.thumbsDir = path.join(this.mediaDir, 'thumbnails');
        this.encryptionKey = encryptionKey;
        
        // Supported file types
        this.supportedImages = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        this.supportedVideos = ['mp4', 'webm', 'ogv', 'mov', 'avi'];
        this.supportedAudio = ['mp3', 'ogg', 'wav', 'aac', 'm4a'];
        this.supportedDocs = ['pdf', 'txt', 'md', 'doc', 'docx'];
        
        // Size limits (in bytes)
        this.maxImageSize = 10 * 1024 * 1024; // 10MB
        this.maxVideoSize = 100 * 1024 * 1024; // 100MB
        this.maxAudioSize = 50 * 1024 * 1024; // 50MB
        this.maxDocSize = 25 * 1024 * 1024; // 25MB
        
        this.init();
    }

    async init() {
        // Create media directories
        const dirs = [this.mediaDir, this.thumbsDir];
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (err) {
                if (err.code !== 'EEXIST') throw err;
            }
        }
    }

    // Upload and process media file
    async uploadMedia(fileBuffer, originalName, mimeType, authorId) {
        try {
            const fileId = uuidv4();
            const fileExtension = this.getFileExtension(originalName);
            const mediaType = this.getMediaType(fileExtension);
            
            // Validate file type and size
            this.validateFile(fileBuffer, fileExtension, mediaType);
            
            // Generate file paths
            const fileName = `${fileId}.${fileExtension}`;
            const filePath = path.join(this.mediaDir, fileName);
            const encryptedPath = `${filePath}.enc`;
            
            // Process file based on type
            let processedBuffer = fileBuffer;
            let metadata = {
                id: fileId,
                originalName: originalName,
                fileName: fileName,
                mimeType: mimeType,
                mediaType: mediaType,
                size: fileBuffer.length,
                uploadedAt: Date.now(),
                authorId: authorId
            };

            // Generate thumbnails and extract metadata
            if (mediaType === 'image') {
                const imageInfo = await this.processImage(fileBuffer, fileId);
                metadata = { ...metadata, ...imageInfo };
                
                // Optimize image if needed
                if (fileBuffer.length > 2 * 1024 * 1024) { // 2MB
                    processedBuffer = await this.optimizeImage(fileBuffer, fileExtension);
                    metadata.optimized = true;
                    metadata.originalSize = fileBuffer.length;
                    metadata.size = processedBuffer.length;
                }
            } else if (mediaType === 'video') {
                const videoInfo = await this.processVideo(filePath, fileBuffer, fileId);
                metadata = { ...metadata, ...videoInfo };
            } else if (mediaType === 'audio') {
                const audioInfo = await this.processAudio(filePath, fileBuffer, fileId);
                metadata = { ...metadata, ...audioInfo };
            }

            // Encrypt and store file
            const encryptedBuffer = this.encryptFile(processedBuffer);
            await fs.writeFile(encryptedPath, encryptedBuffer);
            
            // Store metadata
            const metadataPath = path.join(this.mediaDir, `${fileId}.meta.json`);
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            
            console.log(`📁 Media uploaded: ${originalName} (${metadata.size} bytes)`);
            
            return {
                mediaId: fileId,
                fileName: fileName,
                originalName: originalName,
                mediaType: mediaType,
                size: metadata.size,
                url: `/api/media/${fileId}`,
                thumbnailUrl: metadata.thumbnail ? `/api/media/${fileId}/thumbnail` : null,
                metadata: metadata
            };

        } catch (error) {
            console.error('Error uploading media:', error);
            throw new Error(`Media upload failed: ${error.message}`);
        }
    }

    // Get media file
    async getMedia(mediaId, getThumbnail = false) {
        try {
            const metadataPath = path.join(this.mediaDir, `${mediaId}.meta.json`);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            let filePath;
            if (getThumbnail && metadata.thumbnail) {
                filePath = path.join(this.thumbsDir, `${mediaId}_thumb.enc`);
            } else {
                filePath = path.join(this.mediaDir, `${metadata.fileName}.enc`);
            }
            
            const encryptedBuffer = await fs.readFile(filePath);
            const decryptedBuffer = this.decryptFile(encryptedBuffer);
            
            return {
                buffer: decryptedBuffer,
                metadata: metadata,
                mimeType: getThumbnail ? 'image/jpeg' : metadata.mimeType
            };
        } catch (error) {
            throw new Error(`Media not found: ${mediaId}`);
        }
    }

    // Delete media file
    async deleteMedia(mediaId, authorId) {
        try {
            const metadataPath = path.join(this.mediaDir, `${mediaId}.meta.json`);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            // Verify ownership
            if (metadata.authorId !== authorId) {
                throw new Error('Unauthorized: Cannot delete media from another user');
            }
            
            // Delete files
            const filesToDelete = [
                path.join(this.mediaDir, `${metadata.fileName}.enc`),
                metadataPath,
                path.join(this.thumbsDir, `${mediaId}_thumb.enc`)
            ];
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file);
                } catch (err) {
                    // File might not exist, continue
                }
            }
            
            console.log(`🗑️ Media deleted: ${metadata.originalName}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete media: ${error.message}`);
        }
    }

    // Process image files
    async processImage(buffer, fileId) {
        try {
            const image = sharp(buffer);
            const imageMetadata = await image.metadata();
            
            // Generate thumbnail
            const thumbnailBuffer = await image
                .resize(300, 300, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 80 })
                .toBuffer();
            
            // Encrypt and save thumbnail
            const encryptedThumb = this.encryptFile(thumbnailBuffer);
            const thumbPath = path.join(this.thumbsDir, `${fileId}_thumb.enc`);
            await fs.writeFile(thumbPath, encryptedThumb);
            
            return {
                width: imageMetadata.width,
                height: imageMetadata.height,
                format: imageMetadata.format,
                colorSpace: imageMetadata.space,
                hasAlpha: imageMetadata.hasAlpha,
                thumbnail: true,
                exif: imageMetadata.exif ? this.extractSafeExif(imageMetadata.exif) : null
            };
        } catch (error) {
            console.error('Error processing image:', error);
            return { thumbnail: false };
        }
    }

    // Process video files
    async processVideo(filePath, buffer, fileId) {
        return new Promise((resolve, reject) => {
            // Write temporary file for ffmpeg
            const tempPath = `${filePath}.temp`;
            fs.writeFile(tempPath, buffer).then(() => {
                
                ffmpeg(tempPath)
                    .ffprobe((err, metadata) => {
                        if (err) {
                            console.error('Error probing video:', err);
                            resolve({ duration: 0, thumbnail: false });
                            return;
                        }
                        
                        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                        const duration = metadata.format.duration || 0;
                        
                        // Generate video thumbnail
                        const thumbPath = path.join(this.thumbsDir, `${fileId}_thumb.jpg`);
                        
                        ffmpeg(tempPath)
                            .screenshots({
                                timestamps: [Math.min(duration * 0.1, 5)], // 10% in or 5 seconds
                                filename: `${fileId}_thumb.jpg`,
                                folder: this.thumbsDir,
                                size: '300x300'
                            })
                            .on('end', async () => {
                                try {
                                    // Encrypt thumbnail
                                    const thumbBuffer = await fs.readFile(thumbPath);
                                    const encryptedThumb = this.encryptFile(thumbBuffer);
                                    await fs.writeFile(`${thumbPath}.enc`, encryptedThumb);
                                    await fs.unlink(thumbPath); // Remove unencrypted version
                                    await fs.unlink(tempPath); // Remove temp file
                                    
                                    resolve({
                                        duration: Math.round(duration),
                                        width: videoStream ? videoStream.width : null,
                                        height: videoStream ? videoStream.height : null,
                                        bitrate: metadata.format.bit_rate,
                                        codec: videoStream ? videoStream.codec_name : null,
                                        thumbnail: true
                                    });
                                } catch (error) {
                                    console.error('Error encrypting video thumbnail:', error);
                                    resolve({ duration: Math.round(duration), thumbnail: false });
                                }
                            })
                            .on('error', (error) => {
                                console.error('Error generating video thumbnail:', error);
                                fs.unlink(tempPath).catch(() => {});
                                resolve({ duration: Math.round(duration), thumbnail: false });
                            });
                    });
            }).catch(reject);
        });
    }

    // Process audio files
    async processAudio(filePath, buffer, fileId) {
        return new Promise((resolve, reject) => {
            // Write temporary file for ffmpeg
            const tempPath = `${filePath}.temp`;
            fs.writeFile(tempPath, buffer).then(() => {
                
                ffmpeg(tempPath)
                    .ffprobe((err, metadata) => {
                        fs.unlink(tempPath).catch(() => {}); // Clean up temp file
                        
                        if (err) {
                            console.error('Error probing audio:', err);
                            resolve({ duration: 0 });
                            return;
                        }
                        
                        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                        const duration = metadata.format.duration || 0;
                        
                        resolve({
                            duration: Math.round(duration),
                            bitrate: metadata.format.bit_rate,
                            codec: audioStream ? audioStream.codec_name : null,
                            sampleRate: audioStream ? audioStream.sample_rate : null,
                            channels: audioStream ? audioStream.channels : null,
                            title: metadata.format.tags ? metadata.format.tags.title : null,
                            artist: metadata.format.tags ? metadata.format.tags.artist : null,
                            album: metadata.format.tags ? metadata.format.tags.album : null
                        });
                    });
            }).catch(reject);
        });
    }

    // Optimize image for storage
    async optimizeImage(buffer, extension) {
        try {
            const image = sharp(buffer);
            
            if (['jpg', 'jpeg'].includes(extension.toLowerCase())) {
                return await image.jpeg({ quality: 85, progressive: true }).toBuffer();
            } else if (extension.toLowerCase() === 'png') {
                return await image.png({ compressionLevel: 6 }).toBuffer();
            } else if (extension.toLowerCase() === 'webp') {
                return await image.webp({ quality: 85 }).toBuffer();
            }
            
            // Default: convert to JPEG
            return await image.jpeg({ quality: 85 }).toBuffer();
        } catch (error) {
            console.error('Error optimizing image:', error);
            return buffer; // Return original if optimization fails
        }
    }

    // File validation
    validateFile(buffer, extension, mediaType) {
        const sizeLimits = {
            image: this.maxImageSize,
            video: this.maxVideoSize,
            audio: this.maxAudioSize,
            document: this.maxDocSize
        };

        const maxSize = sizeLimits[mediaType] || this.maxDocSize;
        
        if (buffer.length > maxSize) {
            throw new Error(`File too large. Maximum size: ${this.formatFileSize(maxSize)}`);
        }

        if (!this.isSupportedFileType(extension)) {
            throw new Error(`Unsupported file type: .${extension}`);
        }
    }

    // Utility methods
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    getMediaType(extension) {
        if (this.supportedImages.includes(extension)) return 'image';
        if (this.supportedVideos.includes(extension)) return 'video';
        if (this.supportedAudio.includes(extension)) return 'audio';
        if (this.supportedDocs.includes(extension)) return 'document';
        return 'unknown';
    }

    isSupportedFileType(extension) {
        return [
            ...this.supportedImages,
            ...this.supportedVideos,
            ...this.supportedAudio,
            ...this.supportedDocs
        ].includes(extension);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    extractSafeExif(exifBuffer) {
        // Extract only safe EXIF data (no GPS coordinates)
        try {
            const exif = {}; // Would use exif-parser or similar library
            return exif;
        } catch (error) {
            return null;
        }
    }

    // Encryption/Decryption for media files
    encryptFile(buffer) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
        
        const encrypted = Buffer.concat([
            cipher.update(buffer),
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag();
        
        return Buffer.concat([iv, authTag, encrypted]);
    }

    decryptFile(encryptedBuffer) {
        const iv = encryptedBuffer.slice(0, 16);
        const authTag = encryptedBuffer.slice(16, 32);
        const encrypted = encryptedBuffer.slice(32);
        
        const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
        decipher.setAuthTag(authTag);
        
        return Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
    }

    // Get media statistics
    async getMediaStats() {
        try {
            const files = await fs.readdir(this.mediaDir);
            const mediaFiles = files.filter(f => f.endsWith('.meta.json'));
            
            let totalSize = 0;
            const typeStats = {
                image: { count: 0, size: 0 },
                video: { count: 0, size: 0 },
                audio: { count: 0, size: 0 },
                document: { count: 0, size: 0 }
            };

            for (const file of mediaFiles) {
                try {
                    const content = await fs.readFile(path.join(this.mediaDir, file), 'utf8');
                    const metadata = JSON.parse(content);
                    
                    totalSize += metadata.size;
                    if (typeStats[metadata.mediaType]) {
                        typeStats[metadata.mediaType].count++;
                        typeStats[metadata.mediaType].size += metadata.size;
                    }
                } catch (err) {
                    // Skip corrupted metadata files
                }
            }

            return {
                totalFiles: mediaFiles.length,
                totalSize: totalSize,
                formattedSize: this.formatFileSize(totalSize),
                byType: typeStats
            };
        } catch (error) {
            console.error('Error getting media stats:', error);
            return { totalFiles: 0, totalSize: 0, formattedSize: '0 Bytes', byType: {} };
        }
    }

    // Cleanup orphaned media files
    async cleanupOrphanedMedia(usedMediaIds) {
        try {
            const files = await fs.readdir(this.mediaDir);
            const mediaFiles = files.filter(f => f.endsWith('.meta.json'));
            let cleaned = 0;

            for (const file of mediaFiles) {
                const mediaId = file.replace('.meta.json', '');
                if (!usedMediaIds.includes(mediaId)) {
                    await this.deleteMediaById(mediaId);
                    cleaned++;
                }
            }

            console.log(`🧹 Cleaned up ${cleaned} orphaned media files`);
            return cleaned;
        } catch (error) {
            console.error('Error cleaning up media:', error);
            return 0;
        }
    }

    async deleteMediaById(mediaId) {
        try {
            const metadataPath = path.join(this.mediaDir, `${mediaId}.meta.json`);
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            const filesToDelete = [
                path.join(this.mediaDir, `${metadata.fileName}.enc`),
                metadataPath,
                path.join(this.thumbsDir, `${mediaId}_thumb.enc`)
            ];
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file);
                } catch (err) {
                    // File might not exist
                }
            }
        } catch (error) {
            console.error(`Error deleting media ${mediaId}:`, error);
        }
    }
}

module.exports = MediaManager;
