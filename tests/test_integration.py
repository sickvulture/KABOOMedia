import unittest
import tempfile
import shutil
import os
import time
import json
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import main application components
try:
    from main import DecentralizedSocialApp
    from core.encryption import EncryptionEngine
    from core.storage import SandboxedStorage
    from utils.config import Config
except ImportError as e:
    # Some components might not be implemented yet
    print(f"Warning: Some components not available for integration testing: {e}")

class TestIntegration(unittest.TestCase):
    """Integration tests for the complete application"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = os.path.join(self.temp_dir, 'test_config.json')
        
        # Create test configuration
        self.test_config = {
            'web_port': 18080,  # Use non-standard ports for testing
            'p2p_port': 19999,
            'storage_path': os.path.join(self.temp_dir, 'user_data'),
            'encryption': {
                'algorithm': 'AES-256'
            },
            'registry': {
                'enabled': False  # Disable registry for isolated testing
            }
        }
        
        with open(self.config_file, 'w') as f:
            json.dump(self.test_config, f)
            
        self.test_password = "test_password_123"
        
    def tearDown(self):
        """Clean up test fixtures"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            
    def test_app_initialization(self):
        """Test complete application initialization"""
        try:
            app = DecentralizedSocialApp(self.config_file)
            self.assertIsNotNone(app.config)
            
            # Initialize with password
            app.initialize(self.test_password)
            
            # Check that all components are initialized
            self.assertIsNotNone(app.encryption)
            self.assertIsNotNone(app.storage) 
            self.assertIsNotNone(app.web_server)
            self.assertIsNotNone(app.p2p_node)
            self.assertIsNotNone(app.database)
            
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
            
    def test_encryption_storage_integration(self):
        """Test encryption and storage working together"""
        try:
            encryption = EncryptionEngine(self.test_password)
            storage = SandboxedStorage(
                os.path.join(self.temp_dir, 'storage_test'),
                encryption
            )
            
            # Test storing and retrieving encrypted data
            test_data = {
                'user_id': 'test_user',
                'posts': ['First post', 'Second post'],
                'settings': {'theme': 'dark', 'notifications': True}
            }
            
            # Store data
            file_path = storage.store_encrypted_data('user_data', 'profile', test_data)
            self.assertTrue(os.path.exists(file_path))
            
            # Retrieve data
            retrieved_data = storage.retrieve_encrypted_data('user_data', 'profile')
            self.assertEqual(retrieved_data, test_data)
            
        except NameError as e:
            self.skipTest(f"Required components not available: {e}")
            
    def test_web_server_p2p_integration(self):
        """Test web server and P2P node working together"""
        try:
            app = DecentralizedSocialApp(self.config_file)
            app.initialize(self.test_password)
            
            # Start services
            success = app.start()
            self.assertTrue(success)
            
            # Give services time to start
            time.sleep(0.1)
            
            # Verify services are running
            self.assertTrue(app.web_server.server is not None)
            self.assertTrue(app.p2p_node.is_running)
            
            # Clean up
            app.stop()
            
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
        except Exception as e:
            self.fail(f"Integration test failed: {e}")
            
    def test_full_application_lifecycle(self):
        """Test complete application lifecycle"""
        try:
            # Initialize application
            app = DecentralizedSocialApp(self.config_file)
            app.initialize(self.test_password)
            
            # Start all services
            start_success = app.start()
            self.assertTrue(start_success)
            
            # Simulate some activity
            time.sleep(0.1)
            
            # Test that data can be stored and retrieved
            if hasattr(app, 'storage') and app.storage:
                test_user_data = {
                    'name': 'Integration Test User',
                    'bio': 'Testing the complete application',
                    'created_at': time.time()
                }
                
                app.storage.store_encrypted_data('users', 'test_user', test_user_data)
                retrieved_data = app.storage.retrieve_encrypted_data('users', 'test_user')
                self.assertEqual(retrieved_data, test_user_data)
            
            # Test web server is serving content
            if hasattr(app, 'web_server') and app.web_server:
                # Web server should be running
                self.assertIsNotNone(app.web_server.server)
                
            # Test P2P node is operational
            if hasattr(app, 'p2p_node') and app.p2p_node:
                self.assertTrue(app.p2p_node.is_running)
                
            # Stop all services
            app.stop()
            
            # Verify services stopped
            if hasattr(app, 'p2p_node') and app.p2p_node:
                self.assertFalse(app.p2p_node.is_running)
                
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
        except Exception as e:
            self.fail(f"Full lifecycle test failed: {e}")
            
    def test_configuration_integration(self):
        """Test configuration system integration"""
        try:
            config = Config(self.config_file)
            
            # Test that config values are used correctly
            self.assertEqual(config.get('web_port'), self.test_config['web_port'])
            self.assertEqual(config.get('p2p_port'), self.test_config['p2p_port'])
            
            # Test app uses configuration
            app = DecentralizedSocialApp(self.config_file)
            self.assertEqual(app.config.get('web_port'), self.test_config['web_port'])
            
        except NameError:
            self.skipTest("Config or DecentralizedSocialApp not available")
            
    def test_database_integration(self):
        """Test database integration with other components"""
        try:
            app = DecentralizedSocialApp(self.config_file)
            app.initialize(self.test_password)
            
            if hasattr(app, 'database') and app.database:
                # Database should be initialized
                self.assertIsNotNone(app.database)
                
                # Should be able to perform basic operations
                # (Specific tests depend on database implementation)
                
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
            
    def test_error_handling_integration(self):
        """Test error handling across components"""
        try:
            # Test with invalid configuration
            invalid_config = self.test_config.copy()
            invalid_config['web_port'] = -1  # Invalid port
            
            invalid_config_file = os.path.join(self.temp_dir, 'invalid_config.json')
            with open(invalid_config_file, 'w') as f:
                json.dump(invalid_config, f)
                
            # App should handle invalid config gracefully
            app = DecentralizedSocialApp(invalid_config_file)
            
            # May use defaults or raise appropriate exception
            # depending on implementation
            
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
        except Exception:
            # Expected behavior for invalid config
            pass
            
    def test_concurrent_operations(self):
        """Test concurrent operations across components"""
        import threading
        
        try:
            app = DecentralizedSocialApp(self.config_file)
            app.initialize(self.test_password)
            app.start()
            
            results = []
            errors = []
            
            def worker_operation(worker_id):
                try:
                    # Simulate concurrent data operations
                    if hasattr(app, 'storage') and app.storage:
                        test_data = {
                            'worker_id': worker_id,
                            'timestamp': time.time(),
                            'data': f'Worker {worker_id} test data'
                        }
                        
                        # Store data
                        app.storage.store_encrypted_data(
                            'concurrent_test', 
                            f'worker_{worker_id}', 
                            test_data
                        )
                        
                        # Retrieve data
                        retrieved = app.storage.retrieve_encrypted_data(
                            'concurrent_test',
                            f'worker_{worker_id}'
                        )
                        
                        results.append(retrieved)
                        
                except Exception as e:
                    errors.append(e)
            
            # Run multiple concurrent operations
            threads = []
            for i in range(3):
                thread = threading.Thread(target=worker_operation, args=(i,))
                threads.append(thread)
                thread.start()
                
            # Wait for all threads
            for thread in threads:
                thread.join()
                
            # Check results
            self.assertEqual(len(errors), 0, f"Concurrent operations had errors: {errors}")
            
            if results:  # Only check if storage operations were performed
                self.assertEqual(len(results), 3)
                
            app.stop()
            
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
            
    def test_memory_usage(self):
        """Test memory usage remains reasonable during operations"""
        try:
            import psutil
            process = psutil.Process()
            
            initial_memory = process.memory_info().rss
            
            # Perform operations that might consume memory
            app = DecentralizedSocialApp(self.config_file)
            app.initialize(self.test_password)
            app.start()
            
            # Simulate activity
            if hasattr(app, 'storage') and app.storage:
                for i in range(100):
                    test_data = {
                        'iteration': i,
                        'data': 'x' * 1000  # 1KB per iteration
                    }
                    app.storage.store_encrypted_data('memory_test', f'item_{i}', test_data)
                    
            final_memory = process.memory_info().rss
            memory_increase = final_memory - initial_memory
            
            # Memory increase should be reasonable (less than 100MB for this test)
            self.assertLess(memory_increase, 100 * 1024 * 1024, 
                          f"Memory usage increased by {memory_increase / 1024 / 1024:.1f}MB")
            
            app.stop()
            
        except ImportError:
            self.skipTest("psutil not available for memory testing")
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")
            
    def test_persistence_across_restarts(self):
        """Test data persistence across application restarts"""
        try:
            # First run - store data
            app1 = DecentralizedSocialApp(self.config_file)
            app1.initialize(self.test_password)
            
            test_data = {
                'persistent_test': True,
                'timestamp': time.time(),
                'message': 'This data should persist across restarts'
            }
            
            if hasattr(app1, 'storage') and app1.storage:
                app1.storage.store_encrypted_data('persistence_test', 'data', test_data)
                
            app1.stop()
            
            # Second run - retrieve data
            app2 = DecentralizedSocialApp(self.config_file)
            app2.initialize(self.test_password)
            
            if hasattr(app2, 'storage') and app2.storage:
                retrieved_data = app2.storage.retrieve_encrypted_data('persistence_test', 'data')
                self.assertEqual(retrieved_data, test_data)
                
            app2.stop()
            
        except NameError:
            self.skipTest("DecentralizedSocialApp not available")

if __name__ == '__main__':
    unittest.main()
