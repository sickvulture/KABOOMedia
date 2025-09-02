#!/usr/bin/env python3
"""
Network utilities for Decentralized Social Media Platform
"""

import socket
import urllib.request
import urllib.parse
import urllib.error
import json
import time
import threading
from typing import List, Dict, Optional, Tuple
import netifaces

class NetworkDiscovery:
    """Discover network interfaces and connectivity"""
    
    @staticmethod
    def get_local_ip() -> str:
        """Get primary local IP address"""
        try:
            # Create a socket and connect to a remote address
            # This doesn't actually send data, just determines routing
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            return "127.0.0.1"
    
    @staticmethod
    def get_all_local_ips() -> List[str]:
        """Get all local IP addresses"""
        ips = []
        
        for interface in netifaces.interfaces():
            try:
                addresses = netifaces.ifaddresses(interface)
                if netifaces.AF_INET in addresses:
                    for addr_info in addresses[netifaces.AF_INET]:
                        ip = addr_info['addr']
                        # Skip loopback and APIPA addresses
                        if not ip.startswith(('127.', '169.254.')):
                            ips.append(ip)
            except Exception:
                continue
        
        return list(set(ips))  # Remove duplicates
    
    @staticmethod
    def get_external_ip() -> Optional[str]:
        """Get external IP address using public services"""
        services = [
            "https://api.ipify.org",
            "https://icanhazip.com",
            "https://ipecho.net/plain"
        ]
        
        for service in services:
            try:
                response = urllib.request.urlopen(service, timeout=5)
                ip = response.read().decode('utf-8').strip()
                # Validate IP format
                socket.inet_aton(ip)
                return ip
            except Exception:
                continue
        
        return None
    
    @staticmethod
    def is_port_open(host: str, port: int, timeout: int = 3) -> bool:
        """Check if a port is open on a host"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False
    
    @staticmethod
    def find_available_port(start_port: int = 8000, end_port: int = 9000) -> Optional[int]:
        """Find an available port in the given range"""
        for port in range(start_port, end_port + 1):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.bind(('', port))
                sock.close()
                return port
            except OSError:
                continue
        return None
    
    @staticmethod
    def get_network_info() -> Dict[str, any]:
        """Get comprehensive network information"""
        return {
            'local_ip': NetworkDiscovery.get_local_ip(),
            'all_local_ips': NetworkDiscovery.get_all_local_ips(),
            'external_ip': NetworkDiscovery.get_external_ip(),
            'interfaces': netifaces.interfaces(),
            'default_gateway': NetworkDiscovery.get_default_gateway()
        }
    
    @staticmethod
    def get_default_gateway() -> Optional[str]:
        """Get default gateway IP"""
        try:
            gateways = netifaces.gateways()
            default_gateway = gateways['default'][netifaces.AF_INET][0]
            return default_gateway
        except Exception:
            return None

class PeerDiscovery:
    """Discover other instances on the local network"""
    
    def __init__(self, port: int = 9999):
        self.port = port
        self.discovery_port = port + 100  # Different port for discovery
        self.peers = {}  # peer_id -> {ip, port, last_seen, info}
        self.running = False
        self.discovery_thread = None
    
    def start_discovery(self):
        """Start peer discovery process"""
        if self.running:
            return
        
        self.running = True
        self.discovery_thread = threading.Thread(target=self._discovery_loop, daemon=True)
        self.discovery_thread.start()
    
    def stop_discovery(self):
        """Stop peer discovery process"""
        self.running = False
        if self.discovery_thread:
            self.discovery_thread.join(timeout=1)
    
    def _discovery_loop(self):
        """Main discovery loop"""
        try:
            # Create UDP socket for discovery
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(1.0)
            
            try:
                sock.bind(('', self.discovery_port))
            except OSError:
                # Port might be in use, try to listen anyway
                pass
            
            while self.running:
                # Send discovery broadcast
                self._send_discovery_broadcast(sock)
                
                # Listen for responses
                self._listen_for_peers(sock)
                
                # Clean up old peers
                self._cleanup_old_peers()
                
                time.sleep(30)  # Discovery cycle every 30 seconds
        
        except Exception as e:
            print(f"Discovery loop error: {e}")
        finally:
            sock.close()
    
    def _send_discovery_broadcast(self, sock: socket.socket):
        """Send discovery broadcast message"""
        try:
            discovery_message = {
                'type': 'discovery',
                'port': self.port,
                'timestamp': time.time(),
                'version': '1.0'
            }
            
            message = json.dumps(discovery_message).encode('utf-8')
            
            # Broadcast to local network
            local_ips = NetworkDiscovery.get_all_local_ips()
            for local_ip in local_ips:
                try:
                    # Calculate broadcast address
                    ip_parts = local_ip.split('.')
                    if ip_parts[0] == '192' and ip_parts[1] == '168':
                        broadcast = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.255"
                    elif ip_parts[0] == '10':
                        broadcast = "10.255.255.255"
                    else:
                        continue
                    
                    sock.sendto(message, (broadcast, self.discovery_port))
                except Exception:
                    continue
                    
        except Exception as e:
            print(f"Error sending discovery broadcast: {e}")
    
    def _listen_for_peers(self, sock: socket.socket):
        """Listen for peer discovery messages"""
        try:
            data, addr = sock.recvfrom(1024)
            message = json.loads(data.decode('utf-8'))
            
            if message.get('type') == 'discovery':
                peer_ip = addr[0]
                peer_port = message.get('port', self.port)
                peer_id = f"{peer_ip}:{peer_port}"
                
                # Don't add ourselves
                local_ips = NetworkDiscovery.get_all_local_ips()
                if peer_ip not in local_ips:
                    self.peers[peer_id] = {
                        'ip': peer_ip,
                        'port': peer_port,
                        'last_seen': time.time(),
                        'version': message.get('version', 'unknown')
                    }
                    print(f"Discovered peer: {peer_id}")
                    
        except socket.timeout:
            # Normal timeout, continue
            pass
        except Exception as e:
            print(f"Error listening for peers: {e}")
    
    def _cleanup_old_peers(self):
        """Remove peers that haven't been seen recently"""
        current_time = time.time()
        timeout = 300  # 5 minutes
        
        dead_peers = []
        for peer_id, peer_info in self.peers.items():
            if current_time - peer_info['last_seen'] > timeout:
                dead_peers.append(peer_id)
        
        for peer_id in dead_peers:
            del self.peers[peer_id]
            print(f"Removed inactive peer: {peer_id}")
    
    def get_active_peers(self) -> List[Dict[str, any]]:
        """Get list of currently active peers"""
        return list(self.peers.values())

