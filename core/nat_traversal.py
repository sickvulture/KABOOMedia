import socket
import struct
from typing import Optional, Tuple

class NATTraversal:
    def __init__(self):
        self.upnp_enabled = False
        
    def setup_port_forwarding(self, port: int) -> bool:
        """Attempt to set up UPnP port forwarding"""
        try:
            import upnpclient
            devices = upnpclient.discover()
            if devices:
                device = devices[0]
                device.WANIPConn1.AddPortMapping(
                    NewRemoteHost='',
                    NewExternalPort=port,
                    NewProtocol='TCP',
                    NewInternalPort=port,
                    NewInternalClient=self._get_local_ip(),
                    NewEnabled='1',
                    NewPortMappingDescription='DecentralizedSocial',
                    NewLeaseDuration=0
                )
                self.upnp_enabled = True
                return True
        except Exception as e:
            print(f"UPnP port forwarding failed: {e}")
            
        return False
    
    def _get_local_ip(self) -> str:
        """Get local IP address"""
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
