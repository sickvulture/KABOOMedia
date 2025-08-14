import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    if (user && token) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user, token]);

  const initializeSocket = () => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      auth: {
        token: token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('network-joined', (data) => {
      console.log('Joined network:', data);
      setPeers(data.peers || []);
    });

    newSocket.on('peer-joined', (data) => {
      console.log('Peer joined:', data);
      setPeers(prev => [...prev.filter(p => p.id !== data.peerId), {
        id: data.peerId,
        publicKey: data.publicKey,
        isOnline: true,
        joinedAt: Date.now()
      }]);
    });

    newSocket.on('peer-left', (data) => {
      console.log('Peer left:', data);
      setPeers(prev => prev.filter(p => p.id !== data.peerId));
    });

    newSocket.on('peers-discovered', (data) => {
      console.log('Peers discovered:', data);
      setPeers(data.peers || []);
    });

    newSocket.on('message-received', (data) => {
      console.log('Message received:', data);
      // Handle incoming messages
    });

    newSocket.on('direct-message', (data) => {
      console.log('Direct message:', data);
      // Handle direct messages
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
      setPeers([]);
    }
  };

  const joinNetwork = (networkId, publicKey) => {
    if (socket && user) {
      socket.emit('join-network', {
        networkId,
        userId: user.id,
        publicKey
      });
    }
  };

  const discoverPeers = (networkId) => {
    if (socket) {
      socket.emit('discover-peers', { networkId });
    }
  };

  const sendMessage = (to, encryptedMessage, signature, publicKey) => {
    if (socket) {
      socket.emit('send-message', {
        to,
        encryptedMessage,
        signature,
        publicKey
      });
    }
  };

  const value = {
    socket,
    connected,
    peers,
    joinNetwork,
    discoverPeers,
    sendMessage
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
