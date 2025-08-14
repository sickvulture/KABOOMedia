import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { SocketProvider } from './contexts/SocketContext';

import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import LoadingSpinner from './components/UI/LoadingSpinner';

import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import NetworksPage from './pages/Networks/NetworksPage';
import NetworkDetailPage from './pages/Networks/NetworkDetailPage';
import CreateNetworkPage from './pages/Networks/CreateNetworkPage';
import JoinNetworkPage from './pages/Networks/JoinNetworkPage';
import ProfilePage from './pages/Profile/ProfilePage';
import FilesPage from './pages/Files/FilesPage';
import SettingsPage from './pages/Settings/SettingsPage';

import './styles/global.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <NetworkProvider>
      <SocketProvider>
        <div className="min-h-screen bg-gray-50">
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          
          <div className="flex">
            <Sidebar 
              isOpen={sidebarOpen} 
              onClose={() => setSidebarOpen(false)} 
            />
            
            <main className={`flex-1 transition-all duration-300 ${
              sidebarOpen ? 'lg:ml-64' : ''
            }`}>
              <div className="container mx-auto px-4 py-6 max-w-6xl">
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/networks" element={<NetworksPage />} />
                  <Route path="/networks/:networkId" element={<NetworkDetailPage />} />
                  <Route path="/networks/create" element={<CreateNetworkPage />} />
                  <Route path="/networks/join" element={<JoinNetworkPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/files" element={<FilesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </SocketProvider>
    </NetworkProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
        <ToastContainer
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          className="toast-container"
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
