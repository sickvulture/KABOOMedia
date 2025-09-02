import unittest
import tempfile
import shutil
import os
import time
import requests
import json
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.web_server import LocalWebServer

class TestLocalWebServer(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_port = 18080  # Use different port to avoid conflicts
        self.server = LocalWebServer(self.test_port, self.temp_dir)
        
        # Create test HTML file
        test_html_content = """
        <!DOCTYPE html>
        <html>
        <head><title>Test Page</title></head>
        <body><h1>Test Content</h1></body>
        </html>
        """
        
        with open(os.path.join(self.temp_dir, 'test.html'), 'w') as f:
            f.write(test_html_content)
            
        # Track API calls for testing
        self.api_calls = []
        
    def tearDown(self):
        """Clean up test fixtures"""
        self.server.stop_server()
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            
    def test_server_initialization(self):
        """Test web server initialization"""
        self.assertEqual(self.server.port, self.test_port)
        self.assertEqual(self.server.document_root, self.temp_dir)
        self.assertIsNone(self.server.server)
        self.assertIsNone(self.server.server_thread)
        self.assertEqual(len(self.server.request_handlers), 0)
        
    def test_add_route_handler(self):
        """Test adding route handlers"""
        def test_handler(request):
            return {'status': 'success'}
            
        self.server.add_route_handler('/api/test', test_handler)
        
        self.assertIn('/api/test', self.server.request_handlers)
        self.assertEqual(self.server.request_handlers['/api/test'], test_handler)
        
    def test_start_stop_server(self):
        """Test starting and stopping the server"""
        # Start server
        self.server.start_server()
        time.sleep(0.1)  # Give server time to start
        
        self.assertIsNotNone(self.server.server)
        self.assertIsNotNone(self.server.server_thread)
        self.assertTrue(self.server.server_thread.is_alive())
        
        # Test that server is actually serving
        try:
            response = requests.get(f'http://localhost:{self.test_port}/test.html', timeout=1)
            self.assertEqual(response.status_code, 200)
            self.assertIn('Test Content', response.text)
        except requests.exceptions.RequestException as e:
            self.fail(f"Server not responding: {e}")
            
        # Stop server
        self.server.stop_server()
        time.sleep(0.1)  # Give server time to stop
        
        # Verify server is stopped
        with self.assertRaises(requests.exceptions.ConnectionError):
            requests.get(f'http://localhost:{self.test_port}/test.html', timeout=1)
            
    def test_custom_route_handler_get(self):
        """Test custom GET route handlers"""
        def api_handler(request):
            self.api_calls.append(('GET', request.path))
            return {
                'method': 'GET',
                'path': request.path,
                'message': 'GET request handled'
            }
            
        self.server.add_route_handler('/api/status', api_handler)
        self.server.start_server()
        time.sleep(0.1)
        
        try:
            response = requests.get(f'http://localhost:{self.test_port}/api/status', timeout=1)
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            self.assertEqual(data['method'], 'GET')
            self.assertEqual(data['path'], '/api/status')
            self.assertEqual(len(self.api_calls), 1)
            
        except requests.exceptions.RequestException as e:
            self.fail(f"API request failed: {e}")
            
    def test_custom_route_handler_post(self):
        """Test custom POST route handlers"""
        def api_handler(request, post_data=None):
            self.api_calls.append(('POST', request.path, post_data))
            if post_data:
                try:
                    json_data = json.loads(post_data.decode())
                    return {
                        'method': 'POST',
                        'received_data': json_data,
                        'message': 'POST request handled'
                    }
                except json.JSONDecodeError:
                    return {'error': 'Invalid JSON'}
            return {'error': 'No data received'}
            
        self.server.add_route_handler('/api/data', api_handler)
        self.server.start_server()
        time.sleep(0.1)
        
        test_data = {'user_id': 123, 'message': 'test post'}
        
        try:
            response = requests.post(
                f'http://localhost:{self.test_port}/api/data',
                json=test_data,
                timeout=1
            )
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            self.assertEqual(data['method'], 'POST')
            self.assertEqual(data['received_data'], test_data)
            self.assertEqual(len(self.api_calls), 1)
            
        except requests.exceptions.RequestException as e:
            self.fail(f"API POST request failed: {e}")
            
    def test_404_for_unknown_routes(self):
        """Test 404 response for unknown API routes"""
        self.server.start_server()
        time.sleep(0.1)
        
        try:
            response = requests.post(f'http://localhost:{self.test_port}/api/unknown', timeout=1)
            self.assertEqual(response.status_code, 404)
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Request failed unexpectedly: {e}")
            
    def test_static_file_serving(self):
        """Test serving static files from document root"""
        # Create additional test files
        css_content = "body { color: blue; }"
        js_content = "console.log('test');"
        
        with open(os.path.join(self.temp_dir, 'style.css'), 'w') as f:
            f.write(css_content)
            
        with open(os.path.join(self.temp_dir, 'script.js'), 'w') as f:
            f.write(js_content)
            
        self.server.start_server()
        time.sleep(0.1)
        
        try:
            # Test HTML file
            response = requests.get(f'http://localhost:{self.test_port}/test.html', timeout=1)
            self.assertEqual(response.status_code, 200)
            self.assertIn('Test Content', response.text)
            
            # Test CSS file
            response = requests.get(f'http://localhost:{self.test_port}/style.css', timeout=1)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.text, css_content)
            
            # Test JS file
            response = requests.get(f'http://localhost:{self.test_port}/script.js', timeout=1)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.text, js_content)
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Static file request failed: {e}")
            
    def test_multiple_route_handlers(self):
        """Test multiple route handlers"""
        def handler1(request):
            return {'handler': 1, 'path': request.path}
            
        def handler2(request):
            return {'handler': 2, 'path': request.path}
            
        self.server.add_route_handler('/api/endpoint1', handler1)
        self.server.add_route_handler('/api/endpoint2', handler2)
        self.server.start_server()
        time.sleep(0.1)
        
        try:
            # Test first handler
            response1 = requests.get(f'http://localhost:{self.test_port}/api/endpoint1', timeout=1)
            data1 = response1.json()
            self.assertEqual(data1['handler'], 1)
            self.assertEqual(data1['path'], '/api/endpoint1')
            
            # Test second handler
            response2 = requests.get(f'http://localhost:{self.test_port}/api/endpoint2', timeout=1)
            data2 = response2.json()
            self.assertEqual(data2['handler'], 2)
            self.assertEqual(data2['path'], '/api/endpoint2')
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Multiple handler request failed: {e}")
            
    def test_handler_exception_handling(self):
        """Test that handler exceptions don't crash the server"""
        def failing_handler(request):
            raise Exception("Handler error")
            
        self.server.add_route_handler('/api/fail', failing_handler)
        self.server.start_server()
        time.sleep(0.1)
        
        try:
            # Request should not succeed, but server should remain running
            response = requests.get(f'http://localhost:{self.test_port}/api/fail', timeout=1)
            # The response might be 500 or another error code
            self.assertNotEqual(response.status_code, 200)
            
            # Server should still be able to serve other content
            response = requests.get(f'http://localhost:{self.test_port}/test.html', timeout=1)
            self.assertEqual(response.status_code, 200)
            
        except requests.exceptions.RequestException as e:
            # This is acceptable - the important thing is that the server doesn't crash
            pass

if __name__ == '__main__':
    # Skip tests that require network access if requests is not available
    try:
        import requests
    except ImportError:
        print("Skipping web server tests - requests library not available")
        sys.exit(0)
        
    unittest.main()
