import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import axios from 'axios';
import DarkVeil from './DarkVeil';

interface LoginProps {
  onLogin: (username: string, token: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, username: returnedUsername } = response.data;
      onLogin(returnedUsername, token);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* DarkVeil Background */}
      <div className="absolute inset-0 z-0">
        <DarkVeil
          hueShift={0}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={1.5}
          scanlineFrequency={0}
          warpAmount={0}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Logo and Title */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-center gap-3 mb-4"
            >
              <h1 className="text-5xl font-bold text-white">Jarvis</h1>
            </motion.div>
            <p className="text-white/60 text-lg">Suite</p>
          </div>

          {/* Login Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 space-y-6"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg"
              >
                <AlertCircle size={20} className="text-red-400" />
                <span className="text-red-100 text-sm">{error}</span>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="block text-white/80 text-sm font-medium">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-white/80 text-sm font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/30"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}
