import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { useSocket } from '../../contexts/SocketContext';

const DashboardPage = () => {
  const { user } = useAuth();
  const { networks, loading } = useNetwork();
  const { connected, peers } = useSocket();
  const [stats, setStats] = useState({
    totalNetworks: 0,
    totalPeers: 0,
    onlinePeers: 0,
    recentActivity: []
  });

  useEffect(() => {
    // Calculate stats
    const totalNetworks = networks.length;
    const totalPeers = peers.length;
    const onlinePeers = peers.filter(peer => peer.isOnline).length;

    setStats({
      totalNetworks,
      totalPeers,
      onlinePeers,
      recentActivity: [] // TODO: Implement recent activity
    });
  }, [networks, peers]);

  const StatCard = ({ title, value, icon, color = "indigo" }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <div className={`w-6 h-6 text-${color}-600`}>
            {icon}
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  const QuickAction = ({ title, description, href, icon, color = "indigo" }) => (
    <Link
      to={href}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 block"
    >
      <div className="flex items-start">
        <div className={`p-3 rounded-lg bg-${color}-100 mr-4`}>
          <div className={`w-6 h-6 text-${color}-600`}>
            {icon}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {user?.username}!
            </h1>
            <p className="text-indigo-100">
              Your secure, decentralized social network awaits
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Networks"
          value={stats.totalNetworks}
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          }
          color="indigo"
        />
        <StatCard
          title="Total Peers"
          value={stats.totalPeers}
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          }
          color="green"
        />
        <StatCard
          title="Online Now"
          value={stats.onlinePeers}
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          title="Storage Used"
          value="12.3 MB"
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v11.586l2.707-2.707a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L12 15.586V4z" />
            </svg>
          }
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QuickAction
            title="Create Network"
            description="Start a new decentralized network and invite others"
            href="/networks/create"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
            color="indigo"
          />
          <QuickAction
            title="Join Network"
            description="Connect to an existing network via QR code or invitation"
            href="/networks/join"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
            color="green"
          />
          <QuickAction
            title="Upload Files"
            description="Share encrypted files with your network"
            href="/files"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
            color="purple"
          />
        </div>
      </div>

      {/* Recent Networks */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Networks</h2>
          <Link
            to="/networks"
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : networks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {networks.slice(0, 6).map((network) => (
              <Link
                key={network.networkId}
                to={`/networks/${network.networkId}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {network.settings?.name || `Network ${network.networkId.slice(0, 8)}`}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {network.totalPeers} member{network.totalPeers !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${network.onlinePeers > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-xs text-gray-500">
                      {network.onlinePeers} online
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    network.settings?.isPrivate 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {network.settings?.isPrivate ? 'Private' : 'Public'}
                  </span>
                  <span className="text-gray-500">
                    {network.role || 'Member'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Networks Yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first network or join an existing one to get started
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/networks/create"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Create Network
              </Link>
              <Link
                to="/networks/join"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Join Network
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Security Status */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Secure Connection Active</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Your connection is encrypted end-to-end. All data is secured with RSA-2048 encryption and your private keys never leave your device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
