'use dom';
// The website's front page: a student's desk. Notebook paper you can highlight with the cursor,
// sticky notes you can move, index cards, a clipboard, a tear-off exam calendar and margin scribbles.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react';

type Props = { onStart: () => void; onSignIn: () => void; onLegal: (doc: 'privacy' | 'terms') => void; dom?: import('expo/dom').DOMProps };

const C = { blue: '#3442F5', pink: '#FF7AA8', green: '#5BD6A6', orange: '#FFA94D', purple: '#B79BFF', yellow: '#FFE45E', ink: '#1B1E3F', red: '#E5385F' };
const FOUND = [
  { label: 'Assignment 1', day: 1, col: C.yellow },
  { label: 'Quiz 1', day: 3, col: C.pink },
  { label: 'Midterm', day: 5, col: C.orange },
  { label: 'Project', day: 6, col: C.green },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CODES = ['COMP 202', 'MATH 140', 'ECON 101', 'PSYC 100', 'BIOL 112', 'CHEM 110', 'PHYS 131', 'MGCR 211', 'ENGL 199', 'STAT 230', 'HIST 101', 'LAW 1001', 'ECSE 551', 'COMP 535', 'ACCT 351', 'PHIL 200'];

const ANSWERS: Record<string, { label: string; col: string; text: string }> = {
  simple: { label: "Like I'm 5", col: C.yellow, text: 'A derivative is just **speed**. Position changing fast? Big derivative. Standing still? Zero. That\'s it.' },
  exam: { label: 'Exam mode', col: C.pink, text: '**They ask:** "find dy/dx". **To score:** name the rule, one line per step, box the answer. **Trap:** forgetting the chain rule on (3x+1)².' },
  maths: { label: 'Show the maths', col: C.green, text: 'f′(x) = lim h→0 [f(x+h) − f(x)] / h.  For x²:  [(x+h)² − x²] / h = 2x + h → **2x**.' },
  example: { label: 'Example', col: C.orange, text: 'Drive 100 km in 1 hour: average 100 km/h. The derivative is your speed **at one exact moment**. Your speedometer.' },
};

const NOTES = [
  { id: 'a', x: 0.04, y: 0.08, r: -6, bg: C.pink, top: 'Midterm', big: 'in 3 days!!' },
  { id: 'b', x: 0.48, y: 0.0, r: 4, bg: C.yellow, top: 'Today', big: '2h 15m' },
  { id: 'c', x: 0.1, y: 0.52, r: -2, bg: C.green, top: 'Tutor said', big: '"chain rule"' },
  { id: 'd', x: 0.55, y: 0.46, r: 7, bg: C.purple, top: 'Done', big: '✓ Lecture 7' },
];

const bold = (s: string) => s.split('**').map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));

type Desk = 'paper' | 'mat' | 'navy' | 'blue';
const DEFAULT_DESK: Desk = 'mat';
const pickDesk = (): Desk => {
  try { const q = new URLSearchParams(window.location.search).get('desk'); if (q === 'paper' || q === 'mat' || q === 'navy' || q === 'blue') return q; } catch { /* no window during build */ }
  return DEFAULT_DESK;
};

