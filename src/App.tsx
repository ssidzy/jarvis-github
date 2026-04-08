import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  History, 
  Send, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  Mail, 
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar as CalendarIcon,
  Tag,
  X,
  Zap,
  LogOut,
  ArrowLeft,
  RefreshCw,
  User,
  Copy,
  ClipboardCopy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from './lib/api';
import { Calendar } from './components/Calendar';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ComingSoon } from './components/ComingSoon';
import { useAuth, useEmail, useHistory } from './hooks';

export default function App() {
  // Hooks
  const auth = useAuth();
  const email = useEmail({ onSuccess: () => historyHook.fetchHistory() });
  const historyHook = useHistory();
  
  // Navigation
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (auth.currentUser && currentApp === 'email') {
      historyHook.fetchHistory();
      email.fetchTemplates();
    }
  }, [auth.currentUser, currentApp]);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    email.generate();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      email.addTag(currentTag);
      setCurrentTag('');
    }
  };

  const handleBackToDashboard = () => {
    setCurrentApp(null);
    email.clear();
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentApp(null);
    email.clear();
  };

  // ── Auth Gate ────────────────────────────────────────────────────────────────
  if (!auth.isAuthenticated) {
    return <Login onLogin={auth.login} />;
  }

  if (!currentApp) {
    return <Dashboard username={auth.currentUser!} onSelectApp={setCurrentApp} onLogout={handleLogout} />;
  }

  // ── Coming Soon Apps ─────────────────────────────────────────────────────────
  const comingSoonApps: Record<string, { name: string; description: string }> = {
    'news-briefing': { name: 'News Briefing Pro', description: 'Stay updated with daily news summaries' },
    'recipe-improviser': { name: 'Recipe Improviser', description: 'Discover creative recipes' },
    'image-to-text': { name: 'Image to Text', description: 'Extract text from images' },
  };

  if (comingSoonApps[currentApp]) {
    return <ComingSoon appName={comingSoonApps[currentApp].name} description={comingSoonApps[currentApp].description} onBack={handleBackToDashboard} />;
  }

  // ── Email App ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden font-sans dark:bg-black dark:text-white">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="glass border-r border-white/20 dark:border-white/10 flex flex-col z-20 overflow-hidden"
      >
        <div className="p-6 flex items-center justify-between dark:bg-black/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="px-4 space-y-6 overflow-y-auto pb-8">
          {/* Calendar */}
          <div className="px-2">
            <Calendar 
              datesWithEmails={historyHook.datesWithEmails} 
              onDateClick={historyHook.searchByDate} 
              selectedDate={historyHook.selectedDate} 
            />
          </div>

          {/* Templates */}
          <div className="px-2 border-t border-white/10 dark:border-white/5 pt-4">
            <button
              onClick={() => setShowTemplateList(!showTemplateList)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider mb-4 hover:text-black/60 dark:hover:text-white/60 transition-colors"
            >
              <Zap size={14} />
              Email Style
              <ChevronRight size={12} className={`ml-auto transition-transform ${showTemplateList ? 'rotate-90' : ''}`} />
            </button>

            {showTemplateList && (
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => email.setSelectedTemplateStyle(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    !email.selectedTemplateStyle ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20 text-black/70 dark:text-white/70'
                  }`}
                >
                  <div className="font-medium">None (Neutral Style)</div>
                </button>
                {email.templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => email.setSelectedTemplateStyle(template.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      email.selectedTemplateStyle === template.id ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20 text-black/70 dark:text-white/70'
                    }`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-[11px] opacity-70 mt-0.5">{template.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="px-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider mb-4 px-2">
              <History size={14} />
              {historyHook.searchResults ? 'Search Results' : 'Recent History'}
              {historyHook.searchResults && (
                <button onClick={historyHook.clearSearch} className="ml-auto text-blue-500 hover:underline">
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-4">
              {(historyHook.searchResults || historyHook.history).map((item: any, idx) => (
                <div key={idx} className="space-y-1">
                  {!historyHook.searchResults && (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-black/30 dark:text-white/30 px-2">
                      <CalendarIcon size={10} />
                      {item.date}
                    </div>
                  )}
                  {(historyHook.searchResults ? [item] : item.emails).map((emailItem: any, eIdx: number) => (
                    <button
                      key={eIdx}
                      onClick={() => historyHook.viewEmail(item.date, emailItem.filename)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/60 dark:hover:bg-white/10 transition-all flex flex-col gap-1 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-black/40 dark:text-white/40" />
                        <span className="truncate flex-1 font-medium">{emailItem.name}</span>
                      </div>
                      {emailItem.recipient && (
                        <div className="text-[10px] text-black/40 dark:text-white/40 flex items-center gap-1 ml-5">
                          <User size={10} /> {emailItem.recipient}
                        </div>
                      )}
                      {emailItem.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {emailItem.tags.map((t: string) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-md">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-white/10 dark:border-white/5">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/60 dark:hover:bg-white/10 transition-all">
            <Settings size={16} />
            Settings
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-transparent">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <button onClick={handleBackToDashboard} className="p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded-lg glass transition-all" title="Back to dashboard">
              <ArrowLeft size={20} />
            </button>
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded-lg glass transition-all">
                <ChevronRight size={20} />
              </button>
            )}
            <h1 className="text-xl font-semibold tracking-tight">MailForge</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Message */}
            {email.status && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium glass ${
                  email.status.type === 'success' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {email.status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {email.status.message}
              </motion.div>
            )}

            {/* Action Buttons */}
            {email.draft && (
              <>
                {/* Copy Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setShowCopyMenu(!showCopyMenu)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/60 dark:hover:bg-white/10 transition-all text-sm font-medium"
                  >
                    <Copy size={16} />Copy
                  </button>
                  {showCopyMenu && (
                    <div className="absolute right-0 mt-2 w-48 glass rounded-lg shadow-lg py-2 z-50">
                      <button
                        onClick={() => { email.copyToClipboard(false); setShowCopyMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2"
                      >
                        <ClipboardCopy size={14} /> Copy body only
                      </button>
                      <button
                        onClick={() => { email.copyToClipboard(true); setShowCopyMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10 flex items-center gap-2"
                      >
                        <Mail size={14} /> Copy with subject
                      </button>
                    </div>
                  )}
                </div>

                {/* Regenerate */}
                {email.lastPrompt && (
                  <button 
                    onClick={() => email.regenerate()}
                    disabled={email.isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all text-sm font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50"
                    title="Regenerate with same prompt"
                  >
                    <RefreshCw size={16} className={email.isLoading ? 'animate-spin' : ''} />
                    Regenerate
                  </button>
                )}

                <button onClick={email.save} className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/60 dark:hover:bg-white/10 transition-all text-sm font-medium">
                  <Save size={16} />Save
                </button>
                <button onClick={email.clear} className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-all text-sm font-medium text-red-600 dark:text-red-400">
                  <X size={16} />Clear
                </button>
              </>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-all text-sm font-medium text-red-600 dark:text-red-400" title="Logout">
              <LogOut size={16} />Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8 pb-32 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            {historyHook.viewingEmail ? (
              // Viewing Email
              <ViewEmailPanel 
                email={historyHook.viewingEmail} 
                onBack={historyHook.clearViewing}
                onCopy={email.showStatus}
              />
            ) : (
              // Compose View
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Draft Editor */}
                <motion.div layout className="md:col-span-2 glass rounded-3xl p-8 min-h-[500px] flex flex-col relative group">
                  {email.draft && (
                    <div className="mb-6 space-y-4">
                      {/* Subject */}
                      <input
                        type="text"
                        placeholder="Subject line..."
                        value={email.subject}
                        onChange={e => email.setSubject(e.target.value)}
                        className="w-full bg-transparent text-2xl font-bold placeholder:text-black/10 dark:placeholder:text-white/20 focus:outline-none"
                      />
                      
                      {/* Recipient Field */}
                      <div className="flex items-center gap-2 text-sm">
                        <User size={16} className="text-black/40 dark:text-white/40" />
                        <input
                          type="text"
                          placeholder="Recipient (optional)..."
                          value={email.recipient}
                          onChange={e => email.setRecipient(e.target.value)}
                          className="flex-1 bg-transparent placeholder:text-black/20 dark:placeholder:text-white/20 focus:outline-none"
                        />
                      </div>
                      
                      <div className="h-px w-full bg-black/5 dark:bg-white/10" />
                    </div>
                  )}

                  {/* Draft Body */}
                  <textarea
                    ref={draftRef}
                    value={email.draft}
                    onChange={e => email.setDraft(e.target.value)}
                    placeholder="Your AI-generated draft will appear here..."
                    className="flex-1 w-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed placeholder:text-black/10 dark:placeholder:text-white/20"
                  />

                  {/* Tags */}
                  {email.draft && (
                    <div className="mt-6 space-y-3 pt-4 border-t border-black/5 dark:border-white/10">
                      <label className="text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">Tags for saving</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag size={14} className="text-black/30 dark:text-white/30" />
                        {email.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-[10px] rounded-full">
                            {tag}
                            <button onClick={() => email.removeTag(tag)}><X size={10} /></button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="Add tag..."
                          value={currentTag}
                          onChange={e => setCurrentTag(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          className="bg-transparent text-xs focus:outline-none placeholder:text-black/20 dark:placeholder:text-white/30 w-20"
                        />
                      </div>
                    </div>
                  )}

                  {/* Loading Overlay */}
                  {email.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm z-10">
                      <div className="flex flex-col items-center gap-4">
                        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Loader2 className="animate-spin text-blue-600" size={32} />
                        </motion.div>
                        <p className="text-sm font-medium text-blue-600">MailForge is thinking...</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Sidebar Panels */}
                <div className="space-y-6">
                  {/* Context Panel */}
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-3xl p-6">
                    <h3 className="text-sm font-bold text-black/40 dark:text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Search size={14} />Context Found
                    </h3>
                    {email.context ? (
                      <div className="text-sm text-black/60 dark:text-white/60 leading-relaxed max-h-[200px] overflow-y-auto pr-2">{email.context}</div>
                    ) : (
                      <div className="text-sm text-black/30 dark:text-white/30 italic">No previous context found.</div>
                    )}
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-3xl p-6 bg-blue-500/5">
                    <h3 className="text-sm font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Zap size={14} />Quick Actions
                    </h3>
                    <div className="space-y-2">
                      {['Professional', 'Casual', 'Short', 'Detailed'].map(style => (
                        <button
                          key={style}
                          onClick={() => email.setPrompt(`Rewrite as ${style}: ${email.prompt}`)}
                          className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all text-black/70 dark:text-white/70"
                        >
                          Make it {style}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prompt Input */}
        {!historyHook.viewingEmail && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-30">
            <motion.form onSubmit={handleGenerate} className="glass-dark rounded-full p-2 flex items-center gap-2 shadow-2xl" whileFocusWithin={{ scale: 1.02 }}>
              <div className="pl-4 text-white/40 dark:text-white/60"><Mail size={20} /></div>
              <input
                type="text"
                value={email.prompt}
                onChange={e => email.setPrompt(e.target.value)}
                placeholder="Ask MailForge to draft an email..."
                className="flex-1 bg-transparent border-none focus:outline-none text-white py-3 px-2 placeholder:text-white/30"
              />
              <button type="submit" disabled={email.isLoading || !email.prompt.trim()} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 rounded-full hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50">
                {email.isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </motion.form>
          </div>
        )}
      </main>
    </div>
  );
}

// ── View Email Panel Component ─────────────────────────────────────────────────
function ViewEmailPanel({ email, onBack, onCopy }: { 
  email: any; 
  onBack: () => void; 
  onCopy: (type: 'success' | 'error', message: string) => void;
}) {
  const copyEmail = async (includeSubject: boolean) => {
    try {
      const text = includeSubject ? `Subject: ${email.subject}\n\n${email.body}` : email.body;
      await navigator.clipboard.writeText(text);
      onCopy('success', includeSubject ? 'Copied with subject!' : 'Copied to clipboard!');
    } catch {
      onCopy('error', 'Failed to copy');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 min-h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-white/60 dark:hover:bg-white/10 transition-all text-sm font-medium">
          <ArrowLeft size={16} />Back to Draft
        </button>
        <div className="flex items-center gap-4 text-sm text-black/40 dark:text-white/40">
          {email.recipient && (
            <span className="flex items-center gap-1"><User size={14} />{email.recipient}</span>
          )}
          <span className="flex items-center gap-1"><CalendarIcon size={14} />{email.date}</span>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mb-2">{email.subject}</h2>
      
      {email.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {email.tags.map((tag: string) => (
            <span key={tag} className="text-xs px-2 py-1 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-full">#{tag}</span>
          ))}
        </div>
      )}
      
      <div className="h-px w-full bg-black/10 dark:bg-white/10 mb-6" />
      <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap flex-1">{email.body}</div>
      
      <div className="mt-auto pt-6 flex gap-3">
        <button onClick={() => copyEmail(false)} className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/60 dark:hover:bg-white/10 transition-all text-sm font-medium">
          <ClipboardCopy size={16} />Copy Body
        </button>
        <button onClick={() => copyEmail(true)} className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/60 dark:hover:bg-white/10 transition-all text-sm font-medium">
          <Mail size={16} />Copy with Subject
        </button>
      </div>
    </motion.div>
  );
}
