#!/usr/bin/env python3
"""
Additional API handlers for Decentralized Social Media Platform
"""

import json
import time
import base64
import mimetypes
from typing import Dict, List, Any, Optional
from urllib.parse import parse_qs, urlparse
from pathlib import Path

class MediaAPIHandler:
    """Handle media upload and serving"""
    
    def __init__(self, database, storage, file_manager):
        self.database = database
        self.storage = storage
        self.file_manager = file_manager
    
    def handle_media_upload(self, request_handler, post_data):
        """Handle media file uploads"""
        try:
            # Parse multipart form data (simplified version)
            content_type = request_handler.headers.get('Content-Type', '')
            
            if 'multipart/form-data' not in content_type:
                return {'error': 'Invalid content type', 'status': 400}
            
            # In a real implementation, you'd parse the multipart data properly
            # For now, assume post_data contains the file data
            
            data = json.loads(post_data.decode('utf-8'))
            
            file_data = base64.b64decode(data.get('file_data', ''))
            filename = data.get('filename', 'unknown')
            user_id = data.get('user_id')
            
            if not file_data or not filename or not user_id:
                return {'error': 'Missing required fields', 'status': 400}
            
            # Store the file
            file_info = self.file_manager.store_file(file_data, filename, user_id)
            
            if not file_info:
                return {'error': 'File upload failed', 'status': 500}
            
            # Store file info in database
            file_id = self.database.store_media_file(
                user_id=user_id,
                filename=filename,
                file_path=file_info['stored_path'],
                file_type=file_info['mime_type'],
                file_size=file_info['size'],
                metadata=file_info
            )
            
            return {
                'status': 'success',
                'file_id': file_id,
                'url': f'/api/media/{file_id}',
                'filename': filename,
                'size': file_info['size']
            }
            
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def handle_media_serve(self, request_handler, file_id):
        """Serve media files"""
        try:
            media_file = self.database.get_media_file(file_id)
            if not media_file:
                return {'error': 'File not found', 'status': 404}
            
            # Get file data
            file_data = self.file_manager.get_file(media_file.file_path)
            if not file_data:
                return {'error': 'File data not found', 'status': 404}
            
            # Return file with appropriate headers
            return {
                'status': 'success',
                'data': file_data,
                'content_type': media_file.file_type or 'application/octet-stream',
                'filename': media_file.filename
            }
            
        except Exception as e:
            return {'error': str(e), 'status': 500}

class SearchAPIHandler:
    """Handle search functionality"""
    
    def __init__(self, database):
        self.database = database
    
    def handle_search(self, request_handler, post_data=None):
        """Handle search requests"""
        method = request_handler.command
        parsed_url = urlparse(request_handler.path)
        query_params = parse_qs(parsed_url.query)
        
        if method == 'GET':
            return self._search_content(query_params)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _search_content(self, query_params):
        """Search content based on query parameters"""
        try:
            query = query_params.get('q', [''])[0]
            content_type = query_params.get('type', ['all'])[0]
            limit = int(query_params.get('limit', [20])[0])
            
            if not query.strip():
                return {'error': 'Search query required', 'status': 400}
            
            results = {
                'query': query,
                'users': [],
                'posts': [],
                'total': 0
            }
            
            # Search users
            if content_type in ['all', 'users']:
                users = self._search_users(query, limit)
                results['users'] = users
            
            # Search posts
            if content_type in ['all', 'posts']:
                posts = self._search_posts(query, limit)
                results['posts'] = posts
            
            results['total'] = len(results['users']) + len(results['posts'])
            
            return {
                'status': 'success',
                'results': results
            }
            
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _search_users(self, query: str, limit: int) -> List[Dict]:
        """Search users by name or bio"""
        try:
            cursor = self.database.connection.cursor()
            
            # Simple text search (in a real system, you'd use FTS)
            cursor.execute('''
                SELECT user_id, name, bio, created_at
                FROM users 
                WHERE name LIKE ? OR bio LIKE ?
                ORDER BY name
                LIMIT ?
            ''', (f'%{query}%', f'%{query}%', limit))
            
            users = []
            for row in cursor.fetchall():
                users.append({
                    'user_id': row[0],
                    'name': row[1],
                    'bio': row[2],
                    'created_at': row[3]
                })
            
            return users
            
        except Exception as e:
            print(f"Error searching users: {e}")
            return []
    
    def _search_posts(self, query: str, limit: int) -> List[Dict]:
        """Search posts by content"""
        try:
            cursor = self.database.connection.cursor()
            
            cursor.execute('''
                SELECT p.post_id, p.user_id, p.content, p.created_at, u.name
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.user_id
                WHERE p.content LIKE ? AND p.privacy_level = 'public'
                ORDER BY p.created_at DESC
                LIMIT ?
            ''', (f'%{query}%', limit))
            
            posts = []
            for row in cursor.fetchall():
                posts.append({
                    'post_id': row[0],
                    'user_id': row[1],
                    'content': row[2],
                    'created_at': row[3],
                    'author_name': row[4] or 'Unknown'
                })
            
            return posts
            
        except Exception as e:
            print(f"Error searching posts: {e}")
            return []

