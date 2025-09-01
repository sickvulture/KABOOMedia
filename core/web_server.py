import http.server
import socketserver
import threading
import os
from typing import Callable, Optional
import json

class LocalWebServer:
    def __init__(self, port: int = 8080, document_root: str = "./www"):
        self.port = port
        self.document_root = document_root
        self.server = None
        self.server_thread = None
        self.request_handlers = {}
    
    def add_route_handler(self, path: str, handler: Callable):
        """Add custom route handlers for dynamic content"""
        self.request_handlers[path] = handler
    
    def start_server(self):
        """Start the web server in a separate thread"""
        handler = self._create_request_handler()
        self.server = socketserver.TCPServer(("", self.port), handler)
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()
        print(f"Local web server started on port {self.port}")
    
    def stop_server(self):
        """Stop the web server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server_thread.join()
            print("Local web server stopped")
    
    def _create_request_handler(self):
        document_root = self.document_root
        route_handlers = self.request_handlers
        
        class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=document_root, **kwargs)
            
            def do_GET(self):
                if self.path in route_handlers:
                    response = route_handlers[self.path](self)
                    self._send_json_response(response)
                else:
                    super().do_GET()
            
            def do_POST(self):
                if self.path in route_handlers:
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    response = route_handlers[self.path](self, post_data)
                    self._send_json_response(response)
                else:
                    self._send_error_response(404)
            
            def _send_json_response(self, data):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            
            def _send_error_response(self, code):
                self.send_response(code)
                self.end_headers()
        
        return CustomHTTPRequestHandler
