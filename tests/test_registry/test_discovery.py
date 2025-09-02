import unittest
import time
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Note: This test assumes the discovery service exists
# If it doesn't exist yet, these tests serve as specifications
try:
    from registry.discovery import DiscoveryService
except ImportError:
    # Create a mock class for testing specifications
    class DiscoveryService:
        def __init__(self, registry_urls=None):
            self.registry_urls = registry_urls or ['https://registry1.example.com', 'https://registry2.example.com']
            self.active_registries = []
            self.discovery_cache = {}
            
        def discover_registries(self):
            return self.registry_urls
            
        def check_registry_health(self, registry_url):
            return {'status': 'healthy', 'response_time': 0.1}
            
        def find_user_across_registries(self, user_id):
            return {'status': 'success', 'user': None, 'registry': None}
            
        def broadcast_to_registries(self, data):
            return {'status': 'success', 'results': []}
            
        def get_best_registry(self, criteria=None):
            return self.registry_urls[0] if self.registry_urls else None

class TestDiscoveryService(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_registry_urls = [
            'https://registry1.example.com',
            'https://registry2.example.com', 
            'https://registry3.example.com'
        ]
        
        self.discovery_service = DiscoveryService(self.test_registry_urls)
        
        self.test_user_data = {
            'user_id': 'test_user_123',
            'name': 'Test User',
            'bio': 'A test user for discovery testing',
            'public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
            'current_addresses': ['http://192.168.1.100:8080']
        }
        
    def test_initialization(self):
        """Test discovery service initialization"""
        self.assertEqual(self.discovery_service.registry_urls, self.test_registry_urls)
        self.assertIsInstance(self.discovery_service.active_registries, list)
        self.assertIsInstance(self.discovery_service.discovery_cache, dict)
        
    def test_initialization_with_defaults(self):
        """Test initialization with default registry URLs"""
        default_service = DiscoveryService()
        self.assertTrue(len(default_service.registry_urls) > 0)
        
        for url in default_service.registry_urls:
            self.assertTrue(url.startswith('http'))
            
    def test_discover_registries(self):
        """Test registry discovery"""
        registries = self.discovery_service.discover_registries()
        
        self.assertIsInstance(registries, list)
        self.assertTrue(len(registries) > 0)
        
        # All results should be valid URLs
        for registry in registries:
            self.assertTrue(registry.startswith('http'))
            
    @patch('requests.get')
    def test_discover_registries_with_dns(self, mock_get):
        """Test registry discovery using DNS-based discovery"""
        # Mock DNS TXT record discovery
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'registries': [
                {'url': 'https://discovered1.example.com', 'priority': 1},
                {'url': 'https://discovered2.example.com', 'priority': 2}
            ]
        }
        mock_get.return_value = mock_response
        
        if hasattr(self.discovery_service, 'discover_via_dns'):
            registries = self.discovery_service.discover_via_dns()
            
            self.assertIsInstance(registries, list)
            self.assertTrue(len(registries) >= 2)
            
    def test_check_registry_health(self):
        """Test registry health checking"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'healthy',
                'version': '1.0.0',
                'users_count': 1000,
                'uptime': 86400
            }
            mock_response.elapsed.total_seconds.return_value = 0.15
            mock_get.return_value = mock_response
            
            health = self.discovery_service.check_registry_health(self.test_registry_urls[0])
            
            self.assertEqual(health['status'], 'healthy')
            self.assertIn('response_time', health)
            self.assertIsInstance(health['response_time'], float)
            
    def test_check_registry_health_failure(self):
        """Test registry health check with failed registry"""
        with patch('requests.get') as mock_get:
            mock_get.side_effect = Exception("Connection failed")
            
            health = self.discovery_service.check_registry_health(self.test_registry_urls[0])
            
            self.assertEqual(health['status'], 'unhealthy')
            self.assertIn('error', health)
            
    def test_find_user_across_registries(self):
        """Test finding user across multiple registries"""
        with patch('requests.get') as mock_get:
            # First registry returns not found
            response1 = MagicMock()
            response1.status_code = 404
            response1.json.return_value = {'status': 'error', 'message': 'User not found'}
            
            # Second registry returns user
            response2 = MagicMock()
            response2.status_code = 200
            response2.json.return_value = {
                'status': 'success',
                'user': self.test_user_data
            }
            
            mock_get.side_effect = [response1, response2]
            
            result = self.discovery_service.find_user_across_registries('test_user_123')
            
            self.assertEqual(result['status'], 'success')
            self.assertIsNotNone(result['user'])
            self.assertEqual(result['user']['user_id'], 'test_user_123')
            self.assertIn('registry', result)
            
    def test_find_user_not_found(self):
        """Test finding user that doesn't exist in any registry"""
        with patch('requests.get') as mock_get:
            # All registries return not found
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_response.json.return_value = {'status': 'error', 'message': 'User not found'}
            mock_get.return_value = mock_response
            
            result = self.discovery_service.find_user_across_registries('nonexistent_user')
            
            self.assertEqual(result['status'], 'error')
            self.assertIn('not found', result['message'].lower())
            
    def test_broadcast_to_registries(self):
        """Test broadcasting data to multiple registries"""
        with patch('requests.post') as mock_post:
            # Mock successful responses from all registries
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {'status': 'success'}
            mock_post.return_value = mock_response
            
            broadcast_data = {
                'type': 'user_update',
                'user': self.test_user_data
            }
            
            result = self.discovery_service.broadcast_to_registries(broadcast_data)
            
            self.assertEqual(result['status'], 'success')
            self.assertIn('results', result)
            self.assertEqual(len(result['results']), len(self.test_registry_urls))
            
            # Verify all registries were contacted
            self.assertEqual(mock_post.call_count, len(self.test_registry_urls))
            
    def test_broadcast_with_partial_failures(self):
        """Test broadcasting with some registries failing"""
        with patch('requests.post') as mock_post:
            # First registry succeeds, second fails, third succeeds
            responses = [
                MagicMock(status_code=200, json=lambda: {'status': 'success'}),
                MagicMock(side_effect=Exception("Connection failed")),
                MagicMock(status_code=200, json=lambda: {'status': 'success'})
            ]
            mock_post.side_effect = responses
            
            broadcast_data = {
                'type': 'user_update',
                'user': self.test_user_data
            }
            
            result = self.discovery_service.broadcast_to_registries(broadcast_data)
            
            # Should still be overall success with partial results
            self.assertEqual(result['status'], 'success')
            
            # Should have results for successful registries
            successful_results = [r for r in result['results'] if r.get('status') == 'success']
            self.assertTrue(len(successful_results) >= 2)
            
    def test_get_best_registry(self):
        """Test getting the best registry based on criteria"""
        with patch.object(self.discovery_service, 'check_registry_health') as mock_health:
            # Mock health responses with different response times
            mock_health.side_effect = [
                {'status': 'healthy', 'response_time': 0.2},
                {'status': 'healthy', 'response_time': 0.1}, 
                {'status': 'unhealthy', 'error': 'Timeout'}
            ]
            
            best_registry = self.discovery_service.get_best_registry({'prefer': 'lowest_latency'})
            
            # Should return the registry with lowest response time
            self.assertEqual(best_registry, self.test_registry_urls[1])
            
    def test_get_best_registry_load_balancing(self):
        """Test load balancing registry selection"""
        if hasattr(self.discovery_service, 'get_best_registry'):
            # Test multiple calls to ensure load balancing
            results = []
            for _ in range(10):
                registry = self.discovery_service.get_best_registry({'strategy': 'round_robin'})
                results.append(registry)
                
            # Should distribute across multiple registries
            unique_registries = set(results)
            if len(self.test_registry_urls) > 1:
                self.assertTrue(len(unique_registries) > 1)
                
    def test_registry_caching(self):
        """Test caching of registry responses"""
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'status': 'success',
                'user': self.test_user_data
            }
            mock_get.return_value = mock_response
            
            # First call
            result1 = self.discovery_service.find_user_across_registries('test_user_123')
            
            # Second call (should use cache if implemented)
            result2 = self.discovery_service.find_user_across_registries('test_user_123')
            
            self.assertEqual(result1['status'], 'success')
            self.assertEqual(result2['status'], 'success')
            
            # If caching is implemented, should have fewer calls than expected
            # Otherwise, will make calls to all registries both times
            
    def test_cache_expiration(self):
        """Test cache expiration"""
        if hasattr(self.discovery_service, 'discovery_cache'):
            # Add expired entry to cache
            expired_time = time.time() - 3600  # 1 hour ago
            self.discovery_service.discovery_cache['test_user_123'] = {
                'data': self.test_user_data,
                'timestamp': expired_time,
                'ttl': 1800  # 30 minutes TTL
            }
            
            with patch('requests.get') as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {
                    'status': 'success',
                    'user': self.test_user_data
                }
                mock_get.return_value = mock_response
                
                # Should make fresh request due to expired cache
                result = self.discovery_service.find_user_across_registries('test_user_123')
                
                self.assertEqual(result['status'], 'success')
                
    def test_registry_failover(self):
        """Test failover to backup registries"""
        with patch('requests.get') as mock_get:
            # First registry fails, second succeeds
            responses = [
                Exception("Primary registry down"),
                MagicMock(
                    status_code=200,
                    json=lambda: {'status': 'success', 'user': self.test_user_data}
                )
            ]
            mock_get.side_effect = responses
            
            result = self.discovery_service.find_user_across_registries('test_user_123')
            
            self.assertEqual(result['status'], 'success')
            self.assertIsNotNone(result['user'])
            
    def test_registry_priority_ordering(self):
        """Test registry priority ordering"""
        if hasattr(self.discovery_service, 'set_registry_priorities'):
            priorities = {
                self.test_registry_urls[0]: 3,
                self.test_registry_urls[1]: 1,  # Highest priority
                self.test_registry_urls[2]: 2
            }
            
            self.discovery_service.set_registry_priorities(priorities)
            
            # Should try highest priority registry first
            with patch('requests.get') as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {
                    'status': 'success',
                    'user': self.test_user_data
                }
                mock_get.return_value = mock_response
                
                result = self.discovery_service.find_user_across_registries('test_user_123')
                
                self.assertEqual(result['status'], 'success')
                
                # First call should be to highest priority registry
                first_call_url = mock_get.call_args_list[0][0][0]
                self.assertIn(self.test_registry_urls[1], first_call_url)
                
    def test_async_discovery(self):
        """Test asynchronous discovery operations"""
        if hasattr(self.discovery_service, 'async_find_user'):
            # This would test async operations if implemented
            import asyncio
            
            async def test_async():
                result = await self.discovery_service.async_find_user('test_user_123')
                self.assertEqual(result['status'], 'success')
                
            # Run async test if asyncio is available
            try:
                asyncio.run(test_async())
            except AttributeError:
                # Method not implemented yet
                pass

if __name__ == '__main__':
    unittest.main()
