import { useState, useEffect } from 'react';
import api from '../lib/api';

interface AuthState {
  currentUser: string | null;
  authToken: string | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    currentUser: localStorage.getItem('jarvis_user'),
    authToken: localStorage.getItem('jarvis_token'),
    isLoading: false,
  });

  useEffect(() => {
    if (state.authToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${state.authToken}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [state.authToken]);

  const login = (username: string, token: string) => {
    localStorage.setItem('jarvis_user', username);
    localStorage.setItem('jarvis_token', token);
    setState({ currentUser: username, authToken: token, isLoading: false });
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('jarvis_user');
    localStorage.removeItem('jarvis_token');
    setState({ currentUser: null, authToken: null, isLoading: false });
  };

  return {
    currentUser: state.currentUser,
    authToken: state.authToken,
    isAuthenticated: !!(state.currentUser && state.authToken),
    login,
    logout,
  };
}
