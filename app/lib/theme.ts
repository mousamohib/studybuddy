// StudyBuddy look: a student's desk. Ink-blue pen for actions, highlighter colours for courses,
// Bricolage Grotesque for headings, Figtree for reading. Every screen takes colours from here.
import { Platform } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';

const light = {
  bg: '#FFFFFF',
  surface: '#F1F2F8',     // filled areas: inputs, tracks, chips
  card: '#FFFFFF',
  text: '#181A36',
  muted: '#676B90',
  border: '#E6E8F1',
  accent: '#3442F5',      // ink blue
  accentSoft: '#E4E6FF',
  onAccent: '#FFFFFF',
  highlight: '#FFD43B',   // highlighter yellow
  onHighlight: '#2B2300',
  danger: '#E5385F',
  good: '#12A57A',
  warn: '#E8890C',
  overlay: 'rgba(18,20,48,0.45)',
};

const dark: typeof light = {
  bg: '#0F1124',
  surface: '#1B1E3B',
  card: '#0F1124',
  text: '#EEF0FF',
  muted: '#9A9EC6',
  border: '#242849',
  accent: '#7D88FF',
  accentSoft: '#252A5C',
  onAccent: '#0F1124',
  highlight: '#FFD43B',
  onHighlight: '#2B2300',
  danger: '#FF6B8B',
  good: '#3AD6A3',
  warn: '#FFB04A',
  overlay: 'rgba(0,0,0,0.6)',
};

// Website: the green cutting-mat desk from the front page. Paper things (sticky notes, cards) sit on top.
const mat: typeof light = {
  bg: '#143630',
  surface: 'rgba(255,255,255,0.1)',
  card: '#143630',
  text: '#F4F5FF',
  muted: 'rgba(244,245,255,0.8)',
  border: 'rgba(255,255,255,0.16)',
  accent: '#FFE45E',
  accentSoft: 'rgba(255,228,94,0.16)',
  onAccent: '#1B1E3F',
  highlight: '#FFE45E',
  onHighlight: '#1B1E3F',
  danger: '#FF7AA8',
  good: '#7BE3B8',
  warn: '#FFB04A',
  overlay: 'rgba(5,20,17,0.6)',
};

export type Theme = typeof light & { dark: boolean };
export const themes = Platform.OS === 'web' ? { light: mat, dark: mat } : { light, dark };

const WEB = Platform.OS === 'web';
export function useTheme(): Theme {
  const d = useColorScheme() === 'dark';
  if (WEB) return { ...mat, dark: true };
  return { ...(d ? dark : light), dark: d };
}

/** hex colour + opacity (0-1) → #RRGGBBAA */
export const tint = (hex: string, a: number) => {
  const m = hex.match(/^rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b, al = '1'] = m[1].split(',').map((x) => x.trim()); return `rgba(${r},${g},${b},${(Number(al) * Math.max(0, Math.min(1, a))).toFixed(3)})`; }
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return `#${full}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;
};

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  headingSemi: 'BricolageGrotesque_600SemiBold',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  hand: 'Caveat_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const type = {
  display: { fontFamily: font.display, fontSize: 36, lineHeight: 40, letterSpacing: -1 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.6 },
  heading: { fontFamily: font.heading, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23 },
  strong: { fontFamily: font.semi, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: font.semi, fontSize: 13.5, lineHeight: 18 },
  tiny: { fontFamily: font.semi, fontSize: 11.5, lineHeight: 14 },
};

/** Mix a colour towards white (amt 0-1). */
export const lighten = (hex: string, amt: number) => {
  const h = hex.replace('#', '').slice(0, 6);
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).map((v) => Math.round(v + (255 - v) * amt));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** A course colour made readable as text on the current background. */
export const ink = (hex: string, t: { dark: boolean }) => (t.dark ? lighten(hex, 0.38) : hex);
