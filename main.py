#!/usr/bin/env python3
"""
Decentralized Social Media Platform
Licensed under GNU General Public License v3.0
"""

import sys
import os
import argparse
import time
import json
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

def check_dependencies():
    """Check if all required dependencies are available"""
    missing_deps = []
    
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        missing_deps.append("cryptography")
    
    try:
        import qrcode
    except ImportError:
        missing_deps.append("qrcode")
    
    try:
        import netifaces
    except ImportError:
        missing_deps.append("netifaces")
    
    try:
        from jinja2 import Environment
    except ImportError:
        missing_deps.append("jinja2")
    
    if missing_deps:
        print("ERROR: Missing required dependencies:")
        for dep in missing_deps:
            print(f"  - {dep}")
        print("\nPlease run: python setup.py")
        print("Or install manually: pip install -r requirements.txt")
        return False
    
    return True

# Only import our modules after dependency check
def load_components():
    """Load application components after dependency check"""
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
    
    return (EncryptionEngine, SandboxedStorage, LocalWebServer, P2PNode,
            SiteTemplateEngine, DynamicAddressManager, QRCodeGenerator,
            LocalDatabase, WebInterface, Config)

class DecentralizedSocialApp:
    def __init__(self, config_path: str = None):
        # Load components
        components = load_components()
        (self.EncryptionEngine, self.SandboxedStorage, self.LocalWebServer, 
         self.P2PNode, self.SiteTemplateEngine, self.DynamicAddressManager, 
         self.QRCodeGenerator, self.LocalDatabase, self.WebInterface, 
         self.Config) = components
        
        self.config = self.Config(config_path)
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
        print("Initializing Decentralized Social Media Platform...")
        
        # Initialize encryption
        self.encryption = self.EncryptionEngine(user_password)
        print("✓ Encryption engine initialized")
        
        # Initialize storage
        storage_path = self.config.get('storage_path', './user_data')
        self.storage = self.SandboxedStorage(storage_path, self.encryption)
        print("✓ Storage system initialized")
        
        # Initialize database
        db_path = self.storage.get_sandbox_path('database') / 'local.db'
        self.database = self.LocalDatabase(str(db_path))
        print("✓ Database initialized")
        
        # Initialize template engine
        template_path = self.storage.get_sandbox_path('templates')
        self.template_engine = self.SiteTemplateEngine(str(template_path))
        print("✓ Template engine initialized")
        
        # Initialize address manager
        web_port = self.config.get('web_port', 8080)
        self.address_manager = self.DynamicAddressManager(web_port)
        print("✓ Address manager initialized")
        
        # Initialize QR generator
        self.qr_generator = self.QRCodeGenerator()
        print("✓ QR code generator initialized")
        
        # Initialize web server
        www_path = self.storage.get_sandbox_path('www')
        self.web_server = self.LocalWebServer(web_port, str(www_path))
        print("✓ Web server initialized")
        
        # Initialize P2P node
        p2p_port = self.config.get('p2p_port', 9999)
        self.p2p_node = self.P2PNode(p2p_port)
        print("✓ P2P node initialized")
        
        # Initialize web interface
        self.web_interface = self.WebInterface(
            self.database, self.template_engine, 
            self.address_manager, self.qr_generator
        )
        print("✓ Web interface initialized")
        
        # Set up web server routes
        self._setup_web_routes()
        
        # Check if we need to create initial user
        self._check_initial_setup()
        
        print("✓ Platform initialized successfully!")
    
    def start(self):
        """Start all services"""
        print("Starting services...")
        
        # Start web server
        self.web_server.start_server()
        print(f"✓ Web server started on port {self.web_server.port}")
        
        # Start P2P node
        self.p2p_node.start_node()
        print(f"✓ P2P node started on port {self.p2p_node.port}")
        
        # Update and display addresses
        addresses = self.address_manager.update_current_addresses()
        print("\n" + "="*50)
        print("YOUR SOCIAL SPACE IS NOW LIVE!")
        print("="*50)
        for addr in addresses:
            if not addr['ip'].startswith('127.'):
                print(f"🌐 {addr['url']}")
        
        print(f"🏠 Local: http://localhost:{self.web_server.port}")
        print("="*50)
        
        return True
    
    def stop(self):
        """Stop all services"""
        print("\nShutting down services...")
        if self.web_server:
            self.web_server.stop_server()
            print("✓ Web server stopped")
        if self.p2p_node:
            self.p2p_node.stop_node()
            print("✓ P2P node stopped")
        if self.database:
            self.database.close()
            print("✓ Database closed")
        print("All services stopped")

def main():
    if not check_dependencies():
        return False
    
    app = DecentralizedSocialApp()
    
    try:
        app.initialize()
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
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
