const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorFile = path.join(this.logDir, 'error.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    
    this.initializeLogging();
  }

  async initializeLogging() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize logging directory:', error);
    }
  }

  // Format log entry
  formatLogEntry(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      pid: process.pid,
      ...metadata
    };
    
    return JSON.stringify(entry) + '\n';
  }

  // Write log entry to file
  async writeLog(level, message, metadata = {}) {
    try {
      const logEntry = this.formatLogEntry(level, message, metadata);
      const targetFile = level === 'error' ? this.errorFile : this.logFile;
      
      // Check file size and rotate if necessary
      await this.rotateLogIfNeeded(targetFile);
      
      // Write to file (only essential logging for debugging)
      await fs.appendFile(targetFile, logEntry);
      
      // Also log to console in development
      if (process.env.NODE_ENV !== 'production') {
        const consoleMessage = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;
        if (level === 'error') {
          console.error(consoleMessage, metadata);
        } else {
          console.log(consoleMessage, metadata);
        }
      }
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Logging failed:', error.message);
      console.log(`${level.toUpperCase()}: ${message}`, metadata);
    }
  }

  // Rotate log file if it exceeds size limit
  async rotateLogIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);
      
      if (stats.size > this.maxLogSize) {
        const ext = path.extname(logFile);
        const basename = path.basename(logFile, ext);
        const dirname = path.dirname(logFile);
        
        // Rotate existing files
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = path.join(dirname, `${basename}.${i}${ext}`);
          const newFile = path.join(dirname, `${basename}.${i + 1}${ext}`);
          
          try {
            await fs.rename(oldFile, newFile);
          } catch (error) {
            // File doesn't exist, continue
          }
        }
        
        // Move current log to .1
        const rotatedFile = path.join(dirname, `${basename}.1${ext}`);
        await fs.rename(logFile, rotatedFile);
      }
    } catch (error) {
      // If stat fails, file doesn't exist yet, which is fine
    }
  }

  // Public logging methods
  info(message, metadata = {}) {
    this.writeLog('info', message, metadata);
  }

  warn(message, metadata = {}) {
    this.writeLog('warn', message, metadata);
  }

  error(message, metadata = {}) {
    this.writeLog('error', message, metadata);
  }

  debug(message, metadata = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.writeLog('debug', message, metadata);
    }
  }

  // Log security events (minimal data, local only)
  security(event, metadata = {}) {
    const securityMetadata = {
      ...metadata,
      type: 'security',
      userAgent: metadata.userAgent ? 'redacted' : undefined,
      ip: metadata.ip ? 'redacted' : undefined
    };
    
    this.writeLog('security', event, securityMetadata);
  }

  // Log network events
  network(event, metadata = {}) {
    this.writeLog('network', event, {
      ...metadata,
      type: 'network'
    });
  }

  // Log file operations
  file(event, metadata = {}) {
    this.writeLog('file', event, {
      ...metadata,
      type: 'file'
    });
  }

  // Get recent logs (for debugging)
  async getRecentLogs(level = 'all', limit = 100) {
    try {
      const targetFile = level === 'error' ? this.errorFile : this.logFile;
      const content = await fs.readFile(targetFile, 'utf8');
      const lines = content.trim().split('\n');
      
      const logs = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return { message: line, level: 'unknown' };
          }
        })
        .filter(log => level === 'all' || log.level === level);
      
      return logs;
    } catch (error) {
      return [];
    }
  }

  // Clean old log files
  async cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          this.info(`Cleaned old log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to clean old logs:', { error: error.message });
    }
  }

  // Get log statistics
  async getLogStats() {
    try {
      const files = await fs.readdir(this.logDir);
      let totalSize = 0;
      let fileCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileCount++;
      }
      
      return {
        totalFiles: fileCount,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeMB: 0
      };
    }
  }
}

module.exports = { Logger };
