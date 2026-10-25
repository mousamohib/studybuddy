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

/** Icon and colour for each teaching style, used on the cards that pick one. */
export const STYLE_LOOK: Record<string, { ios: string; material: string; color: string }> = {
  simple: { ios: 'lightbulb.fill', material: 'lightbulb', color: '#C99A00' },
  exam: { ios: 'target', material: 'track_changes', color: '#F0457E' },
  maths: { ios: 'function', material: 'function', color: '#3442F5' },
  lecture: { ios: 'graduationcap.fill', material: 'school', color: '#0F9F74' },
  quick: { ios: 'bolt.fill', material: 'bolt', color: '#F07A12' },
  custom: { ios: 'slider.horizontal.3', material: 'tune', color: '#8B4DF0' },
};
