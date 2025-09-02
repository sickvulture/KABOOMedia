import unittest
import socket
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.nat_traversal import NATTraversal

class TestNATTraversal(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.nat_traversal = NATTraversal()
        
    def test_initialization(self):
        """Test NAT traversal initialization"""
        self.assertFalse(self.nat_traversal.upnp_enabled)
        
    def test_get_local_ip(self):
        """Test getting local IP address"""
        local_ip = self.nat_traversal._get_local_ip()
        
        # Should return a valid IP address
        self.assertIsInstance(local_ip, str)
        self.assertTrue(len(local_ip) > 0)
        
        # Should not be localhost
        self.assertNotEqual(local_ip, '127.0.0.1')
        
        # Should be a valid IP format (basic check)
        parts = local_ip.split('.')
        self.assertEqual(len(parts), 4)
        
        for part in parts:
            try:
                num = int(part)
                self.assertTrue(0 <= num <= 255)
            except ValueError:
                self.fail(f"Invalid IP address format: {local_ip}")
                
    @patch('socket.socket')
    def test_get_local_ip_socket_creation(self, mock_socket_class):
        """Test that get_local_ip properly uses socket"""
        # Mock socket instance
        mock_socket = MagicMock()
        mock_socket.getsockname.return_value = ('192.168.1.100', 12345)
        mock_socket_class.return_value = mock_socket
        
        local_ip = self.nat_traversal._get_local_ip()
        
        # Verify socket was created and used correctly
        mock_socket_class.assert_called_once_with(socket.AF_INET, socket.SOCK_DGRAM)
        mock_socket.connect.assert_called_once_with(("8.8.8.8", 80))
        mock_socket.getsockname.assert_called_once()
        mock_socket.close.assert_called_once()
        
        self.assertEqual(local_ip, '192.168.1.100')
        
    def test_setup_port_forwarding_no_upnp(self):
        """Test port forwarding setup when UPnP is not available"""
        # This should fail gracefully when upnpclient is not available
        # or no UPnP devices are found
        result = self.nat_traversal.setup_port_forwarding(8080)
        
        # Should return False when UPnP is not available
        self.assertFalse(result)
        self.assertFalse(self.nat_traversal.upnp_enabled)
        
    @patch('core.nat_traversal.upnpclient')
    def test_setup_port_forwarding_with_upnp_success(self, mock_upnp):
        """Test successful UPnP port forwarding setup"""
        # Mock UPnP device
        mock_device = MagicMock()
        mock_wan_connection = MagicMock()
        mock_device.WANIPConn1 = mock_wan_connection
        mock_upnp.discover.return_value = [mock_device]
        
        # Mock local IP
        with patch.object(self.nat_traversal, '_get_local_ip', return_value='192.168.1.100'):
            result = self.nat_traversal.setup_port_forwarding(8080)
            
        self.assertTrue(result)
        self.assertTrue(self.nat_traversal.upnp_enabled)
        
        # Verify UPnP calls
        mock_upnp.discover.assert_called_once()
        mock_wan_connection.AddPortMapping.assert_called_once_with(
            NewRemoteHost='',
            NewExternalPort=8080,
            NewProtocol='TCP',
            NewInternalPort=8080,
            NewInternalClient='192.168.1.100',
            NewEnabled='1',
            NewPortMappingDescription='DecentralizedSocial',
            NewLeaseDuration=0
        )
        
    @patch('core.nat_traversal.upnpclient')
    def test_setup_port_forwarding_with_upnp_no_devices(self, mock_upnp):
        """Test UPnP port forwarding setup when no devices are found"""
        mock_upnp.discover.return_value = []
        
        result = self.nat_traversal.setup_port_forwarding(8080)
        
        self.assertFalse(result)
        self.assertFalse(self.nat_traversal.upnp_enabled)
        
    @patch('core.nat_traversal.upnpclient')
    def test_setup_port_forwarding_with_upnp_exception(self, mock_upnp):
        """Test UPnP port forwarding setup when an exception occurs"""
        mock_upnp.discover.side_effect = Exception("UPnP discovery failed")
        
        result = self.nat_traversal.setup_port_forwarding(8080)
        
        self.assertFalse(result)
        self.assertFalse(self.nat_traversal.upnp_enabled)
        
    @patch('core.nat_traversal.upnpclient')
    def test_setup_port_forwarding_different_ports(self, mock_upnp):
        """Test UPnP port forwarding setup with different ports"""
        mock_device = MagicMock()
        mock_wan_connection = MagicMock()
        mock_device.WANIPConn1 = mock_wan_connection
        mock_upnp.discover.return_value = [mock_device]
        
        with patch.object(self.nat_traversal, '_get_local_ip', return_value='192.168.1.100'):
            # Test different ports
            ports_to_test = [8080, 9999, 3000, 8000]
            
            for port in ports_to_test:
                result = self.nat_traversal.setup_port_forwarding(port)
                self.assertTrue(result)
                
        # Verify all ports were set up
        self.assertEqual(mock_wan_connection.AddPortMapping.call_count, len(ports_to_test))
        
    @patch('core.nat_traversal.upnpclient')
    def test_setup_port_forwarding_addportmapping_exception(self, mock_upnp):
        """Test UPnP port forwarding setup when AddPortMapping fails"""
        mock_device = MagicMock()
        mock_wan_connection = MagicMock()
        mock_wan_connection.AddPortMapping.side_effect = Exception("Port mapping failed")
        mock_device.WANIPConn1 = mock_wan_connection
        mock_upnp.discover.return_value = [mock_device]
        
        with patch.object(self.nat_traversal, '_get_local_ip', return_value='192.168.1.100'):
            result = self.nat_traversal.setup_port_forwarding(8080)
            
        self.assertFalse(result)
        self.assertFalse(self.nat_traversal.upnp_enabled)
        
    def test_upnp_import_error_handling(self):
        """Test that missing upnpclient is handled gracefully"""
        # The actual setup_port_forwarding method should handle ImportError
        # when upnpclient is not available
        result = self.nat_traversal.setup_port_forwarding(8080)
        
        # Should not raise an exception, should return False
        self.assertFalse(result)
        
    @patch('core.nat_traversal.upnpclient')
    def test_multiple_upnp_devices(self, mock_upnp):
        """Test UPnP setup with multiple devices (should use first one)"""
        mock_device1 = MagicMock()
        mock_device2 = MagicMock()
        mock_wan_connection1 = MagicMock()
        mock_wan_connection2 = MagicMock()
        
        mock_device1.WANIPConn1 = mock_wan_connection1
        mock_device2.WANIPConn1 = mock_wan_connection2
        mock_upnp.discover.return_value = [mock_device1, mock_device2]
        
        with patch.object(self.nat_traversal, '_get_local_ip', return_value='192.168.1.100'):
            result = self.nat_traversal.setup_port_forwarding(8080)
            
        self.assertTrue(result)
        self.assertTrue(self.nat_traversal.upnp_enabled)
        
        # Should only call first device
        mock_wan_connection1.AddPortMapping.assert_called_once()
        mock_wan_connection2.AddPortMapping.assert_not_called()

if __name__ == '__main__':
    unittest.main()
