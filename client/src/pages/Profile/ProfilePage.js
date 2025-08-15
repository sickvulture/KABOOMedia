import React, { useState } from 'react';
import './ProfilePage.css';

const ProfilePage = () => {
  const [profile, setProfile] = useState({
    username: 'user123',
    displayName: 'John Doe',
    bio: 'Privacy-focused user sharing content securely',
    avatar: null
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleSaveProfile = () => {
    setIsEditing(false);
    // Implement profile saving logic
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="avatar-section">
            <div className="avatar-placeholder">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            {isEditing && <button className="change-avatar-btn">Change Photo</button>}
          </div>
          
          <div className="profile-info">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                  className="edit-input"
                />
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  className="edit-textarea"
                />
              </>
            ) : (
              <>
                <h1>{profile.displayName}</h1>
                <p className="username">@{profile.username}</p>
                <p className="bio">{profile.bio}</p>
              </>
            )}
          </div>

          <div className="profile-actions">
            {isEditing ? (
              <>
                <button onClick={handleSaveProfile} className="btn-primary">Save</button>
                <button onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="btn-primary">Edit Profile</button>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="stat">
            <div className="stat-number">3</div>
            <div className="stat-label">Networks</div>
          </div>
          <div className="stat">
            <div className="stat-number">25</div>
            <div className="stat-label">Files Shared</div>
          </div>
          <div className="stat">
            <div className="stat-number">12</div>
            <div className="stat-label">Posts</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
