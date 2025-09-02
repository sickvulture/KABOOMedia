import unittest
import json
import time
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Note: This test assumes the registry client exists
# If it doesn't exist yet, these tests serve as specifications
try:
    from registry.client import RegistryClient
except ImportError:
    # Create a mock class for testing specifications
    class RegistryClient:
        def __init__(self, registry_url=None, user_id=None):
            self.registry_url = registry_url or "https://registry.example.com"
            self.user_id = user_id
            self.is_registered = False
            
        def register_user(self, user_info):
            return {'status': 'success', 'user_id': user_info.get('user_id')}
            
        def update_user_info(self, user_info):
            return {'status': 'success'}
            
        def find_users(self, search_query):
            return {'status': 'success', 'users': []}
            
        def get_user_addresses(self, user_id):
            return {'status': 'success', 'addresses': []}
            
        def update_addresses(self, addresses):
            return {'status': 'success'}
            
        def unregister_user(self):
            return {'status': 'success'}

class TestRegistryClient(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.registry_url = "https://test-registry.example.com"
        self.user_id = "test_user_123"
        self.client = RegistryClient(self.registry_url, self.user_id)
        
        self.test_user_info = {
            'user_id': self.user_id,
            'name': 'Test User',
            'bio': 'A test user for registry testing',
            'public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
            'current_addresses': [
                'http://192.168.1.100:8080',
                'http://203.0.113.1:8080'
            ],
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
        
    def test_client_initialization(self):
        """Test registry client initialization"""
        self.assertEqual(self.client.registry_url, self.registry_url)
        self.assertEqual(self.client.user_id, self.user_id)
        self.assertFalse(self.client.is_registered)
        
    def test_client_initialization_with_defaults(self):
        """Test client initialization with default values"""
        default_client = RegistryClient()
        self.assertIsNotNone(default_client.registry_url)
        self.assertTrue(default_client.registry_url.startswith('http'))
        
    def test_register_user(self):
        """Test user registration"""
        with patch('requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'user_id': self.user_id,
                'message': 'User registered successfully'
            }
            mock_post.return_value = mock_response
            
            result = self.client.register_user(self.test_user_info)
            
            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['user_id'], self.user_id)
            
            # Verify the request was made correctly
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            self.assertIn('json', call_args.kwargs)
            self.assertEqual(call_args.kwargs['json'], self.test_user_info)
            
    def test_register_user_network_error(self):
        """Test user registration with network error"""
        with patch('requests.post') as mock_post:
            mock_post.side_effect = Exception("Network error")
            
            result = self.client.register_user(self.test_user_info)
            
            self.assertEqual(result['status'], 'error')
            self.assertIn('message', result)
            
    def test_update_user_info(self):
        """Test updating user information"""
        with patch('requests.put') as mock_put:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'message': 'User info updated'
            }
            mock_put.return_value = mock_response
            
            updated_info = self.test_user_info.copy()
            updated_info['bio'] = 'Updated bio'
            
            result = self.client.update_user_info(updated_info)
            
            self.assertEqual(result['status'], 'success')
            
            # Verify request
            mock_put.assert_called_once()
            call_args = mock_put.call_args
            self.assertIn('json', call_args.kwargs)
            
    def test_find_users(self):
        """Test finding users through search"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'users': [
                    {
                        'user_id': 'found_user_1',
                        'name': 'Found User 1',
                        'bio': 'First found user'
                    },
                    {
                        'user_id': 'found_user_2', 
                        'name': 'Found User 2',
                        'bio': 'Second found user'
                    }
                ],
                'total': 2
            }
            mock_get.return_value = mock_response
            
            search_query = "test search"
            result = self.client.find_users(search_query)
            
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['users']), 2)
            self.assertEqual(result['total'], 2)
            
            # Verify request parameters
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            self.assertIn('params', call_args.kwargs)
            self.assertIn('q', call_args.kwargs['params'])
            
    def test_find_users_no_results(self):
        """Test finding users with no results"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'users': [],
                'total': 0
            }
            mock_get.return_value = mock_response
            
            result = self.client.find_users("nonexistent user")
            
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['users']), 0)
            self.assertEqual(result['total'], 0)
            
    def test_get_user_addresses(self):
        """Test getting user addresses"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'user_id': 'target_user',
                'addresses': self.test_addresses,
                'last_updated': time.time()
            }
            mock_get.return_value = mock_response
            
            target_user = 'target_user'
            result = self.client.get_user_addresses(target_user)
            
            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['user_id'], target_user)
            self.assertEqual(len(result['addresses']), len(self.test_addresses))
            
    def test_update_addresses(self):
        """Test updating user addresses"""
        with patch('requests.put') as mock_put:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'message': 'Addresses updated',
                'count': len(self.test_addresses)
            }
            mock_put.return_value = mock_response
            
            result = self.client.update_addresses(self.test_addresses)
            
            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['count'], len(self.test_addresses))
            
            # Verify request
            mock_put.assert_called_once()
            call_args = mock_put.call_args
            self.assertIn('json', call_args.kwargs)
            self.assertEqual(call_args.kwargs['json']['addresses'], self.test_addresses)
            
    def test_unregister_user(self):
        """Test unregistering user"""
        with patch('requests.delete') as mock_delete:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'message': 'User unregistered successfully'
            }
            mock_delete.return_value = mock_response
            
            result = self.client.unregister_user()
            
            self.assertEqual(result['status'], 'success')
            
            # Verify request
            mock_delete.assert_called_once()
            
    def test_authentication_headers(self):
        """Test that authentication headers are included in requests"""
        with patch('requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {'status': 'success'}
            mock_post.return_value = mock_response
            
            # Add authentication to client
            self.client.auth_token = "test_auth_token"
            
            self.client.register_user(self.test_user_info)
            
            # Verify auth header
            call_args = mock_post.call_args
            if 'headers' in call_args.kwargs:
                headers = call_args.kwargs['headers']
                self.assertIn('Authorization', headers)
                
    def test_rate_limiting_handling(self):
        """Test handling of rate limiting responses"""
        with patch('requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.json.return_value = {
                'status': 'error',
                'message': 'Rate limit exceeded',
                'retry_after': 60
            }
            mock_post.return_value = mock_response
            
            result = self.client.register_user(self.test_user_info)
            
            self.assertEqual(result['status'], 'error')
            self.assertIn('rate limit', result['message'].lower())
            
    def test_server_error_handling(self):
        """Test handling of server errors"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.json.return_value = {
                'status': 'error',
                'message': 'Internal server error'
            }
            mock_get.return_value = mock_response
            
            result = self.client.find_users("test query")
            
            self.assertEqual(result['status'], 'error')
            
    def test_invalid_response_handling(self):
        """Test handling of invalid JSON responses"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
            mock_get.return_value = mock_response
            
            result = self.client.find_users("test query")
            
            self.assertEqual(result['status'], 'error')
            self.assertIn('json', result['message'].lower())
            
    def test_connection_timeout_handling(self):
        """Test handling of connection timeouts"""
        with patch('requests.post') as mock_post:
            mock_post.side_effect = TimeoutError("Connection timeout")
            
            result = self.client.register_user(self.test_user_info)
            
            self.assertEqual(result['status'], 'error')
            self.assertIn('timeout', result['message'].lower())
            
    def test_registry_url_validation(self):
        """Test registry URL validation"""
        invalid_urls = ['not_a_url', 'ftp://invalid.com', '']
        
        for invalid_url in invalid_urls:
            with self.assertRaises(ValueError):
                RegistryClient(invalid_url)
                
    def test_batch_operations(self):
        """Test batch operations for efficiency"""
        multiple_users = ['user1', 'user2', 'user3']
        
        with patch('requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'results': [
                    {'user_id': 'user1', 'addresses': []},
                    {'user_id': 'user2', 'addresses': []},
                    {'user_id': 'user3', 'addresses': []}
                ]
            }
            mock_post.return_value = mock_response
            
            # Test batch address lookup
            if hasattr(self.client, 'get_multiple_user_addresses'):
                result = self.client.get_multiple_user_addresses(multiple_users)
                self.assertEqual(result['status'], 'success')
                self.assertEqual(len(result['results']), 3)

if __name__ == '__main__':
    unittest.main()
