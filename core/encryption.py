from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
import base64

class EncryptionEngine:
    def __init__(self, password: str = None):
        if password:
            self.key = self._derive_key(password)
        else:
            self.key = Fernet.generate_key()
        self.cipher = Fernet(self.key)
    
    def _derive_key(self, password: str, salt: bytes = None) -> bytes:
        if salt is None:
            salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key
    
    def encrypt_data(self, data: bytes) -> bytes:
        return self.cipher.encrypt(data)
    
    def decrypt_data(self, encrypted_data: bytes) -> bytes:
        return self.cipher.decrypt(encrypted_data)
    
    def encrypt_file(self, filepath: str) -> str:
        with open(filepath, 'rb') as file:
            data = file.read()
        encrypted_data = self.encrypt_data(data)
        encrypted_filepath = f"{filepath}.encrypted"
        with open(encrypted_filepath, 'wb') as file:
            file.write(encrypted_data)
        return encrypted_filepath
