// Användning: node scripts/create-user.js <användarnamn> <lösenord>
const bcrypt = require('bcrypt');
const db = require('../src/db');

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Användning: node scripts/create-user.js <användarnamn> <lösenord>');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Användare skapad: ${username} (id=${result.lastInsertRowid})`);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      console.error('Användarnamnet finns redan');
    } else {
      throw err;
    }
  }
})();
