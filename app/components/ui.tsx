// Shared building blocks so every screen looks and feels the same.
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { font, ink, radius, space, tint, type, useTheme } from '@/lib/theme';
import { useWide } from '@/lib/useWide';

/** Inside a course, buttons, tabs and links take the course's colour. */
const AccentCtx = createContext<string | null>(null);
export const AccentProvider = AccentCtx.Provider;
export const useAccent = () => { const t = useTheme(); const c = useContext(AccentCtx); return { color: c ?? t.accent, custom: !!c }; };

export const haptic = {
  tap: () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warn: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};

/** Icon names per platform: SF Symbols on iPhone, Material Symbols on Android and web. */
export type IconName = { ios: string; android: string; web: string };
export const ic = (ios: string, material: string): IconName => ({ ios, android: material, web: material });
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <SymbolView name={name as any} tintColor={color ?? t.text} size={size} />;
}

/** A pressable that gives a little squash when touched. */
export function Pressy({ children, style, scaleTo = 0.97, onPress, haptics = true, lift, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptics?: boolean; lift?: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  const rx = useSharedValue(0), ry = useSharedValue(0), ty = useSharedValue(0);
  const baseT = ((StyleSheet.flatten(style) ?? {}) as ViewStyle).transform;
  const base = (Array.isArray(baseT) ? baseT : []) as { rotate?: string }[];
  const baseRot = base.find((x) => x.rotate)?.rotate ?? '0deg';
  const a = useAnimatedStyle(() => (lift
    ? { transform: [{ perspective: 900 }, { translateY: ty.value }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }, { rotate: baseRot }, { scale: s.value }] }
    : { transform: [...(base as never[]), { scale: s.value }] }));
  const hoverProps = lift && Platform.OS === 'web' ? {
    onHoverIn: () => { ty.value = withSpring(-6, { damping: 15 }); },
    onHoverOut: () => { ty.value = withSpring(0); rx.value = withSpring(0); ry.value = withSpring(0); },
    onPointerMove: (e: { nativeEvent: { offsetX?: number; offsetY?: number }; currentTarget: unknown }) => {
      const el = e.currentTarget as unknown as HTMLElement; const r = el.getBoundingClientRect?.();
      const ne = e.nativeEvent as unknown as { clientX: number; clientY: number };
      if (!r) return;
      ry.value = withTiming(((ne.clientX - r.left) / r.width - 0.5) * 12, { duration: 120 });
      rx.value = withTiming(-((ne.clientY - r.top) / r.height - 0.5) * 10, { duration: 120 });
    },
  } : {};
  // Sizing in the parent's layout belongs on the outer touch area; the look goes on the animated inner view.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = {}, inner: ViewStyle = { ...flat };
  for (const k of ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'maxWidth', 'minWidth', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical'] as const) {
    if (flat[k] !== undefined) { (outer as Record<string, unknown>)[k] = flat[k]; delete (inner as Record<string, unknown>)[k]; }
  }
  if (outer.flex || outer.flexGrow || outer.width) inner.flexGrow = 1;
  return (
    <Pressable {...rest} {...(hoverProps as object)} style={outer} onPress={(e) => { if (haptics) haptic.tap(); onPress?.(e); }}
      onPressIn={(e) => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 420 }); rest.onPressIn?.(e); }}
      onPressOut={(e) => { s.value = withSpring(1, { damping: 14, stiffness: 300 }); rest.onPressOut?.(e); }}>
      <Animated.View style={[inner, a]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Screen({ children, scroll = true, style, wide }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; wide?: boolean }) {
  const t = useTheme();
  const big = useWide();
  const inner: ViewStyle = { width: '100%', maxWidth: wide ? 1100 : 820, alignSelf: 'center', ...(big ? { paddingHorizontal: space.xxl, paddingTop: space.xxl } : {}) };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg, padding: space.lg }, inner, style]}>{children}</View>;
  return (
    <ScrollView style={[{ flex: 1, backgroundColor: t.bg }, paperBg(t)]} contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: 120 }, inner, style]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** Website: ruled notebook paper with a red margin line. */
