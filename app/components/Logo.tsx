// The Scrawlie mark: a yellow sticky note with a peeled corner, a strip of tape and a smile.
// The name is written in handwriting next to it.
import { Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { font, useTheme } from '@/lib/theme';

export function LogoMark({ size = 32, tilt = -6 }: { size?: number; tilt?: number }) {
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: `${tilt}deg` }] }}>
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G>
        <Path d="M18 18h64v46L64 82H18z" fill="#FFD43B" />
        <Path d="M64 82l18-18H70a6 6 0 0 0-6 6z" fill="#E0B100" />
        <Rect x="40" y="12" width="22" height="10" fill="rgba(255,255,255,0.75)" />
        <Circle cx="38" cy="44" r="4.5" fill="#1B1E3F" />
        <Circle cx="60" cy="44" r="4.5" fill="#1B1E3F" />
        <Path d="M36 56q13 11 26 0" fill="none" stroke="#1B1E3F" strokeWidth={5} strokeLinecap="round" />
      </G>
    </Svg>
    </View>
  );
}

/** Logo plus the handwritten name. */
export function Wordmark({ size = 28, color, style }: { size?: number; color?: string; style?: TextStyle }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.25 }}>
      <LogoMark size={size * 1.25} />
      <Text style={[{ fontFamily: font.hand, fontSize: size * 1.25, lineHeight: size * 1.45, color: color ?? t.text, transform: [{ rotate: '-3deg' }] }, style]}>Scrawlie</Text>
    </View>
  );
}
