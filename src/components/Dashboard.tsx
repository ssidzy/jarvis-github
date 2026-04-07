import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { LogOut, Mail, Settings, Newspaper, UtensilsCrossed, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import CardSwap, { Card } from './CardSwap';

interface DashboardProps {
  username: string;
  onSelectApp: (app: string) => void;
  onLogout: () => void;
}

export function Dashboard({ username, onSelectApp, onLogout }: DashboardProps) {
  const cardSwapRef = useRef(null);
  const apps = [
    {
      id: 'email',
      name: 'MailForge',
      description: 'Email drafting',
      icon: Mail,
      color: 'from-white/20 to-white/10',
    },
    {
      id: 'news-briefing',
      name: 'News Briefing Pro',
      description: 'Daily news with opinion twist',
      icon: Newspaper,
      color: 'from-blue/20 to-blue/10',
    },
    {
      id: 'recipe-improviser',
      name: 'Recipe Improviser',
      description: "What's in My Fridge",
      icon: UtensilsCrossed,
      color: 'from-orange/20 to-orange/10',
    },
    {
      id: 'image-to-text',
      name: 'Image to Text',
      description: 'Extract text from images',
      icon: Image,
      color: 'from-purple/20 to-purple/10',
    },
  ];

  return (
    <div className="h-screen w-full bg-black flex flex-col">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Jarvis Suite</h1>
          <p className="text-white/60 text-sm mt-1">Welcome, <span className="text-white/80 font-semibold">{username}</span></p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-100 transition-all"
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Header Section */}
        <div className="text-center pt-8 pb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Applications</h2>
          {/* <p className="text-white/60">Choose an application to get started</p> */}
        </div>

        {/* Cards Section - Centered */}
        <div className="flex-1 flex items-center justify-center">
          {/* Card Swap Container with Navigation */}
          <div className="relative w-full flex items-center justify-center" style={{ height: '400px' }}>
            {/* Left Arrow */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => cardSwapRef.current?.next()}
              className="absolute left-8 z-20 p-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/60 hover:text-white transition-all"
            >
              <ChevronLeft size={24} />
            </motion.button>

            {/* Cards Container */}
            <div style={{ height: '400px', position: 'relative', width: '500px' }}>
              <CardSwap
                ref={cardSwapRef}
                cardDistance={50}
                verticalDistance={60}
                delay={5000}
                pauseOnHover={false}
                autoRotate={false}
                easing="linear"
                width={400}
                height={320}
                onCardClick={(index) => {
                  onSelectApp(apps[index].id);
                }}
              >
                {apps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <Card key={app.id} className="group p-6 cursor-pointer hover:border-white/50 transition-all bg-slate-900/70 backdrop-blur">
                      <div className="h-full flex flex-col justify-between">
                        <div>
                          <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
                            <Icon size={28} className="text-white/80" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">{app.name}</h3>
                          <p className="text-white/60 text-sm">{app.description}</p>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 group-hover:text-white/80 transition-colors">
                          <span className="text-sm font-semibold">Open App</span>
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </CardSwap>
            </div>

            {/* Right Arrow */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => cardSwapRef.current?.next()}
              className="absolute right-8 z-20 p-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/60 hover:text-white transition-all"
            >
              <ChevronRight size={24} />
            </motion.button>
          </div>
        </div>

        {/* Info Text - Positioned at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="pb-8 text-center"
        >
          <p className="text-white/50 text-sm">Use arrow buttons to navigate between apps</p>
        </motion.div>
      </main>
    </div>
  );
}
