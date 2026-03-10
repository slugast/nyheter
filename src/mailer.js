const { Resend } = require('resend');

function mdToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#### (.+)$/gm, '<h4 style="color:#6366f1;margin:1em 0 .3em">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#6366f1;margin:1em 0 .3em">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#6366f1;margin:1.2em 0 .4em">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:0 0 .5em">$1</h1>')
    .replace(/\n\n/g, '</p><p style="margin:.7em 0">')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p style="margin:.7em 0">').replace(/$/, '</p>');
}

async function sendReport({ to, topic, content, generatedAt }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY saknas, hoppar över e-post');
    return;
  }

  const date = new Date(generatedAt + 'Z').toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm', dateStyle: 'full', timeStyle: 'short'
  });

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;padding:2rem;margin:0">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#6366f1;padding:1.5rem 2rem">
      <h1 style="color:#fff;margin:0;font-size:1.3rem">${topic}</h1>
      <p style="color:rgba(255,255,255,.75);margin:.3rem 0 0;font-size:.875rem">${date}</p>
    </div>
    <div style="padding:2rem;color:#1f2937;line-height:1.7;font-size:.95rem">
      ${mdToHtml(content)}
    </div>
    <div style="padding:1rem 2rem;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:.8rem">
      Genererad av AI-nyhetsbevakaren
    </div>
  </div>
</body>
</html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject: `Nyheter: ${topic} — ${date}`,
    html
  });

  if (error) throw new Error(error.message);
  console.log(`[mailer] E-post skickad till ${to}`);
}

module.exports = { sendReport };
