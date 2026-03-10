# nyheter — instruktioner för Claude

## Git / push
**Pusha ALDRIG utan att användaren explicit skriver "pusha" eller "push".**
**När användaren ber om push: utför git add + commit + push direkt med Bash-verktyget.**

## Commit-meddelanden
Skriv alltid på **svenska**.

## Arbetsflöde
Gör ändringar lokalt → användaren testar → pusha BARA när användaren explicit ber om det.

## Stack
- Node.js + Express.js, port 3001
- SQLite via better-sqlite3 (`data/nyheter.db` i produktion, utesluten från git)
- node-cron (schemaläggning, timezone: Europe/Stockholm)
- Anthropic SDK med web_search_20250305
- express-session + bcrypt för auth

## Server
- Samma server som eipquiz: `linkan@eipquiz`, app i `~/nyheter`
- Körs med PM2: `NODE_ENV=production pm2 start src/server.js --name nyheter`
- Databas: `~/nyheter/data/nyheter.db`
- Env-fil: `~/nyheter/.env`

**Uppdatera servern:**
```bash
cd nyheter && git pull && npm install && pm2 restart nyheter
```

## Nginx
Lägg till i `/etc/nginx/sites-enabled/eipquiz`:
```nginx
location /nyheter/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```
OBS: trailing slash i proxy_pass strippar /nyheter-prefixet.

## Skapa användare
```bash
cd ~/nyheter && node scripts/create-user.js <användarnamn> <lösenord>
```

## URL-struktur
- `/` → redirect till /login eller /dashboard
- `/login` → inloggning
- `/dashboard` → konfigurera jobb (kräver inloggning)
- `/r/:slug` → publik rapport-sida (ingen inloggning)
- `/logout` → loggar ut

## Anthropic API
- Modell: claude-opus-4-6
- Tool: web_search_20250305
- Rapporter genereras på svenska
