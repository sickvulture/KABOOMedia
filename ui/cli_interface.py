#!/usr/bin/env python3
"""
Command Line Interface for Decentralized Social Media Platform
"""

import sys
import os
import cmd
import json
import time
from pathlib import Path
from typing import List, Dict, Optional

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

class SocialCLI(cmd.Cmd):
    """Interactive CLI for the social media platform"""
    
    intro = '''
╔══════════════════════════════════════════════════════════╗
║           Decentralized Social Media Platform           ║
║                   Command Line Interface                ║
╚══════════════════════════════════════════════════════════╝

Type 'help' or '?' to list commands.
Type 'help <command>' for detailed information about a command.
    '''
    
    prompt = '(dsm) '
    
    def __init__(self):
        super().__init__()
        self.database = None
        self.web_interface = None
        self.current_user_id = None
        self.app = None
        self._initialize_app()
    
    def _initialize_app(self):
        """Initialize the application components"""
        try:
            from main import DecentralizedSocialApp
            self.app = DecentralizedSocialApp()
            self.app.initialize()
            self.database = self.app.database
            self.web_interface = self.app.web_interface
            self.current_user_id = self.web_interface.current_user_id
            
            if self.current_user_id:
                user = self.database.get_user(self.current_user_id)
                if user:
                    print(f"Welcome back, {user.name}!")
                else:
                    print("No active user found. Use 'create_user' to get started.")
            else:
                print("No active user found. Use 'create_user' to get started.")
                
        except Exception as e:
            print(f"Error initializing application: {e}")
            print("Some features may not be available.")
    
    def do_status(self, arg):
        """Show application status and statistics"""
        if not self.database:
            print("Database not available")
            return
        
        try:
            stats = self.database.get_database_stats()
            
            print("Application Status:")
            print("-" * 40)
            print(f"Users:       {stats['users']}")
            print(f"Posts:       {stats['posts']}")
            print(f"Comments:    {stats['comments']}")
            print(f"Connections: {stats['connections']}")
            print(f"Media files: {stats['media_files']}")
            
            if self.current_user_id:
                user = self.database.get_user(self.current_user_id)
                if user:
                    print(f"\nCurrent user: {user.name}")
                    user_posts = self.database.get_user_posts(self.current_user_id)
                    print(f"Your posts:   {len(user_posts)}")
                    
        except Exception as e:
            print(f"Error getting status: {e}")
    
    def do_create_user(self, arg):
        """Create a new user account
        Usage: create_user <name> [bio]
        Example: create_user "John Doe" "Software developer"
        """
        parts = self._parse_args(arg)
        if not parts:
            print("Usage: create_user <name> [bio]")
            return
        
        name = parts[0]
        bio = parts[1] if len(parts) > 1 else ""
        
        try:
            if not self.web_interface:
                print("Web interface not available")
                return
                
            user_id = self.web_interface.create_initial_user(name, bio)
            print(f"User created successfully: {name}")
            print(f"User ID: {user_id}")
            self.current_user_id = user_id
            
        except Exception as e:
            print(f"Error creating user: {e}")
    
    def do_profile(self, arg):
        """Show or update user profile
        Usage: 
        - profile                    (show current profile)
        - profile update <field> <value>  (update profile field)
        
        Available fields: name, bio
        """
        if not arg:
            self._show_profile()
        else:
            parts = arg.split(' ', 2)
            if len(parts) >= 3 and parts[0] == 'update':
                self._update_profile(parts[1], ' '.join(parts[2:]))
            else:
                print("Usage: profile [update <field> <value>]")
    
    def _show_profile(self):
        """Show current user profile"""
        if not self.current_user_id:
            print("No active user. Create a user first.")
            return
        
        try:
            user = self.database.get_user(self.current_user_id)
            if not user:
                print("User not found")
                return
            
            print("\nProfile Information:")
            print("-" * 30)
            print(f"Name: {user.name}")
            print(f"Bio:  {user.bio}")
            print(f"User ID: {user.user_id}")
            print(f"Created: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(user.created_at))}")
            
            # Get user stats
            posts = self.database.get_user_posts(self.current_user_id)
            connections = self.database.get_user_connections(self.current_user_id)
            
            print(f"\nStatistics:")
            print(f"Posts: {len(posts)}")
            print(f"Connections: {len(connections)}")
            
        except Exception as e:
            print(f"Error showing profile: {e}")
    
    def _update_profile(self, field: str, value: str):
        """Update profile field"""
        if field not in ['name', 'bio']:
            print("Available fields: name, bio")
            return
        
        try:
            success = self.database.update_user(self.current_user_id, **{field: value})
            if success:
                print(f"Profile {field} updated successfully")
            else:
                print(f"Failed to update {field}")
        except Exception as e:
            print(f"Error updating profile: {e}")
    
    def do_post(self, arg):
        """Create a new post
        Usage: post <content> [privacy_level]
        Privacy levels: public, friends, private (default: public)
        Example: post "Hello, world!" public
        """
        if not arg:
            print("Usage: post <content> [privacy_level]")
            return
        
        if not self.current_user_id:
            print("No active user. Create a user first.")
            return
        
        parts = self._parse_args(arg)
        content = parts[0]
        privacy_level = parts[1] if len(parts) > 1 else "public"
        
        if privacy_level not in ['public', 'friends', 'private']:
            print("Invalid privacy level. Use: public, friends, or private")
            return
        
        try:
            post_id = self.database.create_post(
                user_id=self.current_user_id,
                content=content,
                privacy_level=privacy_level
            )
            print(f"Post created successfully!")
            print(f"Post ID: {post_id}")
            
        except Exception as e:
            print(f"Error creating post: {e}")
    
    def do_posts(self, arg):
        """List posts
        Usage: 
        - posts              (show public posts)
        - posts mine         (show your posts)
        - posts <user_id>    (show posts by user)
        """
        try:
            if not arg or arg == "public":
                posts = self.database.get_public_posts(limit=20)
                title = "Public Posts"
            elif arg == "mine":
                if not self.current_user_id:
                    print("No active user")
                    return
                posts = self.database.get_user_posts(self.current_user_id, limit=20)
                title = "Your Posts"
            else:
                posts = self.database.get_user_posts(arg, limit=20)
                title = f"Posts by {arg}"
            
            print(f"\n{title}:")
            print("=" * 50)
            
            if not posts:
                print("No posts found")
                return
            
            for post in posts:
                user = self.database.get_user(post.user_id)
                author_name = user.name if user else "Unknown"
                
                print(f"\n[{post.post_id[:8]}] by {author_name}")
                print(f"Created: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(post.created_at))}")
                print(f"Privacy: {post.privacy_level}")
                print(f"Content: {post.content}")
                
                # Show comments
                comments = self.database.get_post_comments(post.post_id)
                if comments:
                    print(f"Comments ({len(comments)}):")
                    for comment in comments[:3]:  # Show first 3 comments
                        comment_author = self.database.get_user(comment.author_id)
                        author_name = comment_author.name if comment_author else "Unknown"
                        print(f"  - {author_name}: {comment.content}")
                print("-" * 50)
                
        except Exception as e:
            print(f"Error listing posts: {e}")
    
    def do_comment(self, arg):
        """Add a comment to a post
        Usage: comment <post_id> <comment_text>
        """
        parts = self._parse_args(arg, 2)
        if len(parts) < 2:
            print("Usage: comment <post_id> <comment_text>")
            return
        
        if not self.current_user_id:
            print("No active user. Create a user first.")
            return
        
        post_id = parts[0]
        comment_text = parts[1]
        
        try:
            # Check if post exists
            post = self.database.get_post(post_id)
            if not post:
                print("Post not found")
                return
            
            comment_id = self.database.create_comment(
                post_id=post_id,
                author_id=self.current_user_id,
                content=comment_text
            )
            print(f"Comment added successfully!")
            print(f"Comment ID: {comment_id}")
            
        except Exception as e:
            print(f"Error adding comment: {e}")
    
    def do_connections(self, arg):
        """Manage connections
        Usage:
        - connections                    (list connections)
        - connections add <user_id>      (send connection request)
        - connections accept <conn_id>   (accept connection)
        - connections block <conn_id>    (block connection)
        """
        if not self.current_user_id:
            print("No active user. Create a user first.")
            return
        
        if not arg:
            self._list_connections()
        else:
            parts = arg.split(' ', 1)
            command = parts[0]
            param = parts[1] if len(parts) > 1 else None
            
            if command == "add" and param:
                self._add_connection(param)
            elif command in ["accept", "block"] and param:
                status = "accepted" if command == "accept" else "blocked"
                self._update_connection(param, status)
            else:
                print("Usage: connections [add <user_id> | accept <conn_id> | block <conn_id>]")
    
    def _list_connections(self):
        """List user connections"""
        try:
            connections = self.database.get_user_connections(self.current_user_id)
            
            if not connections:
                print("No connections found")
                return
            
            print("\nConnections:")
            print("-" * 40)
            
            for conn in connections:
                peer_user = self.database.get_user(conn.peer_user_id)
                peer_name = peer_user.name if peer_user else "Unknown"
                
                print(f"ID: {conn.connection_id[:8]}")
                print(f"Peer: {peer_name} ({conn.peer_user_id[:8]})")
                print(f"Status: {conn.connection_status}")
                print(f"Created: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(conn.created_at))}")
                print("-" * 40)
                
        except Exception as e:
            print(f"Error listing connections: {e}")
    
    def _add_connection(self, user_id: str):
        """Add a new connection"""
        try:
            # Check if user exists
            user = self.database.get_user(user_id)
            if not user:
                print("User not found")
                return
            
            conn_id = self.database.create_connection(
                user_id=self.current_user_id,
                peer_user_id=user_id
            )
            print(f"Connection request sent to {user.name}")
            print(f"Connection ID: {conn_id}")
            
        except Exception as e:
            print(f"Error adding connection: {e}")
    
    def _update_connection(self, conn_id: str, status: str):
        """Update connection status"""
        try:
            success = self.database.update_connection_status(conn_id, status)
            if success:
                print(f"Connection {status} successfully")
            else:
                print("Connection not found or not updated")
                
        except Exception as e:
            print(f"Error updating connection: {e}")
    
    def do_server(self, arg):
        """Server management commands
        Usage:
        - server start    (start web server)
        - server stop     (stop web server)
        - server status   (show server status)
        - server addresses (show server addresses)
        """
        if not arg:
            print("Usage: server [start|stop|status|addresses]")
            return
        
        if not self.app:
            print("Application not available")
            return
        
        try:
            if arg == "start":
                if hasattr(self.app, 'web_server') and self.app.web_server:
                    print("Starting server...")
                    self.app.start()
                else:
                    print("Server not available")
            elif arg == "stop":
                if hasattr(self.app, 'web_server') and self.app.web_server:
                    print("Stopping server...")
                    self.app.stop()
                else:
                    print("Server not running")
            elif arg == "status":
                if hasattr(self.app, 'web_server') and self.app.web_server:
                    print(f"Web server port: {self.app.web_server.port}")
                    print(f"P2P node port: {self.app.p2p_node.port}")
                else:
                    print("Server not initialized")
            elif arg == "addresses":
                if hasattr(self.app, 'address_manager'):
                    addresses = self.app.address_manager.update_current_addresses()
                    print("\nServer Addresses:")
                    print("-" * 30)
                    for addr in addresses:
                        print(f"- {addr['url']}")
                else:
                    print("Address manager not available")
            else:
                print("Unknown server command")
                
        except Exception as e:
            print(f"Server command error: {e}")
    
    def do_backup(self, arg):
        """Create or restore backups
        Usage:
        - backup create [name]    (create backup)
        - backup list            (list backups)
        - backup restore <file>  (restore from backup)
        """
        parts = arg.split(' ', 1) if arg else ['list']
        command = parts[0]
        param = parts[1] if len(parts) > 1 else None
        
        try:
            from utils.file_utils import BackupManager
            
            data_path = self.app.config.get('storage_path', './user_data')
            backup_path = Path(data_path) / 'backups'
            backup_manager = BackupManager(data_path, backup_path)
            
            if command == "create":
                backup_file = backup_manager.create_backup(param)
                if backup_file:
                    print(f"Backup created: {backup_file}")
                else:
                    print("Backup creation failed")
                    
            elif command == "list":
                backups = backup_manager.list_backups()
                if backups:
                    print("\nAvailable Backups:")
                    print("-" * 50)
                    for backup in backups:
                        size_mb = backup['size'] / (1024 * 1024)
                        print(f"{backup['name']:20} {backup['created_str']:20} {size_mb:.1f}MB")
                else:
                    print("No backups found")
                    
            elif command == "restore" and param:
                success = backup_manager.restore_backup(param)
                if success:
                    print(f"Backup restored successfully")
                    print("Restart the application to see changes")
                else:
                    print("Backup restoration failed")
            else:
                print("Usage: backup [create [name] | list | restore <file>]")
                
        except Exception as e:
            print(f"Backup error: {e}")
    
    def do_quit(self, arg):
        """Exit the CLI"""
        print("Goodbye!")
        if self.app:
            try:
                self.app.stop()
            except:
                pass
        return True
    
    def do_exit(self, arg):
        """Exit the CLI"""
        return self.do_quit(arg)
    
    def _parse_args(self, arg: str, max_parts: int = None) -> List[str]:
        """Parse command arguments, handling quoted strings"""
        if not arg:
            return []
        
        parts = []
        current = ""
        in_quotes = False
        quote_char = None
        
        for char in arg:
            if char in ['"', "'"] and not in_quotes:
                in_quotes = True
                quote_char = char
            elif char == quote_char and in_quotes:
                in_quotes = False
                quote_char = None
            elif char == ' ' and not in_quotes:
                if current:
                    parts.append(current)
                    current = ""
                if max_parts and len(parts) >= max_parts - 1:
                    # Rest goes to the last part
                    current = arg[arg.index(char):].strip()
                    break
            else:
                current += char
        
        if current:
            parts.append(current)
        
        return parts
    
    def emptyline(self):
        """Handle empty line"""
        pass
    
    def default(self, line):
        """Handle unknown commands"""
        print(f"Unknown command: {line}")
        print("Type 'help' for available commands")

def main():
    """Main CLI function"""
    try:
        cli = SocialCLI()
        cli.cmdloop()
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"CLI Error: {e}")

if __name__ == "__main__":
    main()
