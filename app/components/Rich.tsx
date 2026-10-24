import RichText from './RichText';
import { useTheme } from '@/lib/theme';

/** Markdown + maths in the app's colours, sized to its content. */
export function Rich({ text, fontSize }: { text: string; fontSize?: number }) {
  const t = useTheme();
  return (
    <RichText
      markdown={text}
      fontSize={fontSize}
      colors={{ text: t.text, muted: t.muted, accent: t.accent, surface: t.surface, border: t.border }}
      dom={{ matchContents: true, scrollEnabled: false }}
    />
  );
}
