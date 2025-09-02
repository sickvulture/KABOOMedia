#!/usr/bin/env python3
"""
Cryptographic utilities for Decentralized Social Media Platform
"""

import hashlib
import secrets
import base64
import time
from typing import Tuple, Optional
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

class KeyPairGenerator:
    """Generate and manage RSA key pairs for users"""
    
    @staticmethod
    def generate_keypair(key_size: int = 2048) -> Tuple[bytes, bytes]:
        """Generate RSA public/private key pair"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size
        )
        
        # Serialize private key
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        # Serialize public key
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return public_pem, private_pem
    
    @staticmethod
    def encrypt_private_key(private_key_pem: bytes, password: str) -> bytes:
        """Encrypt private key with password"""
        # Load the private key
        private_key = serialization.load_pem_private_key(
            private_key_pem, 
            password=None
        )
        
        # Re-serialize with encryption
        encrypted_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(
                password.encode('utf-8')
            )
        )
        
        return encrypted_pem
    
    @staticmethod
    def decrypt_private_key(encrypted_private_key: bytes, password: str) -> bytes:
        """Decrypt private key with password"""
        private_key = serialization.load_pem_private_key(
            encrypted_private_key,
            password=password.encode('utf-8')
        )
        
        # Return unencrypted PEM
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

class MessageSigner:
    """Sign and verify messages using RSA keys"""
    
    @staticmethod
    def sign_message(message: str, private_key_pem: bytes, password: Optional[str] = None) -> str:
        """Sign a message with private key"""
        # Load private key
        private_key = serialization.load_pem_private_key(
            private_key_pem,
            password=password.encode('utf-8') if password else None
        )
        
        # Sign the message
        signature = private_key.sign(
            message.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode('utf-8')
    
    @staticmethod
    def verify_signature(message: str, signature: str, public_key_pem: bytes) -> bool:
        """Verify a message signature with public key"""
        try:
            # Load public key
            public_key = serialization.load_pem_public_key(public_key_pem)
            
            # Decode signature
            signature_bytes = base64.b64decode(signature.encode('utf-8'))
            
            # Verify signature
            public_key.verify(
                signature_bytes,
                message.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False

class HashUtils:
    """Utilities for hashing and content addressing"""
    
    @staticmethod
    def hash_content(content: str) -> str:
        """Create SHA-256 hash of content"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    @staticmethod
    def hash_file(file_path: str) -> str:
        """Create SHA-256 hash of file"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        
        return sha256_hash.hexdigest()
    
    @staticmethod
    def generate_content_id(content: str, timestamp: float = None) -> str:
        """Generate unique content ID"""
        if timestamp is None:
            timestamp = time.time()
        
        content_hash = HashUtils.hash_content(content)
        timestamp_str = str(int(timestamp * 1000))  # Milliseconds
        
        combined = f"{content_hash}:{timestamp_str}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]
    
    @staticmethod
    def generate_user_id(name: str, public_key: bytes) -> str:
        """Generate unique user ID from name and public key"""
        combined = f"{name}:{public_key.decode('utf-8')}"
        return hashlib.sha256(combined.encode('utf-8')).hexdigest()[:16]

class SecureTokenGenerator:
    """Generate secure tokens and IDs"""
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def generate_api_key() -> str:
        """Generate API key for external access"""
        return f"dsm_{secrets.token_urlsafe(40)}"
    
    @staticmethod
    def generate_session_id() -> str:
        """Generate session identifier"""
        return secrets.token_hex(16)
    
    @staticmethod
    def generate_nonce() -> str:
        """Generate number used once (nonce)"""
        return secrets.token_hex(8)

class PasswordUtils:
    """Password hashing and verification utilities"""
    
    @staticmethod
    def derive_key_from_password(password: str, salt: bytes = None) -> Tuple[bytes, bytes]:
        """Derive encryption key from password using PBKDF2"""
        if salt is None:
            salt = secrets.token_bytes(32)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        key = kdf.derive(password.encode('utf-8'))
        return key, salt
    
    @staticmethod
    def hash_password(password: str) -> Tuple[str, str]:
        """Hash password for storage (returns hash and salt)"""
        salt = secrets.token_hex(32)
        combined = f"{password}:{salt}"
        password_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
        return password_hash, salt
    
    @staticmethod
    def verify_password(password: str, stored_hash: str, salt: str) -> bool:
        """Verify password against stored hash"""
        combined = f"{password}:{salt}"
        computed_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
        return secrets.compare_digest(computed_hash, stored_hash)
    
    @staticmethod
    def generate_secure_password(length: int = 16) -> str:
        """Generate secure random password"""
        import string
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))

class ContentValidator:
    """Validate content integrity and authenticity"""
    
    @staticmethod
    def create_content_signature(content: str, user_id: str, timestamp: float) -> str:
        """Create tamper-proof content signature"""
        combined = f"{content}:{user_id}:{timestamp}"
        return HashUtils.hash_content(combined)
    
    @staticmethod
    def verify_content_integrity(content: str, user_id: str, timestamp: float, signature: str) -> bool:
        """Verify content hasn't been tampered with"""
        expected_signature = ContentValidator.create_content_signature(content, user_id, timestamp)
        return secrets.compare_digest(expected_signature, signature)
    
    @staticmethod
    def validate_content_timestamp(timestamp: float, max_age_hours: int = 24) -> bool:
        """Validate content timestamp is within acceptable range"""
        now = time.time()
        age_seconds = now - timestamp
        max_age_seconds = max_age_hours * 3600
        
        # Content can't be from the future (with 5 minute tolerance)
        if timestamp > now + 300:
            return False
        
        # Content can't be too old
        if age_seconds > max_age_seconds:
            return False
        
        return True

