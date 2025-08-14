import React from 'react';

const LoadingSpinner = ({ size = 'default', text = 'Loading...' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="text-center">
        <div className={`${sizeClasses[size]} border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
        <p className="text-white text-lg font-medium">{text}</p>
        <p className="text-white/80 text-sm mt-2">Initializing secure connection...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
