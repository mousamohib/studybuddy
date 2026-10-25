'use dom';
// The website's front page for visitors who aren't signed in. Plain HTML and CSS so it can use
// drag and drop, hover and real web animations. Very little to read: try it, then sign up.
import { useEffect, useRef, useState } from 'react';

type Props = { onStart: () => void; onSignIn: () => void; onLegal: (doc: 'privacy' | 'terms') => void; dom?: import('expo/dom').DOMProps };

const COLS = { blue: '#3442F5', pink: '#F0457E', green: '#0F9F74', orange: '#F07A12', purple: '#8B4DF0', yellow: '#FFD43B' };
const FOUND = [
  { code: 'COMP 202', label: 'Assignment 1', day: 1, col: COLS.blue },
  { code: 'COMP 202', label: 'Quiz 1', day: 3, col: COLS.pink },
  { code: 'COMP 202', label: 'Midterm', day: 5, col: COLS.orange },
  { code: 'COMP 202', label: 'Project', day: 6, col: COLS.green },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CODES = ['COMP 202', 'MATH 140', 'ECON 101', 'PSYC 100', 'BIOL 112', 'CHEM 110', 'PHYS 131', 'MGCR 211', 'ENGL 199', 'STAT 230', 'HIST 101', 'LAW 1001', 'MED 120', 'ECSE 551', 'COMP 535', 'ACCT 351'];

const ANSWERS: Record<string, { label: string; text: string }> = {
  simple: { label: 'Like I\'m 5', text: 'A derivative is just **speed**. If your position changes fast, the derivative is big. If you stand still, it\'s zero. That\'s it.' },
  exam: { label: 'Exam mode', text: '**What they ask:** "find dy/dx". **How to score:** write the rule you used, show one line per step, box the answer. **Trap:** forgetting the chain rule on things like (3x+1)².' },
  maths: { label: 'Show the maths', text: 'f′(x) = lim h→0 [f(x+h) − f(x)] / h.  For f(x) = x²:  [(x+h)² − x²] / h = 2x + h → **2x**.' },
  example: { label: 'Give an example', text: 'You drive 0 → 100 km in 1 hour. Your average speed is 100 km/h. The derivative is your speed **at one exact moment**, like your speedometer.' },
};

function bold(s: string) {
  return s.split('**').map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
}

export default function Landing({ onStart, onSignIn, onLegal }: Props) {
  const [stage, setStage] = useState<'idle' | 'over' | 'reading' | 'found' | 'planned'>('idle');
  const [shown, setShown] = useState(0);
  const [mode, setMode] = useState<keyof typeof ANSWERS>('simple');
  const [typed, setTyped] = useState('');
  const [daysLeft, setDaysLeft] = useState(7);
  const [confetti, setConfetti] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function drop() {
    if (stage === 'reading' || stage === 'found' || stage === 'planned') return;
    setStage('reading'); setShown(0);
    later(1300, () => setStage('found'));
    FOUND.forEach((_, i) => later(1500 + i * 380, () => setShown(i + 1)));
    later(1500 + FOUND.length * 380 + 500, () => { setStage('planned'); setConfetti((c) => c + 1); });
  }
  function reset() { timers.current.forEach(clearTimeout); timers.current = []; setStage('idle'); setShown(0); }

  // Type the tutor's answer out, a few characters at a time.
  useEffect(() => {
    const full = ANSWERS[mode].text;
    let i = 0;
    setTyped('');
    const id = setInterval(() => { i += 3; setTyped(full.slice(0, i)); if (i >= full.length) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [mode]);

  const mood = daysLeft <= 2 ? { t: 'Emergency mode', d: 'Past papers and your cheat sheet. Nothing new.', c: COLS.pink }
    : daysLeft <= 6 ? { t: 'Crunch time', d: 'Practice questions every day, weak topics first.', c: COLS.orange }
    : daysLeft <= 14 ? { t: 'Right on time', d: 'One lecture a day, a quick quiz after each.', c: COLS.blue }
    : { t: 'Chill', d: 'Short sessions. Future you says thanks.', c: COLS.green };
  const sessions = Math.min(28, Math.round(daysLeft * (daysLeft <= 6 ? 2 : 1.2)));

  return (
    <div className="lp">
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" />
      {confetti > 0 && <Confetti key={confetti} />}

      <nav className="nav">
        <div className="brand"><Mark size={30} /><span>StudyBuddy</span></div>
        <div className="navr">
          <button className="link" onClick={() => onSignIn()}>Log in</button>
          <button className="btn small" onClick={() => onStart()}>Start free</button>
        </div>
      </nav>

      <header className="hero">
        <div className="heroText">
          <h1>Your whole semester, sorted in <span className="hl">10 seconds</span>.</h1>
          <p className="sub">Drop your syllabus. Get every deadline, a plan for each day, and a tutor that actually knows your course.</p>
          <div className="ctas">
            <button className="btn big" onClick={() => onStart()}>Start free</button>
            <button className="btn ghost big" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}>Try it first ↓</button>
          </div>
          <p className="tiny">Free forever plan · 7 days of Pro on us · Canada and UK</p>
        </div>
        <div className="heroArt" aria-hidden>
          <div className="sticker s1">Midterm<br /><b>in 3 days</b></div>
          <div className="sticker s2">Today<br /><b>2h 15m</b></div>
          <div className="sticker s3">“Explain<br />it simpler”</div>
          <div className="sticker s4"><b>✓</b> Lecture 7</div>
        </div>
      </header>

      <div className="marquee" aria-hidden><div className="track">{[...CODES, ...CODES].map((c, i) => <span key={i} style={{ background: Object.values(COLS)[i % 6] }}>{c}</span>)}</div></div>

      <section id="try" className="try">
        <h2>Try it. Drag the syllabus in.</h2>
        <div className="board">
          <div className={`paper ${stage !== 'idle' && stage !== 'over' ? 'used' : ''}`} draggable={stage === 'idle' || stage === 'over'}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', 'syllabus')} onClick={drop} title="Drag me, or just click">
            <div className="ptitle">COMP 202<br />syllabus.pdf</div>
            {[90, 70, 84, 60, 78, 50].map((w, i) => <div key={i} className="line" style={{ width: `${w}%` }} />)}
            <div className="grab">drag me →</div>
          </div>
          <div className={`drop ${stage}`} onDragOver={(e) => { e.preventDefault(); if (stage === 'idle') setStage('over'); }}
            onDragLeave={() => stage === 'over' && setStage('idle')} onDrop={(e) => { e.preventDefault(); drop(); }} onClick={drop}>
            {stage === 'idle' || stage === 'over' ? (
              <div className="dropHint"><Mark size={46} /><b>{stage === 'over' ? 'Let go!' : 'Drop it here'}</b><span>or tap the paper</span></div>
            ) : (
              <div className="result">
                <div className="resHead">
                  <b>{stage === 'reading' ? 'Reading your syllabus…' : stage === 'found' ? `Found ${shown} deadline${shown === 1 ? '' : 's'}` : 'Done. Your week is planned.'}</b>
                  {stage === 'planned' && <button className="link" onClick={(e) => { e.stopPropagation(); reset(); }}>Again</button>}
                </div>
                {stage === 'reading' && <div className="scan"><div /></div>}
                <div className="week">
                  {DAYS.map((d, i) => (
                    <div key={d} className="day">
                      <span>{d}</span>
                      {FOUND.slice(0, shown).filter((f) => f.day === i).map((f) => <div key={f.label} className="due pop" style={{ background: f.col }}>{f.label}</div>)}
                      {stage === 'planned' && Array.from({ length: i === 6 ? 1 : 2 }).map((_, j) => <div key={j} className="sess pop" style={{ animationDelay: `${(i * 2 + j) * 40}ms`, background: Object.values(COLS)[(i + j) % 5] }} />)}
                    </div>
                  ))}
                </div>
                {stage === 'planned' && <button className="btn" onClick={(e) => { e.stopPropagation(); onStart(); }}>Do this with my courses</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="step" style={{ background: COLS.yellow, color: '#2B2300' }}><i>1</i><b>Drop your syllabus</b><span>Deadlines and exams go straight into your calendar.</span></div>
        <div className="step" style={{ background: COLS.pink }}><i>2</i><b>Do today's plan</b><span>Tick it off. Fall behind? It re-plans itself.</span></div>
        <div className="step" style={{ background: COLS.blue }}><i>3</i><b>Ask when stuck</b><span>A tutor that read your lecture slides.</span></div>
      </section>

      <section className="tutor">
        <h2>Didn't get it? Change the answer.</h2>
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

      <section className="exam" style={{ ['--mood' as string]: mood.c }}>
        <h2>When's your exam?</h2>
        <div className="big">{daysLeft}<small>{daysLeft === 1 ? 'day' : 'days'}</small></div>
        <input type="range" min={1} max={30} value={daysLeft} onChange={(e) => setDaysLeft(+e.target.value)} aria-label="Days until your exam" />
        <div className="mood"><b>{mood.t}</b><span>{mood.d}</span></div>
        <div className="blocks">{Array.from({ length: sessions }).map((_, i) => <div key={i} style={{ animationDelay: `${i * 15}ms` }} />)}</div>
        <p className="tiny">{sessions} study sessions, sized to the hours you actually have.</p>
      </section>

      <section className="price">
        <h2>Free to start.</h2>
        <div className="plans">
          <div className="plan free">
            <b>Free</b><div className="cost">$0</div>
            <ul><li>2 courses</li><li>7 uploads a month</li><li>20 tutor messages</li><li>Study plan + calendar</li></ul>
            <button className="btn dark" onClick={() => onStart()}>Start free</button>
          </div>
          <div className="plan pro">
            <b>Pro</b><div className="cost">C$9.99<small>/mo</small></div>
            <ul><li>All your courses</li><li>200 uploads</li><li>1,500 tutor messages</li><li>Cheat sheets + practice papers</li></ul>
            <button className="btn yellow" onClick={() => onStart()}>Try Pro free for 7 days</button>
          </div>
        </div>
      </section>

      <section className="end">
        <h2>Stop planning.<br />Start studying.</h2>
        <button className="btn big yellow" onClick={() => onStart()}>Start free</button>
      </section>

      <footer>
        <div className="brand"><Mark size={22} /><span>StudyBuddy</span></div>
        <div><button className="link" onClick={() => onLegal('privacy')}>Privacy</button><button className="link" onClick={() => onLegal('terms')}>Terms</button><button className="link" onClick={() => onSignIn()}>Log in</button></div>
      </footer>
    </div>
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="12" y="26" width="44" height="44" rx="7" fill="#FFD43B" transform="rotate(-10 34 48)" />
      <rect x="28" y="30" width="44" height="44" rx="7" fill="#F0457E" transform="rotate(4 50 52)" />
      <rect x="42" y="24" width="44" height="44" rx="7" fill="#3442F5" transform="rotate(12 64 46)" />
    </svg>
  );
}

function Confetti() {
  const bits = Array.from({ length: 70 }, (_, i) => i);
  const cols = Object.values(COLS);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDelay: `${(i % 10) * 40}ms`, animationDuration: `${1200 + (i % 7) * 180}ms`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  );
}

const CSS = `
:root { --display: BricolageGrotesque_800ExtraBold, 'Bricolage Grotesque', sans-serif; --head: BricolageGrotesque_700Bold, 'Bricolage Grotesque', sans-serif; --body: Figtree_400Regular, Figtree, system-ui, sans-serif; --bold: Figtree_700Bold, Figtree, system-ui, sans-serif; --semi: Figtree_600SemiBold, Figtree, system-ui, sans-serif; --ink:#181A36; --muted:#676B90; --bg:#FFFFFF; --soft:#F1F2F8; --blue:#3442F5; --yellow:#FFD43B; --pink:#F0457E; }
@media (prefers-color-scheme: dark) { :root { --ink:#EEF0FF; --muted:#9A9EC6; --bg:#0F1124; --soft:#1B1E3B; --blue:#7D88FF; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); }
.lp { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; background: var(--bg); color: var(--ink); font-family: var(--body); -webkit-font-smoothing: antialiased; }
h1, h2, .big, .cost, .step b, .brand span { font-family: var(--display); font-weight: normal; }
b, strong, button, .btn, .chip, .link, .grab, .due, .q, .day > span, .track span { font-family: var(--bold); font-weight: normal; }
mark { font-family: var(--bold); }
button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; border-radius: 12px; }
.link { color: var(--muted); font-weight: 600; padding: 8px 10px; }
.link:hover { color: var(--ink); }
.btn { background: #3442F5; color: #fff; font-weight: 700; padding: 14px 22px; border-radius: 14px; font-size: 17px; transition: transform .15s cubic-bezier(.3,1.6,.6,1), box-shadow .15s; box-shadow: 0 4px 0 #1f2bb8; }
.btn:hover { transform: translateY(-2px) rotate(-1deg); }
.btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #1f2bb8; }
.btn.small { padding: 10px 16px; font-size: 15px; }
.btn.big { padding: 18px 30px; font-size: 20px; border-radius: 18px; }
.btn.ghost { background: var(--soft); color: var(--ink); box-shadow: none; }
.btn.yellow { background: var(--yellow); color: #2B2300; box-shadow: 0 4px 0 #c9a300; }
.btn.dark { background: var(--ink); color: var(--bg); box-shadow: none; }
.tiny { color: var(--muted); font-size: 14px; }
mark { background: linear-gradient(transparent 55%, rgba(255,212,59,.75) 55%); color: inherit; padding: 0 2px; }
.hl { background: linear-gradient(transparent 58%, var(--yellow) 58%); padding: 0 .1em; }
@media (prefers-color-scheme: dark) { .hl { background: linear-gradient(transparent 58%, rgba(255,212,59,.45) 58%); } }

.nav { display: flex; justify-content: space-between; align-items: center; padding: 18px clamp(16px, 4vw, 48px); position: sticky; top: 0; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); z-index: 20; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 20px; letter-spacing: -.5px; }
.navr { display: flex; align-items: center; gap: 8px; }

.hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; align-items: center; max-width: 1180px; margin: 0 auto; padding: clamp(24px, 6vw, 80px) clamp(16px, 4vw, 48px) 40px; }
.hero h1 { font-size: clamp(44px, 7.4vw, 96px); line-height: .95; letter-spacing: -.04em; margin: 0 0 20px; font-weight: 800; }
.sub { font-size: clamp(18px, 2vw, 22px); line-height: 1.45; color: var(--muted); max-width: 30ch; margin: 0 0 28px; }
.ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.heroArt { position: relative; height: 420px; }
.sticker { position: absolute; width: 180px; padding: 18px; border-radius: 16px; font-size: 18px; line-height: 1.25; font-family: var(--semi); color: #fff; box-shadow: 0 18px 40px rgba(24,26,54,.18); animation: float 6s ease-in-out infinite; transition: transform .2s; }
.sticker b { font-family: var(--display); font-size: 28px; display: inline-block; margin-top: 2px; }
.sticker:hover { transform: scale(1.06) rotate(0deg) !important; z-index: 5; }
.s1 { background: var(--pink); top: 10px; left: 10%; transform: rotate(-8deg); }
.s2 { background: #3442F5; top: 130px; right: 0; transform: rotate(6deg); animation-delay: -2s; }
.s3 { background: var(--yellow); color: #2B2300; top: 250px; left: 0; transform: rotate(-3deg); animation-delay: -4s; }
.s4 { background: #0F9F74; top: 300px; right: 12%; width: 160px; transform: rotate(9deg); animation-delay: -1s; }
@keyframes float { 50% { translate: 0 -10px; } }

.marquee { overflow: hidden; padding: 18px 0; border-block: 2px solid var(--soft); }
.track { display: flex; gap: 12px; width: max-content; animation: slide 40s linear infinite; }
.track span { color: #fff; font-family: var(--display); font-weight: 700; font-size: 18px; padding: 8px 14px; border-radius: 10px; white-space: nowrap; }
@keyframes slide { to { transform: translateX(-50%); } }

section { max-width: 1180px; margin: 0 auto; padding: clamp(56px, 9vw, 110px) clamp(16px, 4vw, 48px) 0; }
section h2 { font-size: clamp(34px, 5vw, 60px); letter-spacing: -.035em; line-height: 1; margin: 0 0 28px; font-weight: 800; }

.board { display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: stretch; }
.paper { background: #fff; color: #181A36; border-radius: 14px; padding: 20px 18px; box-shadow: 0 16px 36px rgba(24,26,54,.16); transform: rotate(-4deg); cursor: grab; position: relative; transition: transform .2s, opacity .3s; align-self: center; }
.paper:hover { transform: rotate(-1deg) scale(1.03); }
.paper.used { opacity: .25; transform: rotate(0) scale(.9); cursor: default; }
.ptitle { font-family: var(--display); font-weight: 800; font-size: 20px; line-height: 1.1; margin-bottom: 14px; }
.line { height: 8px; background: #E6E8F1; border-radius: 4px; margin: 9px 0; }
.grab { position: absolute; right: -14px; bottom: -14px; background: var(--yellow); color: #2B2300; font-weight: 700; font-size: 14px; padding: 6px 10px; border-radius: 10px; transform: rotate(6deg); }
.drop { min-height: 330px; border-radius: 24px; border: 3px dashed color-mix(in srgb, var(--blue) 40%, transparent); background: color-mix(in srgb, var(--blue) 5%, var(--bg)); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .2s, background .2s; padding: 20px; }
.drop.over { transform: scale(1.02); background: color-mix(in srgb, var(--yellow) 30%, var(--bg)); border-color: var(--yellow); }
.drop.reading, .drop.found, .drop.planned { border-style: solid; border-color: transparent; background: var(--soft); cursor: default; }
.dropHint { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 24px; font-family: var(--display); }
.dropHint span { font-family: var(--body); font-size: 15px; color: var(--muted); }
.result { width: 100%; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
.resHead { display: flex; justify-content: space-between; width: 100%; font-size: 22px; font-family: var(--display); }
.scan { width: 100%; height: 10px; background: var(--bg); border-radius: 5px; overflow: hidden; }
.scan div { height: 100%; width: 40%; background: var(--yellow); border-radius: 5px; animation: scan 1s ease-in-out infinite alternate; }
@keyframes scan { to { transform: translateX(150%); } }
.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; width: 100%; }
.day { display: flex; flex-direction: column; gap: 6px; min-height: 140px; background: var(--bg); border-radius: 12px; padding: 8px 6px; }
.day > span { font-size: 13px; color: var(--muted); font-weight: 700; text-align: center; }
.due { color: #fff; font-size: 12.5px; font-weight: 700; padding: 6px; border-radius: 8px; line-height: 1.15; }
.sess { height: 12px; border-radius: 6px; opacity: .55; }
.pop { animation: pop .45s cubic-bezier(.3,1.7,.5,1) both; }
@keyframes pop { from { transform: scale(.2) translateY(-30px); opacity: 0; } }

.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.step { color: #fff; border-radius: 26px; padding: 28px; display: flex; flex-direction: column; gap: 10px; min-height: 230px; transition: transform .2s cubic-bezier(.3,1.6,.6,1); }
.step:nth-child(1) { transform: rotate(-1.5deg); } .step:nth-child(3) { transform: rotate(1.5deg); }
.step:hover { transform: rotate(0) translateY(-6px); }
.step i { font-style: normal; font-family: var(--display); font-weight: 800; font-size: 64px; line-height: 1; }
.step b { font-size: 28px; letter-spacing: -.02em; line-height: 1.05; }
.step span { font-size: 17px; opacity: .9; line-height: 1.4; }

.chat { max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
.q { align-self: flex-end; background: var(--pink); color: #fff; font-size: 19px; font-weight: 600; padding: 14px 20px; border-radius: 22px 22px 6px 22px; }
.a { display: flex; gap: 12px; align-items: flex-start; min-height: 120px; }
.sb { flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--yellow); color: #2B2300; font-family: var(--display); font-weight: 800; display: grid; place-items: center; transform: rotate(-6deg); }
.a p { margin: 4px 0 0; font-size: clamp(19px, 2.2vw, 24px); line-height: 1.5; }
.caret { display: inline-block; width: 3px; height: 1.1em; background: var(--blue); vertical-align: -3px; margin-left: 2px; animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.modes { display: flex; gap: 10px; flex-wrap: wrap; padding-left: 46px; }
.chip { background: var(--soft); padding: 12px 18px; border-radius: 999px; font-weight: 700; font-size: 16px; transition: transform .15s; }
.chip:hover { transform: translateY(-2px); }
.chip.on { background: #3442F5; color: #fff; }

.exam { text-align: center; }
.exam .big { font-size: clamp(90px, 16vw, 180px); font-weight: 800; letter-spacing: -.06em; line-height: .9; color: var(--mood); transition: color .3s; }
.exam .big small { font-size: .25em; letter-spacing: 0; margin-left: 10px; }
.exam input { width: min(560px, 100%); margin: 24px auto; display: block; accent-color: var(--mood); height: 32px; cursor: pointer; }
.mood { display: flex; flex-direction: column; gap: 4px; font-size: 18px; }
.mood b { font-family: var(--display); font-size: 30px; color: var(--mood); }
.mood span { color: var(--muted); }
.blocks { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 560px; margin: 22px auto 10px; }
.blocks div { width: 30px; height: 30px; border-radius: 8px; background: var(--mood); opacity: .85; animation: pop .35s cubic-bezier(.3,1.7,.5,1) both; }

.plans { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 900px; }
.plan { border-radius: 28px; padding: 32px; display: flex; flex-direction: column; gap: 10px; }
.plan > b { font-family: var(--display); font-size: 26px; }
.plan.free { background: var(--yellow); color: #2B2300; }
.plan.pro { background: #3442F5; color: #fff; }
.cost { font-size: 60px; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
.cost small { font-size: 20px; letter-spacing: 0; opacity: .8; }
.plan ul { margin: 6px 0 16px; padding-left: 20px; font-size: 18px; line-height: 1.8; flex: 1; }
.plan.free .btn.dark { background: #2B2300; color: #FFD43B; }

.end { text-align: center; padding-bottom: 40px; }
.end h2 { font-size: clamp(48px, 9vw, 120px); }
footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; max-width: 1180px; margin: 60px auto 0; padding: 24px clamp(16px, 4vw, 48px) 40px; border-top: 2px solid var(--soft); }

.confetti { position: fixed; inset: 0; pointer-events: none; z-index: 50; overflow: hidden; }
.confetti i { position: absolute; top: -20px; width: 10px; height: 16px; border-radius: 3px; animation: fall linear forwards; }
@keyframes fall { to { top: 110%; transform: rotate(720deg) translateX(40px); } }

@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; }
  .heroArt { height: 260px; }
  .sticker { width: 150px; font-size: 15px; } .sticker b { font-size: 21px; }
  .s2 { top: 40px; } .s3 { top: 150px; } .s4 { top: 170px; }
  .board { grid-template-columns: 1fr; }
  .paper { width: 200px; justify-self: center; }
  .steps, .plans { grid-template-columns: 1fr; }
  .step { min-height: 0; }
  .week { gap: 4px; } .day { min-height: 110px; padding: 6px 3px; } .due { font-size: 10.5px; padding: 4px; }
  .modes { padding-left: 0; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
