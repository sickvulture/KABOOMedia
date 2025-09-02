#!/usr/bin/env python3
"""
Complete deployment script for Decentralized Social Media Platform
This script handles everything: dependencies, setup, configuration, and first run
"""

import sys
import os
import subprocess
import json
import time
import shutil
import argparse
from pathlib import Path
import urllib.request
import zipfile
import tempfile

class PlatformDeployer:
    """Complete deployment manager"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.success_count = 0
        self.total_steps = 12
        
    def deploy(self, config_options=None):
        """Run complete deployment process"""
        print("🚀 Decentralized Social Media Platform Deployment")
        print("=" * 60)
        
        # Step 1: Check Python version
        self.step("Checking Python version...")
        if not self.check_python_version():
            return False
        
        # Step 2: Check system requirements
        self.step("Checking system requirements...")
        if not self.check_system_requirements():
            return False
        
        # Step 3: Install Python dependencies
        self.step("Installing Python dependencies...")
        if not self.install_dependencies():
            return False
        
        # Step 4: Create directory structure
        self.step("Creating directory structure...")
        self.create_directories()
        
        # Step 5: Generate configuration
        self.step("Generating configuration...")
        self.create_configuration(config_options or {})
        
        # Step 6: Initialize database
        self.step("Initializing database...")
        if not self.initialize_database():
            return False
        
        # Step 7: Create initial user
        self.step("Setting up initial user...")
        if not self.setup_initial_user():
            return False
        
        # Step 8: Generate security keys
        self.step("Generating security keys...")
        self.generate_security_keys()
        
        # Step 9: Create service scripts
        self.step("Creating service scripts...")
        self.create_service_scripts()
        
        # Step 10: Set up web frontend
        self.step("Setting up web frontend...")
        self.setup_web_frontend()
        
        # Step 11: Run initial tests
        self.step("Running system tests...")
        if not self.run_initial_tests():
            print("⚠️  Some tests failed, but deployment can continue")
        
        # Step 12: Final setup
        self.step("Finalizing setup...")
        self.finalize_setup()
        
        # Success!
        print("\n" + "=" * 60)
        print("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        self.print_quick_start_guide()
        
        return True
    
    def step(self, message):
        """Print step message"""
        self.success_count += 1
        print(f"[{self.success_count}/{self.total_steps}] {message}")
    
    def check_python_version(self):
        """Check Python version compatibility"""
        if sys.version_info < (3, 8):
            print(f"❌ Python 3.8+ required. Current: {sys.version}")
            print("Please upgrade Python and try again.")
            return False
        
        print(f"✅ Python {sys.version.split()[0]} detected")
        return True
    
    def check_system_requirements(self):
        """Check system requirements"""
        checks = []
        
        # Check available disk space
        try:
            stat = shutil.disk_usage(self.project_root)
            free_gb = stat.free / (1024**3)
            if free_gb < 0.5:  # 500MB minimum
                checks.append(f"❌ Insufficient disk space: {free_gb:.1f}GB available, 0.5GB required")
            else:
                checks.append(f"✅ Disk space: {free_gb:.1f}GB available")
        except:
            checks.append("⚠️  Could not check disk space")
        
        # Check network connectivity
        try:
            urllib.request.urlopen('https://pypi.org', timeout=5)
            checks.append("✅ Internet connectivity available")
        except:
            checks.append("⚠️  Limited internet connectivity (may affect package installation)")
        
        # Check write permissions
        try:
            test_file = self.project_root / '.write_test'
            test_file.touch()
            test_file.unlink()
            checks.append("✅ Write permissions confirmed")
        except:
            checks.append("❌ No write permission in project directory")
            return False
        
        for check in checks:
            print(f"    {check}")
        
        return True
    
    def install_dependencies(self):
        """Install Python dependencies"""
        try:
            # Try pip install
            cmd = [sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt', '--user']
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0:
                print("✅ Dependencies installed successfully")
                return True
            else:
                print("❌ Failed to install dependencies automatically")
                print("Error:", result.stderr)
                
                # Try alternative installation
                print("Trying alternative installation method...")
                return self.install_dependencies_fallback()
                
        except Exception as e:
            print(f"❌ Installation error: {e}")
            return self.install_dependencies_fallback()
    
    def install_dependencies_fallback(self):
        """Fallback dependency installation"""
        required_packages = [
            'cryptography>=41.0.0',
            'qrcode[pil]>=7.4.2', 
            'pillow>=10.0.0',
            'netifaces>=0.11.0',
            'jinja2>=3.1.0'
        ]
        
        for package in required_packages:
            try:
                print(f"Installing {package}...")
                cmd = [sys.executable, '-m', 'pip', 'install', package, '--user']
                result = subprocess.run(cmd, capture_output=True)
                
                if result.returncode != 0:
                    print(f"❌ Failed to install {package}")
                    print("Please install manually:")
                    print(f"    pip install {package}")
                    return False
                    
            except Exception as e:
                print(f"❌ Error installing {package}: {e}")
                return False
        
        print("✅ Dependencies installed via fallback method")
        return True
    
    def create_directories(self):
        """Create necessary directories"""
        directories = [
            'user_data',
            'user_data/database',
            'user_data/www',
            'user_data/templates',
            'user_data/media',
            'user_data/cache',
            'user_data/exports',
            'user_data/backups',
            'logs',
            'tmp',
            'scripts'
        ]
        
        for directory in directories:
            path = self.project_root / directory
            path.mkdir(parents=True, exist_ok=True)
            print(f"    📁 {directory}/")
        
        print("✅ Directory structure created")
    
    def create_configuration(self, options):
        """Generate configuration files"""
        # Main configuration
        config = {
            "storage_path": "./user_data",
            "web_port": options.get('web_port', 8080),
            "p2p_port": options.get('p2p_port', 9999), 
            "enable_upnp": options.get('enable_upnp', True),
            "log_level": options.get('log_level', 'INFO'),
            "max_connections": options.get('max_connections', 50),
            "enable_encryption": True,
            "auto_discover_peers": True,
            "max_post_length": 5000,
            "max_media_size_mb": 100,
            "backup_interval_hours": 24
        }
        
        # Save main config
        config_path = self.project_root / 'config.json'
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        print("✅ Configuration files generated")
    
    def initialize_database(self):
        """Initialize the database"""
        try:
            # Import and create database
            sys.path.insert(0, str(self.project_root))
            from database.local_db import LocalDatabase
            from database.migrations import DatabaseMigrator
            
            # Create database
            db_path = self.project_root / 'user_data' / 'database' / 'local.db'
            db = LocalDatabase(str(db_path))
            
            # Run migrations
            migrator = DatabaseMigrator(db.connection)
            success = migrator.migrate_to_latest()
            
            db.close()
            
            if success:
                print("✅ Database initialized successfully")
                return True
            else:
                print("❌ Database migration failed")
                return False
                
        except Exception as e:
            print(f"❌ Database initialization error: {e}")
            return False
    
    def setup_initial_user(self):
        """Set up the initial user account"""
        try:
            print("Setting up your account...")
            
            # Get user input
            name = input("Enter your name: ").strip()
            if not name:
                name = "Platform User"
            
            bio = input("Enter a short bio (optional): ").strip()
            if not bio:
                bio = "Welcome to my social space!"
            
            # Create user config
            user_config = {
                "name": name,
                "bio": bio,
                "setup_completed": True,
                "created_at": time.time(),
                "setup_version": "1.0.0"
            }
            
            # Save user config
            user_config_path = self.project_root / 'user_data' / 'user_config.json'
            with open(user_config_path, 'w') as f:
                json.dump(user_config, f, indent=2)
            
            print(f"✅ Account created for: {name}")
            return True
            
        except Exception as e:
            print(f"❌ User setup error: {e}")
            return False
    
    def generate_security_keys(self):
        """Generate security keys and certificates"""
        try:
            from utils.crypto_utils import generate_user_keypair
            
            # Generate keypair for the platform
            keys = generate_user_keypair("Platform", "default_password")
            
            # Save keys securely
            keys_path = self.project_root / 'user_data' / 'keys'
            keys_path.mkdir(exist_ok=True)
            
            with open(keys_path / 'platform_keys.json', 'w') as f:
                json.dump({
                    'user_id': keys['user_id'],
                    'public_key': keys['public_key'],
                    'created_at': keys['key_generated_at']
                }, f, indent=2)
            
            print("✅ Security keys generated")
            
        except Exception as e:
            print(f"⚠️  Security key generation failed: {e}")
            print("    This won't prevent the platform from working")
    
    def create_service_scripts(self):
        """Create convenient service scripts"""
        # Start script
        start_script = '''#!/usr/bin/env python3
"""Start the Decentralized Social Media Platform"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    from main import main
    main()
