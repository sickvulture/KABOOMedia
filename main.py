#!/usr/bin/env python3
"""
Decentralized Social Media Platform
Licensed under GNU General Public License v3.0
"""

import sys
import os
import argparse
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from core.encryption import EncryptionEngine
from core.storage import SandboxedStorage
from core.web_server import LocalWebServer
from core.p2p_network import P2PNode
from site_generator.template_engine import SiteTemplateEngine
from site_generator.address_manager import DynamicAddressManager
from site_generator.qr_generator import QRCodeGenerator
from database.local_db import LocalDatabase
from ui.web_interface import WebInterface
from utils.config import Config

class DecentralizedSocialApp:
    def __init__(self, config_path: str = None):
        self.config = Config(config_path)
        self.encryption = None
        self.storage = None
        self.web_server = None
        self.p2p_node = None
        self.database = None
        self.template_engine = None
        self.address_manager = None
        self.qr_generator = None
        self.web_interface = None
        
    def initialize(self, user_password: str = None):
        """Initialize all components"""
        # Initialize encryption
        self.encryption = EncryptionEngine(user_password)
        
        # Initialize storage
        storage_path = self.config.get('storage_path', './user_data')
        self.storage = SandboxedStorage(storage_path, self.encryption)
        
        # Initialize database
        db_path = self.storage.get_sandbox_path('database') / 'local.db'
        self.database = LocalDatabase(str(db_path))
        
        # Initialize template engine
        template_path = self.storage.get_sandbox_path('templates')
        self.template_engine = SiteTemplateEngine(str(template_path))
        
        # Initialize address manager
        web_port = self.config.get('web_port', 8080)
        self.address_manager = DynamicAddressManager(web_port)
        
        # Initialize QR generator
        self.qr_generator = QRCodeGenerator()
        
        # Initialize web server
        www_path = self.storage.get_sandbox_path('www')
        self.web_server = LocalWebServer(web_port, str(www_path))
        
        # Initialize P2P node
        p2p_port = self.config.get('p2p_port', 9999)
        self.p2p_node = P2PNode(p2p_port)
        
        # Initialize web interface
        self.web_interface = WebInterface(
            self.database, self.template_engine, 
            self.address_manager, self.qr_generator
        )
        
        # Set up web server routes
        self._setup_web_routes()
        
        print("Decentralized Social Media Platform initialized successfully!")
    
    def _setup_web_routes(self):
        """Set up web server routes"""
        self.web_server.add_route_handler('/api/posts', self.web_interface.handle_posts)
        self.web_server.add_route_handler('/api/connections', self.web_interface.handle_connections)
        self.web_server.add_route_handler('/api/profile', self.web_interface.handle_profile)
        self.web_server.add_route_handler('/api/addresses', self.web_interface.handle_addresses)
    
    def start(self):
        """Start all services"""
        self.web_server.start_server()
        self.p2p_node.start_node()
        
        # Update addresses
        addresses = self.address_manager.update_current_addresses()
        print(f"Site available at: {[addr['url'] for addr in addresses]}")
        
        return True
    
    def stop(self):
        """Stop all services"""
        if self.web_server:
            self.web_server.stop_server()
        if self.p2p_node:
            self.p2p_node.stop_node()
        print("All services stopped")

def main():
    parser = argparse.ArgumentParser(description='Decentralized Social Media Platform')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--password', help='User password for encryption')
    parser.add_argument('--setup', action='store_true', help='Run initial setup')
    
    args = parser.parse_args()
    
    app = DecentralizedSocialApp(args.config)
    
    try:
        if args.setup:
            print("Running initial setup...")
            # TODO: Implement setup wizard
        
        app.initialize(args.password)
        app.start()
        
        print("Press Ctrl+C to stop the server...")
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nShutting down...")
        app.stop()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import time
    main()
