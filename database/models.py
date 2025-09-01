from dataclasses import dataclass
from typing import List, Dict, Optional, Any
import time
import json

@dataclass
class User:
    user_id: str
    name: str
    bio: str
    public_key: str
    private_key_encrypted: str
    created_at: float
    updated_at: float
    preferences: Dict[str, Any]

@dataclass
class Post:
    post_id: str
    user_id: str
    content: str
    media_urls: List[str]
    privacy_level: str  # 'public', 'friends', 'private'
    created_at: float
    updated_at: float
    metadata: Dict[str, Any]

@dataclass
class Connection:
    connection_id: str
    user_id: str
    peer_user_id: str
    peer_public_key: str
    connection_status: str  # 'pending', 'accepted', 'blocked'
    permissions: Dict[str, bool]  # {'view': True, 'comment': True, 'share': False}
    created_at: float
    updated_at: float

@dataclass
class Comment:
    comment_id: str
    post_id: str
    author_id: str
    content: str
    created_at: float
    is_encrypted: bool

@dataclass
class MediaFile:
    file_id: str
    user_id: str
    filename: str
    file_path: str
    file_type: str
    file_size: int
    is_encrypted: bool
    created_at: float
    metadata: Dict[str, Any]