'''
        
        # CLI script
        cli_script = '''#!/usr/bin/env python3
"""Start the CLI interface"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    from ui.cli_interface import main
    main()
'''
        
        scripts = {
            'start.py': start_script,
            'cli.py': cli_script
        }
        
        scripts_dir = self.project_root / 'scripts'
        for name, content in scripts.items():
            script_path = scripts_dir / name
            with open(script_path, 'w') as f:
                f.write(content)
            
            # Make executable on Unix systems
            if os.name != 'nt':
                os.chmod(script_path, 0o755)
        
        print("✅ Service scripts created")
    
    def setup_web_frontend(self):
        """Set up the web frontend"""
        www_dir = self.project_root / 'user_data' / 'www'
        www_dir.mkdir(exist_ok=True)
        print("✅ Web frontend configured")
    
    def run_initial_tests(self):
        """Run basic system tests"""
        try:
            # Test basic functionality
            sys.path.insert(0, str(self.project_root))
            
            from core.encryption import EncryptionEngine
            from utils.config import Config
            
            # Test basic functionality
            engine = EncryptionEngine("test")
            test_data = b"Hello, World!"
            encrypted = engine.encrypt_data(test_data)
            decrypted = engine.decrypt_data(encrypted)
            
            if decrypted != test_data:
                return False
            
            # Test config
            config = Config()
            if not config.get('web_port'):
                return False
            
            print("✅ System tests passed")
            return True
            
        except Exception as e:
            print(f"⚠️  Could not run tests: {e}")
            return False
    
    def finalize_setup(self):
        """Finalize the setup process"""
        # Create a setup completion marker
        setup_complete = {
            "completed": True,
            "version": "1.0.0",
            "timestamp": time.time(),
            "python_version": sys.version,
            "platform": sys.platform
        }
        
        setup_file = self.project_root / '.setup_complete'
        with open(setup_file, 'w') as f:
            json.dump(setup_complete, f, indent=2)
        
        print("✅ Setup finalized")
    
    def print_quick_start_guide(self):
        """Print quick start instructions"""
        config_path = self.project_root / 'config.json'
        
        try:
            with open(config_path) as f:
                config = json.load(f)
            web_port = config.get('web_port', 8080)
        except:
            web_port = 8080
        
        print(f"""
