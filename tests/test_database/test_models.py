import unittest
import time
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.models import User, Post, Connection, Comment, MediaFile

class TestModels(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.current_time = time.time()
        
        # Test data
        self.test_user_data = {
            'user_id': 'user_123',
            'name': 'John Doe',
            'bio': 'A test user for the social platform',
            'public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
            'private_key_encrypted': 'encrypted_private_key_data',
            'created_at': self.current_time,
            'updated_at': self.current_time,
            'preferences': {
                'privacy': 'friends',
                'notifications': True,
                'theme': 'dark'
            }
        }
        
        self.test_post_data = {
            'post_id': 'post_456',
            'user_id': 'user_123',
            'content': 'This is a test post with some content',
            'media_urls': ['/media/photo1.jpg', '/media/video1.mp4'],
            'privacy_level': 'public',
            'created_at': self.current_time,
            'updated_at': self.current_time,
            'metadata': {
                'location': 'San Francisco',
                'tags': ['test', 'post'],
                'edited': False
            }
        }
        
        self.test_connection_data = {
            'connection_id': 'conn_789',
            'user_id': 'user_123',
            'peer_user_id': 'user_456',
            'peer_public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
            'connection_status': 'accepted',
            'permissions': {
                'view': True,
                'comment': True,
                'share': False
            },
            'created_at': self.current_time,
            'updated_at': self.current_time
        }
        
        self.test_comment_data = {
            'comment_id': 'comment_101',
            'post_id': 'post_456',
            'author_id': 'user_456',
            'content': 'This is a test comment',
            'created_at': self.current_time,
            'is_encrypted': False
        }
        
        self.test_media_data = {
            'file_id': 'media_202',
            'user_id': 'user_123',
            'filename': 'test_photo.jpg',
            'file_path': '/media/user_123/test_photo.jpg',
            'file_type': 'image/jpeg',
            'file_size': 1048576,  # 1MB
            'is_encrypted': True,
            'created_at': self.current_time,
            'metadata': {
                'width': 1920,
                'height': 1080,
                'camera': 'iPhone 12'
            }
        }
        
    def test_user_model_creation(self):
        """Test User model creation and attributes"""
        user = User(**self.test_user_data)
        
        # Check all attributes
        self.assertEqual(user.user_id, self.test_user_data['user_id'])
        self.assertEqual(user.name, self.test_user_data['name'])
        self.assertEqual(user.bio, self.test_user_data['bio'])
        self.assertEqual(user.public_key, self.test_user_data['public_key'])
        self.assertEqual(user.private_key_encrypted, self.test_user_data['private_key_encrypted'])
        self.assertEqual(user.created_at, self.test_user_data['created_at'])
        self.assertEqual(user.updated_at, self.test_user_data['updated_at'])
        self.assertEqual(user.preferences, self.test_user_data['preferences'])
        
    def test_user_model_types(self):
        """Test User model type enforcement"""
        user = User(**self.test_user_data)
        
        self.assertIsInstance(user.user_id, str)
        self.assertIsInstance(user.name, str)
        self.assertIsInstance(user.bio, str)
        self.assertIsInstance(user.public_key, str)
        self.assertIsInstance(user.private_key_encrypted, str)
        self.assertIsInstance(user.created_at, float)
        self.assertIsInstance(user.updated_at, float)
        self.assertIsInstance(user.preferences, dict)
        
    def test_post_model_creation(self):
        """Test Post model creation and attributes"""
        post = Post(**self.test_post_data)
        
        self.assertEqual(post.post_id, self.test_post_data['post_id'])
        self.assertEqual(post.user_id, self.test_post_data['user_id'])
        self.assertEqual(post.content, self.test_post_data['content'])
        self.assertEqual(post.media_urls, self.test_post_data['media_urls'])
        self.assertEqual(post.privacy_level, self.test_post_data['privacy_level'])
        self.assertEqual(post.created_at, self.test_post_data['created_at'])
        self.assertEqual(post.updated_at, self.test_post_data['updated_at'])
        self.assertEqual(post.metadata, self.test_post_data['metadata'])
        
    def test_post_model_types(self):
        """Test Post model type enforcement"""
        post = Post(**self.test_post_data)
        
        self.assertIsInstance(post.post_id, str)
        self.assertIsInstance(post.user_id, str)
        self.assertIsInstance(post.content, str)
        self.assertIsInstance(post.media_urls, list)
        self.assertIsInstance(post.privacy_level, str)
        self.assertIsInstance(post.created_at, float)
        self.assertIsInstance(post.updated_at, float)
        self.assertIsInstance(post.metadata, dict)
        
    def test_post_privacy_levels(self):
        """Test Post privacy level validation"""
        valid_privacy_levels = ['public', 'friends', 'private']
        
        for level in valid_privacy_levels:
            data = self.test_post_data.copy()
            data['privacy_level'] = level
            post = Post(**data)
            self.assertEqual(post.privacy_level, level)
            
    def test_connection_model_creation(self):
        """Test Connection model creation and attributes"""
        connection = Connection(**self.test_connection_data)
        
        self.assertEqual(connection.connection_id, self.test_connection_data['connection_id'])
        self.assertEqual(connection.user_id, self.test_connection_data['user_id'])
        self.assertEqual(connection.peer_user_id, self.test_connection_data['peer_user_id'])
        self.assertEqual(connection.peer_public_key, self.test_connection_data['peer_public_key'])
        self.assertEqual(connection.connection_status, self.test_connection_data['connection_status'])
        self.assertEqual(connection.permissions, self.test_connection_data['permissions'])
        self.assertEqual(connection.created_at, self.test_connection_data['created_at'])
        self.assertEqual(connection.updated_at, self.test_connection_data['updated_at'])
        
    def test_connection_status_values(self):
        """Test Connection status validation"""
        valid_statuses = ['pending', 'accepted', 'blocked']
        
        for status in valid_statuses:
            data = self.test_connection_data.copy()
            data['connection_status'] = status
            connection = Connection(**data)
            self.assertEqual(connection.connection_status, status)
            
    def test_connection_permissions_structure(self):
        """Test Connection permissions structure"""
        connection = Connection(**self.test_connection_data)
        
        self.assertIsInstance(connection.permissions, dict)
        self.assertIn('view', connection.permissions)
        self.assertIn('comment', connection.permissions)
        self.assertIn('share', connection.permissions)
        
        # Check that permissions are boolean
        for permission, value in connection.permissions.items():
            self.assertIsInstance(value, bool)
            
    def test_comment_model_creation(self):
        """Test Comment model creation and attributes"""
        comment = Comment(**self.test_comment_data)
        
        self.assertEqual(comment.comment_id, self.test_comment_data['comment_id'])
        self.assertEqual(comment.post_id, self.test_comment_data['post_id'])
        self.assertEqual(comment.author_id, self.test_comment_data['author_id'])
        self.assertEqual(comment.content, self.test_comment_data['content'])
        self.assertEqual(comment.created_at, self.test_comment_data['created_at'])
        self.assertEqual(comment.is_encrypted, self.test_comment_data['is_encrypted'])
        
    def test_comment_model_types(self):
        """Test Comment model type enforcement"""
        comment = Comment(**self.test_comment_data)
        
        self.assertIsInstance(comment.comment_id, str)
        self.assertIsInstance(comment.post_id, str)
        self.assertIsInstance(comment.author_id, str)
        self.assertIsInstance(comment.content, str)
        self.assertIsInstance(comment.created_at, float)
        self.assertIsInstance(comment.is_encrypted, bool)
        
    def test_media_file_model_creation(self):
        """Test MediaFile model creation and attributes"""
        media = MediaFile(**self.test_media_data)
        
        self.assertEqual(media.file_id, self.test_media_data['file_id'])
        self.assertEqual(media.user_id, self.test_media_data['user_id'])
        self.assertEqual(media.filename, self.test_media_data['filename'])
        self.assertEqual(media.file_path, self.test_media_data['file_path'])
        self.assertEqual(media.file_type, self.test_media_data['file_type'])
        self.assertEqual(media.file_size, self.test_media_data['file_size'])
        self.assertEqual(media.is_encrypted, self.test_media_data['is_encrypted'])
        self.assertEqual(media.created_at, self.test_media_data['created_at'])
        self.assertEqual(media.metadata, self.test_media_data['metadata'])
        
    def test_media_file_types(self):
        """Test MediaFile type enforcement"""
        media = MediaFile(**self.test_media_data)
        
        self.assertIsInstance(media.file_id, str)
        self.assertIsInstance(media.user_id, str)
        self.assertIsInstance(media.filename, str)
        self.assertIsInstance(media.file_path, str)
        self.assertIsInstance(media.file_type, str)
        self.assertIsInstance(media.file_size, int)
        self.assertIsInstance(media.is_encrypted, bool)
        self.assertIsInstance(media.created_at, float)
        self.assertIsInstance(media.metadata, dict)
        
    def test_model_equality(self):
        """Test model equality comparison"""
        user1 = User(**self.test_user_data)
        user2 = User(**self.test_user_data)
        
        # Same data should be equal
        self.assertEqual(user1, user2)
        
        # Different data should not be equal
        different_data = self.test_user_data.copy()
        different_data['name'] = 'Jane Doe'
        user3 = User(**different_data)
        
        self.assertNotEqual(user1, user3)
        
    def test_model_string_representation(self):
        """Test model string representation"""
        user = User(**self.test_user_data)
        post = Post(**self.test_post_data)
        
        # Should have meaningful string representations
        user_str = str(user)
        post_str = str(post)
        
        self.assertIn('User', user_str)
        self.assertIn('Post', post_str)
        
        # Should contain key identifying information
        self.assertIn(user.user_id, user_str)
        self.assertIn(post.post_id, post_str)
        
    def test_model_with_empty_lists(self):
        """Test models with empty lists"""
        data = self.test_post_data.copy()
        data['media_urls'] = []
        
        post = Post(**data)
        self.assertEqual(post.media_urls, [])
        self.assertIsInstance(post.media_urls, list)
        
    def test_model_with_empty_dicts(self):
        """Test models with empty dictionaries"""
        data = self.test_user_data.copy()
        data['preferences'] = {}
        
        user = User(**data)
        self.assertEqual(user.preferences, {})
        self.assertIsInstance(user.preferences, dict)
        
    def test_timestamp_consistency(self):
        """Test that timestamps are consistent"""
        now = time.time()
        
        data = self.test_user_data.copy()
        data['created_at'] = now
        data['updated_at'] = now
        
        user = User(**data)
        
        self.assertEqual(user.created_at, now)
        self.assertEqual(user.updated_at, now)
        self.assertTrue(user.created_at <= user.updated_at)
        
    def test_nested_data_structures(self):
        """Test models with complex nested data structures"""
        complex_metadata = {
            'location': {
                'city': 'San Francisco',
                'country': 'USA',
                'coordinates': [37.7749, -122.4194]
            },
            'tags': ['social', 'platform', 'decentralized'],
            'engagement': {
                'likes': 42,
                'shares': 7,
                'views': 150
            }
        }
        
        data = self.test_post_data.copy()
        data['metadata'] = complex_metadata
        
        post = Post(**data)
        self.assertEqual(post.metadata, complex_metadata)
        self.assertEqual(post.metadata['location']['city'], 'San Francisco')
        self.assertEqual(len(post.metadata['tags']), 3)
        
    def test_boolean_fields(self):
        """Test boolean field handling"""
        # Test comment encryption flag
        data = self.test_comment_data.copy()
        
        data['is_encrypted'] = True
        comment_encrypted = Comment(**data)
        self.assertTrue(comment_encrypted.is_encrypted)
        
        data['is_encrypted'] = False
        comment_plain = Comment(**data)
        self.assertFalse(comment_plain.is_encrypted)
        
        # Test media encryption flag
        media_data = self.test_media_data.copy()
        
        media_data['is_encrypted'] = True
        media_encrypted = MediaFile(**media_data)
        self.assertTrue(media_encrypted.is_encrypted)

if __name__ == '__main__':
    unittest.main()
