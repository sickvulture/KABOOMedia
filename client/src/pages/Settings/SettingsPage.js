import React, { useState } from 'react';
import './SettingsPage.css';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    privacy: {
      allowDiscovery: true,
      requireApproval: true,
      shareLocation: false
    },
    security: {
      twoFactorAuth: false,
      encryptionLevel: 'high',
      autoLock: 15
    },
    network: {
      maxConnections: 10,
      bandwidthLimit: 'unlimited',
      portForwarding: true
    },
    notifications: {
      newMessages: true,
      fileShares: true,
      networkActivity: false,
      systemAlerts: true
    }
  });

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleExportData = () => {
    console.log('Export data clicked');
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      console.log('Delete account confirmed');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1>Settings</h1>
        
        <div className="settings-sections">
          <div className="settings-section">
            <h2>Privacy</h2>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.privacy.allowDiscovery}
                  onChange={(e) => handleSettingChange('privacy', 'allowDiscovery', e.target.checked)}
                />
                Allow network discovery
              </label>
              <p className="setting-description">Let others find your networks through discovery</p>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.privacy.requireApproval}
                  onChange={(e) => handleSettingChange('privacy', 'requireApproval', e.target.checked)}
                />
                Require approval for new connections
              </label>
              <p className="setting-description">Manually approve all incoming connection requests</p>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.privacy.shareLocation}
                  onChange={(e) => handleSettingChange('privacy', 'shareLocation', e.target.checked)}
                />
                Share approximate location
              </label>
              <p className="setting-description">Help others find nearby networks</p>
            </div>
          </div>

          <div className="settings-section">
            <h2>Security</h2>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.security.twoFactorAuth}
                  onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
                />
                Enable two-factor authentication
              </label>
              <p className="setting-description">Add an extra layer of security to your account</p>
            </div>
            <div className="setting-item">
              <label>
                Encryption Level:
                <select
                  value={settings.security.encryptionLevel}
                  onChange={(e) => handleSettingChange('security', 'encryptionLevel', e.target.value)}
                  className="setting-select"
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="maximum">Maximum</option>
                </select>
              </label>
              <p className="setting-description">Higher levels provide better security but may affect performance</p>
            </div>
            <div className="setting-item">
              <label>
                Auto-lock after (minutes):
                <select
                  value={settings.security.autoLock}
                  onChange={(e) => handleSettingChange('security', 'autoLock', parseInt(e.target.value))}
                  className="setting-select"
                >
                  <option value={5}>5</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={0}>Never</option>
                </select>
              </label>
              <p className="setting-description">Automatically lock the application after inactivity</p>
            </div>
          </div>

          <div className="settings-section">
            <h2>Network</h2>
            <div className="setting-item">
              <label>
                Maximum connections:
                <input
                  type="number"
                  value={settings.network.maxConnections}
                  onChange={(e) => handleSettingChange('network', 'maxConnections', parseInt(e.target.value))}
                  className="setting-input"
                  min="1"
                  max="100"
                />
              </label>
              <p className="setting-description">Limit the number of simultaneous peer connections</p>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.network.portForwarding}
                  onChange={(e) => handleSettingChange('network', 'portForwarding', e.target.checked)}
                />
                Enable automatic port forwarding
              </label>
              <p className="setting-description">Automatically configure router for better connectivity</p>
            </div>
          </div>

          <div className="settings-section">
            <h2>Notifications</h2>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.notifications.newMessages}
                  onChange={(e) => handleSettingChange('notifications', 'newMessages', e.target.checked)}
                />
                New messages
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.notifications.fileShares}
                  onChange={(e) => handleSettingChange('notifications', 'fileShares', e.target.checked)}
                />
                File shares
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.notifications.networkActivity}
                  onChange={(e) => handleSettingChange('notifications', 'networkActivity', e.target.checked)}
                />
                Network activity
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.notifications.systemAlerts}
                  onChange={(e) => handleSettingChange('notifications', 'systemAlerts', e.target.checked)}
                />
                System alerts
              </label>
            </div>
          </div>

          <div className="settings-section danger-zone">
            <h2>Data & Account</h2>
            <div className="setting-item">
              <button onClick={handleExportData} className="btn-secondary">
                Export My Data
              </button>
              <p className="setting-description">Download a copy of all your data</p>
            </div>
            <div className="setting-item">
              <button onClick={handleDeleteAccount} className="btn-danger">
                Delete Account
              </button>
              <p className="setting-description">Permanently delete your account and all associated data</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