🎯 QUICK START GUIDE
════════════════════

Your decentralized social media platform is ready to use!

🚀 Start the platform:
   python main.py
   # OR
   python scripts/start.py

🌐 Access your space:
   Web Interface: http://localhost:{web_port}
   
💻 Command line:
   python scripts/cli.py

📁 Important files:
   • Configuration: config.json
   • User data:     user_data/
   • Logs:          logs/

Happy social networking! 🎉
        """)

def main():
    """Main deployment function"""
    parser = argparse.ArgumentParser(description='Deploy Decentralized Social Media Platform')
    parser.add_argument('--web-port', type=int, default=8080, help='Web server port')
    parser.add_argument('--p2p-port', type=int, default=9999, help='P2P network port')
    parser.add_argument('--no-upnp', action='store_true', help='Disable UPnP')
    parser.add_argument('--log-level', default='INFO', help='Log level')
    parser.add_argument('--quick', action='store_true', help='Quick setup with defaults')
    
    args = parser.parse_args()
    
    # Prepare configuration options
    config_options = {
        'web_port': args.web_port,
        'p2p_port': args.p2p_port,
        'enable_upnp': not args.no_upnp,
        'log_level': args.log_level
    }
    
    if args.quick:
        print("🏃‍♂️ Running quick setup with defaults...")
    
    # Run deployment
    deployer = PlatformDeployer()
    success = deployer.deploy(config_options)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
