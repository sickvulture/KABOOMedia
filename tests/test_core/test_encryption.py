import unittest
import tempfile
import os
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.encryption import EncryptionEngine

class TestEncryptionEngine(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.password = "test_password_123"
        self.encryption_engine = EncryptionEngine(self.password)
        self.test_data = b"This is test data for encryption"
        
    def test_encryption_initialization_with_password(self):
        """Test encryption engine initialization with password"""
        engine = EncryptionEngine(self.password)
        self.assertIsNotNone(engine.key)
        self.assertIsNotNone(engine.cipher)
        
    def test_encryption_initialization_without_password(self):
        """Test encryption engine initialization without password (random key)"""
        engine = EncryptionEngine()
        self.assertIsNotNone(engine.key)
        self.assertIsNotNone(engine.cipher)
        
    def test_key_derivation_consistency(self):
        """Test that key derivation produces consistent results"""
        salt = b"test_salt_123456"
        key1 = self.encryption_engine._derive_key(self.password, salt)
        key2 = self.encryption_engine._derive_key(self.password, salt)
        self.assertEqual(key1, key2)
        
    def test_key_derivation_different_passwords(self):
        """Test that different passwords produce different keys"""
        salt = b"test_salt_123456"
        key1 = self.encryption_engine._derive_key("password1", salt)
        key2 = self.encryption_engine._derive_key("password2", salt)
        self.assertNotEqual(key1, key2)
        
    def test_encrypt_decrypt_data(self):
        """Test basic encrypt/decrypt functionality"""
        encrypted_data = self.encryption_engine.encrypt_data(self.test_data)
        decrypted_data = self.encryption_engine.decrypt_data(encrypted_data)
        
        self.assertNotEqual(encrypted_data, self.test_data)
        self.assertEqual(decrypted_data, self.test_data)
        
    def test_encrypt_decrypt_empty_data(self):
        """Test encrypt/decrypt with empty data"""
        empty_data = b""
        encrypted_data = self.encryption_engine.encrypt_data(empty_data)
        decrypted_data = self.encryption_engine.decrypt_data(encrypted_data)
        
        self.assertEqual(decrypted_data, empty_data)
        
    def test_encrypt_decrypt_large_data(self):
        """Test encrypt/decrypt with large data"""
        large_data = b"x" * 10000  # 10KB of data
        encrypted_data = self.encryption_engine.encrypt_data(large_data)
        decrypted_data = self.encryption_engine.decrypt_data(encrypted_data)
        
        self.assertEqual(decrypted_data, large_data)
        
    def test_encrypt_file(self):
        """Test file encryption functionality"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
            temp_file.write("This is test file content")
            temp_file_path = temp_file.name
            
        try:
            encrypted_file_path = self.encryption_engine.encrypt_file(temp_file_path)
            
            # Check that encrypted file exists
            self.assertTrue(os.path.exists(encrypted_file_path))
            self.assertTrue(encrypted_file_path.endswith('.encrypted'))
            
            # Read encrypted file and verify it's different from original
            with open(temp_file_path, 'rb') as original:
                original_content = original.read()
                
            with open(encrypted_file_path, 'rb') as encrypted:
                encrypted_content = encrypted.read()
                
            self.assertNotEqual(original_content, encrypted_content)
            
            # Verify we can decrypt the content
            decrypted_content = self.encryption_engine.decrypt_data(encrypted_content)
            self.assertEqual(decrypted_content, original_content)
            
        finally:
            # Clean up temp files
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            if os.path.exists(encrypted_file_path):
                os.unlink(encrypted_file_path)
                
    def test_decrypt_with_wrong_key(self):
        """Test that decryption fails with wrong key"""
        encrypted_data = self.encryption_engine.encrypt_data(self.test_data)
        
        # Create new engine with different password
        wrong_engine = EncryptionEngine("wrong_password")
        
        with self.assertRaises(Exception):
            wrong_engine.decrypt_data(encrypted_data)
            
    def test_decrypt_corrupted_data(self):
        """Test that decryption fails with corrupted data"""
        encrypted_data = self.encryption_engine.encrypt_data(self.test_data)
        
        # Corrupt the encrypted data
        corrupted_data = b"corrupted" + encrypted_data[9:]
        
        with self.assertRaises(Exception):
            self.encryption_engine.decrypt_data(corrupted_data)

if __name__ == '__main__':
    unittest.main()
