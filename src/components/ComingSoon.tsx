import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Zap } from 'lucide-react';

interface ComingSoonProps {
  appName: string;
  description: string;
  onBack: () => void;
}

export function ComingSoon({ appName, description, onBack }: ComingSoonProps) {
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white transition-all"
      >
        <ArrowLeft size={18} />
        Back
      </motion.button>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 text-center max-w-2xl mx-auto px-8"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="inline-block mb-8"
        >
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/50 flex items-center justify-center">
            <Zap size={48} className="text-blue-400" />
          </div>
        </motion.div>

        <h1 className="text-5xl font-bold text-white mb-4">
          {appName}
        </h1>

        <p className="text-xl text-white/60 mb-2">
          {description}
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12"
        >
          <div className="inline-block">
            <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/20">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-white/80 font-medium">Coming Soon</span>
            </div>
          </div>
        </motion.div>

        <p className="text-white/50 mt-8 text-sm">
          We're working hard to bring this amazing feature to life. Stay tuned!
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-16 grid grid-cols-3 gap-4"
        >
          {['Optimizing', 'Building', 'Testing'].map((item, i) => (
            <div key={item} className="text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                className="text-white/40 text-sm font-semibold mb-2"
              >
                {item}
              </motion.div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                />
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
