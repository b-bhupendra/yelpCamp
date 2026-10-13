import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await api.get('/me');
      if (response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('yelpcamp_user', JSON.stringify(response.data.user));
      }
    } catch (err) {
      console.log('Not logged in');
      setUser(null);
      localStorage.removeItem('yelpcamp_user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/login', formData);
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem('yelpcamp_token', data.access_token);
    }
    setUser(data.user);
    localStorage.setItem('yelpcamp_user', JSON.stringify(data.user));
    return data;
  };

  const register = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/register', formData);
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem('yelpcamp_token', data.access_token);
    }
    setUser(data.user);
    localStorage.setItem('yelpcamp_user', JSON.stringify(data.user));
    return data;
  };

  const loginWithGoogle = async (credential) => {
    const response = await api.post('/auth/google', { token: credential });
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem('yelpcamp_token', data.access_token);
    }
    setUser(data.user);
    localStorage.setItem('yelpcamp_user', JSON.stringify(data.user));
    return data;
  };

  const logout = async () => {
    try {
      await api.get('/logout');
    } catch (e) {
      console.warn('Logout notice:', e);
    }
    setUser(null);
    localStorage.removeItem('yelpcamp_user');
    localStorage.removeItem('yelpcamp_token');
  };

  const updateAvatar = (avatarUrl) => {
    setUser(prev => {
      const updated = { ...prev, avatar_url: avatarUrl };
      localStorage.setItem('yelpcamp_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, logout, updateAvatar, checkAuth, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