export default function Landing({ onStart, onSignIn, onLegal }: Props) {
  const [desk] = useState<Desk>(pickDesk);
  const [stage, setStage] = useState<'idle' | 'over' | 'reading' | 'found' | 'planned'>('idle');
  const [shown, setShown] = useState(0);
  const [mode, setMode] = useState<keyof typeof ANSWERS>('simple');
  const [typed, setTyped] = useState('');
  const [daysLeft, setDaysLeft] = useState(7);
  const [flip, setFlip] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [panic, setPanic] = useState(0);
  const [shaking, setShaking] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { root, threshold: 0.15 });
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    // Depth: the whole desk leans toward the pointer, and cards tip under it.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      if (still) return;
      root.style.setProperty('--px', ((e.clientX / window.innerWidth) - 0.5).toFixed(3));
      root.style.setProperty('--py', ((e.clientY / window.innerHeight) - 0.5).toFixed(3));
      const el = (e.target as HTMLElement).closest?.('.tilt3d') as HTMLElement | null;
      if (last && last !== el) { last.style.setProperty('--rx', '0deg'); last.style.setProperty('--ry', '0deg'); last.style.setProperty('--gl', '0'); }
      if (el) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(0)}%`);
        el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(0)}%`);
        el.style.setProperty('--gl', '1');
      }
      last = el;
    };
    root.addEventListener('pointermove', move);
    return () => { io.disconnect(); root.removeEventListener('pointermove', move); };
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

  const mood = daysLeft <= 2 ? { t: 'EMERGENCY MODE', d: 'past papers + cheat sheet. nothing new!', c: C.red }
    : daysLeft <= 6 ? { t: 'Crunch time', d: 'practice Qs every day, weak topics first', c: '#E8730C' }
    : daysLeft <= 14 ? { t: 'Right on time', d: 'one lecture a day + a quick quiz', c: C.blue }
    : { t: 'Chill', d: 'short sessions. future you says thanks', c: '#0F9F74' };
  const sessions = Math.min(28, Math.round(daysLeft * (daysLeft <= 6 ? 2 : 1.2)));
  const setDays = (n: number) => { if (n !== daysLeft) { setDaysLeft(n); setFlip((f) => f + 1); } };

  function hitPanic() { setPanic((p) => p + 1); setShaking(true); later(500, () => setShaking(false)); }

  return (
    <div className={`lp desk-${desk} ${shaking ? 'shake' : ''}`} ref={scroller}>
      <style>{CSS}</style>
      <Paper scroller={scroller} desk={desk} />
      <div className="holes" aria-hidden><i /><i /><i /></div>
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
          <p className="hand kicker">for uni + college students in Canada &amp; the UK ↓</p>
          <h1>
            <span className="w">Your</span>{' '}<span className="w">whole</span>{' '}<span className="w">semester,</span>{' '}<span className="w auto">sorted.</span>
          </h1>
          <p className="sub">Drop your syllabus. Get every deadline, a plan for each day, and a tutor that read your slides.</p>
          <div className="ctas">
            <button className="btn big" onClick={() => onStart()}>Start free →</button>
            <button className="btn ghost big" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}>Try it first</button>
            <span className="hand note1">it's free, promise
              <svg width="70" height="40" viewBox="0 0 70 40" aria-hidden><path d="M66 6 C 44 2, 20 10, 8 30 M8 30 l2 -12 M8 30 l12 -3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </span>
          </div>
          <p className="hand tiny">psst, your cursor is a highlighter. try it ✎</p>
        </div>
        <Notes />
      </header>

      <div className="tapeStrip" aria-hidden><div className="track">{[...CODES, ...CODES].map((c, i) => <span key={i}>{c}<i>✦</i></span>)}</div></div>

      <section id="try" className="try reveal">
        <Head n="1" title="Drag the syllabus in." note="(or just click it)" />
        <div className="board">
          <div className={`syllabus ${stage !== 'idle' && stage !== 'over' ? 'used' : ''}`} draggable={stage === 'idle' || stage === 'over'}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', 'syllabus')} onClick={drop} title="Drag me, or just click">
            <i className="staple" />
            <div className="ptitle">COMP 202<br /><small>Course outline · Fall</small></div>
            {[90, 70, 84, 60, 78, 50, 66, 72].map((w, i) => <div key={i} className="line" style={{ width: `${w}%` }} />)}
            <span className="hand grab">drag me →</span>
          </div>
          <div className="clipboard tilt3d">
            <i className="clip" />
            <div className={`drop ${stage}`} onDragOver={(e) => { e.preventDefault(); if (stage === 'idle') setStage('over'); }}
              onDragLeave={() => stage === 'over' && setStage('idle')} onDrop={(e) => { e.preventDefault(); drop(); }} onClick={drop}>
              {stage === 'idle' || stage === 'over' ? (
                <div className="dropHint"><b className="hand">{stage === 'over' ? 'let go!' : 'drop it here'}</b><span>your week appears on this page</span></div>
              ) : (
                <div className="result">
                  <div className="resHead">
                    <b className="hand">{stage === 'reading' ? 'reading…' : stage === 'found' ? `${shown} deadline${shown === 1 ? '' : 's'} found` : 'week planned ✓'}</b>
                    {stage === 'planned' && <button className="link" onClick={(e) => { e.stopPropagation(); reset(); }}>↺ again</button>}
                  </div>
                  {stage === 'reading' && <div className="scan"><div /></div>}
                  <div className="week">
                    {DAYS.map((d, i) => (
                      <div key={d} className="day">
                        <span>{d}</span>
                        {FOUND.slice(0, shown).filter((f) => f.day === i).map((f) => <div key={f.label} className="due pop" style={{ background: f.col, transform: `rotate(${(i % 2 ? 3 : -3)}deg)` }}>{f.label}</div>)}
                        {stage === 'planned' && Array.from({ length: i === 6 ? 1 : 2 }).map((_, j) => <div key={j} className="sess pop" style={{ animationDelay: `${(i * 2 + j) * 40}ms`, background: Object.values(C)[(i + j) % 5] }} />)}
                      </div>
                    ))}
                  </div>
                  {stage === 'planned' && <button className="btn" onClick={(e) => { e.stopPropagation(); onStart(); }}>Do this with my courses →</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="tutor reveal">
        <Head n="2" title="Didn't get it? Change the answer." note="tap a tab →" />
        <div className="tutorDesk">
          <div className="sticky q tilt3d" style={{ background: C.pink }}><Tape />what's a derivative 😭</div>
          <div className="indexCard tilt3d">
            <div className="tabs">
              {(Object.keys(ANSWERS) as (keyof typeof ANSWERS)[]).map((k) => (
                <button key={k} className={`tab ${mode === k ? 'on' : ''}`} style={{ background: ANSWERS[k].col }} onClick={() => setMode(k)}>{ANSWERS[k].label}</button>
              ))}
            </div>
            <div className="cardBody"><span className="sb">SB</span><p>{bold(typed)}<span className="caret" /></p></div>
          </div>
        </div>
      </section>

      <section className="exam reveal">
        <Head n="3" title="When's your exam?" note="drag the ruler" />
        <div className="examDesk">
          <div className="deskCal tilt3d">
            <div className="rings" aria-hidden>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
            <div className="calTop" style={{ background: mood.c }}>EXAM IN</div>
            <div className="calPage" key={flip}>
              <div className="calNum" style={{ color: mood.c }}>{daysLeft}</div>
              <div className="calUnit">{daysLeft === 1 ? 'DAY' : 'DAYS'}</div>
            </div>
          </div>
          <div className="examRight">
            <div className="hand mood" style={{ color: mood.c }}>{mood.t}<small>{mood.d}</small></div>
            <div className="ruler tilt3d">
              <input type="range" min={1} max={30} value={daysLeft} onChange={(e) => setDays(+e.target.value)} aria-label="Days until your exam" />
            </div>
            <div className="blocks">{Array.from({ length: sessions }).map((_, i) => <div key={i} style={{ background: Object.values(C)[i % 5], animationDelay: `${i * 15}ms`, transform: `rotate(${((i * 37) % 9) - 4}deg)` }} />)}</div>
            <p className="hand tinyL">= {sessions} study sessions, sized to the hours you actually have</p>
          </div>
        </div>
      </section>

      <section className="panicSec reveal">
        <div className="panicWrap">
          <button className="panic" onClick={hitPanic}><span>PANIC</span></button>
          <span className="hand panicNote">press me</span>
        </div>
        <div className="indexCard plain tilt3d">
          <Tape />
          {panic ? (
            <>
              <h3>Okay. Breathe.</h3>
              <ol className="handList">
                <li><b>tonight:</b> 45 min on the topic you know least</li>
                <li><b>tomorrow:</b> one past paper, timed. mark it.</li>
                <li><b>day after:</b> redo only what you got wrong</li>
              </ol>
              <button className="btn" onClick={() => onStart()}>Make my real plan →</button>
            </>
          ) : (
            <>
              <h3>Exam tomorrow and nothing done?</h3>
              <p className="hand big2">press the button. seriously.</p>
            </>
          )}
        </div>
      </section>

      <section className="price reveal">
        <Head n="4" title="Free to start." note="no card needed" />
        <div className="plans">
          <div className="sticky plan tilt3d" style={{ background: C.yellow, ['--rz' as string]: '-2deg' }}>
            <Tape />
            <b className="planName">Free</b><div className="cost">$0</div>
            <ul><li>2 courses</li><li>7 uploads a month</li><li>20 tutor messages</li><li>study plan + calendar</li></ul>
            <button className="btn dark" onClick={() => onStart()}>Start free →</button>
          </div>
          <div className="sticky plan tilt3d" style={{ background: '#9FB0FF', ['--rz' as string]: '1.5deg' }}>
            <Tape />
            <span className="hand circled">best for exam season</span>
            <b className="planName">Pro</b><div className="cost">C$9.99<small>/mo</small></div>
            <ul><li>all your courses</li><li>200 uploads</li><li>1,500 tutor messages</li><li>cheat sheets + practice papers</li></ul>
            <button className="btn" onClick={() => onStart()}>7 days free →</button>
          </div>
        </div>
      </section>

      <section className="end reveal">
        <h2>Stop planning.<br /><span className="scribble">Start studying.
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden><path d="M4 18 C 80 6, 160 26, 240 12 S 360 8, 396 16" fill="none" stroke="#E5385F" strokeWidth="5" strokeLinecap="round" /></svg>
        </span></h2>
        <button className="btn big" onClick={() => onStart()}>Start free →</button>
      </section>

      <footer>
        <div className="brand"><Mark size={20} /><span>StudyBuddy</span></div>
        <span className="hand">made for students, by students</span>
        <div><button className="link" onClick={() => onLegal('privacy')}>Privacy</button><button className="link" onClick={() => onLegal('terms')}>Terms</button><button className="link" onClick={() => onSignIn()}>Log in</button></div>
      </footer>
    </div>
  );
}

function Head({ n, title, note }: { n: string; title: string; note: string }) {
  return (
    <div className="sectionHead">
      <span className="circleNum hand">{n}</span>
      <h2>{title}</h2>
      <span className="hand sideNote">{note}</span>
    </div>
  );
}

function Tape() { return <i className="tape" aria-hidden />; }

/** Notebook paper behind everything: ruled lines that ripple near the pointer, plus a fading highlighter stroke. */
function Paper({ scroller, desk }: { scroller: RefObject<HTMLDivElement | null>; desk: Desk }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
    let w = 0, h = 0, raf = 0;
    const pts: { x: number; y: number; t: number }[] = [];
    let mx = -9999, my = -9999;
    const size = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const pm = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; pts.push({ x: mx, y: my, t: performance.now() }); if (pts.length > 80) pts.shift(); };
    window.addEventListener('pointermove', pm, { passive: true });
    window.addEventListener('resize', size);
    const L = 34;
    const draw = () => {
      const now = performance.now(), d = dark();
      const off = (scroller.current?.scrollTop ?? 0) % L;
      ctx.clearRect(0, 0, w, h);
      const ripple = (x: number, y: number, axis: 'x' | 'y') => {
        const dist = Math.hypot(x - mx, y - my);
        if (still || dist > 150) return 0;
        return Math.sin((dist / 150) * Math.PI) * (1 - dist / 150) * 12 * Math.sign((axis === 'y' ? y - my : x - mx) || 1);
      };
      const hLines = (col: string, every = 1, major?: string) => {
        let i = 0;
        for (let y = L * 2 - off; y < h + L; y += L, i++) {
          ctx.strokeStyle = major && i % 5 === 0 ? major : col;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 12) { const b = ripple(x, y, 'y'); x === 0 ? ctx.moveTo(x, y + b) : ctx.lineTo(x, y + b); }
          ctx.stroke();
          if (every > 1) i += every - 1;
        }
      };
      const vLines = (col: string, major?: string) => {
        let i = 0;
        for (let x = 0; x < w + L; x += L, i++) {
          ctx.strokeStyle = major && i % 5 === 0 ? major : col;
          ctx.beginPath();
          for (let y = -L; y <= h + L; y += 12) { const yy = y - off; const b = ripple(x, yy, 'x'); y === -L ? ctx.moveTo(x + b, yy) : ctx.lineTo(x + b, yy); }
          ctx.stroke();
        }
      };
      ctx.lineWidth = 1.2;
      if (desk === 'paper') {
        hLines(d ? 'rgba(130,150,255,0.16)' : 'rgba(80,120,230,0.22)');
        const m = w < 600 ? 26 : 64;
        ctx.strokeStyle = d ? 'rgba(255,107,139,0.35)' : 'rgba(229,56,95,0.45)';
        ctx.lineWidth = 1.5;
        [m, m + 4].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); });
      } else if (desk === 'mat') {
        // self-healing cutting mat: fine grid, brighter every 5th line, a diagonal guide
        hLines('rgba(255,255,255,0.07)', 1, 'rgba(255,255,255,0.16)');
        vLines('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.16)');
        ctx.strokeStyle = 'rgba(255,228,94,0.22)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, h * 0.95 - off * 0); ctx.lineTo(w, h * 0.05); ctx.stroke();
      } else if (desk === 'navy') {
        // dot paper: dots swell near the pointer
        for (let y = L - off; y < h + L; y += L) for (let x = L / 2; x < w; x += L) {
          const dist = Math.hypot(x - mx, y - my), r = still || dist > 160 ? 1.6 : 1.6 + (1 - dist / 160) * 4;
          ctx.fillStyle = dist < 160 ? `rgba(255,228,94,${0.25 + (1 - dist / 160) * 0.6})` : 'rgba(255,255,255,0.16)';
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // blueprint grid
        hLines('rgba(255,255,255,0.08)', 1, 'rgba(255,255,255,0.2)');
        vLines('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.2)');
      }
      while (pts.length && now - pts[0].t > 1000) pts.shift();
      if (!still && pts.length > 1) {
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = desk === 'paper' && !d ? 'multiply' : 'source-over';
        for (let i = 1; i < pts.length; i++) {
          const a = 1 - (now - pts[i].t) / 1000;
          ctx.strokeStyle = `rgba(255,222,60,${(desk !== 'paper' ? 0.42 : d ? 0.32 : 0.6) * a})`;
          ctx.lineWidth = 24;
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', pm); window.removeEventListener('resize', size); };
  }, [scroller, desk]);
  return <canvas ref={ref} className="paperBg" aria-hidden />;
}

