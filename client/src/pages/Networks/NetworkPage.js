import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './NetworksPage.css';

const NetworksPage = () => {
  const [networks, setNetworks] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState('');

  useEffect(() => {
    // Simulate loading networks
    setNetworks([
      {
        id: 'net1',
        name: 'Family Photos',
        description: 'Private network for family memories',
        memberCount: 5,
        status: 'active',
        isOwner: true,
        lastActivity: new Date()
      },
      {
        id: 'net2',
        name: 'Work Project Alpha',
        description: 'Collaborative workspace for project files',
        memberCount: 12,
        status: 'active',
        isOwner: false,
        lastActivity: new Date()
      },
      {
        id: 'net3',
        name: 'Music Collection',
        description: 'Shared music library',
        memberCount: 3,
        status: 'inactive',
        isOwner: true,
        lastActivity: new Date(Date.now() - 86400000) // 1 day ago
      }
    ]);
  }, []);

  const handleCreateNetwork = () => {
    if (newNetworkName.trim()) {
      const newNetwork = {
        id: `net${Date.now()}`,
        name: newNetworkName,
        description: 'New network',
        memberCount: 1,
        status: 'active',
        isOwner: true,
        lastActivity: new Date()
      };
      setNetworks([...networks, newNetwork]);
      setNewNetworkName('');
      setShowCreateModal(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="networks-page">
      <div className="networks-header">
        <h1>Networks</h1>
        <p>Manage your private peer-to-peer networks</p>
        <button 
          className="create-network-btn"
          onClick={() => setShowCreateModal(true)}
        >
          Create Network
        </button>
      </div>

      <div className="networks-grid">
        {networks.map(network => (
          <div key={network.id} className="network-card">
            <div className="network-header">
              <div className="network-info">
                <h3>{network.name}</h3>
                <p>{network.description}</p>
              </div>
              <div 
                className="network-status"
                style={{ backgroundColor: getStatusColor(network.status) }}
              />
            </div>

            <div className="network-stats">
              <div className="stat">
                <span className="stat-label">Members:</span>
                <span className="stat-value">{network.memberCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Role:</span>
                <span className="stat-value">{network.isOwner ? 'Owner' : 'Member'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Last Activity:</span>
                <span className="stat-value">{network.lastActivity.toLocaleDateString()}</span>
              </div>
            </div>

            <div className="network-actions">
              <Link to={`/network/${network.id}`} className="btn-secondary">
                View Details
              </Link>
              {network.isOwner && (
                <button className="btn-primary">Manage</button>
              )}
            </div>
          </div>
        ))}

        <div className="join-network-card">
          <div className="join-content">
            <h3>Join a Network</h3>
            <p>Enter a network code or scan a QR code to join an existing network</p>
            <Link to="/join-network" className="btn-accent">
              Join Network
            </Link>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Network</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="networkName">Network Name</label>
                <input
                  id="networkName"
                  type="text"
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  placeholder="Enter network name"
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleCreateNetwork}
              >
                Create Network
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworksPage;
