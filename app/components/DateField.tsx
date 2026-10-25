// Date and time picker for iPhone and Android. Value is local time as "YYYY-MM-DD HH:MM".
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';
import { Icon, ic, T } from '@/components/ui';
import { localToISO } from '@/lib/data';
import { font, radius, space, useTheme } from '@/lib/theme';

export const toLocalStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const parse = (v: string) => { const iso = localToISO(v); return iso ? new Date(iso) : null; };
const defaultDate = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d; };

export function DateField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const date = parse(value);

  if (Platform.OS === 'ios') {
    return (
      <View style={{ gap: 6 }}>
        {label ? <T variant="label">{label}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: radius.md, padding: 6 }}>
          <DateTimePicker value={date ?? defaultDate()} mode="datetime" display="compact" themeVariant={t.dark ? 'dark' : 'light'} accentColor={t.accent}
            onChange={(_, d) => d && onChange(toLocalStr(d))} />
        </View>
      </View>
    );
  }

  // Android: pick the date, then the time.
  function pick() {
    const start = date ?? defaultDate();
    DateTimePickerAndroid.open({
      value: start, mode: 'date',
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        DateTimePickerAndroid.open({
          value: start, mode: 'time', is24Hour: false,
          onChange: (e2, tm) => {
            if (e2.type !== 'set' || !tm) return;
            const out = new Date(d); out.setHours(tm.getHours(), tm.getMinutes(), 0, 0);
            onChange(toLocalStr(out));
          },
        });
      },
    });
  }
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      <Pressable onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: t.surface, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 14 }}>
        <Icon name={ic('calendar', 'calendar_month')} size={20} color={t.accent} />
        <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: date ? t.text : t.muted }}>
          {date ? date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pick a date and time'}
        </Text>
      </Pressable>
    </View>
  );
}
