import { createContext, useContext, useEffect, useState } from 'react';
import api, { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      console.log('📡 Fetching current user...');
      const response = await authAPI.getCurrentUser();
      console.log('✅ User fetched successfully:', response.data);
      setUser(response.data);
    } catch (error) {
      console.error('❌ Failed to fetch user:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
      });
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Use custom login endpoint
      const response = await api.post('/users/login/', { username, password });
      if (response.data.token) {
        const newToken = response.data.token;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        await fetchUser();
        return { success: true };
      }
      throw new Error('No token received');
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      // If token is returned, store it and fetch user
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        await fetchUser();
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  };

  const logout = () => {
    authAPI.logout();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