/** Sticky notes you can peel off and move around. */
function Notes() {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => Object.fromEntries(NOTES.map((s) => [s.id, { x: s.x, y: s.y, r: s.r, z: 1, lift: false }])));
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const top = useRef(10);
  function down(e: RPointerEvent<HTMLDivElement>, id: string) {
    const r = box.current!.getBoundingClientRect();
    const p = pos[id];
    drag.current = { id, dx: e.clientX - (r.left + p.x * r.width), dy: e.clientY - (r.top + p.y * r.height) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPos((s) => ({ ...s, [id]: { ...s[id], z: ++top.current, lift: true } }));
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const d = drag.current; if (!d) return;
    const r = box.current!.getBoundingClientRect();
    const x = Math.max(-0.05, Math.min(0.72, (e.clientX - d.dx - r.left) / r.width));
    const y = Math.max(-0.05, Math.min(0.78, (e.clientY - d.dy - r.top) / r.height));
    setPos((s) => ({ ...s, [d.id]: { ...s[d.id], x, y, r: Math.max(-12, Math.min(12, (e.movementX || 0) * 0.8)) } }));
  }
  function up() {
    const d = drag.current; if (!d) return;
    drag.current = null;
    setPos((s) => ({ ...s, [d.id]: { ...s[d.id], r: Math.round(Math.random() * 14 - 7), lift: false } }));
  }
  return (
    <div className="heroArt" ref={box} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Pencil />
      <Clip />
      {NOTES.map((s) => {
        const p = pos[s.id];
        return (
          <div key={s.id} className={`sticky heroNote ${p.lift ? 'lift' : ''}`} onPointerDown={(e) => down(e, s.id)}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, ['--note-rot' as string]: `rotate(${p.r}deg)${p.lift ? ' translateZ(80px) scale(1.06)' : ''}`, zIndex: p.z, background: s.bg }}>
            <Tape />
            <span>{s.top}</span><b className="hand">{s.big}</b>
          </div>
        );
      })}
      <span className="hand hint">↖ peel these off &amp; move them</span>
    </div>
  );
}

