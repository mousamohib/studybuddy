// Small shared building blocks so every screen looks the same.
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { radius, space, type, useTheme } from '@/lib/theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg, padding: space.lg }, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }, style]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function T({ children, variant = 'body', muted, style }: { children: ReactNode; variant?: keyof typeof type; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type[variant], { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.sm }, style]}>
      {children}
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, loading, style }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? t.onAccent : kind === 'ghost' ? t.muted : t.accent;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: space.lg, alignItems: 'center',
        borderWidth: kind === 'secondary' ? 1 : 0, borderColor: t.accent, opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <T variant="small" muted>{label}</T> : null}
      <TextInput placeholderTextColor={t.muted}
        style={[{ borderColor: t.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, color: t.text, backgroundColor: t.surface, fontSize: 15 }, style]}
        {...rest} />
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.md }}>
      <T variant="heading">{title}</T>
      <T muted>{body}</T>
      {action}
    </Card>
  );
}

export function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const t = useTheme();
  const unlimited = limit >= 1000;
  const pct = unlimited ? 0 : Math.min(1, used / Math.max(1, limit));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small">{label}</T>
        <T variant="small" muted>{unlimited ? `${used} used` : `${used} of ${limit}`}</T>
      </View>
      {!unlimited && (
        <View style={{ height: 6, backgroundColor: t.surface, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: pct >= 1 ? t.danger : t.accent }} />
        </View>
      )}
    </View>
  );
}
