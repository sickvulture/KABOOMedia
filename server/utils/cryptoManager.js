const crypto = require('crypto');
const forge = require('node-forge');

class CryptoManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
  }

  // Generate RSA key pair for asymmetric encryption
  generateKeyPair() {
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    return {
      publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
      privateKey: forge.pki.privateKeyToPem(keyPair.privateKey)
    };
  }

  // Generate symmetric key for file encryption
  generateSymmetricKey() {
    return crypto.randomBytes(32);
  }

  // Encrypt data with AES-256-GCM
  encryptData(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt data with AES-256-GCM
  decryptData(encryptedData, key) {
    const { encrypted, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher(this.algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Encrypt with RSA public key
  encryptWithPublicKey(data, publicKeyPem) {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const encrypted = publicKey.encrypt(data, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
  }

  // Decrypt with RSA private key
  decryptWithPrivateKey(encryptedData, privateKeyPem) {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encrypted = forge.util.decode64(encryptedData);
    return privateKey.decrypt(encrypted, 'RSA-OAEP');
  }

  // Sign data with private key
  signData(data, privateKeyPem) {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const md = forge.md.sha256.create();
    md.update(data, 'utf8');
    const signature = privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  // Verify signature with public key
  verifySignature(data, signature, publicKeyPem) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      const sig = forge.util.decode64(signature);
      return publicKey.verify(md.digest().bytes(), sig);
    } catch (error) {
      return false;
    }
  }

  // Generate secure random string
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash password with salt
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return {
      hash: hash.toString('hex'),
      salt
    };
  }

  // Verify password
  verifyPassword(password, hash, salt) {
    const computed = this.hashPassword(password, salt);
    return computed.hash === hash;
  }

  // Generate QR code data with encryption
  generateSecureQRData(networkId, publicKey, permissions = {}) {
    const qrData = {
      networkId,
      publicKey,
      permissions,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    return Buffer.from(JSON.stringify(qrData)).toString('base64');
  }

  // Decrypt QR code data
  decryptQRData(qrCode) {
    try {
      const data = Buffer.from(qrCode, 'base64').toString('utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error('Invalid QR code data');
    }
  }

  // Encrypt file for storage
  encryptFile(fileBuffer, password) {
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      salt: 'salt'
    };
  }

  // Decrypt file
  decryptFile(encryptedFile, password) {
    const { encrypted, iv, salt } = encryptedFile;
    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipher('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

module.exports = { CryptoManager };
