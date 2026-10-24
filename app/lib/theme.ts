// Calm, Notion-like palette. Every screen takes colours from here so light and dark both work.
import { useColorScheme } from '@/components/useColorScheme';

const light = {
  bg: '#FFFFFF',
  surface: '#F7F7F5',
  card: '#FFFFFF',
  text: '#37352F',
  muted: '#787774',
  border: '#E9E9E7',
  accent: '#2383E2',
  onAccent: '#FFFFFF',
  danger: '#E03E3E',
  good: '#0F7B6C',
  warn: '#D9730D',
};

const dark: typeof light = {
  bg: '#191919',
  surface: '#202020',
  card: '#252525',
  text: '#E6E6E4',
  muted: '#9B9A97',
  border: '#2F2F2F',
  accent: '#529CCA',
  onAccent: '#FFFFFF',
  danger: '#FF7369',
  good: '#4DAB9A',
  warn: '#FFA344',
};

export type Theme = typeof light;
export const themes = { light, dark };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 8, lg: 12 };
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};