export const paperBg = (t: { dark: boolean; bg: string }): ViewStyle => (Platform.OS !== 'web' ? {} : ({
  backgroundImage: `linear-gradient(90deg, transparent 38px, ${t.dark ? 'rgba(255,107,139,0.28)' : 'rgba(229,56,95,0.35)'} 38px, ${t.dark ? 'rgba(255,107,139,0.28)' : 'rgba(229,56,95,0.35)'} 39.5px, transparent 39.5px, transparent 42px, ${t.dark ? 'rgba(255,107,139,0.28)' : 'rgba(229,56,95,0.35)'} 42px, ${t.dark ? 'rgba(255,107,139,0.28)' : 'rgba(229,56,95,0.35)'} 43.5px, transparent 43.5px), repeating-linear-gradient(transparent 0 33px, ${t.dark ? 'rgba(130,150,255,0.13)' : 'rgba(80,120,230,0.17)'} 33px 34px)`,
  backgroundAttachment: 'local',
} as ViewStyle));

const WEIGHT_FONT: Record<string, string> = { '400': font.body, normal: font.body, '500': font.medium, '600': font.semi, '700': font.bold, bold: font.bold, '800': font.bold, '900': font.bold };
const HEADING_VARIANTS = new Set(['display', 'title', 'heading']);

export function T({ children, variant = 'body', muted, color, style, numberOfLines }: {
  children: ReactNode; variant?: keyof typeof type; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  const t = useTheme();
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // Custom fonts need a family per weight, so a fontWeight on body text picks the matching Figtree file.
  const fix: TextStyle = {};
  if (flat.fontWeight && !HEADING_VARIANTS.has(variant) && !flat.fontFamily) { fix.fontFamily = WEIGHT_FONT[String(flat.fontWeight)] ?? font.semi; fix.fontWeight = 'normal'; }
  return <Text numberOfLines={numberOfLines} style={[type[variant], { color: color ?? (muted ? t.muted : t.text) }, flat, fix]}>{children}</Text>;
}

/**
 * A block of content. Plain blocks have no box: they sit on the page, separated by a thin rule above.
 * `tint` makes a coloured note (for messages and highlights); `flat` a soft grey note.
 */
export function Card({ children, style, tint: tc, onPress, flat }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string; onPress?: () => void; flat?: boolean }) {
  const t = useTheme();
  const base: ViewStyle = tc || flat
    ? { backgroundColor: tc ? tint(tc, t.dark ? 0.16 : 0.1) : t.surface, borderRadius: radius.md, padding: space.md, gap: space.sm }
    : { borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border, paddingTop: space.lg, gap: space.sm };
  if (onPress) return <Pressy onPress={onPress} style={[base, style]}>{children}</Pressy>;
  return <View style={[base, style]}>{children}</View>;
}

export type ButtonKind = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost' | 'highlight';
export function Button({ title, onPress, kind = 'primary', disabled, loading, style, icon, small, color }: {
  title: string; onPress?: () => void; kind?: ButtonKind; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; icon?: IconName; small?: boolean; color?: string;
}) {
  const t = useTheme();
  const acc = useAccent();
  const main = color ?? acc.color;
  const bg = { primary: main, secondary: 'transparent', soft: tint(main, t.dark ? 0.22 : 0.12), danger: t.danger, ghost: 'transparent', highlight: t.highlight }[kind];
  const fg = { primary: color || acc.custom ? '#FFFFFF' : t.onAccent, secondary: ink(main, t), soft: ink(main, t), danger: '#FFFFFF', ghost: color ? ink(color, t) : t.muted, highlight: t.onHighlight }[kind];
  return (
    <Pressy accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={[{
        backgroundColor: bg, borderRadius: radius.md, minHeight: small ? 38 : 50, paddingHorizontal: small ? 14 : 20,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
        borderWidth: kind === 'secondary' ? 1.5 : 0, borderColor: tint(main, 0.5), opacity: disabled ? 0.45 : 1,
        // Website: ink slab with a hard shadow, like the front page.
        ...(Platform.OS === 'web' && kind !== 'ghost' && kind !== 'soft' ? { boxShadow: `0 5px 0 ${kind === 'highlight' ? '#C9A300' : kind === 'danger' ? '#9c1d3d' : 'rgba(10,12,40,0.55)'}, 0 12px 16px -6px rgba(27,30,63,0.45), inset 0 1px 0 rgba(255,255,255,0.25)`, marginBottom: 5 } as object : {}),
      }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 17 : 19} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: small ? 14 : 16, fontFamily: font.bold }}>{title}</Text>
        </>
      )}
    </Pressy>
  );
}