# Utility functions for common cryptographic operations
def generate_user_keypair(name: str, password: str) -> dict:
    """Generate complete user key package"""
    public_key, private_key = KeyPairGenerator.generate_keypair()
    encrypted_private_key = KeyPairGenerator.encrypt_private_key(private_key, password)
    user_id = HashUtils.generate_user_id(name, public_key)
    
    return {
        'user_id': user_id,
        'public_key': public_key.decode('utf-8'),
        'private_key_encrypted': base64.b64encode(encrypted_private_key).decode('utf-8'),
        'key_generated_at': time.time()
    }

def sign_post(content: str, private_key_pem: bytes, password: str = None) -> dict:
    """Sign a post with user's private key"""
    timestamp = time.time()
    content_id = HashUtils.generate_content_id(content, timestamp)
    signature = MessageSigner.sign_message(content, private_key_pem, password)
    
    return {
        'content_id': content_id,
        'content': content,
        'timestamp': timestamp,
        'signature': signature
    }

def verify_post(post_data: dict, public_key_pem: bytes) -> bool:
    """Verify a signed post"""
    try:
        content = post_data['content']
        signature = post_data['signature']
        
        return MessageSigner.verify_signature(content, signature, public_key_pem)
    except KeyError:
        return False

if __name__ == "__main__":
    # Example usage and testing
    print("Testing cryptographic utilities...")
    
    # Test key generation
    public_key, private_key = KeyPairGenerator.generate_keypair()
    print("✓ Key pair generation")
    
    # Test message signing
    message = "Hello, decentralized world!"
    signature = MessageSigner.sign_message(message, private_key)
    verified = MessageSigner.verify_signature(message, signature, public_key)
    print(f"✓ Message signing and verification: {verified}")
    
    # Test hashing
    content_hash = HashUtils.hash_content("Test content")
    print(f"✓ Content hashing: {content_hash[:16]}...")
    
    # Test token generation
    token = SecureTokenGenerator.generate_secure_token()
    print(f"✓ Secure token generation: {token[:16]}...")
    
    # Test password utilities
    password_hash, salt = PasswordUtils.hash_password("test_password")
    verified = PasswordUtils.verify_password("test_password", password_hash, salt)
    print(f"✓ Password hashing and verification: {verified}")
    
    print("All cryptographic utilities tested successfully!")
