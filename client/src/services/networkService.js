import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const networkService = {
  // Create new network
  async createNetwork(networkData) {
    try {
      const response = await api.post('/network/create', networkData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create network');
    }
  },

  // Join network via invitation
  async joinNetwork(invitationCode, publicKey) {
    try {
      const response = await api.post('/network/join', {
        invitationCode,
        publicKey
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to join network');
    }
  },

  // Leave network
  async leaveNetwork(networkId) {
    try {
      const response = await api.post(`/network/${networkId}/leave`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to leave network');
    }
  },

  // Get network information
  async getNetworkInfo(networkId) {
    try {
      const response = await api.get(`/network/${networkId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch network info');
    }
  },

  // Generate network invitation
  async generateInvitation(networkId, permissions = {}) {
    try {
      const response = await api.post(`/network/${networkId}/invite`, {
        permissions
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to generate invitation');
    }
  },

  // Get network peers
  async getNetworkPeers(networkId) {
    try {
      const response = await api.get(`/network/${networkId}/peers`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch peers');
    }
  },

  // Update network settings
  async updateNetworkSettings(networkId, settings) {
    try {
      const response = await api.put(`/network/${networkId}/settings`, settings);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to update network settings');
    }
  },

  // Get user's networks
  async getUserNetworks() {
    try {
      const response = await api.get('/network');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch user networks');
    }
  },

  // Remove user from network
  async removeUserFromNetwork(networkId, userId) {
    try {
      const response = await api.delete(`/network/${networkId}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to remove user');
    }
  },

  // Get network health
  async getNetworkHealth(networkId) {
    try {
      const response = await api.get(`/network/${networkId}/health`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to check network health');
    }
  }
};
