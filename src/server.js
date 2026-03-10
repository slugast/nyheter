require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const { requireLogin, login, getUserById } = require('./auth');
const { scheduleJob, unscheduleJob, loadAllJobs } = require('./scheduler');
const { generateReport } = require('./claude');
const { sendReport } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'byt-detta-i-produktion',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 vecka
}));

// Lägg till user på alla requests
app.use((req, res, next) => {
  if (req.session.userId) {
    req.user = getUserById(req.session.userId);
  }
  next();
});

// Skicka HTML-filer
function sendView(res, file) {
  res.sendFile(path.join(__dirname, '..', 'views', file));
}

// ─── Publika rutter ───────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.get('/login', (req, res) => sendView(res, 'login.html'));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await login(username, password);
  if (!user) return res.redirect('/login?error=1');
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Publik rapport-sida: /r/:slug
app.get('/r/:slug', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE slug = ?').get(req.params.slug);
  if (!job) return res.status(404).send('Hittades inte');
  sendView(res, 'report.html');
});

// API för publik rapport-sida
app.get('/api/r/:slug', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE slug = ?').get(req.params.slug);
  if (!job) return res.status(404).json({ error: 'Hittades inte' });

  const reports = db.prepare(
    'SELECT * FROM reports WHERE job_id = ? ORDER BY generated_at DESC LIMIT 20'
  ).all(job.id);

  res.json({ job, reports });
});

// ─── Skyddade rutter ──────────────────────────────────────────────────────────

app.get('/dashboard', requireLogin, (req, res) => sendView(res, 'dashboard.html'));

app.get('/api/me', requireLogin, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE user_id = ?').get(req.user.id);
  res.json({ user: req.user, job: job || null });
});

// Spara/uppdatera jobb
app.post('/api/job', requireLogin, (req, res) => {
  const { topic, slug, cron_expr, email, enabled } = req.body;

  if (!topic || !slug || !cron_expr) {
    return res.status(400).json({ error: 'topic, slug och cron_expr krävs' });
  }

  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const isEnabled = enabled === true || enabled === 'true' || enabled === 1 ? 1 : 0;
  const safeEmail = email || null;

  const existing = db.prepare('SELECT * FROM jobs WHERE user_id = ?').get(req.user.id);

  if (existing) {
    const slugConflict = db.prepare('SELECT id FROM jobs WHERE slug = ? AND id != ?').get(safeSlug, existing.id);
    if (slugConflict) return res.status(409).json({ error: 'Slug används redan' });

    db.prepare(`
      UPDATE jobs SET topic = ?, slug = ?, cron_expr = ?, email = ?, enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(topic, safeSlug, cron_expr, safeEmail, isEnabled, existing.id);

    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(existing.id);
    unscheduleJob(existing.id);
    scheduleJob(updated);
    return res.json({ job: updated });
  } else {
    const slugConflict = db.prepare('SELECT id FROM jobs WHERE slug = ?').get(safeSlug);
    if (slugConflict) return res.status(409).json({ error: 'Slug används redan' });

    const result = db.prepare(
      'INSERT INTO jobs (user_id, topic, slug, cron_expr, email, enabled) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, topic, safeSlug, cron_expr, safeEmail, isEnabled);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
    scheduleJob(job);
    return res.json({ job });
  }
});

// Kör jobb manuellt
app.post('/api/job/run', requireLogin, async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE user_id = ?').get(req.user.id);
  if (!job) return res.status(404).json({ error: 'Inget jobb konfigurerat' });

  try {
    const content = await generateReport(job.topic);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('INSERT INTO reports (job_id, content) VALUES (?, ?)').run(job.id, content);
    if (job.email) {
      sendReport({ to: job.email, topic: job.topic, content, generatedAt: now })
        .catch(err => console.error('[mailer] Misslyckades:', err.message));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/run]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

loadAllJobs();

app.listen(PORT, () => {
  console.log(`Nyheter körs på port ${PORT}`);
});