export function Field(props: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const acc = useAccent();
  const { label, hint, error, style, onFocus, onBlur, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput placeholderTextColor={tint(t.muted, 0.8)}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[{
          borderColor: error ? t.danger : focused ? acc.color : 'transparent', borderWidth: 2, borderRadius: radius.md,
          paddingHorizontal: 13, paddingVertical: 12, color: t.text, backgroundColor: t.surface,
          fontSize: 16, fontFamily: font.body, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
        }, style]}
        {...rest} />
      {error ? <T variant="small" color={t.danger}>{error}</T> : hint ? <T variant="small" muted>{hint}</T> : null}
    </View>
  );
}

/** Three tilted sticky notes in course colours. Used on empty screens. */
export function Stickers({ size = 72 }: { size?: number }) {
  const cols = ['#FFD43B', '#FF4F8B', '#3442F5'];
  return (
    <View style={{ width: size * 1.6, height: size * 1.1 }}>
      {cols.map((c, i) => (
        <View key={c} style={{
          position: 'absolute', left: i * size * 0.3, top: i % 2 ? size * 0.12 : 0, width: size, height: size * 0.95, borderRadius: 10,
          backgroundColor: c, transform: [{ rotate: `${[-10, 4, 12][i]}deg` }], opacity: 0.95,
        }} />
      ))}
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'flex-start', gap: space.md, paddingVertical: space.xl }}>
      <Stickers size={44} />
      <T variant="title">{title}</T>
      <T muted style={{ fontSize: 17, lineHeight: 25 }}>{body}</T>
      {action}
    </View>
  );
}

/** A list row: no box, a thin rule underneath. */
export function ListRow({ children, onPress, onLongPress, style, last }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; last?: boolean }) {
  const t = useTheme();
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, borderColor: t.border };
  if (onPress || onLongPress) {
    return (
      <Pressable onPress={() => { haptic.tap(); onPress?.(); }} onLongPress={onLongPress} style={({ pressed }) => [base, { opacity: pressed ? 0.6 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 600 }); }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, backgroundColor: t.surface, borderRadius: height / 2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', backgroundColor: color, borderRadius: height / 2 }, a]} />
    </View>
  );
}

export function Meter({ label, used, limit, color }: { label: string; used: number; limit: number; color?: string }) {
  const t = useTheme();
  const unlimited = limit >= 1000;
  const pct = unlimited ? 0 : Math.min(1, used / Math.max(1, limit));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label">{label}</T>
        <T variant="small" muted>{unlimited ? `${used} used` : `${used} of ${limit}`}</T>
      </View>
      {!unlimited && <Bar value={pct} color={pct >= 1 ? t.danger : pct > 0.75 ? t.warn : color ?? t.accent} />}
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const acc = useAccent();
  return <Bar value={value} color={color ?? acc.color} />;
}

/** A circular progress ring with something in the middle. */
export function Ring({ value, size = 64, stroke = 8, color, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const t = useTheme();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? t.accent} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - v)} strokeLinecap="round" />
      </Svg>
      {children}
    </View>
  );
}

/** Round tick box that pops when ticked. */
export function Check({ checked, onPress, color, size = 26 }: { checked: boolean; onPress: () => void; color?: string; size?: number }) {
  const t = useTheme();
  const c = color ?? t.good;
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }}
      onPress={() => { s.value = withSpring(1.25, { damping: 6, stiffness: 500 }, () => { s.value = withSpring(1); }); if (!checked) haptic.success(); else haptic.tap(); onPress(); }}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: checked ? c : tint(t.muted, 0.6), backgroundColor: checked ? c : 'transparent', alignItems: 'center', justifyContent: 'center' }, a]}>
        {checked ? <Icon name={ic('checkmark', 'check')} size={size * 0.62} color="#FFFFFF" /> : null}
      </Animated.View>
    </Pressable>
  );
}

