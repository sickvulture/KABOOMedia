#!/usr/bin/env python3
"""
Interaction handler for comments, likes, and other user interactions
"""

import time
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class Interaction:
    interaction_id: str
    user_id: str
    target_id: str  # post_id, comment_id, etc.
    interaction_type: str  # 'like', 'comment', 'share', 'reply'
    content: str = ""
    metadata: Dict[str, Any] = None
    created_at: float = 0.0
    
    def __post_init__(self):
        if self.created_at == 0.0:
            self.created_at = time.time()
        if self.metadata is None:
            self.metadata = {}

class InteractionHandler:
    """Handle user interactions like comments, likes, shares"""
    
    def __init__(self, database):
        self.database = database
        self.interaction_cache = {}
        self.rate_limits = {}  # user_id -> {last_action: timestamp, count: int}
    
    def add_like(self, user_id: str, post_id: str) -> bool:
        """Add a like to a post"""
        if not self._check_rate_limit(user_id, 'like'):
            return False
        
        # Check if user already liked this post
        if self._user_has_interacted(user_id, post_id, 'like'):
            return False
        
        try:
            # Create like interaction
            interaction_id = self._generate_interaction_id()
            
            # Store in database (using comments table for simplicity)
            like_id = self.database.create_comment(
                post_id=post_id,
                author_id=user_id,
                content="__LIKE__",  # Special content to indicate like
                is_encrypted=False
            )
            
            # Update cache
            cache_key = f"{user_id}:{post_id}:like"
            self.interaction_cache[cache_key] = True
            
            self._update_rate_limit(user_id, 'like')
            return True
            
        except Exception as e:
            print(f"Error adding like: {e}")
            return False
    
    def remove_like(self, user_id: str, post_id: str) -> bool:
        """Remove a like from a post"""
        try:
            # Find and remove the like comment
            cursor = self.database.connection.cursor()
            cursor.execute('''
                DELETE FROM comments 
                WHERE post_id = ? AND author_id = ? AND content = '__LIKE__'
            ''', (post_id, user_id))
            
            self.database.connection.commit()
            
            # Update cache
            cache_key = f"{user_id}:{post_id}:like"
            if cache_key in self.interaction_cache:
                del self.interaction_cache[cache_key]
            
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"Error removing like: {e}")
            return False
    
    def add_comment_reply(self, user_id: str, parent_comment_id: str, content: str) -> Optional[str]:
        """Add a reply to a comment"""
        if not self._check_rate_limit(user_id, 'comment'):
            return None
        
        if not content.strip():
            return None
        
        try:
            # Get the parent comment to find the post
            parent_comment = self.database.connection.cursor()
            parent_comment.execute('SELECT post_id FROM comments WHERE comment_id = ?', (parent_comment_id,))
            result = parent_comment.fetchone()
            
            if not result:
                return None
            
            post_id = result[0]
            
            # Create reply with metadata indicating parent
            metadata = {'parent_comment_id': parent_comment_id, 'is_reply': True}
            reply_content = f"@reply:{parent_comment_id}:{content}"
            
            reply_id = self.database.create_comment(
                post_id=post_id,
                author_id=user_id,
                content=reply_content,
                is_encrypted=False
            )
            
            self._update_rate_limit(user_id, 'comment')
            return reply_id
            
        except Exception as e:
            print(f"Error adding comment reply: {e}")
            return None
    
    def get_post_likes_count(self, post_id: str) -> int:
        """Get number of likes for a post"""
        try:
            cursor = self.database.connection.cursor()
            cursor.execute('''
                SELECT COUNT(*) FROM comments 
                WHERE post_id = ? AND content = '__LIKE__'
            ''', (post_id,))
            
            result = cursor.fetchone()
            return result[0] if result else 0
            
        except Exception as e:
            print(f"Error getting likes count: {e}")
            return 0
    
    def get_post_interactions(self, post_id: str) -> Dict[str, Any]:
        """Get all interactions for a post"""
        try:
            # Get regular comments (not likes)
            comments = self.database.get_post_comments(post_id)
            regular_comments = [c for c in comments if c.content != '__LIKE__']
            
            # Get likes count
            likes_count = self.get_post_likes_count(post_id)
            
            # Process replies
            replies_by_parent = {}
            processed_comments = []
            
            for comment in regular_comments:
                if comment.content.startswith('@reply:'):
                    # This is a reply
                    parts = comment.content.split(':', 3)
                    if len(parts) >= 4:
                        parent_id = parts[1]
                        reply_content = parts[3]
                        
                        if parent_id not in replies_by_parent:
                            replies_by_parent[parent_id] = []
                        
                        replies_by_parent[parent_id].append({
                            'comment_id': comment.comment_id,
                            'author_id': comment.author_id,
                            'content': reply_content,
                            'created_at': comment.created_at
                        })
                else:
                    # Regular comment
                    processed_comments.append({
                        'comment_id': comment.comment_id,
                        'author_id': comment.author_id,
                        'content': comment.content,
                        'created_at': comment.created_at,
                        'replies': replies_by_parent.get(comment.comment_id, [])
                    })
            
            return {
                'likes_count': likes_count,
                'comments_count': len(regular_comments),
                'comments': processed_comments,
                'total_interactions': likes_count + len(regular_comments)
            }
            
        except Exception as e:
            print(f"Error getting post interactions: {e}")
            return {
                'likes_count': 0,
                'comments_count': 0,
                'comments': [],
                'total_interactions': 0
            }
    
    def get_user_interactions_summary(self, user_id: str) -> Dict[str, int]:
        """Get summary of user's interactions"""
        try:
            cursor = self.database.connection.cursor()
            
            # Count likes given
            cursor.execute('''
                SELECT COUNT(*) FROM comments 
                WHERE author_id = ? AND content = '__LIKE__'
            ''', (user_id,))
            likes_given = cursor.fetchone()[0]
            
            # Count comments made
            cursor.execute('''
                SELECT COUNT(*) FROM comments 
                WHERE author_id = ? AND content != '__LIKE__'
            ''', (user_id,))
            comments_made = cursor.fetchone()[0]
            
            # Count likes received (on user's posts)
            cursor.execute('''
                SELECT COUNT(*) FROM comments c
                JOIN posts p ON c.post_id = p.post_id
                WHERE p.user_id = ? AND c.content = '__LIKE__'
            ''', (user_id,))
            likes_received = cursor.fetchone()[0]
            
            # Count comments received (on user's posts)
            cursor.execute('''
                SELECT COUNT(*) FROM comments c
                JOIN posts p ON c.post_id = p.post_id
                WHERE p.user_id = ? AND c.content != '__LIKE__' AND c.author_id != ?
            ''', (user_id, user_id))
            comments_received = cursor.fetchone()[0]
            
            return {
                'likes_given': likes_given,
                'likes_received': likes_received,
                'comments_made': comments_made,
                'comments_received': comments_received,
                'total_interactions': likes_given + comments_made
            }
            
        except Exception as e:
            print(f"Error getting user interactions summary: {e}")
            return {
                'likes_given': 0,
                'likes_received': 0,
                'comments_made': 0,
                'comments_received': 0,
                'total_interactions': 0
            }
    
    def _check_rate_limit(self, user_id: str, action_type: str) -> bool:
        """Check if user is within rate limits"""
        current_time = time.time()
        
        # Rate limits per minute
        limits = {
            'like': 30,      # 30 likes per minute
            'comment': 10,   # 10 comments per minute
            'share': 5       # 5 shares per minute
        }
        
        if action_type not in limits:
            return True
        
        key = f"{user_id}:{action_type}"
        if key not in self.rate_limits:
            self.rate_limits[key] = {'last_reset': current_time, 'count': 0}
        
        rate_data = self.rate_limits[key]
        
        # Reset counter if more than a minute has passed
        if current_time - rate_data['last_reset'] > 60:
            rate_data['count'] = 0
            rate_data['last_reset'] = current_time
        
        # Check if within limit
        return rate_data['count'] < limits[action_type]
    
    def _update_rate_limit(self, user_id: str, action_type: str):
        """Update rate limit counter"""
        key = f"{user_id}:{action_type}"
        if key in self.rate_limits:
            self.rate_limits[key]['count'] += 1
    
    def _user_has_interacted(self, user_id: str, target_id: str, interaction_type: str) -> bool:
        """Check if user has already performed this interaction"""
        cache_key = f"{user_id}:{target_id}:{interaction_type}"
        
        # Check cache first
        if cache_key in self.interaction_cache:
            return self.interaction_cache[cache_key]
        
        # Check database
        if interaction_type == 'like':
            try:
                cursor = self.database.connection.cursor()
                cursor.execute('''
                    SELECT COUNT(*) FROM comments 
                    WHERE post_id = ? AND author_id = ? AND content = '__LIKE__'
                ''', (target_id, user_id))
                
                count = cursor.fetchone()[0]
                has_interacted = count > 0
                
                # Cache result
                self.interaction_cache[cache_key] = has_interacted
                return has_interacted
                
            except Exception:
                return False
        
        return False
    
    def _generate_interaction_id(self) -> str:
        """Generate unique interaction ID"""
        import uuid
        return str(uuid.uuid4())
    
    def cleanup_old_cache_entries(self, max_age_hours: int = 24):
        """Clean up old cache entries"""
        # This is a simple implementation
        # In a production system, you'd want more sophisticated cache management
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        # For now, just clear the entire cache periodically
        if len(self.interaction_cache) > 1000:  # Arbitrary limit
            self.interaction_cache.clear()
            print("Interaction cache cleared due to size limit")
