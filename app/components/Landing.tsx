'use dom';
// The website's front page for visitors who aren't signed in. Plain HTML, CSS and a canvas so it
// can do things a phone screen can't: a graph-paper background your cursor highlights, stickers you
// can drag, a syllabus you drop in, a panic button. Square edges, ink rules, highlighter colours.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react';

type Props = { onStart: () => void; onSignIn: () => void; onLegal: (doc: 'privacy' | 'terms') => void; dom?: import('expo/dom').DOMProps };

const C = { blue: '#3442F5', pink: '#F0457E', green: '#0F9F74', orange: '#F07A12', purple: '#8B4DF0', yellow: '#FFD43B', ink: '#14162E' };
const FOUND = [
  { label: 'Assignment 1', day: 1, col: C.blue },
  { label: 'Quiz 1', day: 3, col: C.pink },
  { label: 'Midterm', day: 5, col: C.orange },
  { label: 'Project', day: 6, col: C.green },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CODES = ['COMP 202', 'MATH 140', 'ECON 101', 'PSYC 100', 'BIOL 112', 'CHEM 110', 'PHYS 131', 'MGCR 211', 'ENGL 199', 'STAT 230', 'HIST 101', 'LAW 1001', 'ECSE 551', 'COMP 535', 'ACCT 351', 'PHIL 200'];

const ANSWERS: Record<string, { label: string; text: string }> = {
  simple: { label: "Like I'm 5", text: 'A derivative is just **speed**. Position changing fast? Big derivative. Standing still? Zero. That\'s it.' },
  exam: { label: 'Exam mode', text: '**They ask:** "find dy/dx". **To score:** name the rule, one line per step, box the answer. **Trap:** forgetting the chain rule on (3x+1)².' },
  maths: { label: 'Show the maths', text: 'f′(x) = lim h→0 [f(x+h) − f(x)] / h.  For x²:  [(x+h)² − x²] / h = 2x + h → **2x**.' },
  example: { label: 'Example', text: 'Drive 100 km in 1 hour: average speed 100 km/h. The derivative is your speed **at one exact moment**. Your speedometer.' },
};

const STICKERS = [
  { id: 'a', x: 0.06, y: 0.12, r: -7, bg: C.pink, fg: '#fff', top: 'Midterm', big: 'in 3 days' },
  { id: 'b', x: 0.5, y: 0.02, r: 5, bg: C.blue, fg: '#fff', top: 'Today', big: '2h 15m' },
  { id: 'c', x: 0.12, y: 0.55, r: -3, bg: C.yellow, fg: C.ink, top: 'Tutor', big: '"simpler pls"' },
  { id: 'd', x: 0.56, y: 0.48, r: 8, bg: C.green, fg: '#fff', top: 'Done', big: '✓ Lecture 7' },
];

const bold = (s: string) => s.split('**').map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));

