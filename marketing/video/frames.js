// Renders video.html frame by frame. Usage: node frames.js <w> <h> <outdir> [fps] [times(comma list) for stills]
const { chromium } = require('playwright');
const fs = require('fs');
const [, , w = '1920', h = '1080', out = 'out', fps = '30', stills] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(`http://127.0.0.1:8765/video.html?w=${w}&h=${h}`);
  await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
  fs.mkdirSync(out, { recursive: true });
  const times = stills ? stills.split(',').map(Number) : [...Array(Math.round(48 * +fps))].map((_, i) => i / +fps);
  let n = 0;
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    await p.screenshot({ path: `${out}/${stills ? `t${t}` : String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    n++;
    if (!stills && n % 150 === 0) console.log('frame', n);
  }
  await b.close();
})();
