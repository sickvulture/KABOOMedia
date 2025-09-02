import sqlite3
import json
import time
import uuid
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from .models import User, Post, Connection, Comment, MediaFile

class LocalDatabase:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = None
        self._initialize_database()
    
    def _initialize_database(self):
        """Initialize database connection and create tables"""
        self.connection = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.connection.row_factory = sqlite3.Row  # Enable dict-like access
        self._create_tables()
    
    def _create_tables(self):
        """Create database tables if they don't exist"""
        cursor = self.connection.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                bio TEXT,
                public_key TEXT,
                private_key_encrypted TEXT,
                created_at REAL,
                updated_at REAL,
                preferences TEXT  -- JSON string
            )
        ''')
        
        # Posts table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS posts (
                post_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                media_urls TEXT,  -- JSON array
                privacy_level TEXT DEFAULT 'public',
                created_at REAL,
                updated_at REAL,
                metadata TEXT,  -- JSON string
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')
        
        # Connections table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                connection_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                peer_user_id TEXT NOT NULL,
                peer_public_key TEXT,
                connection_status TEXT DEFAULT 'pending',
                permissions TEXT,  -- JSON string
                created_at REAL,
                updated_at REAL,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')
        
        # Comments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                comment_id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at REAL,
                is_encrypted BOOLEAN DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES posts (post_id),
                FOREIGN KEY (author_id) REFERENCES users (user_id)
            )
        ''')
        
        # Media files table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS media_files (
                file_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                is_encrypted BOOLEAN DEFAULT 1,
                created_at REAL,
                metadata TEXT,  -- JSON string
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments (post_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections (user_id)')
        
        self.connection.commit()
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
    
    # User operations
    def create_user(self, name: str, bio: str = "", public_key: str = "", 
                   private_key_encrypted: str = "", preferences: Dict = None) -> str:
        """Create a new user"""
        user_id = str(uuid.uuid4())
        current_time = time.time()
        preferences_json = json.dumps(preferences or {})
        
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO users 
            (user_id, name, bio, public_key, private_key_encrypted, created_at, updated_at, preferences)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, name, bio, public_key, private_key_encrypted, 
              current_time, current_time, preferences_json))
        
        self.connection.commit()
        return user_id
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        cursor = self.connection.cursor()
        cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        
        if row:
            return User(
                user_id=row['user_id'],
                name=row['name'],
                bio=row['bio'] or "",
                public_key=row['public_key'] or "",
                private_key_encrypted=row['private_key_encrypted'] or "",
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                preferences=json.loads(row['preferences'] or '{}')
            )
        return None
    
    def update_user(self, user_id: str, **kwargs) -> bool:
        """Update user information"""
        if not kwargs:
            return False
        
        # Handle preferences separately as JSON
        if 'preferences' in kwargs:
            kwargs['preferences'] = json.dumps(kwargs['preferences'])
        
        kwargs['updated_at'] = time.time()
        
        set_clause = ', '.join(f"{key} = ?" for key in kwargs.keys())
        values = list(kwargs.values()) + [user_id]
        
        cursor = self.connection.cursor()
        cursor.execute(f'UPDATE users SET {set_clause} WHERE user_id = ?', values)
        self.connection.commit()
        
        return cursor.rowcount > 0
    
    # Post operations
    def create_post(self, user_id: str, content: str, media_urls: List[str] = None,
                   privacy_level: str = 'public', metadata: Dict = None) -> str:
        """Create a new post"""
        post_id = str(uuid.uuid4())
        current_time = time.time()
        media_urls_json = json.dumps(media_urls or [])
        metadata_json = json.dumps(metadata or {})
        
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO posts 
            (post_id, user_id, content, media_urls, privacy_level, created_at, updated_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (post_id, user_id, content, media_urls_json, privacy_level, 
              current_time, current_time, metadata_json))
        
        self.connection.commit()
        return post_id
    
    def get_post(self, post_id: str) -> Optional[Post]:
        """Get post by ID"""
        cursor = self.connection.cursor()
        cursor.execute('SELECT * FROM posts WHERE post_id = ?', (post_id,))
        row = cursor.fetchone()
        
        if row:
            return Post(
                post_id=row['post_id'],
                user_id=row['user_id'],
                content=row['content'],
                media_urls=json.loads(row['media_urls'] or '[]'),
                privacy_level=row['privacy_level'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                metadata=json.loads(row['metadata'] or '{}')
            )
        return None
    
    def get_user_posts(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Post]:
        """Get posts by user ID"""
        cursor = self.connection.cursor()
        cursor.execute('''
            SELECT * FROM posts WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT ? OFFSET ?
        ''', (user_id, limit, offset))
        
        posts = []
        for row in cursor.fetchall():
            posts.append(Post(
                post_id=row['post_id'],
                user_id=row['user_id'],
                content=row['content'],
                media_urls=json.loads(row['media_urls'] or '[]'),
                privacy_level=row['privacy_level'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                metadata=json.loads(row['metadata'] or '{}')
            ))
        
        return posts
    
    def get_public_posts(self, limit: int = 50, offset: int = 0) -> List[Post]:
        """Get all public posts"""
        cursor = self.connection.cursor()
        cursor.execute('''
            SELECT * FROM posts WHERE privacy_level = 'public' 
            ORDER BY created_at DESC LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        posts = []
        for row in cursor.fetchall():
            posts.append(Post(
                post_id=row['post_id'],
                user_id=row['user_id'],
                content=row['content'],
                media_urls=json.loads(row['media_urls'] or '[]'),
                privacy_level=row['privacy_level'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                metadata=json.loads(row['metadata'] or '{}')
            ))
        
        return posts
    
    def delete_post(self, post_id: str, user_id: str) -> bool:
        """Delete a post (only by owner)"""
        cursor = self.connection.cursor()
        cursor.execute('DELETE FROM posts WHERE post_id = ? AND user_id = ?', (post_id, user_id))
        self.connection.commit()
        return cursor.rowcount > 0
    
    # Connection operations
    def create_connection(self, user_id: str, peer_user_id: str, peer_public_key: str = "",
                         permissions: Dict = None) -> str:
        """Create a new connection"""
        connection_id = str(uuid.uuid4())
        current_time = time.time()
        default_permissions = {'view': True, 'comment': True, 'share': False}
        permissions_json = json.dumps(permissions or default_permissions)
        
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO connections 
            (connection_id, user_id, peer_user_id, peer_public_key, connection_status, 
             permissions, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
        ''', (connection_id, user_id, peer_user_id, peer_public_key, 
              permissions_json, current_time, current_time))
        
        self.connection.commit()
        return connection_id
    
    def get_user_connections(self, user_id: str, status: str = None) -> List[Connection]:
        """Get connections for a user"""
        cursor = self.connection.cursor()
        
        if status:
            cursor.execute('''
                SELECT * FROM connections WHERE user_id = ? AND connection_status = ?
                ORDER BY created_at DESC
            ''', (user_id, status))
        else:
            cursor.execute('''
                SELECT * FROM connections WHERE user_id = ? 
                ORDER BY created_at DESC
            ''', (user_id,))
        
        connections = []
        for row in cursor.fetchall():
            connections.append(Connection(
                connection_id=row['connection_id'],
                user_id=row['user_id'],
                peer_user_id=row['peer_user_id'],
                peer_public_key=row['peer_public_key'] or "",
                connection_status=row['connection_status'],
                permissions=json.loads(row['permissions'] or '{}'),
                created_at=row['created_at'],
                updated_at=row['updated_at']
            ))
        
        return connections
    
    def update_connection_status(self, connection_id: str, status: str) -> bool:
        """Update connection status"""
        cursor = self.connection.cursor()
        cursor.execute('''
            UPDATE connections SET connection_status = ?, updated_at = ? 
            WHERE connection_id = ?
        ''', (status, time.time(), connection_id))
        self.connection.commit()
        return cursor.rowcount > 0
    
    # Comment operations
    def create_comment(self, post_id: str, author_id: str, content: str, 
                      is_encrypted: bool = False) -> str:
        """Create a new comment"""
        comment_id = str(uuid.uuid4())
        current_time = time.time()
        
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO comments (comment_id, post_id, author_id, content, created_at, is_encrypted)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (comment_id, post_id, author_id, content, current_time, is_encrypted))
        
        self.connection.commit()
        return comment_id
    
    def get_post_comments(self, post_id: str) -> List[Comment]:
        """Get comments for a post"""
        cursor = self.connection.cursor()
        cursor.execute('''
            SELECT * FROM comments WHERE post_id = ? 
            ORDER BY created_at ASC
        ''', (post_id,))
        
        comments = []
        for row in cursor.fetchall():
            comments.append(Comment(
                comment_id=row['comment_id'],
                post_id=row['post_id'],
                author_id=row['author_id'],
                content=row['content'],
                created_at=row['created_at'],
                is_encrypted=bool(row['is_encrypted'])
            ))
        
        return comments
    
    # Media operations
    def store_media_file(self, user_id: str, filename: str, file_path: str,
                        file_type: str, file_size: int, metadata: Dict = None) -> str:
        """Store media file information"""
        file_id = str(uuid.uuid4())
        current_time = time.time()
        metadata_json = json.dumps(metadata or {})
        
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO media_files 
            (file_id, user_id, filename, file_path, file_type, file_size, 
             is_encrypted, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        ''', (file_id, user_id, filename, file_path, file_type, file_size, 
              current_time, metadata_json))
        
        self.connection.commit()
        return file_id
    
    def get_media_file(self, file_id: str) -> Optional[MediaFile]:
        """Get media file by ID"""
        cursor = self.connection.cursor()
        cursor.execute('SELECT * FROM media_files WHERE file_id = ?', (file_id,))
        row = cursor.fetchone()
        
        if row:
            return MediaFile(
                file_id=row['file_id'],
                user_id=row['user_id'],
                filename=row['filename'],
                file_path=row['file_path'],
                file_type=row['file_type'],
                file_size=row['file_size'],
                is_encrypted=bool(row['is_encrypted']),
                created_at=row['created_at'],
                metadata=json.loads(row['metadata'] or '{}')
            )
        return None
    
    # Utility methods
    def get_database_stats(self) -> Dict[str, int]:
        """Get database statistics"""
        cursor = self.connection.cursor()
        stats = {}
        
        tables = ['users', 'posts', 'connections', 'comments', 'media_files']
        for table in tables:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            stats[table] = cursor.fetchone()[0]
        
        return stats
    
    def vacuum_database(self):
        """Optimize database storage"""
        self.connection.execute('VACUUM')
        self.connection.commit()
