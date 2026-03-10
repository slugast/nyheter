const { spawn } = require('child_process');

function generateReport(topic) {
  return new Promise((resolve, reject) => {
    const prompt = `Använd dina sökverktyg för att hitta de senaste nyheterna om följande ämne, och skriv sedan en rapport på svenska:

Ämne: ${topic}

Välj neutrala och trovärdiga källor (internationella nyhetsbyråer, etablerade medier). Presentera olika perspektiv utan att ta ställning.

Strukturera rapporten med dessa avsnitt i ordning:

## Sammanfattning
2–3 meningar om det viktigaste just nu.

## Viktiga händelser
Punktlista med de senaste händelserna från de senaste 24 timmarna.

## Perspektiv
En markdown-tabell som visar hur olika sidor ser på konflikten. Använd exakt detta format:

| Fråga | [Sida A] | [Sida B] |
|---|---|---|
| Civila offer | Synen från sida A | Synen från sida B |
| Diplomati | ... | ... |

## Källor
En punktlista med klickbara markdown-länkar till de faktiska artiklar du läst, i formatet:
- [Artikelrubrik – Källnamn](https://faktisk-url.com)

Det är viktigt att länkarna i Källor-avsnittet är riktiga URL:er till artiklar du faktiskt besökt under din sökning.`;

    console.log(`[claude] Genererar rapport för: ${topic}`);

    const child = spawn('claude', [
      '-p', prompt,
      '--dangerously-skip-permissions'
    ], {
      timeout: 5 * 60 * 1000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'dumb' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => {
      process.stdout.write('[claude] ' + d.toString());
      stdout += d.toString();
    });
    child.stderr.on('data', d => {
      process.stderr.write('[claude:err] ' + d.toString());
      stderr += d.toString();
    });

    child.on('close', code => {
      if (code !== 0) {
        console.error(`[claude] Avslutade med kod ${code}`);
        return reject(new Error(stderr || `Exitkod ${code}`));
      }
      const output = stdout.trim();
      if (!output) return reject(new Error('Claude returnerade tomt svar'));
      console.log(`[claude] Klar, ${output.length} tecken`);
      resolve(output);
    });

    child.on('error', err => {
      console.error('[claude] Spawn-fel:', err.message);
      reject(err);
    });
  });
}

module.exports = { generateReport };
