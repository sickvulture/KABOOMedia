import React, { useState, useEffect } from 'react';
import './DashboardPage.css';

const DashboardPage = () => {
  const [recentActivity, setRecentActivity] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    connectedPeers: 0,
    sharedFiles: 0,
    totalStorage: 0
  });

  useEffect(() => {
    // Simulate loading recent activity
    setRecentActivity([
      { id: 1, type: 'file_share', message: 'Shared "vacation_photos.zip"', timestamp: new Date() },
      { id: 2, type: 'network_join', message: 'User "Alice" joined your network', timestamp: new Date() },
      { id: 3, type: 'comment', message: 'New comment on "Project Updates"', timestamp: new Date() }
    ]);

    // Simulate network statistics
    setNetworkStats({
      connectedPeers: 3,
      sharedFiles: 12,
      totalStorage: 2.4
    });
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome to your KABOOMedia network</p>
      </div>

      <div className="dashboard-grid">
        <div className="stats-section">
          <h2>Network Statistics</h2>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-number">{networkStats.connectedPeers}</div>
              <div className="stat-label">Connected Peers</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{networkStats.sharedFiles}</div>
              <div className="stat-label">Shared Files</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{networkStats.totalStorage}GB</div>
              <div className="stat-label">Storage Used</div>
            </div>
          </div>
        </div>

        <div className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {recentActivity.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className={`activity-icon ${activity.type}`}></div>
                <div className="activity-content">
                  <p>{activity.message}</p>
                  <small>{activity.timestamp.toLocaleTimeString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button className="action-btn primary">Share File</button>
            <button className="action-btn secondary">Join Network</button>
            <button className="action-btn secondary">Create Post</button>
            <button className="action-btn secondary">Invite User</button>
          </div>
        </div>

        <div className="network-health">
          <h2>Network Health</h2>
          <div className="health-indicator">
            <div className="health-status healthy">
              <span className="status-dot"></span>
              All systems operational
            </div>
            <div className="health-details">
              <p>Encryption: Active</p>
              <p>P2P Connection: Stable</p>
              <p>Last Backup: 2 hours ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
