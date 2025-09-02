#!/usr/bin/env python3
"""
File handling utilities for Decentralized Social Media Platform
"""

import os
import shutil
import hashlib
import mimetypes
import tempfile
import json
import time
import zipfile
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Union
import uuid

class SafeFileHandler:
    """Safe file operations with sandboxing"""
    
    def __init__(self, base_path: Union[str, Path]):
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _validate_path(self, path: Union[str, Path]) -> Path:
        """Validate that path is within sandbox"""
        full_path = (self.base_path / path).resolve()
        
        # Ensure path is within base directory (prevent directory traversal)
        if not str(full_path).startswith(str(self.base_path)):
            raise ValueError(f"Path outside sandbox: {path}")
        
        return full_path
    
    def read_file(self, path: str, encoding: str = 'utf-8') -> str:
        """Safely read text file"""
        safe_path = self._validate_path(path)
        
        if not safe_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        with open(safe_path, 'r', encoding=encoding) as f:
            return f.read()
    
    def read_binary_file(self, path: str) -> bytes:
        """Safely read binary file"""
        safe_path = self._validate_path(path)
        
        if not safe_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        with open(safe_path, 'rb') as f:
            return f.read()
    
    def write_file(self, path: str, content: str, encoding: str = 'utf-8') -> bool:
        """Safely write text file"""
        try:
            safe_path = self._validate_path(path)
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(safe_path, 'w', encoding=encoding) as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"Error writing file {path}: {e}")
            return False
    
    def write_binary_file(self, path: str, content: bytes) -> bool:
        """Safely write binary file"""
        try:
            safe_path = self._validate_path(path)
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(safe_path, 'wb') as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"Error writing binary file {path}: {e}")
            return False
    
    def delete_file(self, path: str) -> bool:
        """Safely delete file"""
        try:
            safe_path = self._validate_path(path)
            if safe_path.exists():
                safe_path.unlink()
                return True
            return False
        except Exception as e:
            print(f"Error deleting file {path}: {e}")
            return False
    
    def list_files(self, directory: str = "", pattern: str = "*") -> List[str]:
        """List files in directory with optional pattern"""
        try:
            safe_dir = self._validate_path(directory)
            if not safe_dir.is_dir():
                return []
            
            files = []
            for file_path in safe_dir.glob(pattern):
                if file_path.is_file():
                    # Return relative path from base
                    rel_path = file_path.relative_to(self.base_path)
                    files.append(str(rel_path))
            
            return sorted(files)
        except Exception as e:
            print(f"Error listing files in {directory}: {e}")
            return []
    
    def get_file_info(self, path: str) -> Optional[Dict]:
        """Get file information"""
        try:
            safe_path = self._validate_path(path)
            if not safe_path.exists():
                return None
            
            stat = safe_path.stat()
            
            return {
                'path': str(path),
                'size': stat.st_size,
                'created': stat.st_ctime,
                'modified': stat.st_mtime,
                'is_file': safe_path.is_file(),
                'is_dir': safe_path.is_dir(),
                'mime_type': mimetypes.guess_type(str(safe_path))[0]
            }
        except Exception as e:
            print(f"Error getting file info for {path}: {e}")
            return None

