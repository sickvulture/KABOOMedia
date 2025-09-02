import unittest
import threading
import time
import socket
import json
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.p2p_network import P2PNode

class TestP2PNode(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        # Use different ports for each test to avoid conflicts
        self.test_port_1 = 19991
        self.test_port_2 = 19992
        self.node1 = P2PNode(self.test_port_1)
        self.node2 = P2PNode(self.test_port_2)
        
        # Track messages received for testing
        self.received_messages = []
        self.message_lock = threading.Lock()
        
    def tearDown(self):
        """Clean up test fixtures"""
        self.node1.stop_node()
        self.node2.stop_node()
        time.sleep(0.1)  # Give nodes time to shutdown
        
    def test_node_initialization(self):
        """Test P2P node initialization"""
        self.assertEqual(self.node1.port, self.test_port_1)
        self.assertEqual(self.node2.port, self.test_port_2)
        self.assertFalse(self.node1.is_running)
        self.assertFalse(self.node2.is_running)
        self.assertEqual(len(self.node1.peer_connections), 0)
        
    def test_start_stop_node(self):
        """Test starting and stopping nodes"""
        # Start node
        self.node1.start_node()
        self.assertTrue(self.node1.is_running)
        self.assertIsNotNone(self.node1.socket)
        
        # Stop node
        self.node1.stop_node()
        self.assertFalse(self.node1.is_running)
        
    def test_node_listening(self):
        """Test that node can listen for connections"""
        self.node1.start_node()
        
        # Try to connect to the node
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            test_socket.connect(('localhost', self.test_port_1))
            # If we get here, the node is listening
            self.assertTrue(True)
        except ConnectionRefusedError:
            self.fail("Node is not listening on the expected port")
        finally:
            test_socket.close()
            
    def test_peer_connection(self):
        """Test connecting two peers"""
        # Start both nodes
        self.node1.start_node()
        self.node2.start_node()
        time.sleep(0.1)  # Give nodes time to start
        
        # Connect node2 to node1
        success = self.node2.connect_to_peer('localhost', self.test_port_1, 'peer1')
        self.assertTrue(success)
        
        # Give connection time to establish
        time.sleep(0.1)
        
        # Check that connection exists
        self.assertIn('peer1', self.node2.peer_connections)
        
    def test_message_sending(self):
        """Test sending messages between peers"""
        # Set up message handler for node1
        def handle_test_message(peer_id, data):
            with self.message_lock:
                self.received_messages.append({
                    'peer_id': peer_id,
                    'data': data
                })
        
        self.node1.add_message_handler('test_message', handle_test_message)
        
        # Start both nodes and connect them
        self.node1.start_node()
        self.node2.start_node()
        time.sleep(0.1)
        
        self.node2.connect_to_peer('localhost', self.test_port_1, 'peer1')
        time.sleep(0.1)
        
        # Send message from node2 to node1
        test_data = {'content': 'Hello from peer2', 'timestamp': time.time()}
        success = self.node2.send_message('peer1', 'test_message', test_data)
        self.assertTrue(success)
        
        # Give message time to be received and processed
        time.sleep(0.1)
        
        # Check that message was received
        with self.message_lock:
            self.assertEqual(len(self.received_messages), 1)
            received = self.received_messages[0]
            self.assertEqual(received['data'], test_data)
            
    def test_message_broadcasting(self):
        """Test broadcasting messages to multiple peers"""
        # This test would require more complex setup with multiple peers
        # For now, test that broadcast method exists and can be called
        self.node1.start_node()
        
        test_data = {'broadcast': 'test message'}
        # Should not raise an exception even with no peers
        self.node1.broadcast_message('broadcast_test', test_data)
        
    def test_message_handler_registration(self):
        """Test registering message handlers"""
        def dummy_handler(peer_id, data):
            pass
            
        # Register handler
        self.node1.add_message_handler('test_type', dummy_handler)
        
        # Check that handler is registered
        self.assertIn('test_type', self.node1.message_handlers)
        self.assertEqual(self.node1.message_handlers['test_type'], dummy_handler)
        
    def test_send_message_to_nonexistent_peer(self):
        """Test sending message to peer that doesn't exist"""
        self.node1.start_node()
        
        # Try to send to non-existent peer
        success = self.node1.send_message('nonexistent_peer', 'test', {'data': 'test'})
        self.assertFalse(success)
        
    def test_multiple_message_types(self):
        """Test handling multiple message types"""
        message_counts = {'type1': 0, 'type2': 0}
        
        def handle_type1(peer_id, data):
            message_counts['type1'] += 1
            
        def handle_type2(peer_id, data):
            message_counts['type2'] += 1
            
        self.node1.add_message_handler('type1', handle_type1)
        self.node1.add_message_handler('type2', handle_type2)
        
        # Start nodes and connect
        self.node1.start_node()
        self.node2.start_node()
        time.sleep(0.1)
        
        self.node2.connect_to_peer('localhost', self.test_port_1, 'peer1')
        time.sleep(0.1)
        
        # Send different types of messages
        self.node2.send_message('peer1', 'type1', {'test': 1})
        self.node2.send_message('peer1', 'type2', {'test': 2})
        self.node2.send_message('peer1', 'type1', {'test': 3})
        
        time.sleep(0.2)  # Give messages time to be processed
        
        # Check that correct handlers were called
        self.assertEqual(message_counts['type1'], 2)
        self.assertEqual(message_counts['type2'], 1)
        
    def test_connection_cleanup_on_stop(self):
        """Test that connections are cleaned up when node stops"""
        self.node1.start_node()
        self.node2.start_node()
        time.sleep(0.1)
        
        # Establish connection
        self.node2.connect_to_peer('localhost', self.test_port_1, 'peer1')
        time.sleep(0.1)
        
        # Verify connection exists
        self.assertTrue(len(self.node2.peer_connections) > 0)
        
        # Stop node
        self.node2.stop_node()
        
        # Verify connections are cleaned up
        self.assertEqual(len(self.node2.peer_connections), 0)
        
    def test_invalid_json_handling(self):
        """Test handling of invalid JSON messages"""
        # This is more of an integration test - would need actual socket
        # communication to test invalid JSON handling properly
        # For now, just verify the method exists
        self.assertTrue(hasattr(self.node1, '_handle_peer_messages'))

if __name__ == '__main__':
    unittest.main()