function Pencil() {
  return (
    <svg className="pencil" viewBox="0 0 420 40" aria-hidden>
      <defs>
        <linearGradient id="pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE27A" /><stop offset=".45" stopColor="#FFC93C" /><stop offset="1" stopColor="#C98A00" /></linearGradient>
        <linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef0f6" /><stop offset=".5" stopColor="#b7bccd" /><stop offset="1" stopColor="#7d8296" /></linearGradient>
        <linearGradient id="pe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9db8" /><stop offset="1" stopColor="#c43a63" /></linearGradient>
        <linearGradient id="pw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6dcb6" /><stop offset="1" stopColor="#b98a52" /></linearGradient>
      </defs>
      <rect x="0" y="6" width="34" height="28" fill="url(#pe)" />
      <rect x="34" y="5" width="30" height="30" fill="url(#pm)" />
      <rect x="64" y="6" width="290" height="28" fill="url(#pb)" />
      <polygon points="354,6 404,20 354,34" fill="url(#pw)" />
      <polygon points="392,16.5 420,20 392,23.5" fill="#2b2b33" />
    </svg>
  );
}

function Clip() {
  return (
    <svg className="paperclip" viewBox="0 0 40 110" aria-hidden>
      <defs><linearGradient id="cl" x1="0" x2="1"><stop offset="0" stopColor="#8d93a8" /><stop offset=".5" stopColor="#eef0f7" /><stop offset="1" stopColor="#8d93a8" /></linearGradient></defs>
      <path d="M12 30 V88 a8 8 0 0 0 16 0 V18 a12 12 0 0 0 -24 0 V92 a16 16 0 0 0 32 0 V34" fill="none" stroke="url(#cl)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
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
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDelay: `${(i % 10) * 40}ms`, animationDuration: `${1300 + (i % 7) * 180}ms` }} />
      ))}
    </div>
  );
}

