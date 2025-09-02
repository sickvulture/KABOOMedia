import unittest
import tempfile
import shutil
import os
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.storage import SandboxedStorage
from core.encryption import EncryptionEngine

class TestSandboxedStorage(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.encryption_engine = EncryptionEngine("test_password")
        self.storage = SandboxedStorage(self.temp_dir, self.encryption_engine)
        
        self.test_data = {
            "user_id": "test_user_123",
            "name": "Test User",
            "posts": ["post1", "post2"],
            "metadata": {"created": 1234567890}
        }
        
    def tearDown(self):
        """Clean up test fixtures"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            
    def test_sandbox_structure_creation(self):
        """Test that sandbox directory structure is created properly"""
        expected_dirs = [
            'user_data', 'media', 'posts', 'connections',
            'temp', 'cache', 'backups', 'keys'
        ]
        
        for directory in expected_dirs:
            dir_path = Path(self.temp_dir) / directory
            self.assertTrue(dir_path.exists())
            self.assertTrue(dir_path.is_dir())
            
    def test_store_and_retrieve_encrypted_data(self):
        """Test storing and retrieving encrypted data"""
        category = "user_data"
        filename = "test_profile"
        
        # Store data
        file_path = self.storage.store_encrypted_data(category, filename, self.test_data)
        self.assertTrue(os.path.exists(file_path))
        self.assertTrue(file_path.endswith('.enc'))
        
        # Retrieve data
        retrieved_data = self.storage.retrieve_encrypted_data(category, filename)
        self.assertEqual(retrieved_data, self.test_data)
        
    def test_store_retrieve_multiple_files(self):
        """Test storing and retrieving multiple files"""
        test_files = {
            ("posts", "post1"): {"content": "First post", "timestamp": 1234567890},
            ("posts", "post2"): {"content": "Second post", "timestamp": 1234567891},
            ("connections", "friend1"): {"user_id": "friend1", "status": "accepted"}
        }
        
        # Store all files
        for (category, filename), data in test_files.items():
            self.storage.store_encrypted_data(category, filename, data)
            
        # Retrieve and verify all files
        for (category, filename), expected_data in test_files.items():
            retrieved_data = self.storage.retrieve_encrypted_data(category, filename)
            self.assertEqual(retrieved_data, expected_data)
            
    def test_retrieve_nonexistent_file(self):
        """Test retrieving a file that doesn't exist"""
        with self.assertRaises(FileNotFoundError):
            self.storage.retrieve_encrypted_data("user_data", "nonexistent")
            
    def test_get_sandbox_path(self):
        """Test getting sandbox paths"""
        # Test root path
        root_path = self.storage.get_sandbox_path()
        self.assertEqual(str(root_path), self.temp_dir)
        
        # Test category path
        posts_path = self.storage.get_sandbox_path("posts")
        expected_path = Path(self.temp_dir) / "posts"
        self.assertEqual(posts_path, expected_path)
        
    def test_data_encryption_integrity(self):
        """Test that stored data is actually encrypted"""
        category = "user_data"
        filename = "test_encryption"
        
        # Store data
        file_path = self.storage.store_encrypted_data(category, filename, self.test_data)
        
        # Read raw file content
        with open(file_path, 'rb') as f:
            raw_content = f.read()
            
        # Verify that raw content is not the same as original JSON
        import json
        original_json = json.dumps(self.test_data).encode()
        self.assertNotEqual(raw_content, original_json)
        
        # Verify that raw content doesn't contain readable user data
        raw_content_str = raw_content.decode('utf-8', errors='ignore')
        self.assertNotIn("Test User", raw_content_str)
        self.assertNotIn("test_user_123", raw_content_str)
        
    def test_storage_with_different_encryption_keys(self):
        """Test that data encrypted with one key cannot be read with another"""
        category = "user_data"
        filename = "test_key_isolation"
        
        # Store data with first storage instance
        self.storage.store_encrypted_data(category, filename, self.test_data)
        
        # Create new storage with different encryption key
        different_encryption = EncryptionEngine("different_password")
        different_storage = SandboxedStorage(self.temp_dir, different_encryption)
        
        # Try to retrieve data with different key - should fail
        with self.assertRaises(Exception):
            different_storage.retrieve_encrypted_data(category, filename)
            
    def test_store_empty_data(self):
        """Test storing and retrieving empty data"""
        empty_data = {}
        category = "temp"
        filename = "empty_test"
        
        self.storage.store_encrypted_data(category, filename, empty_data)
        retrieved_data = self.storage.retrieve_encrypted_data(category, filename)
        
        self.assertEqual(retrieved_data, empty_data)
        
    def test_store_complex_nested_data(self):
        """Test storing and retrieving complex nested data structures"""
        complex_data = {
            "user": {
                "profile": {
                    "name": "Complex User",
                    "settings": {
                        "privacy": {"posts": "friends", "profile": "public"},
                        "notifications": {"email": True, "push": False}
                    }
                },
                "posts": [
                    {"id": 1, "content": "First post", "likes": [1, 2, 3]},
                    {"id": 2, "content": "Second post", "likes": []}
                ]
            },
            "metadata": {
                "version": 1.0,
                "created": 1234567890,
                "features": ["encryption", "p2p", "local-first"]
            }
        }
        
        category = "user_data"
        filename = "complex_profile"
        
        self.storage.store_encrypted_data(category, filename, complex_data)
        retrieved_data = self.storage.retrieve_encrypted_data(category, filename)
        
        self.assertEqual(retrieved_data, complex_data)

if __name__ == '__main__':
    unittest.main()