export function Segments<K extends string>({ items, value, onChange, color }: { items: { key: K; label: string; color?: string }[]; value: K; onChange: (k: K) => void; color?: string }) {
  const t = useTheme();
  const acc = useAccent();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {items.map((it) => {
        const on = value === it.key, c = it.color ?? color ?? acc.color;
        return (
          <Pressy key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.pill, backgroundColor: on ? c : t.surface }}>
            <Text style={{ color: on ? (c === t.accent && !acc.custom && !it.color && !color ? t.onAccent : '#FFFFFF') : t.text, fontSize: 14, fontFamily: font.semi }}>{it.label}</Text>
          </Pressy>
        );
      })}
    </ScrollView>
  );
}

export function Pill({ label, color }: { label: string; color?: string }) {
  const t = useTheme();
  const c = color ?? t.muted;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: tint(c, t.dark ? 0.2 : 0.12) }}>
      <Text style={{ fontSize: 12, fontFamily: font.semi, color: ink(c, t) }}>{label}</Text>
    </View>
  );
}

/** Course code badge: a small coloured block with the code in it. */
export function CourseTag({ code, color, big }: { code: string; color: string; big?: boolean }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: big ? 10 : 7, paddingHorizontal: big ? 10 : 7, paddingVertical: big ? 5 : 2 }}>
      <Text style={{ color: '#FFFFFF', fontFamily: font.heading, fontSize: big ? 15 : 12, letterSpacing: 0.2 }}>{code}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function LinkText({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  const acc = useAccent();
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: color ?? ink(acc.color, t), fontSize: 15, fontFamily: font.semi }}>{title}</Text>
    </Pressable>
  );
}

/** Heading for a part of a screen, with an optional action on the right. */
export function Section({ title, action, children, gap = space.sm }: { title: string; action?: ReactNode; children?: ReactNode; gap?: number }) {
  return (
    <View style={{ gap }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T variant="heading">{title}</T>
        {action}
      </Row>
      {children}
    </View>
  );
}

/** Small round icon button. */
export function IconButton({ icon, onPress, color, bg, label, size = 40 }: { icon: IconName; onPress: () => void; color?: string; bg?: string; label: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? t.surface }}>
      <Icon name={icon} size={size * 0.5} color={color ?? t.text} />
    </Pressy>
  );
}

/** On the website, coloured blocks look like sticky notes: a slight tilt and a soft paper shadow. */
export function useSlab(tilt = -0.6): ViewStyle {
  return Platform.OS === 'web' ? ({ boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 4px 0 rgba(0,0,0,0.06), 0 30px 34px -20px rgba(27,30,63,0.6)', transform: [{ rotate: `${tilt}deg` }], marginTop: 10 } as ViewStyle) : {};
}

/** A strip of sticky tape across the top of a block (website only). */
export function Tape({ left = '50%' }: { left?: `${number}%` }) {
  if (Platform.OS !== 'web') return null;
  return <View pointerEvents="none" style={{ position: 'absolute', top: -12, left, width: 92, marginLeft: -46, height: 24, backgroundColor: 'rgba(255,255,240,0.6)', transform: [{ rotate: '-3deg' }], zIndex: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.12)' } as ViewStyle} />;
}

// Coloured blocks: strong colours with white text in the phone app; pastel sticky notes with ink text on the website.
const WEB = Platform.OS === 'web';
export const onNote = WEB ? '#1B1E3F' : '#FFFFFF';
export const onNoteSoft = WEB ? 'rgba(27,30,63,0.72)' : 'rgba(255,255,255,0.86)';
export const noteChip = WEB ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
export const noteBg = (col: string) => (WEB ? lightenHex(col, 0.55) : col);
function lightenHex(hex: string, amt: number) {
  const h = hex.replace('#', '').slice(0, 6);
  return `#${[0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) + (255 - parseInt(h.slice(i, i + 2), 16)) * amt).toString(16).padStart(2, '0')).join('')}`;
}
