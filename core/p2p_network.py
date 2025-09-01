import socket
import threading
import json
import time
from typing import Dict, List, Callable, Optional
from .nat_traversal import NATTraversal

class P2PNode:
    def __init__(self, port: int = 9999):
        self.port = port
        self.socket = None
        self.peer_connections = {}  # peer_id -> socket
        self.message_handlers = {}
        self.is_running = False
        self.nat_traversal = NATTraversal()
    
    def start_node(self):
        """Start the P2P node"""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(('', self.port))
        self.socket.listen(5)
        self.is_running = True
        
        # Try to set up port forwarding for NAT traversal
        self.nat_traversal.setup_port_forwarding(self.port)
        
        # Start listening thread
        listen_thread = threading.Thread(target=self._listen_for_connections)
        listen_thread.daemon = True
        listen_thread.start()
        
        print(f"P2P node started on port {self.port}")
    
    def stop_node(self):
        """Stop the P2P node"""
        self.is_running = False
        if self.socket:
            self.socket.close()
        for peer_socket in self.peer_connections.values():
            peer_socket.close()
        self.peer_connections.clear()
    
    def connect_to_peer(self, peer_address: str, peer_port: int, peer_id: str):
        """Connect to another peer"""
        try:
            peer_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            peer_socket.connect((peer_address, peer_port))
            self.peer_connections[peer_id] = peer_socket
            
            # Start handling messages from this peer
            handler_thread = threading.Thread(
                target=self._handle_peer_messages, 
                args=(peer_socket, peer_id)
            )
            handler_thread.daemon = True
            handler_thread.start()
            
            return True
        except Exception as e:
            print(f"Failed to connect to peer {peer_id}: {e}")
            return False
    
    def send_message(self, peer_id: str, message_type: str, data: Dict):
        """Send a message to a specific peer"""
        if peer_id not in self.peer_connections:
            return False
        
        message = {
            'type': message_type,
            'timestamp': time.time(),
            'data': data
        }
        
        try:
            message_json = json.dumps(message) + '\n'
            self.peer_connections[peer_id].send(message_json.encode())
            return True
        except Exception as e:
            print(f"Failed to send message to {peer_id}: {e}")
            return False
    
    def broadcast_message(self, message_type: str, data: Dict):
        """Broadcast a message to all connected peers"""
        for peer_id in list(self.peer_connections.keys()):
            self.send_message(peer_id, message_type, data)
    
    def add_message_handler(self, message_type: str, handler: Callable):
        """Add a handler for specific message types"""
        self.message_handlers[message_type] = handler
    
    def _listen_for_connections(self):
        """Listen for incoming peer connections"""
        while self.is_running:
            try:
                client_socket, address = self.socket.accept()
                peer_id = f"{address[0]}:{address[1]}"
                self.peer_connections[peer_id] = client_socket
                
                handler_thread = threading.Thread(
                    target=self._handle_peer_messages, 
                    args=(client_socket, peer_id)
                )
                handler_thread.daemon = True
                handler_thread.start()
                
            except Exception as e:
                if self.is_running:
                    print(f"Error accepting connection: {e}")
    
    def _handle_peer_messages(self, peer_socket: socket.socket, peer_id: str):
        """Handle messages from a specific peer"""
        buffer = ""
        while self.is_running:
            try:
                data = peer_socket.recv(1024).decode()
                if not data:
                    break
                
                buffer += data
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if line:
                        try:
                            message = json.loads(line)
                            message_type = message.get('type')
                            if message_type in self.message_handlers:
                                self.message_handlers[message_type](peer_id, message['data'])
                        except json.JSONDecodeError:
                            print(f"Invalid JSON from {peer_id}: {line}")
                            
            except Exception as e:
                print(f"Error handling messages from {peer_id}: {e}")
                break
        
        # Clean up connection
        peer_socket.close()
        if peer_id in self.peer_connections:
            del self.peer_connections[peer_id]
