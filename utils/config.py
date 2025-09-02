#!/usr/bin/env python3
"""
Configuration management for Decentralized Social Media Platform
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

class Config:
    """Configuration manager with JSON file support"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(config_path) if config_path else Path("config.json")
        self.config_data = {}
        self.defaults = {
            "storage_path": "./user_data",
            "web_port": 8080,
            "p2p_port": 9999,
            "enable_upnp": True,
            "log_level": "INFO",
            "max_connections": 50,
            "enable_encryption": True,
            "auto_discover_peers": True,
            "max_post_length": 5000,
            "max_media_size_mb": 100,
            "backup_interval_hours": 24,
            "cleanup_old_data_days": 365
        }
        
        self._load_config()
    
    def _load_config(self):
        """Load configuration from file or create default"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.config_data = json.load(f)
                print(f"Configuration loaded from: {self.config_path}")
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load config from {self.config_path}: {e}")
                print("Using default configuration")
                self.config_data = {}
        else:
            print("No configuration file found, using defaults")
            self.config_data = {}
            self._save_default_config()
    
    def _save_default_config(self):
        """Save default configuration to file"""
        try:
            # Create directory if it doesn't exist
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save defaults to file
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.defaults, f, indent=2, sort_keys=True)
            print(f"Default configuration saved to: {self.config_path}")
        except IOError as e:
            print(f"Warning: Could not save default config: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value with fallback to defaults"""
        # Try user config first, then defaults, then provided default
        return self.config_data.get(key, self.defaults.get(key, default))
    
    def set(self, key: str, value: Any) -> None:
        """Set configuration value"""
        self.config_data[key] = value
    
    def save(self) -> bool:
        """Save current configuration to file"""
        try:
            # Merge with defaults for complete config file
            complete_config = self.defaults.copy()
            complete_config.update(self.config_data)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(complete_config, f, indent=2, sort_keys=True)
            return True
        except IOError as e:
            print(f"Error saving configuration: {e}")
            return False
    
    def update(self, updates: Dict[str, Any]) -> None:
        """Update multiple configuration values"""
        self.config_data.update(updates)
    
    def get_all(self) -> Dict[str, Any]:
        """Get all configuration values (merged with defaults)"""
        complete_config = self.defaults.copy()
        complete_config.update(self.config_data)
        return complete_config
    
    def reset_to_defaults(self) -> None:
        """Reset configuration to defaults"""
        self.config_data = {}
        self._save_default_config()
    
    def validate(self) -> bool:
        """Validate configuration values"""
        issues = []
        
        # Check port numbers
        web_port = self.get('web_port')
        p2p_port = self.get('p2p_port')
        
        if not (1024 <= web_port <= 65535):
            issues.append(f"Invalid web_port: {web_port} (must be 1024-65535)")
        
        if not (1024 <= p2p_port <= 65535):
            issues.append(f"Invalid p2p_port: {p2p_port} (must be 1024-65535)")
        
        if web_port == p2p_port:
            issues.append("web_port and p2p_port cannot be the same")
        
        # Check paths
        storage_path = Path(self.get('storage_path'))
        try:
            storage_path.mkdir(parents=True, exist_ok=True)
        except OSError:
            issues.append(f"Cannot create storage_path: {storage_path}")
        
        # Check numeric values
        max_connections = self.get('max_connections')
        if not isinstance(max_connections, int) or max_connections < 1:
            issues.append(f"max_connections must be positive integer: {max_connections}")
        
        max_media_size = self.get('max_media_size_mb')
        if not isinstance(max_media_size, (int, float)) or max_media_size <= 0:
            issues.append(f"max_media_size_mb must be positive number: {max_media_size}")
        
        if issues:
            print("Configuration validation issues:")
            for issue in issues:
                print(f"  - {issue}")
            return False
        
        print("Configuration validation passed")
        return True
    
    def get_storage_path(self, subpath: str = "") -> Path:
        """Get full path within storage directory"""
        storage_path = Path(self.get('storage_path'))
        if subpath:
            return storage_path / subpath
        return storage_path
    
    def print_config(self):
        """Print current configuration"""
        print("Current Configuration:")
        print("-" * 30)
        config = self.get_all()
        for key, value in sorted(config.items()):
            print(f"{key:25} = {value}")
        print("-" * 30)

# Utility functions for common configuration tasks
def create_default_config(config_path: str = "config.json") -> Config:
    """Create a new configuration file with defaults"""
    config = Config(config_path)
    config.save()
    return config

def load_config(config_path: str = "config.json") -> Config:
    """Load configuration from file"""
    return Config(config_path)

def validate_config(config_path: str = "config.json") -> bool:
    """Validate configuration file"""
    config = Config(config_path)
    return config.validate()

# Command-line interface for configuration management
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Configuration Management')
    parser.add_argument('--config', default='config.json', help='Configuration file path')
    parser.add_argument('--validate', action='store_true', help='Validate configuration')
    parser.add_argument('--create-default', action='store_true', help='Create default configuration')
    parser.add_argument('--print', action='store_true', help='Print current configuration')
    parser.add_argument('--set', nargs=2, metavar=('KEY', 'VALUE'), help='Set configuration value')
    parser.add_argument('--get', metavar='KEY', help='Get configuration value')
    
    args = parser.parse_args()
    
    config = Config(args.config)
    
    if args.create_default:
        config.reset_to_defaults()
        print("Default configuration created")
    
    if args.validate:
        config.validate()
    
    if args.print:
        config.print_config()
    
    if args.set:
        key, value = args.set
        # Try to parse as JSON for complex types
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            # Keep as string if not valid JSON
            pass
        
        config.set(key, value)
        config.save()
        print(f"Set {key} = {value}")
    
    if args.get:
        value = config.get(args.get)
        print(f"{args.get} = {value}")
