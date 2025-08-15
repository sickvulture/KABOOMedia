import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './NetworkDetailPage.css';

const NetworkDetailPage = () => {
  const { networkId } = useParams();
  const [network, setNetwork] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [files, setFiles] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Simulate loading network data
    setNetwork({
      id: networkId,
      name: 'Family Photos',
      description: 'Private network for family memories',
      memberCount: 5,
      status: 'active',
      isOwner: true,
      createdDate: new Date(Date.now() - 30 * 86400000), // 30 days ago
      networkCode: 'ABC123XYZ'
    });

    setMembers([
      { id: 1, name: 'You', role: 'Owner', status: 'online', joinDate: new Date() },
      { id: 2, name: 'Alice Smith', role: 'Member', status: 'online', joinDate: new Date() },
      { id: 3, name: 'Bob Johnson', role: 'Member', status: 'offline', joinDate: new Date() },
      { id: 4, name: 'Carol Davis', role: 'Moderator', status: 'online', joinDate: new Date() },
      { id: 5, name: 'Dave Wilson', role: 'Member', status: 'offline', joinDate: new Date() }
    ]);

    setFiles([
      { id: 1, name: 'vacation_2024.zip', size: '245 MB', type: 'archive', sharedBy: 'You', date: new Date() },
      { id: 2, name: 'birthday_party.mp4', size: '1.2 GB', type: 'video', sharedBy: 'Alice Smith', date: new Date() },
      { id: 3, name: 'family_recipes.pdf', size: '2.3 MB', type: 'document', sharedBy: 'Carol Davis', date: new Date() }
    ]);

    setPosts([
      { id: 1, author: 'Alice Smith', content: 'Great photos from the vacation!', timestamp: new Date(), likes: 3 },
      { id: 2, author: 'You', content: 'Added new family photos from last weekend', timestamp: new Date(), likes: 5 },
      { id: 3, author: 'Carol Davis', content: 'Thanks for sharing the recipes everyone!', timestamp: new Date(), likes: 2 }
    ]);
  }, [networkId]);

  const getFileIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'archive': return '📦';
      case 'document': return '📄';
      default: return '📁';
    }
  };

  const getStatusColor = (status) => {
    return status === 'online' ? '#10b981' : '#6b7280';
  };

  if (!network) {
    return <div className="loading">Loading network details...</div>;
  }

  return (
    <div className="network-detail-page">
      <div className="network-header">
        <div className="network-info">
          <h1>{network.name}</h1>
          <p>{network.description}</p>
          <div className="network-meta">
            <span>{network.memberCount} members</span>
            <span>•</span>
            <span>Created {network.createdDate.toLocaleDateString()}</span>
            <span>•</span>
            <span className={`status ${network.status}`}>{network.status}</span>
          </div>
        </div>
        <div className="network-actions">
          <button className="btn-secondary">Share Network</button>
          {network.isOwner && (
            <button className="btn-primary">Settings</button>
          )}
        </div>
      </div>

      <div className="network-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        <button 
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button 
          className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-grid">
              <div className="network-stats">
                <h3>Network Statistics</h3>
                <div className="stats-list">
                  <div className="stat-item">
                    <span className="stat-label">Total Files:</span>
                    <span className="stat-value">{files.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Active Members:</span>
                    <span className="stat-value">{members.filter(m => m.status === 'online').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Network Code:</span>
                    <span className="stat-value">{network.networkCode}</span>
                  </div>
                </div>
              </div>
              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">Alice uploaded birthday_party.mp4</div>
                  <div className="activity-item">Carol shared family_recipes.pdf</div>
                  <div className="activity-item">Bob joined the network</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="members-tab">
            <div className="members-header">
              <h3>Network Members ({members.length})</h3>
              {network.isOwner && (
                <button className="btn-primary">Invite Member</button>
              )}
            </div>
            <div className="members-list">
              {members.map(member => (
                <div key={member.id} className="member-item">
                  <div className="member-info">
                    <div className="member-name">{member.name}</div>
                    <div className="member-role">{member.role}</div>
                  </div>
                  <div className="member-status">
                    <div 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(member.status) }}
                    />
                    <span>{member.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-tab">
            <div className="files-header">
              <h3>Shared Files ({files.length})</h3>
              <button className="btn-primary">Upload File</button>
            </div>
            <div className="files-list">
              {files.map(file => (
                <div key={file.id} className="file-item">
                  <div className="file-icon">{getFileIcon(file.type)}</div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {file.size} • Shared by {file.sharedBy} • {file.date.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="file-actions">
                    <button className="btn-secondary">Download</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="posts-tab">
            <div className="posts-header">
              <h3>Network Posts</h3>
              <button className="btn-primary">Create Post</button>
            </div>
            <div className="posts-list">
              {posts.map(post => (
                <div key={post.id} className="post-item">
                  <div className="post-header">
                    <div className="post-author">{post.author}</div>
                    <div className="post-time">{post.timestamp.toLocaleTimeString()}</div>
                  </div>
                  <div className="post-content">{post.content}</div>
                  <div className="post-actions">
                    <button className="like-btn">👍 {post.likes}</button>
                    <button className="reply-btn">Reply</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkDetailPage;