class ConnectionTester:
    """Test network connectivity and performance"""
    
    @staticmethod
    def test_internet_connectivity() -> bool:
        """Test if internet connection is available"""
        test_hosts = [
            "8.8.8.8",  # Google DNS
            "1.1.1.1",  # Cloudflare DNS
            "208.67.222.222"  # OpenDNS
        ]
        
        for host in test_hosts:
            if NetworkDiscovery.is_port_open(host, 53, timeout=3):
                return True
        
        return False
    
    @staticmethod
    def test_peer_connectivity(ip: str, port: int) -> Dict[str, any]:
        """Test connectivity to a specific peer"""
        start_time = time.time()
        
        result = {
            'reachable': False,
            'response_time': None,
            'error': None
        }
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            
            connect_result = sock.connect_ex((ip, port))
            response_time = (time.time() - start_time) * 1000  # milliseconds
            
            if connect_result == 0:
                result['reachable'] = True
                result['response_time'] = response_time
            else:
                result['error'] = f"Connection failed: {connect_result}"
            
            sock.close()
            
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    @staticmethod
    def test_bandwidth(peer_ip: str, peer_port: int, test_size: int = 1024) -> Optional[float]:
        """Test bandwidth to a peer (returns KB/s)"""
        try:
            test_data = b'0' * test_size
            
            start_time = time.time()
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            sock.connect((peer_ip, peer_port))
            
            sock.sendall(test_data)
            response = sock.recv(len(test_data))
            
            end_time = time.time()
            sock.close()
            
            if len(response) == len(test_data):
                duration = end_time - start_time
                bandwidth = (test_size * 2) / duration / 1024  # KB/s (send + receive)
                return bandwidth
            
        except Exception:
            pass
        
        return None

class HTTPUtils:
    """HTTP utilities for web requests"""
    
    @staticmethod
    def make_request(url: str, method: str = 'GET', data: Dict = None, 
                    headers: Dict = None, timeout: int = 10) -> Optional[Dict]:
        """Make HTTP request and return response"""
        try:
            if headers is None:
                headers = {}
            
            if method == 'POST' and data:
                data = urllib.parse.urlencode(data).encode('utf-8')
                headers['Content-Type'] = 'application/x-www-form-urlencoded'
            
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read().decode('utf-8')
                
                return {
                    'status_code': response.status,
                    'headers': dict(response.headers),
                    'content': content
                }
        
        except urllib.error.HTTPError as e:
            return {
                'status_code': e.code,
                'error': str(e),
                'content': e.read().decode('utf-8') if e.fp else None
            }
        except Exception as e:
            return {
                'status_code': 0,
                'error': str(e),
                'content': None
            }
    
    @staticmethod
    def download_file(url: str, local_path: str, chunk_size: int = 8192) -> bool:
        """Download file from URL to local path"""
        try:
            with urllib.request.urlopen(url) as response:
                with open(local_path, 'wb') as f:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
            return True
        except Exception as e:
            print(f"Download failed: {e}")
            return False
    
    @staticmethod
    def check_url_reachable(url: str, timeout: int = 5) -> bool:
        """Check if URL is reachable"""
        try:
            urllib.request.urlopen(url, timeout=timeout)
            return True
        except Exception:
            return False

# Utility functions
def get_network_status() -> Dict[str, any]:
    """Get comprehensive network status"""
    return {
        'network_info': NetworkDiscovery.get_network_info(),
        'internet_connected': ConnectionTester.test_internet_connectivity(),
        'timestamp': time.time()
    }

def scan_local_network_for_peers(port: int = 9999) -> List[str]:
    """Scan local network for other instances"""
    peers = []
    local_ips = NetworkDiscovery.get_all_local_ips()
    
    for local_ip in local_ips:
        # Get network range
        ip_parts = local_ip.split('.')
        base_ip = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}"
        
        # Scan common IP ranges (this is a simple approach)
        for i in range(1, 255):
            test_ip = f"{base_ip}.{i}"
            if test_ip != local_ip and NetworkDiscovery.is_port_open(test_ip, port, timeout=1):
                peers.append(test_ip)
    
    return peers

if __name__ == "__main__":
    # Test network utilities
    print("Testing network utilities...")
    
    # Test network discovery
    local_ip = NetworkDiscovery.get_local_ip()
    print(f"✓ Local IP: {local_ip}")
    
    all_ips = NetworkDiscovery.get_all_local_ips()
    print(f"✓ All local IPs: {all_ips}")
    
    external_ip = NetworkDiscovery.get_external_ip()
    print(f"✓ External IP: {external_ip}")
    
    # Test connectivity
    internet_connected = ConnectionTester.test_internet_connectivity()
    print(f"✓ Internet connectivity: {internet_connected}")
    
    # Test peer discovery (brief test)
    discovery = PeerDiscovery(9999)
    print(f"✓ Peer discovery initialized")
    
    print("Network utilities tested successfully!")
