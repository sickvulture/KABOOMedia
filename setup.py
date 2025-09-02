#!/usr/bin/env python3
"""
Setup script for Decentralized Social Media Platform
This script helps users set up their first installation
"""

import sys
import os
import subprocess
from pathlib import Path
import json

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("ERROR: Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        return False
    return True

def install_dependencies():
    """Install required Python packages"""
    print("Installing dependencies...")
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        print("ERROR: requirements.txt not found")
        return False
    
    try:
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], check=True)
        print("Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR installing dependencies: {e}")
        return False

def create_directory_structure():
    """Create necessary directories"""
    directories = [
        "user_data",
        "user_data/database",
        "user_data/www",
        "user_data/templates",
        "user_data/media",
        "user_data/cache",
        "logs"
    ]
    
    for directory in directories:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {directory}")

def create_default_config():
    """Create default configuration file"""
    config = {
        "storage_path": "./user_data",
        "web_port": 8080,
        "p2p_port": 9999,
        "enable_upnp": True,
        "log_level": "INFO",
        "max_connections": 50,
        "enable_encryption": True
    }
    
    config_path = Path("config.json")
    if not config_path.exists():
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        print("Created default configuration: config.json")
    else:
        print("Configuration file already exists: config.json")

def test_imports():
    """Test that all required modules can be imported"""
    print("Testing imports...")
    
    required_modules = [
        "cryptography.fernet",
        "sqlite3",
        "qrcode",
        "PIL",
        "netifaces",
        "jinja2"
    ]
    
    failed_imports = []
    
    for module in required_modules:
        try:
            __import__(module)
            print(f"✓ {module}")
        except ImportError as e:
            print(f"✗ {module} - {e}")
            failed_imports.append(module)
    
    if failed_imports:
        print(f"\nFAILED IMPORTS: {failed_imports}")
        print("Please install missing dependencies")
        return False
    
    print("All imports successful!")
    return True

def setup_initial_user():
    """Set up the initial user"""
    print("\n" + "="*50)
    print("INITIAL USER SETUP")
    print("="*50)
    
    name = input("Enter your name: ").strip()
    if not name:
        print("Name is required!")
        return False
    
    bio = input("Enter a short bio (optional): ").strip()
    
    # Create a simple user config
    user_config = {
        "name": name,
        "bio": bio,
        "setup_completed": True,
        "created_at": str(Path().cwd())
    }
    
    user_config_path = Path("user_data/user_config.json")
    with open(user_config_path, 'w') as f:
        json.dump(user_config, f, indent=2)
    
    print(f"Initial user setup complete for: {name}")
    return True

def create_launch_script():
    """Create a convenient launch script"""
    launch_script_content = '''#!/usr/bin/env python3
"""
Launch script for Decentralized Social Media Platform
"""

import os
import sys
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    from main import main
    main()
'''
    
    script_path = Path("launch.py")
    with open(script_path, 'w') as f:
        f.write(launch_script_content)
    
    # Make executable on Unix-like systems
    if os.name != 'nt':
        os.chmod(script_path, 0o755)
    
    print("Created launch script: launch.py")

def main():
    """Main setup function"""
    print("Decentralized Social Media Platform Setup")
    print("="*50)
    
    # Check Python version
    if not check_python_version():
        return False
    
    # Install dependencies
    if not install_dependencies():
        return False
    
    # Test imports
    if not test_imports():
        return False
    
    # Create directories
    create_directory_structure()
    
    # Create config
    create_default_config()
    
    # Create launch script
    create_launch_script()
    
    # Setup initial user
    if input("\nWould you like to set up an initial user? (y/N): ").lower() == 'y':
        setup_initial_user()
    
    print("\n" + "="*50)
    print("SETUP COMPLETE!")
    print("="*50)
    print("To start your social media platform:")
    print("  python launch.py")
    print("\nOr:")
    print("  python main.py")
    print("\nYour site will be available at:")
    print("  http://localhost:8080")
    print("\nConfiguration file: config.json")
    print("User data directory: user_data/")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
