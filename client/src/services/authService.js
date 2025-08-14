import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Generate new key pair
  async generateKeys() {
    try {
      const response = await api.post('/auth/generate-keys');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to generate keys');
    }
  },

  // Register new user
  async register(username, password, publicKey, privateKey) {
    try {
      const response = await api.post('/auth/register', {
        username,
        password,
        publicKey,
        privateKey
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Login user
  async login(username, password) {
    try {
      const response = await api.post('/auth/login', {
        username,
        password
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Logout user
  async logout() {
    try {
      const response = await api.post('/auth/logout');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Logout failed');
    }
  },

  // Get user profile
  async getProfile() {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch profile');
    }
  },

  // Update user profile
  async updateProfile(data) {
    try {
      const response = await api.put('/auth/profile', data);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Profile update failed');
    }
  },

  // Verify token
  async verifyToken(token) {
    try {
      const response = await api.post('/auth/verify', { token });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  },

  // Refresh token
  async refreshToken() {
    try {
      const response = await api.post('/auth/refresh');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Token refresh failed');
    }
  }
};
