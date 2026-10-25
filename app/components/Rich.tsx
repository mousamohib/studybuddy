import RichText from './RichText';
import { tint, useTheme } from '@/lib/theme';

/** Markdown + maths in the app's colours, sized to its content. */
export function Rich({ text, fontSize }: { text: string; fontSize?: number }) {
  const t = useTheme();
  return (
    <RichText
      markdown={text}
      fontSize={fontSize}
      colors={{ text: t.text, muted: t.muted, accent: t.accent, surface: t.surface, border: t.border, mark: tint(t.highlight, t.dark ? 0.32 : 0.55) }}
      dom={{ matchContents: true, scrollEnabled: false }}
    />
  );
}
