import unittest
import time
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from site_generator.address_manager import DynamicAddressManager

class TestDynamicAddressManager(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.base_port = 8080
        self.address_manager = DynamicAddressManager(self.base_port)
        
    def test_initialization(self):
        """Test address manager initialization"""
        self.assertEqual(self.address_manager.base_port, self.base_port)
        self.assertEqual(len(self.address_manager.current_addresses), 0)
        self.assertEqual(len(self.address_manager.address_history), 0)
        
    @patch('site_generator.address_manager.netifaces')
    def test_get_local_addresses(self, mock_netifaces):
        """Test getting local network addresses"""
        # Mock netifaces responses
        mock_netifaces.interfaces.return_value = ['eth0', 'wlan0', 'lo']
        mock_netifaces.AF_INET = 2
        
        # Mock interface addresses
        mock_netifaces.ifaddresses.side_effect = [
            {2: [{'addr': '192.168.1.100'}]},  # eth0
            {2: [{'addr': '10.0.0.50'}]},      # wlan0
            {2: [{'addr': '127.0.0.1'}]}       # lo (localhost)
        ]
        
        addresses = self.address_manager.get_local_addresses()
        
        # Should return 2 addresses (excluding localhost)
        self.assertEqual(len(addresses), 2)
        
        # Check first address
        self.assertEqual(addresses[0]['interface'], 'eth0')
        self.assertEqual(addresses[0]['ip'], '192.168.1.100')
        self.assertEqual(addresses[0]['port'], self.base_port)
        self.assertEqual(addresses[0]['url'], f'http://192.168.1.100:{self.base_port}')
        
        # Check second address
        self.assertEqual(addresses[1]['interface'], 'wlan0')
        self.assertEqual(addresses[1]['ip'], '10.0.0.50')
        self.assertEqual(addresses[1]['url'], f'http://10.0.0.50:{self.base_port}')
        
        # Verify timestamps are present
        for addr in addresses:
            self.assertIn('timestamp', addr)
            self.assertIsInstance(addr['timestamp'], float)
            
    @patch('site_generator.address_manager.netifaces')
    def test_get_local_addresses_interface_error(self, mock_netifaces):
        """Test handling of interface errors"""
        mock_netifaces.interfaces.return_value = ['eth0', 'bad_interface']
        mock_netifaces.AF_INET = 2
        
        # First interface works, second raises exception
        mock_netifaces.ifaddresses.side_effect = [
            {2: [{'addr': '192.168.1.100'}]},
            Exception("Interface error")
        ]
        
        addresses = self.address_manager.get_local_addresses()
        
        # Should return 1 address (the working one)
        self.assertEqual(len(addresses), 1)
        self.assertEqual(addresses[0]['ip'], '192.168.1.100')
        
    @patch('site_generator.address_manager.urllib.request')
    def test_get_external_address_success(self, mock_urllib):
        """Test getting external IP address successfully"""
        mock_response = MagicMock()
        mock_response.read.return_value.decode.return_value = '203.0.113.1'
        mock_urllib.urlopen.return_value = mock_response
        
        external_addr = self.address_manager.get_external_address()
        
        self.assertIsNotNone(external_addr)
        self.assertEqual(external_addr['type'], 'external')
        self.assertEqual(external_addr['ip'], '203.0.113.1')
        self.assertEqual(external_addr['port'], self.base_port)
        self.assertEqual(external_addr['url'], f'http://203.0.113.1:{self.base_port}')
        self.assertIn('timestamp', external_addr)
        
    @patch('site_generator.address_manager.urllib.request')
    def test_get_external_address_failure(self, mock_urllib):
        """Test handling external IP lookup failure"""
        mock_urllib.urlopen.side_effect = Exception("Network error")
        
        external_addr = self.address_manager.get_external_address()
        
        self.assertIsNone(external_addr)
        
    def test_generate_address_id(self):
        """Test address ID generation"""
        test_addresses = [
            'http://192.168.1.100:8080',
            'http://203.0.113.1:8080',
            'http://10.0.0.1:8080'
        ]
        
        ids = []
        for addr in test_addresses:
            addr_id = self.address_manager.generate_address_id(addr)
            ids.append(addr_id)
            
            # Should be 16 characters
            self.assertEqual(len(addr_id), 16)
            
            # Should be hexadecimal
            try:
                int(addr_id, 16)
            except ValueError:
                self.fail(f"Address ID is not hexadecimal: {addr_id}")
                
        # Different addresses should have different IDs
        self.assertEqual(len(set(ids)), len(ids))
        
        # Same address should have same ID
        same_id = self.address_manager.generate_address_id(test_addresses[0])
        self.assertEqual(ids[0], same_id)
        
    @patch.object(DynamicAddressManager, 'get_local_addresses')
    @patch.object(DynamicAddressManager, 'get_external_address')
    def test_update_current_addresses(self, mock_external, mock_local):
        """Test updating current addresses"""
        mock_local.return_value = [
            {
                'interface': 'eth0',
                'ip': '192.168.1.100',
                'port': 8080,
                'url': 'http://192.168.1.100:8080',
                'timestamp': time.time()
            }
        ]
        
        mock_external.return_value = {
            'type': 'external',
            'ip': '203.0.113.1',
            'port': 8080,
            'url': 'http://203.0.113.1:8080',
            'timestamp': time.time()
        }
        
        addresses = self.address_manager.update_current_addresses()
        
        # Should have 2 addresses (local + external)
        self.assertEqual(len(addresses), 2)
        
        # Check that IDs were added
        for addr in addresses:
            self.assertIn('id', addr)
            self.assertEqual(len(addr['id']), 16)
            
        # Check that addresses are stored
        self.assertEqual(len(self.address_manager.current_addresses), 2)
        self.assertEqual(len(self.address_manager.address_history), 2)
        
    @patch.object(DynamicAddressManager, 'get_local_addresses')
    @patch.object(DynamicAddressManager, 'get_external_address')
    def test_update_current_addresses_no_external(self, mock_external, mock_local):
        """Test updating addresses when external IP is not available"""
        mock_local.return_value = [
            {
                'interface': 'eth0',
                'ip': '192.168.1.100',
                'port': 8080,
                'url': 'http://192.168.1.100:8080',
                'timestamp': time.time()
            }
        ]
        
        mock_external.return_value = None
        
        addresses = self.address_manager.update_current_addresses()
        
        # Should have only 1 address (local)
        self.assertEqual(len(addresses), 1)
        self.assertEqual(addresses[0]['ip'], '192.168.1.100')
        
    def test_get_shareable_addresses(self):
        """Test getting addresses that can be shared"""
        # Set up some test addresses
        self.address_manager.current_addresses = [
            {
                'ip': '127.0.0.1',  # localhost - not shareable
                'url': 'http://127.0.0.1:8080',
                'id': 'local1'
            },
            {
                'ip': '192.168.1.100',  # local network - shareable
                'url': 'http://192.168.1.100:8080',
                'id': 'local2'
            },
            {
                'ip': '203.0.113.1',  # external - shareable
                'url': 'http://203.0.113.1:8080',
                'id': 'external1'
            },
            {
                'ip': '127.0.0.2',  # another localhost - not shareable
                'url': 'http://127.0.0.2:8080',
                'id': 'local3'
            }
        ]
        
        shareable = self.address_manager.get_shareable_addresses()
        
        # Should have 2 shareable addresses
        self.assertEqual(len(shareable), 2)
        
        shareable_ips = [addr['ip'] for addr in shareable]
        self.assertIn('192.168.1.100', shareable_ips)
        self.assertIn('203.0.113.1', shareable_ips)
        self.assertNotIn('127.0.0.1', shareable_ips)
        self.assertNotIn('127.0.0.2', shareable_ips)
        
    def test_address_history_tracking(self):
        """Test that address history is properly tracked"""
        # Simulate multiple address updates
        test_addresses = [
            {
                'ip': '192.168.1.100',
                'url': 'http://192.168.1.100:8080',
                'timestamp': time.time()
            },
            {
                'ip': '192.168.1.101',
                'url': 'http://192.168.1.101:8080',
                'timestamp': time.time()
            }
        ]
        
        with patch.object(self.address_manager, 'get_local_addresses') as mock_local:
            with patch.object(self.address_manager, 'get_external_address', return_value=None):
                
                # First update
                mock_local.return_value = [test_addresses[0]]
                self.address_manager.update_current_addresses()
                
                # Second update with different address
                mock_local.return_value = [test_addresses[1]]
                self.address_manager.update_current_addresses()
                
                # History should contain both addresses
                self.assertEqual(len(self.address_manager.address_history), 2)
                
                # Current should only have latest
                self.assertEqual(len(self.address_manager.current_addresses), 1)
                self.assertEqual(self.address_manager.current_addresses[0]['ip'], '192.168.1.101')
                
    def test_different_port_configurations(self):
        """Test address manager with different port configurations"""
        custom_port = 3000
        custom_manager = DynamicAddressManager(custom_port)
        
        with patch('site_generator.address_manager.netifaces') as mock_netifaces:
            mock_netifaces.interfaces.return_value = ['eth0']
            mock_netifaces.AF_INET = 2
            mock_netifaces.ifaddresses.return_value = {2: [{'addr': '192.168.1.100'}]}
            
            addresses = custom_manager.get_local_addresses()
            
            self.assertEqual(len(addresses), 1)
            self.assertEqual(addresses[0]['port'], custom_port)
            self.assertEqual(addresses[0]['url'], f'http://192.168.1.100:{custom_port}')

if __name__ == '__main__':
    unittest.main()