class AnalyticsAPIHandler:
    """Handle analytics and statistics"""
    
    def __init__(self, database):
        self.database = database
    
    def handle_analytics(self, request_handler, post_data=None):
        """Handle analytics requests"""
        method = request_handler.command
        parsed_url = urlparse(request_handler.path)
        query_params = parse_qs(parsed_url.query)
        
        if method == 'GET':
            return self._get_analytics(query_params)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _get_analytics(self, query_params):
        """Get analytics data"""
        try:
            report_type = query_params.get('type', ['overview'])[0]
            time_range = query_params.get('range', ['30d'])[0]
            
            if report_type == 'overview':
                return self._get_overview_analytics(time_range)
            elif report_type == 'engagement':
                return self._get_engagement_analytics(time_range)
            elif report_type == 'growth':
                return self._get_growth_analytics(time_range)
            else:
                return {'error': 'Invalid report type', 'status': 400}
            
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _get_overview_analytics(self, time_range: str) -> Dict:
        """Get overview analytics"""
        try:
            cursor = self.database.connection.cursor()
            
            # Get time range in seconds
            range_seconds = self._parse_time_range(time_range)
            cutoff_time = time.time() - range_seconds
            
            # Get basic stats
            stats = self.database.get_database_stats()
            
            # Get recent activity
            cursor.execute('''
                SELECT COUNT(*) FROM posts WHERE created_at > ?
            ''', (cutoff_time,))
            recent_posts = cursor.fetchone()[0]
            
            cursor.execute('''
                SELECT COUNT(*) FROM comments WHERE created_at > ?
            ''', (cutoff_time,))
            recent_comments = cursor.fetchone()[0]
            
            cursor.execute('''
                SELECT COUNT(*) FROM users WHERE created_at > ?
            ''', (cutoff_time,))
            new_users = cursor.fetchone()[0]
            
            return {
                'status': 'success',
                'time_range': time_range,
                'overview': {
                    'total_users': stats['users'],
                    'total_posts': stats['posts'],
                    'total_comments': stats['comments'],
                    'total_connections': stats['connections'],
                    'recent_posts': recent_posts,
                    'recent_comments': recent_comments,
                    'new_users': new_users
                }
            }
            
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _parse_time_range(self, time_range: str) -> int:
        """Parse time range string to seconds"""
        if time_range == '24h':
            return 24 * 3600
        elif time_range == '7d':
            return 7 * 24 * 3600
        elif time_range == '30d':
            return 30 * 24 * 3600
        elif time_range == '90d':
            return 90 * 24 * 3600
        elif time_range == '1y':
            return 365 * 24 * 3600
        else:
            return 30 * 24 * 3600  # Default to 30 days

# Utility function to combine all API handlers
def setup_additional_api_routes(web_server, database, storage, file_manager):
    """Set up additional API routes"""
    
    # Initialize handlers
    media_handler = MediaAPIHandler(database, storage, file_manager)
    search_handler = SearchAPIHandler(database)
    analytics_handler = AnalyticsAPIHandler(database)
    
    # Add routes
    web_server.add_route_handler('/api/media/upload', media_handler.handle_media_upload)
    web_server.add_route_handler('/api/search', search_handler.handle_search)
    web_server.add_route_handler('/api/analytics', analytics_handler.handle_analytics)
    
    print("Additional API routes configured")
