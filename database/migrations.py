#!/usr/bin/env python3
"""
Database migration system for Decentralized Social Media Platform
"""

import sqlite3
import time
import json
from typing import List, Dict, Callable
from pathlib import Path

class DatabaseMigrator:
    """Handle database schema migrations"""
    
    def __init__(self, db_connection: sqlite3.Connection):
        self.connection = db_connection
        self.migrations = []
        self._init_migrations_table()
        self._register_migrations()
    
    def _init_migrations_table(self):
        """Create migrations tracking table"""
        cursor = self.connection.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at REAL NOT NULL,
                checksum TEXT
            )
        ''')
        self.connection.commit()
    
    def _register_migrations(self):
        """Register all available migrations"""
        # Migration 001: Initial schema (already handled by LocalDatabase)
        self.migrations.append({
            'version': 1,
            'name': 'initial_schema',
            'description': 'Create initial database schema',
            'up': self._migration_001_up,
            'down': self._migration_001_down,
            'checksum': 'abc123'
        })
        
        # Migration 002: Add indexes for performance
        self.migrations.append({
            'version': 2,
            'name': 'add_performance_indexes',
            'description': 'Add database indexes for better performance',
            'up': self._migration_002_up,
            'down': self._migration_002_down,
            'checksum': 'def456'
        })
        
        # Migration 003: Add user preferences and settings
        self.migrations.append({
            'version': 3,
            'name': 'enhance_user_settings',
            'description': 'Add enhanced user settings and preferences',
            'up': self._migration_003_up,
            'down': self._migration_003_down,
            'checksum': 'ghi789'
        })
        
        # Migration 004: Add post reactions and engagement
        self.migrations.append({
            'version': 4,
            'name': 'add_post_reactions',
            'description': 'Add post reactions and engagement tracking',
            'up': self._migration_004_up,
            'down': self._migration_004_down,
            'checksum': 'jkl012'
        })
    
    def get_current_version(self) -> int:
        """Get current database schema version"""
        cursor = self.connection.cursor()
        cursor.execute('SELECT MAX(version) FROM schema_migrations')
        result = cursor.fetchone()
        return result[0] if result[0] is not None else 0
    
    def get_applied_migrations(self) -> List[Dict]:
        """Get list of applied migrations"""
        cursor = self.connection.cursor()
        cursor.execute('''
            SELECT version, name, applied_at, checksum 
            FROM schema_migrations 
            ORDER BY version
        ''')
        
        migrations = []
        for row in cursor.fetchall():
            migrations.append({
                'version': row[0],
                'name': row[1],
                'applied_at': row[2],
                'checksum': row[3]
            })
        
        return migrations
    
    def migrate_to_latest(self) -> bool:
        """Apply all pending migrations"""
        current_version = self.get_current_version()
        target_version = max(m['version'] for m in self.migrations)
        
        if current_version >= target_version:
            print(f"Database already at latest version ({current_version})")
            return True
        
        print(f"Migrating database from version {current_version} to {target_version}")
        
        # Apply pending migrations
        for migration in self.migrations:
            if migration['version'] > current_version:
                if not self._apply_migration(migration):
                    print(f"Migration {migration['version']} failed!")
                    return False
        
        print("Database migration completed successfully")
        return True
    
    def migrate_to_version(self, target_version: int) -> bool:
        """Migrate to specific version"""
        current_version = self.get_current_version()
        
        if current_version == target_version:
            print(f"Database already at version {target_version}")
            return True
        
        if target_version > current_version:
            # Migrate up
            for migration in self.migrations:
                if current_version < migration['version'] <= target_version:
                    if not self._apply_migration(migration):
                        return False
        else:
            # Migrate down
            applied_migrations = self.get_applied_migrations()
            for migration_info in reversed(applied_migrations):
                if migration_info['version'] > target_version:
                    migration = next(
                        (m for m in self.migrations if m['version'] == migration_info['version']), 
                        None
                    )
                    if migration and not self._rollback_migration(migration):
                        return False
        
        return True
    
    def _apply_migration(self, migration: Dict) -> bool:
        """Apply a single migration"""
        print(f"Applying migration {migration['version']}: {migration['name']}")
        
        try:
            # Execute the migration
            migration['up'](self.connection)
            
            # Record the migration
            cursor = self.connection.cursor()
            cursor.execute('''
                INSERT INTO schema_migrations (version, name, applied_at, checksum)
                VALUES (?, ?, ?, ?)
            ''', (
                migration['version'],
                migration['name'],
                time.time(),
                migration['checksum']
            ))
            
            self.connection.commit()
            print(f"✓ Migration {migration['version']} applied successfully")
            return True
            
        except Exception as e:
            print(f"✗ Migration {migration['version']} failed: {e}")
            self.connection.rollback()
            return False
    
    def _rollback_migration(self, migration: Dict) -> bool:
        """Rollback a single migration"""
        print(f"Rolling back migration {migration['version']}: {migration['name']}")
        
        try:
            # Execute the rollback
            migration['down'](self.connection)
            
            # Remove migration record
            cursor = self.connection.cursor()
            cursor.execute('''
                DELETE FROM schema_migrations WHERE version = ?
            ''', (migration['version'],))
            
            self.connection.commit()
            print(f"✓ Migration {migration['version']} rolled back successfully")
            return True
            
        except Exception as e:
            print(f"✗ Migration {migration['version']} rollback failed: {e}")
            self.connection.rollback()
            return False
    
    # Migration implementations
    def _migration_001_up(self, conn: sqlite3.Connection):
        """Initial schema - handled by LocalDatabase.__init__"""
        # This migration is automatically applied by LocalDatabase
        # Just ensure the tables exist
        cursor = conn.cursor()
        
        # Verify core tables exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('users', 'posts', 'connections', 'comments', 'media_files')
        """)
        
        existing_tables = {row[0] for row in cursor.fetchall()}
        expected_tables = {'users', 'posts', 'connections', 'comments', 'media_files'}
        
        if not expected_tables.issubset(existing_tables):
            raise Exception("Core tables not found - database initialization may have failed")
    
    def _migration_001_down(self, conn: sqlite3.Connection):
        """Drop all tables"""
        cursor = conn.cursor()
        tables = ['media_files', 'comments', 'connections', 'posts', 'users']
        
        for table in tables:
            cursor.execute(f'DROP TABLE IF EXISTS {table}')
    
    def _migration_002_up(self, conn: sqlite3.Connection):
        """Add performance indexes"""
        cursor = conn.cursor()
        
        # Additional indexes for better query performance
        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_posts_privacy_created ON posts (privacy_level, created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_connections_status ON connections (connection_status)',
            'CREATE INDEX IF NOT EXISTS idx_media_files_user_type ON media_files (user_id, file_type)',
            'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC)'
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
    
    def _migration_002_down(self, conn: sqlite3.Connection):
        """Drop performance indexes"""
        cursor = conn.cursor()
        
        indexes = [
            'DROP INDEX IF EXISTS idx_posts_privacy_created',
            'DROP INDEX IF EXISTS idx_comments_created_at', 
            'DROP INDEX IF EXISTS idx_connections_status',
            'DROP INDEX IF EXISTS idx_media_files_user_type',
            'DROP INDEX IF EXISTS idx_users_created_at'
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
    
    def _migration_003_up(self, conn: sqlite3.Connection):
        """Add enhanced user settings"""
        cursor = conn.cursor()
        
        # Add new columns to users table
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN theme TEXT DEFAULT "light"')
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN language TEXT DEFAULT "en"')
        except sqlite3.OperationalError:
            pass
        
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT "UTC"')
        except sqlite3.OperationalError:
            pass
        
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN notification_settings TEXT DEFAULT "{}"')
        except sqlite3.OperationalError:
            pass
    
    def _migration_003_down(self, conn: sqlite3.Connection):
        """Remove enhanced user settings"""
        # SQLite doesn't support dropping columns easily
        # In a real system, we'd recreate the table without these columns
        # For now, we'll leave them as they don't break anything
        pass
    
    def _migration_004_up(self, conn: sqlite3.Connection):
        """Add post reactions and engagement"""
        cursor = conn.cursor()
        
        # Create reactions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_reactions (
                reaction_id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reaction_type TEXT NOT NULL,
                created_at REAL NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
                UNIQUE(post_id, user_id, reaction_type)
            )
        ''')
        
        # Create engagement tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_engagement (
                post_id TEXT PRIMARY KEY,
                view_count INTEGER DEFAULT 0,
                like_count INTEGER DEFAULT 0,
                comment_count INTEGER DEFAULT 0,
                share_count INTEGER DEFAULT 0,
                updated_at REAL NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE
            )
        ''')
        
        # Add indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions (post_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reactions_user ON post_reactions (user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_engagement_updated ON post_engagement (updated_at)')
    
    def _migration_004_down(self, conn: sqlite3.Connection):
        """Remove post reactions and engagement"""
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS post_reactions')
        cursor.execute('DROP TABLE IF EXISTS post_engagement')
    
    def status(self) -> Dict:
        """Get migration status"""
        current_version = self.get_current_version()
        applied_migrations = self.get_applied_migrations()
        total_migrations = len(self.migrations)
        
        pending_migrations = [
            m for m in self.migrations 
            if m['version'] > current_version
        ]
        
        return {
            'current_version': current_version,
            'latest_version': max(m['version'] for m in self.migrations) if self.migrations else 0,
            'applied_count': len(applied_migrations),
            'total_count': total_migrations,
            'pending_count': len(pending_migrations),
            'applied_migrations': applied_migrations,
            'pending_migrations': pending_migrations
        }

def run_migrations(db_path: str, target_version: int = None) -> bool:
    """Run migrations on database"""
    try:
        conn = sqlite3.connect(db_path)
        migrator = DatabaseMigrator(conn)
        
        if target_version is None:
            success = migrator.migrate_to_latest()
        else:
            success = migrator.migrate_to_version(target_version)
        
        conn.close()
        return success
    
    except Exception as e:
        print(f"Migration error: {e}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Migration Tool')
    parser.add_argument('--db', required=True, help='Database file path')
    parser.add_argument('--version', type=int, help='Target version (default: latest)')
    parser.add_argument('--status', action='store_true', help='Show migration status')
    
    args = parser.parse_args()
    
    if args.status:
        conn = sqlite3.connect(args.db)
        migrator = DatabaseMigrator(conn)
        status = migrator.status()
        
        print(f"Current version: {status['current_version']}")
        print(f"Latest version:  {status['latest_version']}")
        print(f"Applied:         {status['applied_count']}/{status['total_count']}")
        print(f"Pending:         {status['pending_count']}")
        
        if status['pending_migrations']:
            print("\nPending migrations:")
            for migration in status['pending_migrations']:
                print(f"  {migration['version']:3d}: {migration['name']}")
        
        conn.close()
    else:
        success = run_migrations(args.db, args.version)
        exit(0 if success else 1)
