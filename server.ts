import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { format } from 'date-fns';
import * as fuzz from 'fuzzball';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

dotenv.config();

// ── OpenAI ─────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callOpenAI(systemPrompt: string, userMessage?: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in environment');

  // Use system + user message format for better instruction following
  const messages = userMessage 
    ? [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    : [{ role: 'user', content: systemPrompt }];

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1000, // Increased for longer emails
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content as string;
}

// ── Password Hashing ───────────────────────────────────────────────────────────
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── File-based Session Store (t3.micro friendly - no Redis needed) ─────────────
const SESSION_DURATION = 24 * 60 * 60 * 1000;
const SESSIONS_FILE = path.join(process.cwd(), 'sessions.json');

interface Session {
  username: string;
  createdAt: number;
}

let sessions: Map<string, Session> = new Map();

async function loadSessions(): Promise<void> {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const now = Date.now();
    // Filter out expired sessions while loading
    sessions = new Map(
      Object.entries(parsed).filter(([_, s]: [string, any]) => 
        now - s.createdAt < SESSION_DURATION
      ) as [string, Session][]
    );
  } catch {
    sessions = new Map();
  }
}

async function saveSessions(): Promise<void> {
  const obj = Object.fromEntries(sessions);
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(obj, null, 2));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── Server ─────────────────────────────────────────────────────────────────────
async function startServer() {
  const app  = express();
  const PORT = Number(process.env.PORT) || 3000;
  const DATA_DIR      = path.join(process.cwd(), 'jarvis_data');
  const TEMPLATES_DIR = path.join(process.cwd(), 'email_templates');
  const USERS_FILE    = path.join(process.cwd(), 'users.json');

  // Load existing sessions from disk
  await loadSessions();
  console.log(`📂 Loaded ${sessions.size} active sessions`);

  await fs.mkdir(DATA_DIR,      { recursive: true }).catch(console.error);
  await fs.mkdir(TEMPLATES_DIR, { recursive: true }).catch(console.error);

  // Session cleanup - runs every hour, saves to disk
  setInterval(async () => {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, session] of sessions.entries()) {
      if (now - session.createdAt > SESSION_DURATION) {
        sessions.delete(token);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      await saveSessions();
      console.log(`🧹 Cleaned ${cleaned} expired sessions`);
    }
  }, 60 * 60 * 1000);

  // CORS: allow GitHub Pages origin + localhost in dev
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // ── Rate Limiting (t3.micro friendly) ────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,             // 30 requests per minute per IP
    message: { error: 'Too many requests. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Stricter limit for AI generation (expensive operation)
  const generateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,             // 10 generations per minute per IP
    message: { error: 'Generation rate limit reached. Please wait before generating more emails.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);

  // ── Input Validation Helper ──────────────────────────────────────────────────
  function validate(data: any, rules: Record<string, { required?: boolean; maxLength?: number; type?: string }>) {
    const errors: string[] = [];
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
      }
      if (value && rule.maxLength && String(value).length > rule.maxLength) {
        errors.push(`${field} must be ${rule.maxLength} characters or less`);
      }
      if (value && rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
      if (value && rule.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }
    }
    return errors;
  }

  // ── Auth middleware ──────────────────────────────────────────────────────────
  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    const session = sessions.get(token)!;
    if (Date.now() - session.createdAt > SESSION_DURATION) {
      sessions.delete(token);
      saveSessions(); // Persist the deletion
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    (req as any).user = session.username;
    next();
  };

  // ── User Data Directory (isolates each user's emails) ───────────────────────
  function getUserDataDir(username: string): string {
    return path.join(DATA_DIR, username);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async function getMetadata(filePath: string) {
    try {
      return JSON.parse(await fs.readFile(filePath.replace('.txt', '.meta.json'), 'utf-8'));
    } catch {
      return { tags: [], recipient: '' };
    }
  }

  async function getUserProfile(username: string) {
    try {
      const { users } = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
      return users.find((u: any) => u.username === username) || null;
    } catch {
      return null;
    }
  }

  function cleanEmailOutput(raw: string): { subject: string; body: string } {
    let text = raw.trim().replace(/\[.*?\]/g, '');
    text = text.replace(/^(Subject:|Body:|Email:|Draft:|Here is|Below is)[\s:]*/i, '');

    let subject = '';
    let body    = text;

    const subjectMatch = text.match(/^Subject:\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body    = text.replace(/^Subject:\s*.+?(?:\n|$)/i, '').trim();
    } else {
      const lines     = text.split('\n');
      const firstLine = lines[0].trim();
      if (firstLine.length < 100 && !firstLine.toLowerCase().startsWith('dear') && !firstLine.toLowerCase().startsWith('hi ')) {
        subject = firstLine;
        body    = lines.slice(1).join('\n').trim();
      }
    }

    body = body.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/gm, '');
    return { subject, body };
  }

  // ── Public routes ────────────────────────────────────────────────────────────

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Input validation
    const errors = validate(req.body, {
      username: { required: true, maxLength: 50, type: 'string' },
      password: { required: true, maxLength: 100, type: 'string' },
    });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    try {
      const { users } = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
      const user = users.find((u: any) => u.username === username);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Check if password is hashed (starts with $2b$ for bcrypt)
      let passwordValid = false;
      if (user.passwordHash) {
        // New format: use bcrypt
        passwordValid = await verifyPassword(password, user.passwordHash);
      } else if (user.password) {
        // Legacy format: plain text (for migration)
        passwordValid = user.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = generateToken();
      sessions.set(token, { username, createdAt: Date.now() });
      await saveSessions(); // Persist session to disk
      
      // Create user data directory if it doesn't exist
      await fs.mkdir(getUserDataDir(username), { recursive: true });
      
      res.json({ token, username });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      sessions.delete(token);
      await saveSessions();
    }
    res.json({ success: true });
  });

  // ── Protected routes ─────────────────────────────────────────────────────────

  app.get('/api/history', requireAuth, async (req, res) => {
    const username = (req as any).user;
    const userDataDir = getUserDataDir(username);
    
    try {
      await fs.mkdir(userDataDir, { recursive: true });
      const folders = await fs.readdir(userDataDir);
      const history = [];
      
      for (const folder of folders) {
        const folderPath = path.join(userDataDir, folder);
        if (!(await fs.stat(folderPath)).isDirectory()) continue;
        const files  = await fs.readdir(folderPath);
        const emails = [];
        for (const f of files) {
          if (!f.endsWith('.txt')) continue;
          const meta = await getMetadata(path.join(folderPath, f));
          emails.push({ 
            name: f.replace('.txt', '').replace(/_/g, ' '), 
            filename: f, 
            tags: meta.tags || [],
            recipient: meta.recipient || ''
          });
        }
        if (emails.length > 0) {
          history.push({ date: folder, emails });
        }
      }
      history.sort((a, b) => b.date.localeCompare(a.date));
      res.json(history);
    } catch (err) {
      console.error('History fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  app.get('/api/context', requireAuth, async (req, res) => {
    const { query } = req.query;
    const username = (req as any).user;
    const userDataDir = getUserDataDir(username);
    
    if (!query) return res.json({ context: null });
    
    try {
      await fs.mkdir(userDataDir, { recursive: true });
      const folders = (await fs.readdir(userDataDir)).sort().reverse();
      const searchTerm = (query as string).toLowerCase();
      let best = { score: 0, content: null as string | null, source: null as string | null };

      for (const folder of folders) {
        const folderPath = path.join(userDataDir, folder);
        if (!(await fs.stat(folderPath)).isDirectory()) continue;
        const files = await fs.readdir(folderPath);
        for (const file of files) {
          if (!file.endsWith('.txt')) continue;
          const content      = await fs.readFile(path.join(folderPath, file), 'utf-8');
          const fileNameClean = file.replace('.txt', '').replace(/_/g, ' ');
          const firstLines   = content.split('\n').slice(0, 5).join(' ');
          const score = Math.max(
            fuzz.partial_ratio(searchTerm, fileNameClean.toLowerCase()),
            fuzz.partial_ratio(searchTerm, firstLines.toLowerCase())
          );
          if (score > 70 && score > best.score) best = { score, content, source: `${folder}/${file}` };
          if (score > 95) break;
        }
        if (best.score > 95) break;
      }
      res.json({ context: best.content, source: best.source, score: best.score });
    } catch {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // ── Generate with OpenAI ─────────────────────────────────────────────────────
  app.post('/api/generate', requireAuth, generateLimiter, async (req, res) => {
    const { prompt, context, templateType } = req.body;
    
    // Input validation
    const errors = validate(req.body, {
      prompt: { required: true, maxLength: 2000, type: 'string' },
    });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    const username = (req as any).user;

    const userProfile = await getUserProfile(username);
    const fullName    = userProfile?.fullName    || username;
    const designation = userProfile?.designation || '';
    const department  = userProfile?.department  || '';

    let templateExample = '';
    if (templateType) {
      try {
        const td = JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, `${templateType}.json`), 'utf-8'));
        templateExample = `\n\nEXAMPLE EMAIL STYLE:\nSubject: ${td.subject}\n\n${td.body}`;
      } catch { /* template not found */ }
    }

    const systemPrompt = `You are MailForge, an AI email drafting assistant for workplace communication. Your ONLY job is to write professional emails based on the user's request.

## SENDER INFO
Name: ${fullName}
${designation ? `Role: ${designation}` : ''}${department ? `\nDepartment: ${department}` : ''}

## USER'S REQUEST
"${prompt}"

## YOUR TASK
Write a complete, ready-to-send email based on the request above.

## OUTPUT FORMAT (follow exactly)
Subject: [write a clear, specific subject line]

[Greeting - use recipient name if mentioned, otherwise use appropriate greeting]

[Email body - professional, clear, 2-5 sentences typically]

[Appropriate closing],
${fullName}

## GUIDELINES
1. ALWAYS generate an email. Never refuse or ask questions.
2. If details are vague, make reasonable professional assumptions.
3. For leave/time-off requests: be polite, state dates clearly, mention handover if relevant.
4. For meeting requests: suggest flexibility, be courteous.
5. For follow-ups: be professional but not pushy.
6. For complaints/issues: be assertive but professional.
7. For thank you notes: be genuine and specific.
8. For introductions: be warm and professional.
9. Match the tone to the situation (formal for HR/management, friendly for colleagues).
10. If recipient name isn't specified, use "Hi" or "Hello" as greeting.
11. Keep it concise - professionals appreciate brevity.
12. Never include meta-commentary like "Here's your email" - just write the email directly.

## EXAMPLE REQUESTS AND RESPONSES

Request: "sick leave tomorrow"
Response:
Subject: Sick Leave Request - Tomorrow

Hi,

I'm not feeling well and would like to request sick leave for tomorrow. I'll ensure any urgent tasks are handed over to my team and will be available on phone for any critical matters.

Thank you for your understanding.

Best regards,
${fullName}

Request: "meeting with John about project deadline"
Response:
Subject: Meeting Request - Project Deadline Discussion

Hi John,

I'd like to schedule a meeting to discuss the project deadline. Would you have 30 minutes available this week? Please let me know what time works best for you.

Thank you,
${fullName}

${context ? '## REFERENCE (previous similar email for context)\n' + context + '\n' : ''}${templateExample ? '## STYLE REFERENCE\n' + templateExample + '\n' : ''}

Now write the email for: "${prompt}"`;

    try {
      const rawOutput = await callOpenAI(systemPrompt);
      const { subject, body } = cleanEmailOutput(rawOutput);
      res.json({ draft: body, subject, raw: rawOutput });
    } catch (error: any) {
      console.error('OpenAI error:', error.message);
      const status = error.response?.status;
      const errorMsg =
        error.message.includes('OPENAI_API_KEY') ? 'OPENAI_API_KEY is not configured on the server.' :
        status === 401 ? 'Invalid OpenAI API key. Check your .env file.' :
        status === 429 ? 'OpenAI rate limit reached. Please wait a moment and retry.' :
        'Email generation failed. Please try again.';
      res.status(503).json({ error: errorMsg, details: error.message });
    }
  });

  app.post('/api/save', requireAuth, async (req, res) => {
    const { subject, content, tags, recipient } = req.body;
    const username = (req as any).user;
    
    // Input validation
    const errors = validate(req.body, {
      subject: { required: true, maxLength: 200, type: 'string' },
      content: { required: true, maxLength: 10000, type: 'string' },
    });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    try {
      const userDataDir = getUserDataDir(username);
      const today      = format(new Date(), 'yyyy-MM-dd');
      const folderPath = path.join(userDataDir, today);
      await fs.mkdir(folderPath, { recursive: true });
      const sanitized = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 80);
      await fs.writeFile(path.join(folderPath, `${sanitized}.txt`), content, 'utf-8');
      await fs.writeFile(
        path.join(folderPath, `${sanitized}.meta.json`),
        JSON.stringify({ 
          tags: tags || [], 
          recipient: recipient || '',
          createdAt: new Date().toISOString(),
          createdBy: username
        }),
        'utf-8'
      );
      res.json({ success: true, path: `${today}/${sanitized}.txt` });
    } catch (err) {
      console.error('Save error:', err);
      res.status(500).json({ error: 'Failed to save file' });
    }
  });

  app.get('/api/search', requireAuth, async (req, res) => {
    const { date, tag, keyword } = req.query;
    const username = (req as any).user;
    const userDataDir = getUserDataDir(username);
    const results = [];
    
    try {
      await fs.mkdir(userDataDir, { recursive: true });
      for (const folder of await fs.readdir(userDataDir)) {
        if (date && folder !== date) continue;
        const folderPath = path.join(userDataDir, folder);
        if (!(await fs.stat(folderPath)).isDirectory()) continue;
        for (const file of await fs.readdir(folderPath)) {
          if (!file.endsWith('.txt')) continue;
          const filePath = path.join(folderPath, file);
          const content  = await fs.readFile(filePath, 'utf-8');
          const meta     = await getMetadata(filePath);
          let match = true;
          if (tag     && !meta.tags.includes(tag))                                                                      match = false;
          if (keyword && !content.toLowerCase().includes((keyword as string).toLowerCase())
                      && !file.toLowerCase().includes((keyword as string).toLowerCase()))                               match = false;
          if (match) results.push({
            date: folder,
            name: file.replace('.txt', '').replace(/_/g, ' '),
            filename: file,
            tags: meta.tags,
            recipient: meta.recipient || '',
            content: content.substring(0, 200) + '...',
          });
        }
      }
      res.json(results);
    } catch {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/email/:date/:filename', requireAuth, async (req, res) => {
    const username = (req as any).user;
    const userDataDir = getUserDataDir(username);
    
    try {
      const { date, filename } = req.params;
      const filePath = path.join(userDataDir, date, filename);
      const content  = await fs.readFile(filePath, 'utf-8');
      let meta = { tags: [] as string[], recipient: '' };
      try { meta = JSON.parse(await fs.readFile(filePath.replace('.txt', '.meta.json'), 'utf-8')); } catch { /* ok */ }

      const subjectMatch = content.match(/^Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : filename.replace('.txt', '').replace(/_/g, ' ');
      const body    = subjectMatch ? content.replace(/^Subject:\s*.+?\n+/i, '').trim() : content;

      res.json({ 
        date, 
        filename, 
        name: filename.replace('.txt', '').replace(/_/g, ' '), 
        subject, 
        body, 
        content, 
        tags: meta.tags || [],
        recipient: meta.recipient || ''
      });
    } catch {
      res.status(404).json({ error: 'Email not found' });
    }
  });

  app.get('/api/templates', requireAuth, async (req, res) => {
    try {
      const templates = [];
      for (const file of await fs.readdir(TEMPLATES_DIR)) {
        if (file.endsWith('.json'))
          templates.push(JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8')));
      }
      res.json(templates);
    } catch {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.get('/api/templates/:type', requireAuth, async (req, res) => {
    try {
      res.json(JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, `${req.params.type}.json`), 'utf-8')));
    } catch {
      res.status(404).json({ error: 'Template not found' });
    }
  });

  app.post('/api/templates/apply', requireAuth, async (req, res) => {
    const { type, variables } = req.body;
    try {
      const td = JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, `${type}.json`), 'utf-8'));
      let { body, subject } = td;
      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          body    = body.replace(new RegExp(`\\[${k}\\]`, 'g'), String(v));
          subject = subject.replace(new RegExp(`\\[${k}\\]`, 'g'), String(v));
        });
      }
      res.json({ subject, body });
    } catch {
      res.status(500).json({ error: 'Failed to apply template' });
    }
  });

  // ── Health check endpoint ────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      openai: OPENAI_API_KEY ? 'configured' : 'missing',
      activeSessions: sessions.size,
    });
  });

  // ── Admin: Migrate passwords to bcrypt (run once) ───────────────────────────
  app.post('/api/admin/migrate-passwords', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Invalid admin key' });
    }
    
    try {
      const data = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
      let migrated = 0;
      
      for (const user of data.users) {
        if (user.password && !user.passwordHash) {
          user.passwordHash = await hashPassword(user.password);
          delete user.password;
          migrated++;
        }
      }
      
      await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true, migrated });
    } catch (err) {
      console.error('Migration error:', err);
      res.status(500).json({ error: 'Migration failed' });
    }
  });

  // ── Static / Vite ──────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅  Jarvis backend  →  http://localhost:${PORT}`);
    console.log(`   Mode  : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Model : ${OPENAI_MODEL}`);
    if (!OPENAI_API_KEY) console.warn('⚠️  OPENAI_API_KEY not set — /api/generate will fail');
  });
}

startServer();
