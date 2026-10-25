// A short burst of falling paper bits. Change `burst` to fire it again.
import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, ReduceMotion } from 'react-native-reanimated';

const COLS = ['#3442F5', '#F0457E', '#0F9F74', '#F07A12', '#8B4DF0', '#FFD43B'];

function Bit({ i, burst, w, h, big }: { i: number; burst: number; w: number; h: number; big: boolean }) {
  const y = useSharedValue(-30), r = useSharedValue(0), o = useSharedValue(0);
  const x0 = big ? ((i * 53) % 100) / 100 * w : w / 2 + (((i * 37) % 60) - 30) * 4;
  const drift = (((i * 29) % 21) - 10) * 8;
  useEffect(() => {
    if (!burst) return;
    const d = (i % 12) * 35, dur = 1100 + (i % 7) * 160;
    y.value = -30; r.value = 0; o.value = 1;
    y.value = withDelay(d, withTiming(h + 40, { duration: dur, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System }));
    r.value = withDelay(d, withTiming(720 + i * 9, { duration: dur }));
    o.value = withDelay(d + dur - 200, withTiming(0, { duration: 200 }));
  }, [burst, i, h, y, r, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { translateX: (y.value / h) * drift }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ position: 'absolute', left: x0, top: 0, width: 9, height: 14, borderRadius: 3, backgroundColor: COLS[i % COLS.length] }, a]} />;
}

export function Confetti({ burst, big = false }: { burst: number; big?: boolean }) {
  const { width, height } = useWindowDimensions();
  if (!burst) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {Array.from({ length: big ? 70 : 28 }, (_, i) => <Bit key={i} i={i} burst={burst} w={width} h={height} big={big} />)}
    </View>
  );
}