const CSS = `
:root {
  --display: BricolageGrotesque_800ExtraBold, 'Bricolage Grotesque', sans-serif;
  --body: Figtree_400Regular, Figtree, system-ui, sans-serif;
  --semi: Figtree_600SemiBold, Figtree, system-ui, sans-serif;
  --bold: Figtree_700Bold, Figtree, system-ui, sans-serif;
  --hand: Caveat_700Bold, Caveat, 'Comic Sans MS', cursive;
  --ink: #1B1E3F; --paper: #FDFDF8; --card: #FFFFFF; --muted: #5E6286; --pen: #2A44D8; --red: #E5385F;
  --shadow: 0 16px 22px -14px rgba(27,30,63,.45), 0 2px 3px rgba(27,30,63,.08);
}
@media (prefers-color-scheme: dark) { :root { --ink: #F2F3FF; --paper: #14172E; --card: #1E2242; --muted: #A3A7CF; --pen: #9FB0FF; --shadow: 0 16px 24px -12px rgba(0,0,0,.7); } }
* { box-sizing: border-box; border-radius: 0 !important; }
html, body { margin: 0; background: var(--paper); }
.lp { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; background: var(--paper); color: var(--ink); font-family: var(--body); -webkit-font-smoothing: antialiased; }
.paperBg { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.lp > *:not(.paperBg):not(.confetti):not(.holes) { position: relative; z-index: 1; }
.holes { position: fixed; left: 20px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: space-around; z-index: 1; pointer-events: none; }
.holes i { width: 22px; height: 22px; border-radius: 50% !important; background: color-mix(in srgb, var(--ink) 10%, transparent); box-shadow: inset 0 2px 3px rgba(0,0,0,.25); }
h1, h2, h3, .cost, .brand span, .planName { font-family: var(--display); font-weight: normal; }
b, strong, button, .due, mark { font-family: var(--bold); font-weight: normal; }
.hand { font-family: var(--hand); font-weight: normal; color: var(--pen); }
button { font-size: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
button:focus-visible, input:focus-visible { outline: 3px dashed var(--red); outline-offset: 4px; }
.link { color: var(--muted); padding: 8px 10px; font-size: 15px; }
.link:hover { color: var(--ink); text-decoration: underline wavy var(--red); }

/* buttons: label-maker strips */
.btn { --cap: #0b0d24; background: linear-gradient(#2b2f5e, #1B1E3F); color: #fff; padding: 14px 22px; font-size: 17px; box-shadow: 0 6px 0 var(--cap), 0 14px 18px -6px rgba(27,30,63,.55), inset 0 1px 0 rgba(255,255,255,.18); transition: transform .08s, box-shadow .08s; transform: translateY(0); }
.btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 var(--cap), 0 18px 22px -6px rgba(27,30,63,.55), inset 0 1px 0 rgba(255,255,255,.18); }
.btn:active { transform: translateY(6px); box-shadow: 0 0 0 var(--cap), 0 4px 8px -4px rgba(27,30,63,.5), inset 0 1px 0 rgba(255,255,255,.18); }
.btn.small { padding: 9px 14px; font-size: 15px; }
.btn.big { padding: 18px 28px; font-size: 20px; }
.btn.ghost { --cap: #b9bcd3; background: linear-gradient(#ffffff, #eceef7); color: #1B1E3F; }
.btn.dark { color: #FFE45E; }
mark { background: linear-gradient(100deg, transparent 2%, rgba(255,222,60,.9) 4%, rgba(255,222,60,.75) 96%, transparent 98%); background-size: 100% 60%; background-position: 0 70%; background-repeat: no-repeat; color: inherit; padding: 0 3px; }
@media (prefers-color-scheme: dark) { mark { background-image: linear-gradient(100deg, transparent 2%, rgba(255,222,60,.45) 4%, rgba(255,222,60,.4) 96%, transparent 98%); } }

/* ---------- desks: the surface everything sits on ---------- */
.lp.desk-mat, .lp.desk-navy, .lp.desk-blue { --ink: #F7F8FF; --muted: rgba(244,245,255,.82); --pen: #FFE45E; --red: #FF7AA8; --card: #FFFFFF; --soft: rgba(255,255,255,.1); }
.lp.desk-mat { --paper: #143630; --ex1: #0e2823; --ex2: #0a211c; --ex3: #071915; background: radial-gradient(ellipse at 30% 0%, #1d4a41, #143630 55%, #0e2823); }
.lp.desk-navy { --paper: #151936; --ex1: #0f1229; --ex2: #0b0e21; --ex3: #080a19; background: radial-gradient(ellipse at 30% 0%, #222868, #151936 55%, #0f1229); }
.lp.desk-blue { --paper: #2C38D6; --ex1: #2230b4; --ex2: #1c2899; --ex3: #16207c; background: radial-gradient(ellipse at 30% 0%, #4b56f0, #2C38D6 55%, #2230b4); }
.lp:not(.desk-paper) .holes { display: none; }
.lp:not(.desk-paper) .nav { background: color-mix(in srgb, var(--paper) 80%, transparent); }
.lp:not(.desk-paper) .indexCard, .lp:not(.desk-paper) .drop, .lp:not(.desk-paper) .deskCal, .lp:not(.desk-paper) .indexCard h3 { color: #1B1E3F; }
.lp:not(.desk-paper) .indexCard .hand, .lp:not(.desk-paper) .drop .hand, .lp:not(.desk-paper) .handList, .lp:not(.desk-paper) .drop .day > span { color: #2A44D8; }
.lp:not(.desk-paper) .handList b { color: #E5385F; }
.lp:not(.desk-paper) .drop .dropHint span, .lp:not(.desk-paper) .calUnit { color: #5E6286; }
.lp:not(.desk-paper) .resHead b, .lp:not(.desk-paper) .dropHint b { color: #1B1E3F; }
.lp:not(.desk-paper) .btn { --cap: #0b0d24; }
.lp:not(.desk-paper) .btn:not(.ghost):not(.dark) { background: linear-gradient(#FFF07A, #FFD43B); color: #1B1E3F; --cap: #b08f00; }
.lp:not(.desk-paper) .circleNum { color: var(--pen); border-color: var(--pen); }
.lp:not(.desk-paper) .w, .lp:not(.desk-paper) .w.auto { color: inherit; }
.lp:not(.desk-paper) .w { background-image: linear-gradient(100deg, transparent 1%, rgba(255,122,168,.75) 3%, rgba(255,122,168,.6) 97%, transparent 99%); }
.lp:not(.desk-paper) mark { background-image: linear-gradient(100deg, transparent 2%, rgba(255,222,60,.9) 4%, rgba(255,222,60,.75) 96%, transparent 98%); }
.lp:not(.desk-paper) .tapeStrip { box-shadow: 0 20px 30px -14px rgba(0,0,0,.55); }
.lp:not(.desk-paper) .sticky, .lp:not(.desk-paper) .indexCard, .lp:not(.desk-paper) .deskCal, .lp:not(.desk-paper) .clipboard, .lp:not(.desk-paper) .syllabus { filter: drop-shadow(0 20px 18px rgba(0,0,0,.35)); }
.lp:not(.desk-paper) footer { border-color: rgba(255,255,255,.2); }
.lp:not(.desk-paper) .link { color: rgba(244,245,255,.75); }
.lp:not(.desk-paper) .link:hover { color: #fff; }
.lp:not(.desk-paper) .scribble svg path { stroke: #FFE45E; }
.lp:not(.desk-paper) .mood { color: var(--pen) !important; }
.lp:not(.desk-paper) .syllabus.used { opacity: .55; }

/* ---------- depth ---------- */
.lp { --px: 0; --py: 0; }
.tilt3d { --rx: 0deg; --ry: 0deg; --rz: 0deg; --gl: 0; transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) rotate(var(--rz)); transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; transform-style: preserve-3d; will-change: transform; }
.tilt3d:hover { box-shadow: 0 40px 50px -26px rgba(27,30,63,.55), 0 6px 12px rgba(27,30,63,.1) !important; }
.tilt3d::selection { background: transparent; }
.tilt3d > .glare { display: none; }
h1, section h2, .end h2 { text-shadow: 1px 1px 0 var(--ex1), 2px 2px 0 var(--ex1), 3px 3px 0 var(--ex2), 4px 4px 0 var(--ex2), 5px 5px 0 var(--ex3), 6px 6px 0 var(--ex3), 10px 14px 18px rgba(27,30,63,.18); }
:root { --ex1: #c9cdf2; --ex2: #b3b9ee; --ex3: #9aa2e6; }
@media (prefers-color-scheme: dark) { :root { --ex1: #2a2f63; --ex2: #232856; --ex3: #1c2049; } }
.hero h1 { transform: translate(calc(var(--px) * -10px), calc(var(--py) * -8px)); transition: transform .2s; }
.heroArt { perspective: 1100px; }
.heroArt > * { transform-style: preserve-3d; }
.heroNote { transform: perspective(900px) rotateX(calc(var(--py) * -14deg)) rotateY(calc(var(--px) * 18deg)) var(--note-rot, rotate(0deg)) !important; }
.pencil { position: absolute; width: 360px; left: 8%; bottom: 4%; transform: rotate(-14deg) translate(calc(var(--px) * 24px), calc(var(--py) * 18px)); filter: drop-shadow(10px 18px 10px rgba(27,30,63,.35)); z-index: 30; pointer-events: none; transition: transform .2s; }
.paperclip { position: absolute; width: 34px; right: 6%; top: -2%; transform: rotate(18deg) translate(calc(var(--px) * -16px), calc(var(--py) * -12px)); filter: drop-shadow(4px 8px 4px rgba(27,30,63,.3)); z-index: 30; pointer-events: none; transition: transform .2s; }

/* paper objects */
.sticky { position: relative; color: #1B1E3F; padding: 28px 22px 22px; box-shadow: 0 1px 1px rgba(0,0,0,.08), 0 24px 26px -20px rgba(27,30,63,.6); background-image: linear-gradient(170deg, rgba(255,255,255,.35), rgba(255,255,255,0) 40%, rgba(0,0,0,.06)) !important; background-blend-mode: soft-light; }
.sticky::before { content: ''; position: absolute; left: 6%; right: 6%; bottom: 6px; height: 14px; box-shadow: 0 14px 14px rgba(27,30,63,.35); transform: perspective(200px) rotateX(30deg); z-index: -1; }
.sticky::after { content: ''; position: absolute; right: 0; bottom: 0; width: 42px; height: 42px; background: linear-gradient(135deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.18) 50%, rgba(255,255,255,.55) 78%, rgba(255,255,255,.2) 100%); box-shadow: -3px -3px 6px rgba(0,0,0,.08); }
.tape { position: absolute; top: -12px; left: 50%; width: 92px; height: 26px; transform: translateX(-50%) rotate(-3deg) translateZ(20px); background: linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,235,.55) 60%, rgba(230,226,200,.6)); box-shadow: 0 2px 3px rgba(0,0,0,.15); clip-path: polygon(3% 0, 97% 4%, 100% 30%, 96% 55%, 99% 100%, 2% 96%, 0 70%, 4% 45%, 0 15%); z-index: 2; backdrop-filter: blur(1px); }
@media (prefers-color-scheme: dark) { .tape { background: rgba(255,255,240,.28); } }
.indexCard { position: relative; background: var(--card); box-shadow: 0 2px 0 #e3e5ef, 0 4px 0 #d6d9e6, 0 30px 40px -22px rgba(27,30,63,.5); background-image: linear-gradient(var(--card), var(--card)), repeating-linear-gradient(transparent 0 31px, rgba(80,120,230,.25) 31px 32px); background-size: 100% 46px, 100% 100%; background-repeat: no-repeat, repeat; border-top: 46px solid var(--card); }
.indexCard::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--red); opacity: .7; }

.nav { display: flex; justify-content: space-between; align-items: center; padding: 14px clamp(16px, 4vw, 48px) 14px clamp(80px, 8vw, 110px); position: sticky !important; top: 0; background: color-mix(in srgb, var(--paper) 88%, transparent); backdrop-filter: blur(6px); z-index: 20 !important; }
.brand { display: flex; align-items: center; gap: 8px; font-size: 21px; letter-spacing: -.5px; }
.navr { display: flex; align-items: center; gap: 12px; }

.hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 32px; align-items: center; max-width: 1260px; margin: 0 auto; padding: clamp(24px, 5vw, 64px) clamp(16px, 4vw, 48px) 56px clamp(90px, 9vw, 130px); }
.kicker { font-size: 26px; margin: 0 0 10px; transform: rotate(-2deg); display: inline-block; }
.hero h1 { font-size: clamp(54px, 8.4vw, 128px); line-height: .9; letter-spacing: -.05em; margin: 0 0 24px; }
.w { display: inline-block; background-image: linear-gradient(100deg, transparent 1%, rgba(255,222,60,.95) 3%, rgba(255,222,60,.8) 97%, transparent 99%); background-repeat: no-repeat; background-position: 0 85%; background-size: 0% 42%; transition: background-size .35s cubic-bezier(.2,.8,.2,1); }
.w:hover { background-size: 100% 42%; }
.w.auto { background-size: 100% 42%; animation: swipe 1s .4s cubic-bezier(.2,.8,.2,1) both; }
@keyframes swipe { from { background-size: 0% 42%; } }
@media (prefers-color-scheme: dark) { .w { background-image: linear-gradient(100deg, transparent 1%, rgba(255,222,60,.5) 3%, rgba(255,222,60,.45) 97%, transparent 99%); } }
.sub { font-size: clamp(19px, 2vw, 23px); line-height: 1.45; color: var(--muted); max-width: 32ch; margin: 0 0 30px; }
.ctas { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; position: relative; }
.note1 { font-size: 24px; color: var(--red); display: inline-flex; align-items: flex-end; gap: 0; transform: rotate(-4deg); }
.note1 svg { color: var(--red); margin-left: -6px; }
.tiny { font-size: 22px; opacity: .8; margin: 0; }

.heroArt { position: relative; height: 470px; touch-action: none; }
.heroNote { position: absolute; width: 200px; min-height: 170px; display: flex; flex-direction: column; gap: 6px; cursor: grab; user-select: none; transition: transform .3s cubic-bezier(.3,1.6,.5,1), box-shadow .2s; }
.heroNote span { font-family: var(--bold); font-size: 13px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; }
.heroNote b { font-size: 36px; line-height: .95; color: #1B1E3F; white-space: nowrap; }
.heroNote.lift { cursor: grabbing; box-shadow: 0 34px 40px -20px rgba(27,30,63,.55); transition: box-shadow .2s; }
.hint { position: absolute; right: 2%; bottom: 0; font-size: 24px; color: var(--red); transform: rotate(-3deg); }

.tapeStrip { overflow: hidden; margin: 10px 0; transform: rotate(-1.2deg) scaleX(1.03); background: repeating-linear-gradient(45deg, #FFE45E 0 18px, #FFD43B 18px 36px); box-shadow: var(--shadow); }
.track { display: flex; width: max-content; animation: slide 40s linear infinite; }
.track span { color: #1B1E3F; font-family: var(--display); font-size: 24px; padding: 12px 18px; white-space: nowrap; display: flex; align-items: center; gap: 18px; letter-spacing: -.02em; }
.track span i { font-style: normal; color: var(--red); }
@keyframes slide { to { transform: translateX(-50%); } }

section { max-width: 1260px; margin: 0 auto; padding: clamp(70px, 10vw, 130px) clamp(16px, 4vw, 48px) 0 clamp(90px, 9vw, 130px); }
.sectionHead { display: flex; align-items: center; gap: 18px; margin-bottom: 40px; flex-wrap: wrap; }
.circleNum { width: 58px; height: 58px; display: grid; place-items: center; font-size: 40px; color: var(--red); border: 3px solid var(--red); border-radius: 50% 45% 55% 48% / 52% 48% 52% 46% !important; transform: rotate(-8deg); flex: none; }
section h2 { font-size: clamp(36px, 5.4vw, 70px); letter-spacing: -.045em; line-height: .95; margin: 0; }
.sideNote { font-size: 26px; transform: rotate(-3deg); }
.reveal { opacity: 0; transform: translateY(40px) rotate(-.5deg); transition: opacity .6s, transform .7s cubic-bezier(.2,.8,.2,1); }
.reveal.in { opacity: 1; transform: none; }

/* 1: syllabus + clipboard */
.board { display: grid; grid-template-columns: 240px 1fr; gap: 44px; align-items: center; }
.syllabus { position: relative; background: #fff; color: #1B1E3F; padding: 26px 20px 30px; box-shadow: 0 2px 0 #eceef5, 0 4px 0 #e0e3ee, 0 6px 0 #d4d8e6, 0 30px 36px -18px rgba(27,30,63,.5); transform: perspective(800px) rotateX(10deg) rotate(-5deg); cursor: grab; transition: transform .2s, opacity .3s; }
.syllabus:hover { transform: perspective(800px) rotateX(0deg) rotate(-2deg) translateY(-10px); box-shadow: 0 2px 0 #eceef5, 0 4px 0 #e0e3ee, 0 6px 0 #d4d8e6, 0 50px 50px -24px rgba(27,30,63,.55); }
.syllabus.used { opacity: .3; transform: rotate(0) scale(.9); cursor: default; }
.staple { position: absolute; left: 14px; top: 10px; width: 26px; height: 4px; background: linear-gradient(#bbb, #777); transform: rotate(-30deg); }
.ptitle { font-family: var(--display); font-size: 24px; line-height: 1.05; margin: 8px 0 16px; }
.ptitle small { font-family: var(--body); font-size: 13px; color: #6a6e90; }
.line { height: 6px; background: #E3E5F0; margin: 11px 0; }
.grab { position: absolute; right: -40px; bottom: -34px; font-size: 26px; color: var(--red); transform: rotate(-8deg); }
.clipboard { --rz: .6deg; position: relative; background: #B88A5A; box-shadow: 0 2px 0 #8a6239, 0 4px 0 #74512e, 0 40px 50px -26px rgba(27,30,63,.6) !important; padding: 46px 18px 18px; box-shadow: var(--shadow); background-image: repeating-linear-gradient(95deg, rgba(0,0,0,.04) 0 3px, transparent 3px 9px); }
@media (prefers-color-scheme: dark) { .clipboard { background-color: #6B4F33; } }
.clip { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 130px; height: 46px; background: linear-gradient(#d9dbe3, #9da1b3); box-shadow: 0 3px 6px rgba(0,0,0,.3); clip-path: polygon(12% 0, 88% 0, 100% 40%, 100% 100%, 0 100%, 0 40%); }
.drop { min-height: 330px; background: var(--card); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 22px; transition: background .15s, transform .15s; background-image: repeating-linear-gradient(transparent 0 29px, rgba(80,120,230,.18) 29px 30px); }
.drop.over { background: #FFF6B8; transform: scale(1.01); }
.drop.reading, .drop.found, .drop.planned { cursor: default; }
.dropHint { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dropHint b { font-size: clamp(44px, 5vw, 64px); color: var(--ink); }
.dropHint span { color: var(--muted); }
.result { width: 100%; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.resHead { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.resHead b { font-size: 38px; color: var(--ink); }
.scan { width: 100%; height: 12px; background: #eee; overflow: hidden; }
.scan div { height: 100%; width: 40%; background: #FFE45E; animation: scan .9s ease-in-out infinite alternate; }
@keyframes scan { to { transform: translateX(150%); } }
.week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); width: 100%; border-top: 2px solid var(--ink); }
.day { display: flex; flex-direction: column; gap: 7px; min-height: 160px; padding: 8px 5px; border-right: 1px dashed color-mix(in srgb, var(--ink) 35%, transparent); }
.day:last-child { border-right: 0; }
.day > span { font-family: var(--hand); font-size: 22px; color: var(--pen); text-align: center; }
.due { color: #1B1E3F; font-size: 12.5px; padding: 8px 6px; line-height: 1.15; box-shadow: 0 10px 10px -7px rgba(0,0,0,.5), inset 0 -3px 0 rgba(0,0,0,.08); }
.sess { height: 10px; opacity: .8; }
.pop { animation: pop .5s cubic-bezier(.3,1.7,.5,1) both; }
@keyframes pop { from { transform: scale(.2) translateY(-40px) rotate(-25deg); opacity: 0; } }

/* 2: tutor */
.tutorDesk { display: grid; grid-template-columns: 260px 1fr; gap: 44px; align-items: start; max-width: 1040px; }
.q { --rz: -4deg; font-family: var(--hand); font-size: 36px; line-height: 1.05; min-height: 200px; display: flex; align-items: center; }
.indexCard .tabs { position: absolute; top: -84px; left: 18px; display: flex; gap: 6px; flex-wrap: wrap; }
.tab { padding: 10px 16px 18px; font-size: 15px; color: #1B1E3F; box-shadow: 0 -2px 4px rgba(0,0,0,.08); transform: translateY(10px); transition: transform .15s; }
.tab:hover { transform: translateY(4px); }
.tab.on { transform: translateY(0); }
.cardBody { display: flex; gap: 14px; padding: 6px 26px 34px; min-height: 190px; }
.indexCard { margin-top: 72px; }
.sb { flex: none; width: 38px; height: 38px; background: #FFE45E; color: #1B1E3F; font-family: var(--display); display: grid; place-items: center; transform: rotate(-6deg); margin-top: 2px; }
.cardBody p { margin: 0; font-size: clamp(20px, 2.3vw, 26px); line-height: 32px; }
.caret { display: inline-block; width: 3px; height: 1em; background: var(--pen); vertical-align: -3px; margin-left: 3px; animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* 3: tear-off exam calendar + ruler */
.examDesk { display: grid; grid-template-columns: auto 1fr; gap: clamp(30px, 6vw, 80px); align-items: center; }
.deskCal { --rz: -2deg; position: relative; width: clamp(230px, 26vw, 320px); background: var(--card); box-shadow: 0 3px 0 #dcdfea, 0 6px 0 #cdd1e0, 0 9px 0 #bfc3d6, 0 36px 44px -22px rgba(27,30,63,.55); padding-bottom: 18px; }
.rings { position: absolute; top: -12px; left: 0; right: 0; display: flex; justify-content: space-around; z-index: 2; }
.rings i { width: 10px; height: 26px; background: linear-gradient(90deg, #8a8ea6, #e3e5ee, #8a8ea6); border-radius: 5px !important; }
.calTop { color: #fff; font-family: var(--display); letter-spacing: .14em; text-align: center; padding: 20px 0 12px; font-size: 22px; transition: background .3s; }
.calPage { text-align: center; animation: tear .45s cubic-bezier(.3,1.4,.5,1); transform-origin: top center; }
@keyframes tear { from { transform: rotateX(-70deg); opacity: .2; } }
.calNum { font-family: var(--display); font-size: clamp(130px, 15vw, 190px); line-height: .9; letter-spacing: -.06em; transition: color .3s; }
.calUnit { font-family: var(--bold); letter-spacing: .3em; color: var(--muted); }
.mood { font-size: clamp(44px, 5vw, 64px); line-height: 1; transition: color .3s; }
.mood small { display: block; font-size: .5em; color: var(--muted); margin-top: 6px; }
.ruler { --rz: -1deg; margin: 28px 0 22px; padding: 14px 10px 30px; background: #F3E3A8; box-shadow: 0 3px 0 #c9b46c, 0 20px 26px -14px rgba(27,30,63,.5); background-image: repeating-linear-gradient(90deg, rgba(27,30,63,.7) 0 1.5px, transparent 1.5px 12px), repeating-linear-gradient(90deg, rgba(27,30,63,.8) 0 2px, transparent 2px 60px); background-size: 100% 12px, 100% 22px; background-position: 0 100%, 0 100%; background-repeat: repeat-x; }
@media (prefers-color-scheme: dark) { .ruler { background-color: #C9B87E; } }
.ruler input { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; background: transparent; cursor: pointer; }
.ruler input::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 44px; background: var(--red); clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%); cursor: grab; }
.ruler input::-moz-range-thumb { width: 30px; height: 44px; background: var(--red); border: 0; }
.blocks { display: flex; flex-wrap: wrap; gap: 8px; }
.blocks div { width: 28px; height: 28px; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.5), 0 6px 8px -4px rgba(0,0,0,.45); animation: pop .35s cubic-bezier(.3,1.7,.5,1) both; }
.tinyL { font-size: 24px; margin-top: 12px; }

/* panic */
.panicSec { display: grid; grid-template-columns: auto 1fr; gap: clamp(36px, 7vw, 100px); align-items: center; }
.panicWrap { position: relative; }
#root .panic, .panic { width: clamp(180px, 20vw, 240px); aspect-ratio: 1; border-radius: 50% !important; background: radial-gradient(circle at 35% 30%, #ff6b8b, #c51f45 70%); box-shadow: 0 14px 0 #7d1229, 0 26px 30px rgba(0,0,0,.35); color: #fff; transition: transform .08s, box-shadow .08s; }
.panic span { font-family: var(--display); font-size: clamp(32px, 3.6vw, 46px); letter-spacing: .04em; text-shadow: 0 2px 0 rgba(0,0,0,.25); }
.panic:hover { transform: translateY(-2px); }
.panic:active { transform: translateY(12px); box-shadow: 0 2px 0 #7d1229, 0 8px 12px rgba(0,0,0,.35); }
.panicNote { position: absolute; right: -40px; top: -20px; font-size: 28px; color: var(--red); transform: rotate(10deg); }
.indexCard.plain { --rz: 1deg; padding: 0 32px 32px; max-width: 620px; }
.indexCard.plain h3 { font-size: clamp(30px, 3.6vw, 46px); letter-spacing: -.03em; margin: 0 0 8px; line-height: 1; }
.big2 { font-size: 34px; margin: 0; }
.handList { font-family: var(--hand); font-size: clamp(26px, 2.6vw, 32px); line-height: 32px; color: var(--pen); padding-left: 28px; margin: 6px 0 22px; }
.handList b { font-family: var(--hand); color: var(--red); }
.shake .panicSec { animation: shake .45s; }
@keyframes shake { 20% { transform: translateX(-10px) rotate(-1deg); } 40% { transform: translateX(9px) rotate(1deg); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }

/* pricing */
.plans { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; max-width: 920px; }
.plan { padding: 40px 32px 32px; display: flex; flex-direction: column; gap: 8px; transition: transform .25s cubic-bezier(.3,1.6,.5,1); }

.planName { font-size: 32px; }
.cost { font-size: 64px; letter-spacing: -.04em; line-height: 1; }
.cost small { font-size: 20px; letter-spacing: 0; opacity: .7; font-family: var(--bold); }
.plan ul { margin: 8px 0 20px; padding-left: 0; list-style: none; font-family: var(--hand); font-size: 28px; line-height: 1.25; flex: 1; color: #1B1E3F; }
.plan li::before { content: '✓ '; color: #1B1E3F; }
.circled { position: absolute; top: 18px; right: 14px; font-size: 22px; color: var(--red); padding: 4px 10px; border: 2.5px solid var(--red); border-radius: 50% 46% 52% 48% / 55% 45% 55% 45% !important; transform: rotate(6deg); }

/* end */
.end { padding-bottom: 50px; }
.end h2 { font-size: clamp(58px, 11vw, 168px); line-height: .88; letter-spacing: -.055em; margin-bottom: 40px; }
.scribble { position: relative; display: inline-block; }
.scribble svg { position: absolute; left: 0; right: 0; bottom: -10px; width: 100%; height: 30px; }
footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin: 70px 0 0; padding: 22px clamp(16px, 4vw, 48px) 36px clamp(90px, 9vw, 130px); border-top: 1.5px dashed color-mix(in srgb, var(--ink) 35%, transparent); }
footer .hand { font-size: 24px; }

.confetti { position: fixed; inset: 0; pointer-events: none; z-index: 50; overflow: hidden; }
.confetti i { position: absolute; top: -20px; width: 12px; height: 12px; animation: fall linear forwards; box-shadow: 0 2px 2px rgba(0,0,0,.15); }
@keyframes fall { to { top: 110%; transform: rotate(540deg) translateX(40px); } }

@media (max-width: 900px) {
  .hero, .board, .plans, .panicSec, .examDesk, .tutorDesk { grid-template-columns: 1fr; }
  .heroArt { height: 380px; }
  .heroNote { width: 160px; min-height: 140px; padding: 24px 16px 16px; } .heroNote b { font-size: 31px; }
  .syllabus { width: 220px; justify-self: center; }
  .grab { right: -20px; }
  .q { min-height: 0; max-width: 300px; }
  .deskCal { justify-self: center; }
  .panicWrap { justify-self: center; }
}
@media (max-width: 600px) {
  .holes { left: 4px; } .holes i { width: 14px; height: 14px; }
  .nav { padding-left: 40px; }
  .hero, section, footer { padding-left: 40px; padding-right: 16px; }
  .hero h1 { font-size: clamp(42px, 13vw, 60px); }
  .kicker { font-size: 21px; }
  .note1 { display: none; }
  .day { min-height: 120px; padding: 6px 2px; } .due { font-size: 10px; padding: 5px 3px; } .day > span { font-size: 17px; }
  .clipboard { padding: 40px 10px 10px; } .drop { padding: 12px; }
  .indexCard .tabs { top: -78px; left: 8px; } .tab { padding: 8px 10px 16px; font-size: 13px; }
  .plan ul { font-size: 24px; }
  .circled { position: static; align-self: flex-start; margin-bottom: 6px; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .reveal { opacity: 1; transform: none; } }
`;
