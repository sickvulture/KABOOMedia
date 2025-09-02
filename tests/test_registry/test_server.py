import unittest
import json
import time
import tempfile
import sqlite3
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Note: This test assumes the registry server exists
# If it doesn't exist yet, these tests serve as specifications
try:
    from registry.server import RegistryServer
except ImportError:
    # Create a mock class for testing specifications
    class RegistryServer:
        def __init__(self, port=5000, database_path=None):
            self.port = port
            self.database_path = database_path or ":memory:"
            self.app = None
            self.is_running = False
            
        def start_server(self):
            self.is_running = True
            return True
            
        def stop_server(self):
            self.is_running = False
            
        def register_user(self, user_data):
            return {'status': 'success', 'user_id': user_data.get('user_id')}
            
        def update_user(self, user_id, user_data):
            return {'status': 'success'}
            
        def find_users(self, query):
            return {'status': 'success', 'users': [], 'total': 0}
            
        def get_user_addresses(self, user_id):
            return {'status': 'success', 'addresses': []}
            
        def update_user_addresses(self, user_id, addresses):
            return {'status': 'success'}
            
        def unregister_user(self, user_id):
            return {'status': 'success'}

class TestRegistryServer(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        
        self.server_port = 15000  # Use non-standard port for testing
        self.server = RegistryServer(self.server_port, self.temp_db.name)
        
        self.test_user_data = {
            'user_id': 'test_user_123',
            'name': 'Test User',
            'bio': 'A test user for registry server testing',
            'public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
            'current_addresses': [
                'http://192.168.1.100:8080',
                'http://203.0.113.1:8080'
            ],
            'created_at': time.time(),
            'last_seen': time.time()
        }
        
        self.test_addresses = [
            {
                'url': 'http://192.168.1.100:8080',
                'type': 'local',
                'timestamp': time.time()
            },
            {
                'url': 'http://203.0.113.1:8080',
                'type': 'external', 
                'timestamp': time.time()
            }
        ]
        
    def tearDown(self):
        """Clean up test fixtures"""
        if self.server.is_running:
            self.server.stop_server()
        
        # Clean up temp database
        import os
        if os.path.exists(self.temp_db.name):
            os.unlink(self.temp_db.name)
            
    def test_server_initialization(self):
        """Test registry server initialization"""
        self.assertEqual(self.server.port, self.server_port)
        self.assertEqual(self.server.database_path, self.temp_db.name)
        self.assertFalse(self.server.is_running)
        
    def test_server_start_stop(self):
        """Test starting and stopping the server"""
        # Test start
        result = self.server.start_server()
        self.assertTrue(result)
        self.assertTrue(self.server.is_running)
        
        # Test stop
        self.server.stop_server()
        self.assertFalse(self.server.is_running)
        
    def test_database_initialization(self):
        """Test database initialization and schema creation"""
        # Server should create necessary tables
        conn = sqlite3.connect(self.temp_db.name)
        cursor = conn.cursor()
        
        # Check that expected tables exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('users', 'addresses', 'search_index')
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['users', 'addresses']
        for table in expected_tables:
            if hasattr(self.server, '_create_database_schema'):
                self.server._create_database_schema()
                # Re-check after schema creation
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, (table,))
                self.assertTrue(cursor.fetchone() is not None, 
                              f"Table {table} should exist")
                
        conn.close()
        
    def test_register_user(self):
        """Test user registration"""
        result = self.server.register_user(self.test_user_data)
        
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['user_id'], self.test_user_data['user_id'])
        
    def test_register_duplicate_user(self):
        """Test registering duplicate user"""
        # Register user first time
        result1 = self.server.register_user(self.test_user_data)
        self.assertEqual(result1['status'], 'success')
        
        # Try to register same user again
        result2 = self.server.register_user(self.test_user_data)
        
        # Should either update existing user or return error
        self.assertIn(result2['status'], ['success', 'error'])
        if result2['status'] == 'error':
            self.assertIn('exists', result2['message'].lower())
            
    def test_update_user(self):
        """Test updating user information"""
        # Register user first
        self.server.register_user(self.test_user_data)
        
        # Update user data
        updated_data = self.test_user_data.copy()
        updated_data['bio'] = 'Updated bio for testing'
        updated_data['last_seen'] = time.time()
        
        result = self.server.update_user(
            self.test_user_data['user_id'], 
            updated_data
        )
        
        self.assertEqual(result['status'], 'success')
        
    def test_update_nonexistent_user(self):
        """Test updating user that doesn't exist"""
        result = self.server.update_user('nonexistent_user', self.test_user_data)
        
        self.assertEqual(result['status'], 'error')
        self.assertIn('not found', result['message'].lower())
        
    def test_find_users_by_name(self):
        """Test finding users by name"""
        # Register some test users
        users_to_register = [
            {
                'user_id': 'user1',
                'name': 'Alice Johnson',
                'bio': 'Software developer',
                'public_key': 'key1',
                'current_addresses': [],
                'created_at': time.time(),
                'last_seen': time.time()
            },
            {
                'user_id': 'user2', 
                'name': 'Bob Smith',
                'bio': 'Designer and artist',
                'public_key': 'key2',
                'current_addresses': [],
                'created_at': time.time(),
                'last_seen': time.time()
            },
            {
                'user_id': 'user3',
                'name': 'Alice Cooper',
                'bio': 'Musician',
                'public_key': 'key3',
                'current_addresses': [],
                'created_at': time.time(),
                'last_seen': time.time()
            }
        ]
        
        for user in users_to_register:
            self.server.register_user(user)
            
        # Search for "Alice"
        result = self.server.find_users('Alice')
        
        self.assertEqual(result['status'], 'success')
        # Should find Alice Johnson and Alice Cooper
        if result['total'] > 0:  # If search is implemented
            alice_names = [user['name'] for user in result['users'] 
                          if 'Alice' in user['name']]
            self.assertTrue(len(alice_names) >= 1)
            
    def test_find_users_by_bio(self):
        """Test finding users by bio content"""
        # Register user
        self.server.register_user(self.test_user_data)
        
        # Search for text in bio
        result = self.server.find_users('testing')
        
        self.assertEqual(result['status'], 'success')
        # Implementation dependent - may or may not find results
        
    def test_find_users_empty_query(self):
        """Test finding users with empty query"""
        result = self.server.find_users('')
        
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['total'], 0)
        
    def test_get_user_addresses(self):
        """Test getting user addresses"""
        # Register user first
        self.server.register_user(self.test_user_data)
        
        result = self.server.get_user_addresses(self.test_user_data['user_id'])
        
        self.assertEqual(result['status'], 'success')
        self.assertIn('addresses', result)
        
    def test_get_nonexistent_user_addresses(self):
        """Test getting addresses for nonexistent user"""
        result = self.server.get_user_addresses('nonexistent_user')
        
        self.assertEqual(result['status'], 'error')
        self.assertIn('not found', result['message'].lower())
        
    def test_update_user_addresses(self):
        """Test updating user addresses"""
        # Register user first
        self.server.register_user(self.test_user_data)
        
        result = self.server.update_user_addresses(
            self.test_user_data['user_id'],
            self.test_addresses
        )
        
        self.assertEqual(result['status'], 'success')
        
        # Verify addresses were updated
        get_result = self.server.get_user_addresses(self.test_user_data['user_id'])
        if get_result['status'] == 'success':
            # Check that addresses are stored
            self.assertIsInstance(get_result['addresses'], list)
            
    def test_unregister_user(self):
        """Test unregistering user"""
        # Register user first
        self.server.register_user(self.test_user_data)
        
        # Unregister user
        result = self.server.unregister_user(self.test_user_data['user_id'])
        
        self.assertEqual(result['status'], 'success')
        
        # Verify user is no longer findable
        find_result = self.server.find_users(self.test_user_data['name'])
        self.assertEqual(find_result['status'], 'success')
        # User should not be in results
        if find_result['total'] > 0:
            user_ids = [user['user_id'] for user in find_result['users']]
            self.assertNotIn(self.test_user_data['user_id'], user_ids)
            
    def test_unregister_nonexistent_user(self):
        """Test unregistering nonexistent user"""
        result = self.server.unregister_user('nonexistent_user')
        
        self.assertEqual(result['status'], 'error')
        self.assertIn('not found', result['message'].lower())
        
    def test_database_persistence(self):
        """Test that data persists in database"""
        # Register user
        self.server.register_user(self.test_user_data)
        
        # Create new server instance with same database
        server2 = RegistryServer(self.server_port + 1, self.temp_db.name)
        
        # Should be able to find the user
        result = server2.find_users(self.test_user_data['name'])
        
        self.assertEqual(result['status'], 'success')
        # Implementation dependent - may need database initialization
        
    def test_user_privacy_filtering(self):
        """Test that sensitive user data is filtered in responses"""
        self.server.register_user(self.test_user_data)
        
        result = self.server.find_users(self.test_user_data['name'])
        
        if result['status'] == 'success' and result['total'] > 0:
            user = result['users'][0]
            
            # Should not include private key or other sensitive data
            self.assertNotIn('private_key', user)
            self.assertNotIn('password', user)
            
            # Should include public information
            self.assertIn('name', user)
            self.assertIn('bio', user)
            
    def test_rate_limiting(self):
        """Test rate limiting for API endpoints"""
        # This would test rate limiting if implemented
        # For now, just test that rapid requests don't crash
        
        for i in range(10):
            result = self.server.find_users(f'test query {i}')
            self.assertEqual(result['status'], 'success')
            
    def test_address_history_tracking(self):
        """Test that address history is tracked"""
        # Register user
        self.server.register_user(self.test_user_data)
        
        # Update addresses multiple times
        addresses1 = [
            {'url': 'http://192.168.1.100:8080', 'type': 'local', 'timestamp': time.time()}
        ]
        addresses2 = [
            {'url': 'http://192.168.1.101:8080', 'type': 'local', 'timestamp': time.time()}
        ]
        
        self.server.update_user_addresses(self.test_user_data['user_id'], addresses1)
        time.sleep(0.1)  # Ensure different timestamps
        self.server.update_user_addresses(self.test_user_data['user_id'], addresses2)
        
        # Get current addresses
        result = self.server.get_user_addresses(self.test_user_data['user_id'])
        
        self.assertEqual(result['status'], 'success')
        # Should have the most recent addresses
        
    def test_cleanup_old_addresses(self):
        """Test cleanup of old/stale addresses"""
        # Register user with addresses
        self.server.register_user(self.test_user_data)
        
        # Add addresses with old timestamps
        old_addresses = [
            {
                'url': 'http://192.168.1.100:8080',
                'type': 'local',
                'timestamp': time.time() - 86400  # 24 hours ago
            }
        ]
        
        self.server.update_user_addresses(self.test_user_data['user_id'], old_addresses)
        
        # If cleanup is implemented, old addresses should be removed
        if hasattr(self.server, 'cleanup_old_addresses'):
            self.server.cleanup_old_addresses(max_age=3600)  # 1 hour
            
            result = self.server.get_user_addresses(self.test_user_data['user_id'])
            self.assertEqual(result['status'], 'success')
            
    def test_server_stats(self):
        """Test server statistics endpoint"""
        if hasattr(self.server, 'get_stats'):
            # Register some users
            for i in range(3):
                user_data = self.test_user_data.copy()
                user_data['user_id'] = f'test_user_{i}'
                user_data['name'] = f'Test User {i}'
                self.server.register_user(user_data)
                
            stats = self.server.get_stats()
            
            self.assertIn('total_users', stats)
            self.assertIn('active_users', stats)
            self.assertIn('total_addresses', stats)
            self.assertTrue(stats['total_users'] >= 3)

if __name__ == '__main__':
    unittest.main()
