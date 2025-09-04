#!/usr/bin/env python3
"""
Custom HTTP server for serving static files with proper MIME types
for vanilla JavaScript applications.
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler with proper MIME types for JavaScript modules"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def guess_type(self, path):
        """Override to ensure proper MIME types"""
        mimetype, encoding = super().guess_type(path)
        
        # Ensure JavaScript files have correct MIME type
        if path.endswith('.js'):
            mimetype = 'application/javascript'
        elif path.endswith('.mjs'):
            mimetype = 'application/javascript'
        elif path.endswith('.json'):
            mimetype = 'application/json'
        elif path.endswith('.css'):
            mimetype = 'text/css'
        elif path.endswith('.html'):
            mimetype = 'text/html'
        
        return mimetype, encoding
    
    def end_headers(self):
        """Add security headers and ensure proper caching"""
        # Prevent caching for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        
        # Security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        
        super().end_headers()

def run_server(port=8080, directory='.'):
    """Run the custom HTTP server"""
    # Change to the specified directory
    if directory != '.':
        os.chdir(directory)
    
    # Set up the server
    handler = CustomHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"Serving directory '{os.getcwd()}' at http://localhost:{port}/")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"Error: Port {port} is already in use. Try a different port.")
            sys.exit(1)
        else:
            raise
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    run_server(port, directory)
