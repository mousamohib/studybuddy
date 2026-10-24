// Teaching style presets (the full rules live on the server in supabase/functions/_shared/prompts.ts).
export const STYLE_OPTIONS = [
  { key: 'simple', name: 'Explain simply', blurb: 'Plain words, every term defined, everyday examples first.' },
  { key: 'exam', name: 'Exam-focused', blurb: 'What gets asked, how to answer it, traps, practice.' },
  { key: 'maths', name: 'Step-by-step maths', blurb: 'Background maths first, every derivation step shown.' },
  { key: 'lecture', name: 'Lecture style', blurb: 'In order, in parts, with a coverage checklist.' },
  { key: 'quick', name: 'Quick revision', blurb: 'Short, dense, key formulas only.' },
  { key: 'custom', name: 'Custom', blurb: 'Your own rules, written in Profile.' },
];

export const RESHAPE_OPTIONS = [
  { key: 'simpler', label: 'Simpler' },
  { key: 'detail', label: 'More detail' },
  { key: 'maths', label: 'More mathematical' },
  { key: 'intuition', label: 'More intuition and theory' },
  { key: 'example', label: 'Give an example' },
  { key: 'quiz', label: 'Quiz me on this' },
];
