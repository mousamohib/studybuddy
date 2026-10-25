// Web version: the browser's own date and time picker. Value is local time as "YYYY-MM-DD HH:MM".
import { createElement } from 'react';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { font, radius, useTheme } from '@/lib/theme';

export const toLocalStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function DateField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      {createElement('input', {
        type: 'datetime-local',
        value: value ? (value.length === 10 ? `${value}T23:59` : value.replace(' ', 'T').slice(0, 16)) : '',
        onChange: (e: { target: { value: string } }) => onChange(e.target.value.replace('T', ' ')),
        style: {
          fontFamily: font.body, fontSize: 16, color: t.text, background: t.surface, border: '2px solid transparent',
          borderRadius: radius.md, padding: '11px 13px', colorScheme: t.dark ? 'dark' : 'light', outline: 'none',
        },
      })}
    </View>
  );
}
