import os
import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List
from .encryption import EncryptionEngine

class SandboxedStorage:
    def __init__(self, base_path: str, encryption_engine: EncryptionEngine):
        self.base_path = Path(base_path)
        self.encryption = encryption_engine
        self._ensure_sandbox_structure()
    
    def _ensure_sandbox_structure(self):
        """Create isolated directory structure"""
        directories = [
            'user_data', 'media', 'posts', 'connections',
            'temp', 'cache', 'backups', 'keys'
        ]
        for directory in directories:
            (self.base_path / directory).mkdir(parents=True, exist_ok=True)
    
    def store_encrypted_data(self, category: str, filename: str, data: Dict[str, Any]) -> str:
        file_path = self.base_path / category / f"{filename}.enc"
        encrypted_data = self.encryption.encrypt_data(json.dumps(data).encode())
        with open(file_path, 'wb') as f:
            f.write(encrypted_data)
        return str(file_path)
    
    def retrieve_encrypted_data(self, category: str, filename: str) -> Dict[str, Any]:
        file_path = self.base_path / category / f"{filename}.enc"
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'rb') as f:
            encrypted_data = f.read()
        
        decrypted_data = self.encryption.decrypt_data(encrypted_data)
        return json.loads(decrypted_data.decode())
    
    def get_sandbox_path(self, category: str = "") -> Path:
        return self.base_path / category if category else self.base_path