export default function Landing({ onStart, onSignIn, onLegal }: Props) {
  const [stage, setStage] = useState<'idle' | 'over' | 'reading' | 'found' | 'planned'>('idle');
  const [shown, setShown] = useState(0);
  const [mode, setMode] = useState<keyof typeof ANSWERS>('simple');
  const [typed, setTyped] = useState('');
  const [daysLeft, setDaysLeft] = useState(7);
  const [confetti, setConfetti] = useState(0);
  const [panic, setPanic] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Sections slide in once as they scroll into view.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { root, threshold: 0.18 });
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function drop() {
    if (stage !== 'idle' && stage !== 'over') return;
    setStage('reading'); setShown(0);
    later(1300, () => setStage('found'));
    FOUND.forEach((_, i) => later(1500 + i * 380, () => setShown(i + 1)));
    later(1500 + FOUND.length * 380 + 500, () => { setStage('planned'); setConfetti((c) => c + 1); });
  }
  function reset() { timers.current.forEach(clearTimeout); timers.current = []; setStage('idle'); setShown(0); }

  useEffect(() => {
    const full = ANSWERS[mode].text;
    let i = 0;
    setTyped('');
    const id = setInterval(() => { i += 3; setTyped(full.slice(0, i)); if (i >= full.length) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [mode]);

  const mood = daysLeft <= 2 ? { t: 'EMERGENCY MODE', d: 'Past papers and your cheat sheet. Nothing new.', c: C.pink }
    : daysLeft <= 6 ? { t: 'Crunch time', d: 'Practice questions every day. Weak topics first.', c: C.orange }
    : daysLeft <= 14 ? { t: 'Right on time', d: 'One lecture a day, a quick quiz after each.', c: C.blue }
    : { t: 'Chill', d: 'Short sessions. Future you says thanks.', c: C.green };
  const sessions = Math.min(28, Math.round(daysLeft * (daysLeft <= 6 ? 2 : 1.2)));

  const [shaking, setShaking] = useState(false);
  function hitPanic() { setPanic((p) => p + 1); setShaking(true); later(500, () => setShaking(false)); }

  return (
    <div className={`lp ${shaking ? 'shake' : ''}`} ref={scroller}>
      <style>{CSS}</style>
      <Paper scroller={scroller} />
      {confetti > 0 && <Confetti key={confetti} />}

      <nav className="nav">
        <div className="brand"><Mark size={28} /><span>StudyBuddy</span></div>
        <div className="navr">
          <button className="link" onClick={() => onSignIn()}>Log in</button>
          <button className="btn small" onClick={() => onStart()}>Start free</button>
        </div>
      </nav>

      <header className="hero">
        <div className="heroText">
          <p className="kicker">For uni and college students in Canada and the UK</p>
          <h1>
            <span className="w">Your</span>{' '}<span className="w">whole</span>{' '}<span className="w">semester,</span>{' '}<span className="w auto">sorted.</span>
          </h1>
          <p className="sub">Drop your syllabus. Get every deadline, a plan for each day, and a tutor that read your slides.</p>
          <div className="ctas">
            <button className="btn big" onClick={() => onStart()}>Start free →</button>
            <button className="btn ghost big" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}>Try it first</button>
          </div>
          <p className="tiny">Move your mouse (or finger). It's a highlighter.</p>
        </div>
        <Stickers />
      </header>

      <div className="marquee" aria-hidden><div className="track">{[...CODES, ...CODES].map((c, i) => <span key={i}>{c}<i style={{ background: Object.values(C)[i % 6] }} /></span>)}</div></div>

      <section id="try" className="try reveal">
        <div className="sectionHead"><span className="num">01</span><h2>Drag the syllabus in.</h2></div>
        <div className="board">
          <div className={`paper ${stage !== 'idle' && stage !== 'over' ? 'used' : ''}`} draggable={stage === 'idle' || stage === 'over'}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', 'syllabus')} onClick={drop} title="Drag me, or just click">
            <div className="ptitle">COMP 202<br />syllabus.pdf</div>
            {[90, 70, 84, 60, 78, 50, 66].map((w, i) => <div key={i} className="line" style={{ width: `${w}%` }} />)}
            <div className="grab">DRAG ME →</div>
          </div>
          <div className={`drop ${stage}`} onDragOver={(e) => { e.preventDefault(); if (stage === 'idle') setStage('over'); }}
            onDragLeave={() => stage === 'over' && setStage('idle')} onDrop={(e) => { e.preventDefault(); drop(); }} onClick={drop}>
            {stage === 'idle' || stage === 'over' ? (
              <div className="dropHint"><b>{stage === 'over' ? 'LET GO' : 'DROP IT HERE'}</b><span>or tap the paper</span></div>
            ) : (
              <div className="result">
                <div className="resHead">
                  <b>{stage === 'reading' ? 'Reading…' : stage === 'found' ? `${shown} deadline${shown === 1 ? '' : 's'} found` : 'Week planned.'}</b>
                  {stage === 'planned' && <button className="link" onClick={(e) => { e.stopPropagation(); reset(); }}>↺ again</button>}
                </div>
                {stage === 'reading' && <div className="scan"><div /></div>}
                <div className="week">
                  {DAYS.map((d, i) => (
                    <div key={d} className="day">
                      <span>{d}</span>
                      {FOUND.slice(0, shown).filter((f) => f.day === i).map((f) => <div key={f.label} className="due pop" style={{ background: f.col }}>{f.label}</div>)}
                      {stage === 'planned' && Array.from({ length: i === 6 ? 1 : 2 }).map((_, j) => <div key={j} className="sess pop" style={{ animationDelay: `${(i * 2 + j) * 40}ms`, background: Object.values(C)[(i + j) % 5] }} />)}
                    </div>
                  ))}
                </div>
                {stage === 'planned' && <button className="btn" onClick={(e) => { e.stopPropagation(); onStart(); }}>Do this with my courses →</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="tutor reveal">
        <div className="sectionHead"><span className="num">02</span><h2>Didn't get it? Change the answer.</h2></div>
        <div className="chat">
          <div className="q">what's a derivative 😭</div>
          <div className="a"><span className="sb">SB</span><p>{bold(typed)}<span className="caret" /></p></div>
          <div className="modes">
            {(Object.keys(ANSWERS) as (keyof typeof ANSWERS)[]).map((k) => (
              <button key={k} className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{ANSWERS[k].label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="exam reveal" style={{ ['--mood' as string]: mood.c }}>
        <div className="flood" />
        <div className="sectionHead light"><span className="num">03</span><h2>When's your exam?</h2></div>
        <div className="examGrid">
          <div className="big">{daysLeft}<small>{daysLeft === 1 ? 'DAY' : 'DAYS'}</small></div>
          <div className="examRight">
            <div className="mood"><b>{mood.t}</b><span>{mood.d}</span></div>
            <input type="range" min={1} max={30} value={daysLeft} onChange={(e) => setDaysLeft(+e.target.value)} aria-label="Days until your exam" />
            <div className="blocks">{Array.from({ length: sessions }).map((_, i) => <div key={i} style={{ animationDelay: `${i * 15}ms` }} />)}</div>
            <p className="tinyL">{sessions} study sessions, sized to the hours you actually have.</p>
          </div>
        </div>
      </section>

      <section className="panicSec reveal">
        <button className="panic" onClick={hitPanic}><span>PANIC</span></button>
        <div className="panicText">
          {panic ? (
            <>
              <h3>Okay. Breathe.</h3>
              <ol>
                <li><b>Tonight:</b> 45 min on the topic you know least.</li>
                <li><b>Tomorrow:</b> one past paper, timed. Mark it.</li>
                <li><b>Day after:</b> redo only what you got wrong.</li>
              </ol>
              <button className="btn" onClick={() => onStart()}>Make my real plan →</button>
            </>
          ) : (
            <>
              <h3>Exam tomorrow and nothing done?</h3>
              <p>Press the button. Seriously.</p>
            </>
          )}
        </div>
      </section>

      <section className="price reveal">
        <div className="sectionHead"><span className="num">04</span><h2>Free to start.</h2></div>
        <div className="plans">
          <div className="plan free">
            <div className="ptop"><b>Free</b><div className="cost">$0</div></div>
            <ul><li>2 courses</li><li>7 uploads a month</li><li>20 tutor messages</li><li>Study plan + calendar</li></ul>
            <button className="btn dark" onClick={() => onStart()}>Start free →</button>
          </div>
          <div className="plan pro">
            <div className="ptop"><b>Pro</b><div className="cost">C$9.99<small>/mo</small></div></div>
            <ul><li>All your courses</li><li>200 uploads</li><li>1,500 tutor messages</li><li>Cheat sheets + practice papers</li></ul>
            <button className="btn yellow" onClick={() => onStart()}>7 days free →</button>
          </div>
        </div>
      </section>

      <section className="end reveal">
        <h2><span className="w">Stop</span> <span className="w">planning.</span><br /><span className="w">Start</span> <span className="w auto">studying.</span></h2>
        <button className="btn big yellow" onClick={() => onStart()}>Start free →</button>
      </section>

      <footer>
        <div className="brand"><Mark size={20} /><span>StudyBuddy</span></div>
        <div><button className="link" onClick={() => onLegal('privacy')}>Privacy</button><button className="link" onClick={() => onLegal('terms')}>Terms</button><button className="link" onClick={() => onSignIn()}>Log in</button></div>
      </footer>
    </div>
  );
}

/** Graph paper behind everything. The pointer leaves a fading highlighter stroke; the grid bends near it. */
function Paper({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0;
    const pts: { x: number; y: number; t: number }[] = [];
    let mx = -9999, my = -9999;
    const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const move = (x: number, y: number) => { mx = x; my = y; pts.push({ x, y, t: performance.now() }); if (pts.length > 80) pts.shift(); };
    const pm = (e: PointerEvent) => move(e.clientX, e.clientY);
    window.addEventListener('pointermove', pm, { passive: true });
    window.addEventListener('resize', size);
    const G = 28;
    const draw = () => {
      const now = performance.now(), d = dark();
      const off = (scroller.current?.scrollTop ?? 0) * 0.25;
      ctx.clearRect(0, 0, w, h);
      // grid: lines bend away from the pointer
      ctx.lineWidth = 1;
      ctx.strokeStyle = d ? 'rgba(125,136,255,0.13)' : 'rgba(52,66,245,0.09)';
      const bend = (x: number, y: number) => {
        const dx = x - mx, dy = y - my, dist = Math.hypot(dx, dy);
        if (dist > 160 || still) return [x, y];
        const f = (1 - dist / 160) * 14;
        return [x + (dx / (dist || 1)) * f, y + (dy / (dist || 1)) * f];
      };
      for (let x = 0; x <= w + G; x += G) {
        ctx.beginPath();
        for (let y = -G; y <= h + G; y += 14) { const [bx, by] = bend(x, y - (off % G)); y === -G ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by); }
        ctx.stroke();
      }
      for (let y = -G; y <= h + G; y += G) {
        const yy = y - (off % G);
        ctx.beginPath();
        for (let x = 0; x <= w + 14; x += 14) { const [bx, by] = bend(x, yy); x === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by); }
        ctx.stroke();
      }
      // margin line, like exam paper
      ctx.strokeStyle = d ? 'rgba(240,69,126,0.35)' : 'rgba(240,69,126,0.28)';
      const mx0 = w < 600 ? 22 : 56; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx0, 0); ctx.lineTo(mx0, h); ctx.stroke();
      // highlighter trail
      while (pts.length && now - pts[0].t > 900) pts.shift();
      if (!still && pts.length > 1) {
        ctx.lineCap = 'square'; ctx.lineJoin = 'round';
        for (let i = 1; i < pts.length; i++) {
          const a = 1 - (now - pts[i].t) / 900;
          ctx.strokeStyle = `rgba(255,212,59,${(d ? 0.35 : 0.55) * a})`;
          ctx.lineWidth = 22;
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', pm); window.removeEventListener('resize', size); };
  }, [scroller]);
  return <canvas ref={ref} className="paperBg" aria-hidden />;
}

/** App snippets you can pick up and throw around. */
function Stickers() {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => Object.fromEntries(STICKERS.map((s) => [s.id, { x: s.x, y: s.y, r: s.r, z: 1 }])));
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const top = useRef(10);
  function down(e: RPointerEvent<HTMLDivElement>, id: string) {
    const r = box.current!.getBoundingClientRect();
    const p = pos[id];
    drag.current = { id, dx: e.clientX - (r.left + p.x * r.width), dy: e.clientY - (r.top + p.y * r.height) };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPos((s) => ({ ...s, [id]: { ...s[id], r: 0, z: ++top.current } }));
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const d = drag.current; if (!d) return;
    const r = box.current!.getBoundingClientRect();
    const x = Math.max(-0.05, Math.min(0.75, (e.clientX - d.dx - r.left) / r.width));
    const y = Math.max(-0.05, Math.min(0.8, (e.clientY - d.dy - r.top) / r.height));
    setPos((s) => ({ ...s, [d.id]: { ...s[d.id], x, y } }));
  }
  function up() {
    const d = drag.current; if (!d) return;
    drag.current = null;
    setPos((s) => ({ ...s, [d.id]: { ...s[d.id], r: Math.round(Math.random() * 16 - 8) } }));
  }
  return (
    <div className="heroArt" ref={box} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {STICKERS.map((s) => {
        const p = pos[s.id];
        return (
          <div key={s.id} className="sticker" onPointerDown={(e) => down(e, s.id)}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `rotate(${p.r}deg)`, zIndex: p.z, background: s.bg, color: s.fg }}>
            <span>{s.top}</span><b>{s.big}</b>
          </div>
        );
      })}
      <div className="hint">↑ drag these</div>
    </div>
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="12" y="26" width="44" height="44" fill="#FFD43B" transform="rotate(-10 34 48)" />
      <rect x="28" y="30" width="44" height="44" fill="#F0457E" transform="rotate(4 50 52)" />
      <rect x="42" y="24" width="44" height="44" fill="#3442F5" transform="rotate(12 64 46)" />
    </svg>
  );
}

function Confetti() {
  const cols = Object.values(C);
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 80 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDelay: `${(i % 10) * 40}ms`, animationDuration: `${1200 + (i % 7) * 180}ms` }} />
      ))}
    </div>
  );
}

