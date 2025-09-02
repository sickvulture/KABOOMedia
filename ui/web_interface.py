import json
import time
from typing import Dict, List, Any, Optional
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler
import uuid

class WebInterface:
    def __init__(self, database, template_engine, address_manager, qr_generator):
        self.database = database
        self.template_engine = template_engine
        self.address_manager = address_manager
        self.qr_generator = qr_generator
        self.current_user_id = None  # Will be set after user login/creation
    
    def set_current_user(self, user_id: str):
        """Set the current active user"""
        self.current_user_id = user_id
    
    def handle_posts(self, request_handler, post_data=None):
        """Handle posts API requests"""
        method = request_handler.command
        parsed_url = urlparse(request_handler.path)
        query_params = parse_qs(parsed_url.query)
        
        if method == 'GET':
            return self._get_posts(query_params)
        elif method == 'POST' and post_data:
            return self._create_post(post_data)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _get_posts(self, query_params):
        """Get posts based on query parameters"""
        try:
            user_id = query_params.get('user_id', [None])[0]
            limit = int(query_params.get('limit', [50])[0])
            offset = int(query_params.get('offset', [0])[0])
            post_type = query_params.get('type', ['public'])[0]
            
            if user_id:
                posts = self.database.get_user_posts(user_id, limit, offset)
            elif post_type == 'public':
                posts = self.database.get_public_posts(limit, offset)
            else:
                posts = []
            
            # Convert posts to dict format and add comments
            posts_data = []
            for post in posts:
                post_dict = {
                    'post_id': post.post_id,
                    'user_id': post.user_id,
                    'content': post.content,
                    'media_urls': post.media_urls,
                    'privacy_level': post.privacy_level,
                    'created_at': post.created_at,
                    'updated_at': post.updated_at,
                    'metadata': post.metadata,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', 
                                            time.localtime(post.created_at))
                }
                
                # Add comments
                comments = self.database.get_post_comments(post.post_id)
                post_dict['comments'] = [
                    {
                        'comment_id': comment.comment_id,
                        'author_id': comment.author_id,
                        'content': comment.content,
                        'created_at': comment.created_at,
                        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', 
                                                 time.localtime(comment.created_at))
                    } for comment in comments
                ]
                
                # Get author information
                author = self.database.get_user(post.user_id)
                if author:
                    post_dict['author_name'] = author.name
                
                posts_data.append(post_dict)
            
            return {
                'status': 'success',
                'posts': posts_data,
                'total': len(posts_data)
            }
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _create_post(self, post_data):
        """Create a new post"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            if not self.current_user_id:
                return {'error': 'No user logged in', 'status': 401}
            
            content = data.get('content', '').strip()
            if not content:
                return {'error': 'Content is required', 'status': 400}
            
            media_urls = data.get('media_urls', [])
            privacy_level = data.get('privacy_level', 'public')
            metadata = data.get('metadata', {})
            
            post_id = self.database.create_post(
                user_id=self.current_user_id,
                content=content,
                media_urls=media_urls,
                privacy_level=privacy_level,
                metadata=metadata
            )
            
            return {
                'status': 'success',
                'post_id': post_id,
                'message': 'Post created successfully'
            }
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON data', 'status': 400}
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def handle_connections(self, request_handler, post_data=None):
        """Handle connections API requests"""
        method = request_handler.command
        parsed_url = urlparse(request_handler.path)
        query_params = parse_qs(parsed_url.query)
        
        if method == 'GET':
            return self._get_connections(query_params)
        elif method == 'POST' and post_data:
            return self._create_connection(post_data)
        elif method == 'PUT' and post_data:
            return self._update_connection(post_data)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _get_connections(self, query_params):
        """Get user connections"""
        try:
            if not self.current_user_id:
                return {'error': 'No user logged in', 'status': 401}
            
            status = query_params.get('status', [None])[0]
            connections = self.database.get_user_connections(self.current_user_id, status)
            
            connections_data = []
            for conn in connections:
                conn_dict = {
                    'connection_id': conn.connection_id,
                    'user_id': conn.user_id,
                    'peer_user_id': conn.peer_user_id,
                    'peer_public_key': conn.peer_public_key,
                    'connection_status': conn.connection_status,
                    'permissions': conn.permissions,
                    'created_at': conn.created_at,
                    'updated_at': conn.updated_at,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', 
                                             time.localtime(conn.created_at))
                }
                
                # Get peer user information
                peer_user = self.database.get_user(conn.peer_user_id)
                if peer_user:
                    conn_dict['peer_name'] = peer_user.name
                    conn_dict['peer_bio'] = peer_user.bio
                
                connections_data.append(conn_dict)
            
            return {
                'status': 'success',
                'connections': connections_data,
                'total': len(connections_data)
            }
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _create_connection(self, post_data):
        """Create a new connection"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            if not self.current_user_id:
                return {'error': 'No user logged in', 'status': 401}
            
            peer_user_id = data.get('peer_user_id')
            peer_public_key = data.get('peer_public_key', '')
            permissions = data.get('permissions', {})
            
            if not peer_user_id:
                return {'error': 'Peer user ID is required', 'status': 400}
            
            connection_id = self.database.create_connection(
                user_id=self.current_user_id,
                peer_user_id=peer_user_id,
                peer_public_key=peer_public_key,
                permissions=permissions
            )
            
            return {
                'status': 'success',
                'connection_id': connection_id,
                'message': 'Connection request created'
            }
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON data', 'status': 400}
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _update_connection(self, post_data):
        """Update connection status"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            connection_id = data.get('connection_id')
            status = data.get('status')
            
            if not connection_id or not status:
                return {'error': 'Connection ID and status are required', 'status': 400}
            
            if status not in ['pending', 'accepted', 'blocked']:
                return {'error': 'Invalid status', 'status': 400}
            
            success = self.database.update_connection_status(connection_id, status)
            
            if success:
                return {
                    'status': 'success',
                    'message': f'Connection status updated to {status}'
                }
            else:
                return {'error': 'Connection not found or not updated', 'status': 404}
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON data', 'status': 400}
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def handle_profile(self, request_handler, post_data=None):
        """Handle profile API requests"""
        method = request_handler.command
        parsed_url = urlparse(request_handler.path)
        query_params = parse_qs(parsed_url.query)
        
        if method == 'GET':
            return self._get_profile(query_params)
        elif method == 'POST' and post_data:
            return self._update_profile(post_data)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _get_profile(self, query_params):
        """Get user profile"""
        try:
            user_id = query_params.get('user_id', [self.current_user_id])[0]
            
            if not user_id:
                return {'error': 'User ID is required', 'status': 400}
            
            user = self.database.get_user(user_id)
            if not user:
                return {'error': 'User not found', 'status': 404}
            
            profile_data = {
                'user_id': user.user_id,
                'name': user.name,
                'bio': user.bio,
                'public_key': user.public_key,
                'created_at': user.created_at,
                'updated_at': user.updated_at,
                'preferences': user.preferences,
                'member_since': time.strftime('%Y-%m-%d', 
                                            time.localtime(user.created_at))
            }
            
            # Get user statistics
            user_posts = self.database.get_user_posts(user_id, limit=1000)
            connections = self.database.get_user_connections(user_id, 'accepted')
            
            profile_data['stats'] = {
                'posts_count': len(user_posts),
                'connections_count': len(connections),
                'last_post': user_posts[0].created_at if user_posts else None
            }
            
            return {
                'status': 'success',
                'profile': profile_data
            }
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def _update_profile(self, post_data):
        """Update user profile"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            if not self.current_user_id:
                return {'error': 'No user logged in', 'status': 401}
            
            # Only allow updating certain fields
            allowed_fields = ['name', 'bio', 'preferences']
            update_data = {k: v for k, v in data.items() if k in allowed_fields}
            
            if not update_data:
                return {'error': 'No valid fields to update', 'status': 400}
            
            success = self.database.update_user(self.current_user_id, **update_data)
            
            if success:
                return {
                    'status': 'success',
                    'message': 'Profile updated successfully'
                }
            else:
                return {'error': 'Profile not updated', 'status': 500}
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON data', 'status': 400}
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def handle_addresses(self, request_handler, post_data=None):
        """Handle addresses API requests"""
        method = request_handler.command
        
        if method == 'GET':
            return self._get_addresses()
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _get_addresses(self):
        """Get current addresses and generate QR codes"""
        try:
            addresses = self.address_manager.update_current_addresses()
            shareable_addresses = self.address_manager.get_shareable_addresses()
            
            # Generate QR codes for shareable addresses
            for addr in shareable_addresses:
                addr['qr_code'] = self.qr_generator.generate_address_qr(addr)
            
            return {
                'status': 'success',
                'all_addresses': addresses,
                'shareable_addresses': shareable_addresses,
                'total': len(addresses)
            }
        except Exception as e:
            return {'error': str(e), 'status': 500}
    
    def generate_user_page(self, user_id: str = None) -> str:
        """Generate a full HTML page for a user"""
        try:
            target_user_id = user_id or self.current_user_id
            if not target_user_id:
                return "<html><body><h1>No user specified</h1></body></html>"
            
            user = self.database.get_user(target_user_id)
            if not user:
                return "<html><body><h1>User not found</h1></body></html>"
            
            posts = self.database.get_user_posts(target_user_id, limit=20)
            
            # Convert posts to template format
            template_posts = []
            for post in posts:
                comments = self.database.get_post_comments(post.post_id)
                template_comments = []
                for comment in comments:
                    author = self.database.get_user(comment.author_id)
                    template_comments.append({
                        'author': author.name if author else 'Unknown',
                        'content': comment.content,
                        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', 
                                                  time.localtime(comment.created_at))
                    })
                
                template_posts.append({
                    'content': post.content,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S', 
                                             time.localtime(post.created_at)),
                    'privacy_level': post.privacy_level,
                    'media': [{'url': url, 'description': ''} for url in post.media_urls],
                    'comments': template_comments
                })
            
            user_data = {
                'name': user.name,
                'bio': user.bio,
                'user_id': user.user_id
            }
            
            return self.template_engine.generate_user_site(user_data, template_posts)
        
        except Exception as e:
            return f"<html><body><h1>Error generating page: {str(e)}</h1></body></html>"
    
    def create_initial_user(self, name: str, bio: str = "") -> str:
        """Create the first user for this instance"""
        try:
            # Check if any users exist
            stats = self.database.get_database_stats()
            if stats['users'] > 0:
                raise Exception("Users already exist in database")
            
            user_id = self.database.create_user(name, bio)
            self.set_current_user(user_id)
            
            return user_id
        except Exception as e:
            raise Exception(f"Failed to create initial user: {str(e)}")
    
    def handle_comments(self, request_handler, post_data=None):
        """Handle comments API requests"""
        method = request_handler.command
        
        if method == 'POST' and post_data:
            return self._create_comment(post_data)
        else:
            return {'error': 'Method not supported', 'status': 405}
    
    def _create_comment(self, post_data):
        """Create a new comment"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            if not self.current_user_id:
                return {'error': 'No user logged in', 'status': 401}
            
            post_id = data.get('post_id')
            content = data.get('content', '').strip()
            
            if not post_id or not content:
                return {'error': 'Post ID and content are required', 'status': 400}
            
            # Verify post exists
            post = self.database.get_post(post_id)
            if not post:
                return {'error': 'Post not found', 'status': 404}
            
            comment_id = self.database.create_comment(
                post_id=post_id,
                author_id=self.current_user_id,
                content=content
            )
            
            return {
                'status': 'success',
                'comment_id': comment_id,
                'message': 'Comment created successfully'
            }
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON data', 'status': 400}
        except Exception as e:
            return {'error': str(e), 'status': 500}
