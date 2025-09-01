import socket
import netifaces
import hashlib
import time
from typing import List, Dict, Optional

class DynamicAddressManager:
    def __init__(self, base_port: int = 8080):
        self.base_port = base_port
        self.current_addresses = []
        self.address_history = []
    
    def get_local_addresses(self) -> List[Dict[str, str]]:
        """Get all local IP addresses"""
        addresses = []
        
        # Get all network interfaces
        for interface in netifaces.interfaces():
            try:
                interface_info = netifaces.ifaddresses(interface)
                if netifaces.AF_INET in interface_info:
                    for link in interface_info[netifaces.AF_INET]:
                        ip = link['addr']
                        if ip != '127.0.0.1':  # Skip localhost
                            addresses.append({
                                'interface': interface,
                                'ip': ip,
                                'port': self.base_port,
                                'url': f"http://{ip}:{self.base_port}",
                                'timestamp': time.time()
                            })
            except Exception as e:
                print(f"Error getting addresses for interface {interface}: {e}")
        
        return addresses
    
    def get_external_address(self) -> Optional[Dict[str, str]]:
        """Get external IP address (requires internet connection)"""
        try:
            # Simple method to get external IP
            import urllib.request
            external_ip = urllib.request.urlopen('https://api.ipify.org').read().decode('utf8')
            return {
                'type': 'external',
                'ip': external_ip,
                'port': self.base_port,
                'url': f"http://{external_ip}:{self.base_port}",
                'timestamp': time.time()
            }
        except Exception as e:
            print(f"Could not determine external IP: {e}")
            return None
    
    def generate_address_id(self, address: str) -> str:
        """Generate a unique ID for an address"""
        return hashlib.sha256(address.encode()).hexdigest()[:16]
    
    def update_current_addresses(self) -> List[Dict[str, str]]:
        """Update and return current addresses"""
        local_addresses = self.get_local_addresses()
        external_address = self.get_external_address()
        
        all_addresses = local_addresses.copy()
        if external_address:
            all_addresses.append(external_address)
        
        # Add address IDs
        for addr in all_addresses:
            addr['id'] = self.generate_address_id(addr['url'])
        
        # Update history
        for addr in all_addresses:
            if addr not in self.address_history:
                self.address_history.append(addr)
        
        self.current_addresses = all_addresses
        return all_addresses
    
    def get_shareable_addresses(self) -> List[Dict[str, str]]:
        """Get addresses that can be shared with others"""
        return [addr for addr in self.current_addresses 
                if not addr['ip'].startswith('127.')]