class MediaFileManager:
    """Manage media files (images, videos, etc.)"""
    
    ALLOWED_EXTENSIONS = {
        'image': {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'},
        'video': {'.mp4', '.webm', '.ogg', '.mov', '.avi'},
        'audio': {'.mp3', '.wav', '.ogg', '.m4a', '.flac'},
        'document': {'.pdf', '.txt', '.md', '.doc', '.docx'}
    }
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB default
    
    def __init__(self, media_path: Union[str, Path], max_size: int = None):
        self.media_path = Path(media_path)
        self.media_path.mkdir(parents=True, exist_ok=True)
        self.max_size = max_size or self.MAX_FILE_SIZE
        self.file_handler = SafeFileHandler(self.media_path)
    
    def is_allowed_file(self, filename: str) -> bool:
        """Check if file type is allowed"""
        ext = Path(filename).suffix.lower()
        all_extensions = set()
        for extensions in self.ALLOWED_EXTENSIONS.values():
            all_extensions.update(extensions)
        return ext in all_extensions
    
    def get_file_category(self, filename: str) -> Optional[str]:
        """Get file category (image, video, audio, document)"""
        ext = Path(filename).suffix.lower()
        for category, extensions in self.ALLOWED_EXTENSIONS.items():
            if ext in extensions:
                return category
        return None
    
    def store_file(self, file_data: bytes, filename: str, user_id: str) -> Optional[Dict]:
        """Store uploaded file and return file info"""
        if not self.is_allowed_file(filename):
            return None
        
        if len(file_data) > self.max_size:
            return None
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        extension = Path(filename).suffix
        stored_filename = f"{file_id}{extension}"
        
        # Create user subdirectory
        user_dir = f"user_{user_id}"
        file_path = f"{user_dir}/{stored_filename}"
        
        # Store file
        if not self.file_handler.write_binary_file(file_path, file_data):
            return None
        
        # Calculate hash
        file_hash = hashlib.sha256(file_data).hexdigest()
        
        return {
            'file_id': file_id,
            'original_name': filename,
            'stored_path': file_path,
            'size': len(file_data),
            'hash': file_hash,
            'category': self.get_file_category(filename),
            'mime_type': mimetypes.guess_type(filename)[0],
            'uploaded_at': time.time()
        }
    
    def get_file(self, file_path: str) -> Optional[bytes]:
        """Retrieve file data"""
        return self.file_handler.read_binary_file(file_path)
    
    def delete_file(self, file_path: str) -> bool:
        """Delete stored file"""
        return self.file_handler.delete_file(file_path)
    
    def get_user_files(self, user_id: str) -> List[str]:
        """Get all files for a user"""
        user_dir = f"user_{user_id}"
        return self.file_handler.list_files(user_dir)

class BackupManager:
    """Manage data backups"""
    
    def __init__(self, data_path: Union[str, Path], backup_path: Union[str, Path]):
        self.data_path = Path(data_path)
        self.backup_path = Path(backup_path)
        self.backup_path.mkdir(parents=True, exist_ok=True)
    
    def create_backup(self, name: str = None) -> Optional[str]:
        """Create a backup archive"""
        if name is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            name = f"backup_{timestamp}"
        
        backup_file = self.backup_path / f"{name}.zip"
        
        try:
            with zipfile.ZipFile(backup_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in self.data_path.rglob('*'):
                    if file_path.is_file():
                        # Calculate relative path
                        rel_path = file_path.relative_to(self.data_path)
                        zipf.write(file_path, rel_path)
            
            return str(backup_file)
        except Exception as e:
            print(f"Backup creation failed: {e}")
            return None
    
    def restore_backup(self, backup_file: str) -> bool:
        """Restore from backup archive"""
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                return False
            
            # Create temporary extraction directory
            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(backup_path, 'r') as zipf:
                    zipf.extractall(temp_dir)
                
                # Move extracted files to data directory
                temp_path = Path(temp_dir)
                for file_path in temp_path.rglob('*'):
                    if file_path.is_file():
                        rel_path = file_path.relative_to(temp_path)
                        dest_path = self.data_path / rel_path
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(file_path, dest_path)
            
            return True
        except Exception as e:
            print(f"Backup restoration failed: {e}")
            return False
    
    def list_backups(self) -> List[Dict]:
        """List available backups"""
        backups = []
        
        for backup_file in self.backup_path.glob("*.zip"):
            stat = backup_file.stat()
            backups.append({
                'name': backup_file.stem,
                'file': str(backup_file),
                'size': stat.st_size,
                'created': stat.st_ctime,
                'created_str': time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_ctime))
            })
        
        return sorted(backups, key=lambda x: x['created'], reverse=True)
    
    def cleanup_old_backups(self, max_backups: int = 10):
        """Keep only the most recent backups"""
        backups = self.list_backups()
        
        if len(backups) <= max_backups:
            return
        
        # Remove oldest backups
        for backup in backups[max_backups:]:
            try:
                Path(backup['file']).unlink()
                print(f"Removed old backup: {backup['name']}")
            except Exception as e:
                print(f"Error removing backup {backup['name']}: {e}")

