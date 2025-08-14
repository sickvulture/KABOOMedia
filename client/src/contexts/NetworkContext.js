import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { networkService } from '../services/networkService';

const NetworkContext = createContext();

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export const NetworkProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [networks, setNetworks] = useState([]);
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && token) {
      loadUserNetworks();
    }
  }, [user, token]);

  const loadUserNetworks = async () => {
    try {
      setLoading(true);
      const userNetworks = await networkService.getUserNetworks();
      setNetworks(userNetworks.networks || []);
    } catch (error) {
      console.error('Failed to load networks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNetwork = async (networkData) => {
    try {
      const newNetwork = await networkService.createNetwork(networkData);
      setNetworks(prev => [...prev, newNetwork]);
      return { success: true, network: newNetwork };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const joinNetwork = async (invitationCode, publicKey) => {
    try {
      const result = await networkService.joinNetwork(invitationCode, publicKey);
      await loadUserNetworks(); // Refresh networks list
      return { success: true, network: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const leaveNetwork = async (networkId) => {
    try {
      await networkService.leaveNetwork(networkId);
      setNetworks(prev => prev.filter(n => n.networkId !== networkId));
      if (currentNetwork?.networkId === networkId) {
        setCurrentNetwork(null);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const generateInvitation = async (networkId, permissions = {}) => {
    try {
      const invitation = await networkService.generateInvitation(networkId, permissions);
      return { success: true, invitation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const getNetworkInfo = async (networkId) => {
    try {
      const networkInfo = await networkService.getNetworkInfo(networkId);
      return { success: true, network: networkInfo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    networks,
    currentNetwork,
    setCurrentNetwork,
    loading,
    createNetwork,
    joinNetwork,
    leaveNetwork,
    generateInvitation,
    getNetworkInfo,
    refreshNetworks: loadUserNetworks
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};
