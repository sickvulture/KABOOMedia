const crypto = require('crypto');

class QRCodeGenerator {
    constructor(nodeConfig) {
        this.nodeConfig = nodeConfig;
    }

    // Generate connection URI for QR code
    generateConnectionURI() {
        const connectionData = {
            nodeId: this.nodeConfig.node_id,
            displayName: this.nodeConfig.display_name,
            publicKey: this.getPublicKey(),
            version: this.nodeConfig.version,
            timestamp: Date.now()
        };

        // Create a kaboo:// URI
        const uri = `kaboo://${this.nodeConfig.node_id}@${this.getNodeAddress()}:${this.nodeConfig.port + 1}`;
        
        return {
            uri: uri,
            data: connectionData,
            qrData: this.encodeForQR(connectionData)
        };
    }

    // Generate temporary connection code
    generateTempConnectionCode(expirationMinutes = 30) {
        const tempCode = crypto.randomBytes(16).toString('hex');
        const expiresAt = Date.now() + (expirationMinutes * 60 * 1000);
        
        const connectionData = {
            tempCode: tempCode,
            nodeId: this.nodeConfig.node_id,
            displayName: this.nodeConfig.display_name,
            publicKey: this.getPublicKey(),
            expiresAt: expiresAt,
            type: 'temp_connection'
        };

        return {
            code: tempCode,
            data: connectionData,
            qrData: this.encodeForQR(connectionData),
            expiresAt: expiresAt
        };
    }

    // Encode data for QR code
    encodeForQR(data) {
        const jsonString = JSON.stringify(data);
        const compressed = this.compressData(jsonString);
        return `KABOO:${Buffer.from(compressed).toString('base64')}`;
    }

    // Decode QR code data
    decodeFromQR(qrData) {
        try {
            if (!qrData.startsWith('KABOO:')) {
                throw new Error('Invalid QR code format');
            }

            const base64Data = qrData.substring(6); // Remove 'KABOO:' prefix
            const compressed = Buffer.from(base64Data, 'base64');
            const jsonString = this.decompressData(compressed);
            
            return JSON.parse(jsonString);
        } catch (error) {
            throw new Error(`Failed to decode QR data: ${error.message}`);
        }
    }

    // Simple compression (in production, use proper compression library)
    compressData(data) {
        // For now, just return the data as-is
        // In production, implement gzip or similar compression
        return data;
    }

    decompressData(data) {
        // Corresponding decompression
        return data.toString();
    }

    // Get current node address (simplified)
    getNodeAddress() {
        // In production, this should detect the actual IP address
        // For local testing, return localhost
        return 'localhost';
    }

    getPublicKey() {
        return this.nodeConfig.publicKey || 'PUBLIC_KEY_PLACEHOLDER';
    }

    // Validate connection data
    validateConnectionData(data) {
        const required = ['nodeId', 'displayName', 'publicKey'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Check if temporary connection has expired
        if (data.type === 'temp_connection' && data.expiresAt < Date.now()) {
            throw new Error('Connection code has expired');
        }

        return true;
    }

    // Generate SVG QR code representation (simplified)
    generateSVGQRCode(data, size = 200) {
        // This is a simplified version for demonstration
        // In production, use a proper QR code library like 'qrcode'
        
        const qrSize = 21; // Standard QR code is 21x21 modules
        const moduleSize = size / qrSize;
        
        // Generate a simple pattern (not a real QR code)
        const pattern = this.generateSimplePattern(data, qrSize);
        
        let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${size}" height="${size}" fill="white"/>`;
        
        for (let y = 0; y < qrSize; y++) {
            for (let x = 0; x < qrSize; x++) {
                if (pattern[y][x]) {
                    const rectX = x * moduleSize;
                    const rectY = y * moduleSize;
                    svg += `<rect x="${rectX}" y="${rectY}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
                }
            }
        }
        
        svg += '</svg>';
        return svg;
    }

    // Generate a simple pattern for demonstration
    generateSimplePattern(data, size) {
        const pattern = Array(size).fill().map(() => Array(size).fill(false));
        
        // Add finder patterns (corners)
        this.addFinderPattern(pattern, 0, 0);
        this.addFinderPattern(pattern, size - 7, 0);
        this.addFinderPattern(pattern, 0, size - 7);
        
        // Add some data pattern based on input
        const hash = crypto.createHash('md5').update(data).digest('hex');
        for (let i = 0; i < hash.length && i < size * size / 4; i++) {
            const val = parseInt(hash[i], 16);
            const x = (i * 3) % size;
            const y = Math.floor((i * 3) / size) % size;
            pattern[y][x] = (val % 2 === 0);
        }
        
        return pattern;
    }

    addFinderPattern(pattern, startX, startY) {
        // Add 7x7 finder pattern
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < 7; x++) {
                if (startX + x < pattern[0].length && startY + y < pattern.length) {
                    // Simplified finder pattern
                    const isEdge = x === 0 || x === 6 || y === 0 || y === 6;
                    const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
                    pattern[startY + y][startX + x] = isEdge || isCenter;
                }
            }
        }
    }
}

module.exports = QRCodeGenerator;