const CSS = `
:root {
  --display: BricolageGrotesque_800ExtraBold, 'Bricolage Grotesque', sans-serif;
  --head: BricolageGrotesque_700Bold, 'Bricolage Grotesque', sans-serif;
  --body: Figtree_400Regular, Figtree, system-ui, sans-serif;
  --semi: Figtree_600SemiBold, Figtree, system-ui, sans-serif;
  --bold: Figtree_700Bold, Figtree, system-ui, sans-serif;
  --ink: #14162E; --paper: #FBFBF6; --muted: #5E6286; --rule: #14162E; --soft: #EEEFF6;
  --blue: #3442F5; --yellow: #FFD43B; --pink: #F0457E; --green: #0F9F74;
}
@media (prefers-color-scheme: dark) { :root { --ink: #F2F3FF; --paper: #0D0F22; --muted: #9DA1C9; --rule: #F2F3FF; --soft: #1A1D38; } }
* { box-sizing: border-box; border-radius: 0 !important; }
html, body { margin: 0; background: var(--paper); }
.lp { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; max-width: 100vw; background: var(--paper); color: var(--ink); font-family: var(--body); -webkit-font-smoothing: antialiased; }
.paperBg { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.lp > *:not(.paperBg):not(.confetti) { position: relative; z-index: 1; }
h1, h2, h3, .big, .cost, .brand span, .num { font-family: var(--display); font-weight: normal; }
b, strong, button, .chip, .grab, .due, .q, .day > span, .track span, .kicker, mark { font-family: var(--bold); font-weight: normal; }
button { font-size: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--pink); outline-offset: 3px; }
.link { color: var(--muted); padding: 8px 10px; font-size: 15px; }
.link:hover { color: var(--ink); text-decoration: underline; text-decoration-thickness: 2px; }

/* buttons: ink slabs with a hard offset shadow that presses down */
.btn { background: var(--blue); color: #fff; padding: 14px 22px; font-size: 17px; border: 2.5px solid var(--rule); box-shadow: 5px 5px 0 var(--rule); transition: transform .08s, box-shadow .08s; letter-spacing: .01em; }
.btn:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 var(--rule); }
.btn:active { transform: translate(5px, 5px); box-shadow: 0 0 0 var(--rule); }
.btn.small { padding: 9px 14px; font-size: 15px; box-shadow: 3px 3px 0 var(--rule); }
.btn.big { padding: 18px 28px; font-size: 20px; }
.btn.ghost { background: var(--paper); color: var(--ink); }
.btn.yellow { background: var(--yellow); color: #14162E; }
.btn.dark { background: #14162E; color: var(--yellow); }
mark { background: linear-gradient(transparent 52%, rgba(255,212,59,.85) 52%); color: inherit; padding: 0 2px; }
@media (prefers-color-scheme: dark) { mark { background: linear-gradient(transparent 52%, rgba(255,212,59,.4) 52%); } }

.nav { display: flex; justify-content: space-between; align-items: center; padding: 14px clamp(16px, 4vw, 48px); position: sticky !important; top: 0; background: color-mix(in srgb, var(--paper) 85%, transparent); backdrop-filter: blur(8px); border-bottom: 2.5px solid var(--rule); z-index: 20 !important; }
.brand { display: flex; align-items: center; gap: 8px; font-size: 21px; letter-spacing: -.5px; }
.navr { display: flex; align-items: center; gap: 10px; }

.hero { display: grid; grid-template-columns: 1.15fr .85fr; gap: 24px; align-items: center; max-width: 1240px; margin: 0 auto; padding: clamp(28px, 6vw, 84px) clamp(16px, 4vw, 48px) 48px clamp(72px, 7vw, 96px); }
.kicker { display: inline-block; background: var(--ink); color: var(--paper); padding: 6px 10px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; margin: 0 0 22px; transform: rotate(-1.5deg); }
.hero h1 { font-size: clamp(54px, 8.6vw, 132px); line-height: .88; letter-spacing: -.05em; margin: 0 0 22px; }
.w { display: inline-block; background-image: linear-gradient(var(--yellow), var(--yellow)); background-repeat: no-repeat; background-position: 0 88%; background-size: 0% 38%; transition: background-size .35s cubic-bezier(.2,.8,.2,1); }
.w:hover { background-size: 100% 38%; }
.w.auto { background-size: 100% 38%; animation: swipe 1s .4s cubic-bezier(.2,.8,.2,1) both; }
@keyframes swipe { from { background-size: 0% 38%; } }
@media (prefers-color-scheme: dark) { .w { background-image: linear-gradient(rgba(255,212,59,.55), rgba(255,212,59,.55)); } }
.sub { font-size: clamp(19px, 2vw, 23px); line-height: 1.4; color: var(--muted); max-width: 32ch; margin: 0 0 30px; }
.ctas { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.tiny { color: var(--muted); font-size: 14px; }

.heroArt { position: relative; height: 440px; touch-action: none; }
.sticker { position: absolute; width: max-content; min-width: 170px; max-width: 240px; padding: 16px 18px 18px; border: 2.5px solid var(--rule); box-shadow: 8px 8px 0 var(--rule); cursor: grab; user-select: none; display: flex; flex-direction: column; gap: 2px; transition: transform .25s cubic-bezier(.3,1.6,.5,1), box-shadow .15s; }
.sticker:active { cursor: grabbing; box-shadow: 14px 14px 0 var(--rule); }
.sticker span { font-family: var(--bold); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
.sticker b { font-family: var(--display); font-size: 30px; line-height: 1.05; letter-spacing: -.03em; }
.hint { position: absolute; right: 4%; bottom: -4px; font-family: var(--bold); color: var(--pink); transform: rotate(-4deg); font-size: 15px; }

.marquee { overflow: hidden; border-block: 2.5px solid var(--rule); background: var(--ink); }
.track { display: flex; width: max-content; animation: slide 36s linear infinite; }
.track span { color: var(--paper); font-family: var(--display); font-size: 26px; padding: 14px 22px; white-space: nowrap; display: flex; align-items: center; gap: 22px; letter-spacing: -.02em; }
.track span i { width: 14px; height: 14px; display: inline-block; transform: rotate(45deg); }
@keyframes slide { to { transform: translateX(-50%); } }

section { max-width: 1240px; margin: 0 auto; padding: clamp(64px, 10vw, 130px) clamp(16px, 4vw, 48px) 0 clamp(72px, 7vw, 96px); }
.sectionHead { display: flex; align-items: baseline; gap: 18px; margin-bottom: 34px; border-bottom: 2.5px solid var(--rule); padding-bottom: 14px; }
.sectionHead.light { border-color: #fff; color: #fff; }
.num { font-size: 22px; color: var(--pink); }
.sectionHead.light .num { color: #fff; opacity: .8; }
section h2 { font-size: clamp(36px, 5.6vw, 72px); letter-spacing: -.045em; line-height: .95; margin: 0; }
.reveal { opacity: 0; transform: translateY(40px); transition: opacity .6s, transform .6s cubic-bezier(.2,.8,.2,1); }
.reveal.in { opacity: 1; transform: none; }

.board { display: grid; grid-template-columns: 230px 1fr; gap: 34px; align-items: stretch; }
.paper { background: #fff; color: #14162E; padding: 22px 18px; border: 2.5px solid #14162E; box-shadow: 8px 8px 0 #14162E; transform: rotate(-4deg); cursor: grab; position: relative; transition: transform .2s, opacity .3s; align-self: center; background-image: repeating-linear-gradient(transparent 0 23px, rgba(52,66,245,.12) 23px 24px); }
.paper:hover { transform: rotate(-1deg) translate(-3px, -3px); }
.paper.used { opacity: .25; transform: rotate(0) scale(.9); cursor: default; }
.ptitle { font-family: var(--display); font-size: 22px; line-height: 1.05; margin-bottom: 14px; }
.line { height: 8px; background: #DADCEB; margin: 10px 0; }
.grab { position: absolute; right: -16px; bottom: -16px; background: var(--yellow); color: #14162E; font-size: 13px; letter-spacing: .06em; padding: 7px 10px; border: 2px solid #14162E; transform: rotate(6deg); }
.drop { min-height: 340px; border: 3px dashed var(--rule); background: color-mix(in srgb, var(--paper) 70%, transparent); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; padding: 22px; }
.drop.over { background: var(--yellow); }
.drop.over .dropHint b { color: #14162E; }
.drop.reading, .drop.found, .drop.planned { border-style: solid; background: var(--paper); box-shadow: 8px 8px 0 var(--rule); cursor: default; }
.dropHint { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dropHint b { font-family: var(--display); font-size: clamp(32px, 4vw, 52px); letter-spacing: -.03em; }
.dropHint span { color: var(--muted); }
.result { width: 100%; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
.resHead { display: flex; justify-content: space-between; width: 100%; }
.resHead b { font-family: var(--display); font-size: 30px; letter-spacing: -.02em; }
.scan { width: 100%; height: 14px; background: var(--soft); overflow: hidden; border: 2px solid var(--rule); }
.scan div { height: 100%; width: 40%; background: var(--yellow); animation: scan .9s ease-in-out infinite alternate; }
@keyframes scan { to { transform: translateX(150%); } }
.week { display: grid; grid-template-columns: repeat(7, 1fr); width: 100%; border: 2px solid var(--rule); }
.day { display: flex; flex-direction: column; gap: 6px; min-height: 150px; padding: 8px 6px; border-right: 2px solid var(--rule); }
.day:last-child { border-right: 0; }
.day > span { font-size: 13px; color: var(--muted); text-align: center; text-transform: uppercase; letter-spacing: .05em; }
.due { color: #fff; font-size: 12.5px; padding: 6px; line-height: 1.15; border: 2px solid #14162E; }
.sess { height: 10px; opacity: .6; }
.pop { animation: pop .45s cubic-bezier(.3,1.7,.5,1) both; }
@keyframes pop { from { transform: scale(.2) translateY(-30px) rotate(-20deg); opacity: 0; } }

.chat { max-width: 780px; display: flex; flex-direction: column; gap: 22px; }
.q { align-self: flex-end; background: var(--pink); color: #fff; font-size: 20px; padding: 14px 20px; border: 2.5px solid var(--rule); box-shadow: 5px 5px 0 var(--rule); transform: rotate(1deg); }
.a { display: flex; gap: 14px; align-items: flex-start; min-height: 130px; }
.sb { flex: none; width: 38px; height: 38px; background: var(--yellow); color: #14162E; font-family: var(--display); display: grid; place-items: center; transform: rotate(-6deg); border: 2px solid #14162E; }
.a p { margin: 4px 0 0; font-size: clamp(20px, 2.4vw, 27px); line-height: 1.45; }
.caret { display: inline-block; width: 12px; height: 1.05em; background: var(--blue); vertical-align: -4px; margin-left: 4px; animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.modes { display: flex; gap: 12px; flex-wrap: wrap; padding-left: 52px; }
.chip { padding: 12px 18px; font-size: 16px; border: 2.5px solid var(--rule); background: var(--paper); transition: transform .08s, box-shadow .08s; box-shadow: 4px 4px 0 var(--rule); }
.chip:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--rule); }
.chip.on { background: var(--ink); color: var(--paper); transform: translate(4px, 4px); box-shadow: 0 0 0 var(--rule); }

.exam { position: relative; color: #fff; margin-top: clamp(64px, 10vw, 130px); padding-top: clamp(48px, 6vw, 80px); padding-bottom: clamp(48px, 6vw, 80px); max-width: none; }
.flood { position: absolute !important; inset: 0; background: var(--mood); transition: background .35s; z-index: 0 !important; border-block: 2.5px solid var(--rule); }
.exam > *:not(.flood) { position: relative; z-index: 1; max-width: 1100px; margin-left: auto; margin-right: auto; }
.examGrid { display: grid; grid-template-columns: auto 1fr; gap: clamp(24px, 5vw, 64px); align-items: center; }
.exam .big { font-size: clamp(120px, 22vw, 300px); letter-spacing: -.07em; line-height: .8; }
.exam .big small { font-size: .16em; letter-spacing: .1em; margin-left: 12px; font-family: var(--bold); }
.mood b { font-family: var(--display); font-size: clamp(30px, 4vw, 48px); display: block; letter-spacing: -.02em; }
.mood span { font-size: 19px; opacity: .9; }
.exam input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; background: rgba(255,255,255,.35); margin: 26px 0; cursor: pointer; border: 2px solid #fff; }
.exam input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 34px; height: 34px; background: #fff; border: 3px solid #14162E; box-shadow: 4px 4px 0 #14162E; }
.exam input[type=range]::-moz-range-thumb { width: 30px; height: 30px; background: #fff; border: 3px solid #14162E; box-shadow: 4px 4px 0 #14162E; }
.blocks { display: flex; flex-wrap: wrap; gap: 6px; }
.blocks div { width: 26px; height: 26px; background: #fff; border: 2px solid #14162E; animation: pop .35s cubic-bezier(.3,1.7,.5,1) both; }
.tinyL { opacity: .85; font-size: 15px; }

.panicSec { display: grid; grid-template-columns: auto 1fr; gap: clamp(28px, 6vw, 80px); align-items: center; }
#root .panic, .panic { width: clamp(180px, 22vw, 260px); aspect-ratio: 1; border-radius: 50% !important; background: #E5385F; border: 4px solid var(--rule); box-shadow: 0 14px 0 #8f1a35, 0 14px 0 4px var(--rule); color: #fff; transition: transform .08s, box-shadow .08s; position: relative; }
.panic span { font-family: var(--display); font-size: clamp(34px, 4vw, 50px); letter-spacing: .02em; }
.panic:hover { transform: translateY(-2px); }
.panic:active { transform: translateY(12px); box-shadow: 0 2px 0 #8f1a35, 0 2px 0 4px var(--rule); }
.panicText h3 { font-size: clamp(30px, 4vw, 52px); letter-spacing: -.03em; margin: 0 0 12px; line-height: 1; }
.panicText p { font-size: 20px; color: var(--muted); margin: 0; }
.panicText ol { font-size: clamp(18px, 2vw, 22px); line-height: 1.6; padding-left: 26px; margin: 0 0 22px; }
.shake .panicSec { animation: shake .45s; }
@keyframes shake { 20% { transform: translateX(-10px) rotate(-1deg); } 40% { transform: translateX(9px) rotate(1deg); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }

.plans { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; max-width: 980px; }
.plan { padding: 32px; display: flex; flex-direction: column; gap: 10px; border: 2.5px solid var(--rule); box-shadow: 10px 10px 0 var(--rule); transition: transform .15s; }
.plan:hover { transform: translate(-3px, -3px) rotate(-.5deg); }
.ptop { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: space-between; align-items: baseline; border-bottom: 2.5px solid currentColor; padding-bottom: 12px; }
.plan .ptop b { font-family: var(--display); font-size: 30px; }
.plan.free { background: var(--yellow); color: #14162E; }
.plan.pro { background: #3442F5; color: #fff; }
.cost { font-size: 54px; letter-spacing: -.04em; line-height: 1; }
.cost small { font-size: 18px; letter-spacing: 0; opacity: .8; font-family: var(--bold); }
.plan ul { margin: 10px 0 18px; padding-left: 0; list-style: none; font-size: 19px; line-height: 2; flex: 1; }
.plan li::before { content: '■'; margin-right: 10px; font-size: 12px; vertical-align: 3px; }
.plan .btn { border-color: #14162E; box-shadow: 5px 5px 0 #14162E; }

.end { text-align: left; padding-bottom: 40px; }
.end h2 { font-size: clamp(56px, 11vw, 168px); line-height: .86; letter-spacing: -.055em; margin-bottom: 36px; }
footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin: 70px 0 0; padding: 22px clamp(16px, 4vw, 48px) 36px clamp(72px, 7vw, 96px); border-top: 2.5px solid var(--rule); }

.confetti { position: fixed; inset: 0; pointer-events: none; z-index: 50; overflow: hidden; }
.confetti i { position: absolute; top: -20px; width: 10px; height: 14px; animation: fall linear forwards; }
@keyframes fall { to { top: 110%; transform: rotate(720deg) translateX(40px); } }

@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; padding-left: 72px; }
  .heroArt { height: 300px; }
  .sticker { min-width: 130px; padding: 12px 14px; box-shadow: 6px 6px 0 #14162E; } .sticker b { font-size: 23px; }
  section, footer { padding-left: 72px; padding-right: 16px; }
  .board, .plans, .panicSec, .examGrid { grid-template-columns: 1fr; }
  .paper { width: 210px; justify-self: center; }
  .week { grid-template-columns: repeat(7, minmax(0, 1fr)); } .day { min-height: 110px; padding: 5px 2px; } .due { font-size: 10px; padding: 3px; border-width: 1.5px; }
  .modes { padding-left: 0; }
  .panic { justify-self: center; }
  .exam { padding-left: 24px; padding-right: 24px; }
}
@media (max-width: 600px) { .hero, section, footer { padding-left: 36px; padding-right: 16px; } .hero h1 { font-size: clamp(40px, 12.5vw, 58px); } .exam { padding-left: 36px; } .kicker { font-size: 11px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .reveal { opacity: 1; transform: none; } }
`;
