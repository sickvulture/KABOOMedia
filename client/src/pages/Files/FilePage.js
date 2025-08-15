// FilesPage.js
import React, { useState, useEffect } from 'react';
import './FilesPage.css';

export const FilesPage = () => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    setFiles([
      { id: 1, name: 'vacation_photos.zip', size: '245 MB', type: 'archive', network: 'Family Photos', date: new Date() },
      { id: 2, name: 'project_presentation.pdf', size: '5.2 MB', type: 'document', network: 'Work Project Alpha', date: new Date() },
      { id: 3, name: 'birthday_video.mp4', size: '1.8 GB', type: 'video', network: 'Family Photos', date: new Date() },
      { id: 4, name: 'music_collection.mp3', size: '4.5 MB', type: 'audio', network: 'Music Collection', date: new Date() },
      { id: 5, name: 'design_assets.png', size: '12.3 MB', type: 'image', network: 'Work Project Alpha', date: new Date() }
    ]);
  }, []);

  const getFileIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'image': return '🖼️';
      case 'document': return '📄';
      case 'archive': return '📦';
      default: return '📁';
    }
  };

  const handleFileSelect = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleUploadFile = () => {
    // Implement file upload logic
    console.log('Upload file clicked');
  };

  return (
    <div className="files-page">
      <div className="files-header">
        <h1>My Files</h1>
        <div className="files-actions">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          <button onClick={handleUploadFile} className="btn-primary">
            Upload File
          </button>
        </div>
      </div>

      <div className="files-stats">
        <div className="stat">
          <span className="stat-number">{files.length}</span>
          <span className="stat-label">Total Files</span>
        </div>
        <div className="stat">
          <span className="stat-number">2.8 GB</span>
          <span className="stat-label">Storage Used</span>
        </div>
        <div className="stat">
          <span className="stat-number">{selectedFiles.length}</span>
          <span className="stat-label">Selected</span>
        </div>
      </div>

      <div className={`files-container ${viewMode}`}>
        {files.map(file => (
          <div 
            key={file.id} 
            className={`file-item ${selectedFiles.includes(file.id) ? 'selected' : ''}`}
            onClick={() => handleFileSelect(file.id)}
          >
            <div className="file-icon">{getFileIcon(file.type)}</div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                <span>{file.size}</span>
                <span>•</span>
                <span>{file.network}</span>
                <span>•</span>
                <span>{file.date.toLocaleDateString()}</span>
              </div>
            </div>
            <div className="file-actions">
              <button className="action-btn">Download</button>
              <button className="action-btn">Share</button>
            </div>
          </div>
        ))}
      </div>

      {selectedFiles.length > 0 && (
        <div className="bulk-actions">
          <button className="btn-secondary">Download Selected</button>
          <button className="btn-secondary">Share Selected</button>
          <button className="btn-danger">Delete Selected</button>
        </div>
      )}
    </div>
  );
};