class TempFileManager:
    """Manage temporary files with automatic cleanup"""
    
    def __init__(self, temp_dir: Union[str, Path] = None):
        if temp_dir:
            self.temp_dir = Path(temp_dir)
            self.temp_dir.mkdir(parents=True, exist_ok=True)
        else:
            self.temp_dir = Path(tempfile.gettempdir()) / "dsm_temp"
            self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        self.temp_files = set()
    
    def create_temp_file(self, content: Union[str, bytes], 
                        suffix: str = ".tmp", prefix: str = "dsm_") -> str:
        """Create temporary file with content"""
        temp_path = self.temp_dir / f"{prefix}{uuid.uuid4()}{suffix}"
        
        if isinstance(content, str):
            temp_path.write_text(content, encoding='utf-8')
        else:
            temp_path.write_bytes(content)
        
        self.temp_files.add(temp_path)
        return str(temp_path)
    
    def cleanup(self):
        """Clean up all temporary files"""
        for temp_file in self.temp_files.copy():
            try:
                if temp_file.exists():
                    temp_file.unlink()
                self.temp_files.remove(temp_file)
            except Exception as e:
                print(f"Error cleaning up temp file {temp_file}: {e}")
    
    def cleanup_old_files(self, max_age_hours: int = 24):
        """Clean up old temporary files"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        for temp_file in self.temp_dir.glob("dsm_*"):
            try:
                if temp_file.stat().st_mtime < cutoff_time:
                    temp_file.unlink()
                    if temp_file in self.temp_files:
                        self.temp_files.remove(temp_file)
            except Exception:
                continue
    
    def __del__(self):
        """Cleanup on destruction"""
        self.cleanup()

class ConfigFileManager:
    """Manage configuration files"""
    
    @staticmethod
    def load_json_config(file_path: Union[str, Path]) -> Dict:
        """Load JSON configuration file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading config from {file_path}: {e}")
            return {}
    
    @staticmethod
    def save_json_config(file_path: Union[str, Path], config: Dict) -> bool:
        """Save configuration to JSON file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, sort_keys=True)
            return True
        except Exception as e:
            print(f"Error saving config to {file_path}: {e}")
            return False
    
    @staticmethod
    def merge_configs(base_config: Dict, override_config: Dict) -> Dict:
        """Merge two configuration dictionaries"""
        merged = base_config.copy()
        merged.update(override_config)
        return merged

# Utility functions
def calculate_directory_size(directory: Union[str, Path]) -> int:
    """Calculate total size of directory"""
    total_size = 0
    dir_path = Path(directory)
    
    for file_path in dir_path.rglob('*'):
        if file_path.is_file():
            total_size += file_path.stat().st_size
    
    return total_size

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    
    return f"{s} {size_names[i]}"

def get_file_hash(file_path: Union[str, Path], algorithm: str = 'sha256') -> str:
    """Calculate file hash"""
    hash_obj = hashlib.new(algorithm)
    
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_obj.update(chunk)
    
    return hash_obj.hexdigest()

if __name__ == "__main__":
    # Test file utilities
    print("Testing file utilities...")
    
    # Test safe file handler
    with tempfile.TemporaryDirectory() as temp_dir:
        handler = SafeFileHandler(temp_dir)
        
        # Test writing and reading
        test_content = "Hello, World!"
        success = handler.write_file("test.txt", test_content)
        print(f"✓ File write: {success}")
        
        read_content = handler.read_file("test.txt")
        print(f"✓ File read: {read_content == test_content}")
        
        # Test file listing
        files = handler.list_files()
        print(f"✓ File listing: {len(files)} files found")
        
        # Test media manager
        media_manager = MediaFileManager(Path(temp_dir) / "media")
        test_image = b"fake_image_data"
        file_info = media_manager.store_file(test_image, "test.jpg", "user123")
        print(f"✓ Media storage: {file_info is not None}")
        
        # Test backup manager
        backup_manager = BackupManager(temp_dir, Path(temp_dir) / "backups")
        backup_file = backup_manager.create_backup()
        print(f"✓ Backup creation: {backup_file is not None}")
    
    print("File utilities tested successfully!")
