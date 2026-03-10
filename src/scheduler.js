const cron = require('node-cron');
const db = require('./db');
const { generateReport } = require('./claude');
const { sendReport } = require('./mailer');

const activeTasks = new Map(); // jobId -> cron task

function scheduleJob(job) {
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id).stop();
  }

  if (!job.enabled) return;

  if (!cron.validate(job.cron_expr)) {
    console.warn(`[scheduler] Ogiltigt cron-uttryck för jobb ${job.id}: ${job.cron_expr}`);
    return;
  }

  const task = cron.schedule(job.cron_expr, async () => {
    console.log(`[scheduler] Kör jobb ${job.id}: ${job.topic}`);
    try {
      const content = await generateReport(job.topic);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('INSERT INTO reports (job_id, content) VALUES (?, ?)').run(job.id, content);
      console.log(`[scheduler] Rapport sparad för jobb ${job.id}`);
      if (job.email) {
        sendReport({ to: job.email, topic: job.topic, content, generatedAt: now })
          .catch(err => console.error('[mailer] Misslyckades:', err.message));
      }
    } catch (err) {
      console.error(`[scheduler] Fel för jobb ${job.id}:`, err.message);
    }
  }, { timezone: 'Europe/Stockholm' });

  activeTasks.set(job.id, task);
  console.log(`[scheduler] Schemalagt jobb ${job.id} (${job.cron_expr}): ${job.topic}`);
}

function unscheduleJob(jobId) {
  if (activeTasks.has(jobId)) {
    activeTasks.get(jobId).stop();
    activeTasks.delete(jobId);
  }
}

function loadAllJobs() {
  const jobs = db.prepare('SELECT * FROM jobs WHERE enabled = 1').all();
  jobs.forEach(scheduleJob);
  console.log(`[scheduler] Laddade ${jobs.length} aktiva jobb`);
}

module.exports = { scheduleJob, unscheduleJob, loadAllJobs };
