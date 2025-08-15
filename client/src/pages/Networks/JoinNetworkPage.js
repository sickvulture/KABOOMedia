// JoinNetworkPage.js
import React, { useState } from 'react';
import './JoinNetworkPage.css';

export const JoinNetworkPage = () => {
  const [networkCode, setNetworkCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleJoinNetwork = () => {
    if (networkCode.trim()) {
      console.log('Joining network with code:', networkCode);
      // Implement network joining logic
    }
  };

  return (
    <div className="join-network-page">
      <div className="join-container">
        <h1>Join Network</h1>
        <p>Enter a network code or scan a QR code to join an existing network</p>
        
        <div className="join-methods">
          <div className="method-section">
            <h3>Enter Network Code</h3>
            <div className="code-input-group">
              <input
                type="text"
                value={networkCode}
                onChange={(e) => setNetworkCode(e.target.value.toUpperCase())}
                placeholder="ABC123XYZ"
                className="network-code-input"
              />
              <button 
                onClick={handleJoinNetwork}
                disabled={!networkCode.trim()}
                className="join-btn"
              >
                Join
              </button>
            </div>
          </div>

          <div className="divider">OR</div>

          <div className="method-section">
            <h3>Scan QR Code</h3>
            <button 
              onClick={() => setIsScanning(!isScanning)}
              className="scan-btn"
            >
              {isScanning ? 'Stop Scanning' : 'Start QR Scanner'}
            </button>
            {isScanning && (
              <div className="scanner-placeholder">
                QR Code Scanner would appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
