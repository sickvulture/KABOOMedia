import unittest
import tempfile
import json
import os
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.config import Config

class TestConfig(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_config_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        
        self.test_config = {
            'web_port': 8080,
            'p2p_port': 9999,
            'storage_path': './user_data',
            'encryption': {
                'algorithm': 'AES-256',
                'key_derivation': 'PBKDF2'
            },
            'registry': {
                'urls': ['https://registry1.example.com', 'https://registry2.example.com'],
                'enabled': True
            },
            'ui': {
                'theme': 'dark',
                'language': 'en'
            }
        }
        
        json.dump(self.test_config, self.temp_config_file)
        self.temp_config_file.close()
        
    def tearDown(self):
        """Clean up test fixtures"""
        if os.path.exists(self.temp_config_file.name):
            os.unlink(self.temp_config_file.name)
            
    def test_config_initialization_with_file(self):
        """Test config initialization with config file"""
        config = Config(self.temp_config_file.name)
        
        self.assertEqual(config.get('web_port'), self.test_config['web_port'])
        self.assertEqual(config.get('p2p_port'), self.test_config['p2p_port'])
        self.assertEqual(config.get('storage_path'), self.test_config['storage_path'])
        
    def test_config_initialization_without_file(self):
        """Test config initialization without config file (defaults)"""
        config = Config()
        
        # Should have some default values
        self.assertIsNotNone(config.get('web_port'))
        self.assertIsNotNone(config.get('p2p_port'))
        self.assertIsInstance(config.get('web_port'), int)
        self.assertIsInstance(config.get('p2p_port'), int)
        
    def test_config_get_with_default(self):
        """Test getting config values with defaults"""
        config = Config(self.temp_config_file.name)
        
        # Existing value
        self.assertEqual(config.get('web_port', 3000), 8080)
        
        # Non-existing value with default
        self.assertEqual(config.get('nonexistent_key', 'default_value'), 'default_value')
        
        # Non-existing value without default
        self.assertIsNone(config.get('another_nonexistent_key'))
        
    def test_config_nested_values(self):
        """Test getting nested config values"""
        config = Config(self.temp_config_file.name)
        
        # Test nested access
        encryption_config = config.get('encryption')
        self.assertIsInstance(encryption_config, dict)
        self.assertEqual(encryption_config['algorithm'], 'AES-256')
        
        registry_urls = config.get('registry', {}).get('urls', [])
        self.assertIsInstance(registry_urls, list)
        self.assertEqual(len(registry_urls), 2)
        
    def test_config_set_values(self):
        """Test setting config values"""
        config = Config(self.temp_config_file.name)
        
        # Set new value
        config.set('new_key', 'new_value')
        self.assertEqual(config.get('new_key'), 'new_value')
        
        # Update existing value
        config.set('web_port', 9000)
        self.assertEqual(config.get('web_port'), 9000)
        
    def test_config_set_nested_values(self):
        """Test setting nested config values"""
        config = Config(self.temp_config_file.name)
        
        # Set nested value
        config.set_nested('encryption.key_size', 256)
        encryption_config = config.get('encryption', {})
        self.assertEqual(encryption_config.get('key_size'), 256)
        
        # Set deeply nested value
        config.set_nested('ui.advanced.debug', True)
        ui_config = config.get('ui', {})
        self.assertTrue(ui_config.get('advanced', {}).get('debug'))
        
    def test_config_save(self):
        """Test saving config to file"""
        config = Config(self.temp_config_file.name)
        
        # Modify config
        config.set('web_port', 9000)
        config.set('new_setting', 'test_value')
        
        # Save to file
        config.save()
        
        # Load new config instance and verify changes
        new_config = Config(self.temp_config_file.name)
        self.assertEqual(new_config.get('web_port'), 9000)
        self.assertEqual(new_config.get('new_setting'), 'test_value')
        
    def test_config_save_to_different_file(self):
        """Test saving config to different file"""
        config = Config(self.temp_config_file.name)
        
        new_temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        new_temp_file.close()
        
        try:
            config.set('test_key', 'test_value')
            config.save(new_temp_file.name)
            
            # Verify new file contains the config
            new_config = Config(new_temp_file.name)
            self.assertEqual(new_config.get('test_key'), 'test_value')
            self.assertEqual(new_config.get('web_port'), self.test_config['web_port'])
            
        finally:
            if os.path.exists(new_temp_file.name):
                os.unlink(new_temp_file.name)
                
    def test_config_invalid_json_file(self):
        """Test config with invalid JSON file"""
        invalid_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        invalid_file.write("{ invalid json content")
        invalid_file.close()
        
        try:
            # Should handle invalid JSON gracefully
            config = Config(invalid_file.name)
            # Should use defaults instead of crashing
            self.assertIsNotNone(config.get('web_port'))
            
        finally:
            if os.path.exists(invalid_file.name):
                os.unlink(invalid_file.name)
                
    def test_config_nonexistent_file(self):
        """Test config with nonexistent file"""
        config = Config('/path/that/does/not/exist.json')
        
        # Should use defaults
        self.assertIsNotNone(config.get('web_port'))
        self.assertIsNotNone(config.get('p2p_port'))
        
    def test_config_environment_variable_override(self):
        """Test config values can be overridden by environment variables"""
        config = Config(self.temp_config_file.name)
        
        # Test environment variable override
        os.environ['DSOCIAL_WEB_PORT'] = '9090'
        os.environ['DSOCIAL_STORAGE_PATH'] = '/custom/path'
        
        try:
            # Reload config to pick up environment variables
            config.reload()
            
            # Should use environment variables if supported
            if hasattr(config, '_load_env_overrides'):
                self.assertEqual(config.get('web_port'), 9090)
                self.assertEqual(config.get('storage_path'), '/custom/path')
                
        finally:
            # Clean up environment variables
            if 'DSOCIAL_WEB_PORT' in os.environ:
                del os.environ['DSOCIAL_WEB_PORT']
            if 'DSOCIAL_STORAGE_PATH' in os.environ:
                del os.environ['DSOCIAL_STORAGE_PATH']
                
    def test_config_validation(self):
        """Test config value validation"""
        config = Config(self.temp_config_file.name)
        
        # Test port validation
        if hasattr(config, 'validate'):
            # Invalid port (too high)
            with self.assertRaises(ValueError):
                config.set('web_port', 99999)
                config.validate()
                
            # Invalid port (negative)
            with self.assertRaises(ValueError):
                config.set('p2p_port', -1)
                config.validate()
                
    def test_config_defaults(self):
        """Test default config values"""
        config = Config()
        
        # Test that defaults are reasonable
        web_port = config.get('web_port')
        p2p_port = config.get('p2p_port')
        
        self.assertIsInstance(web_port, int)
        self.assertIsInstance(p2p_port, int)
        self.assertTrue(1024 <= web_port <= 65535)
        self.assertTrue(1024 <= p2p_port <= 65535)
        self.assertNotEqual(web_port, p2p_port)  # Ports should be different
        
    def test_config_merge(self):
        """Test merging config with another config"""
        config = Config(self.temp_config_file.name)
        
        additional_config = {
            'web_port': 9090,  # Override existing
            'debug': True,     # New value
            'encryption': {
                'algorithm': 'AES-256',  # Same as existing
                'padding': 'PKCS7'       # New nested value
            }
        }
        
        if hasattr(config, 'merge'):
            config.merge(additional_config)
            
            self.assertEqual(config.get('web_port'), 9090)  # Overridden
            self.assertTrue(config.get('debug'))  # New value
            
            encryption = config.get('encryption', {})
            self.assertEqual(encryption.get('algorithm'), 'AES-256')  # Preserved
            self.assertEqual(encryption.get('padding'), 'PKCS7')  # New nested
            
    def test_config_to_dict(self):
        """Test converting config to dictionary"""
        config = Config(self.temp_config_file.name)
        
        config_dict = config.to_dict()
        
        self.assertIsInstance(config_dict, dict)
        self.assertEqual(config_dict['web_port'], self.test_config['web_port'])
        self.assertEqual(config_dict['encryption']['algorithm'], 
                        self.test_config['encryption']['algorithm'])
        
    def test_config_reset(self):
        """Test resetting config to defaults"""
        config = Config(self.temp_config_file.name)
        
        # Modify config
        original_port = config.get('web_port')
        config.set('web_port', 9999)
        self.assertEqual(config.get('web_port'), 9999)
        
        # Reset to defaults
        if hasattr(config, 'reset'):
            config.reset()
            
            # Should have default values, not original file values
            self.assertNotEqual(config.get('web_port'), 9999)
            
    def test_config_schema_validation(self):
        """Test config schema validation"""
        if hasattr(Config, 'SCHEMA'):
            # Test valid config passes validation
            config = Config(self.temp_config_file.name)
            self.assertTrue(config.is_valid())
            
            # Test invalid config fails validation
            config.set('web_port', 'not_a_number')
            self.assertFalse(config.is_valid())

if __name__ == '__main__':
    unittest.main()
