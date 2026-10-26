// First-time walkthrough. It moves through the real tabs, rings the menu button for each one,
// and explains what lives there on a sticky note. Skippable; replay it from the You tab.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Icon, Pressy, ic, Tape } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { SECTIONS } from '@/components/course/sections';
import { useAccount } from '@/lib/auth';
import { endTour, useTour } from '@/lib/tour';
import { useWide } from '@/lib/useWide';
import { font, space } from '@/lib/theme';

const INK = '#1B1E3F', INK_SOFT = 'rgba(27,30,63,0.75)', NOTE = '#FFE45E';

type Step = { tab?: 'index' | 'calendar' | 'courses' | 'chat' | 'profile'; title: string; body: string; extra?: ReactNode };

function Toolbox() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {SECTIONS.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.65)', paddingVertical: 5, paddingHorizontal: 8, width: '48%' }}>
          <View style={{ width: 22, height: 22, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={13} color="#FFFFFF" /></View>
          <Text style={{ fontFamily: font.semi, fontSize: 13, color: INK }}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Modes() {
  const m = [['Ask', 'quick answers'], ['Teach me', 'learn a topic'], ['Practice', 'questions + marking'], ['Coding', 'code exercises'], ['Assignment', 'help with one task']];
  return (
    <View style={{ gap: 3, marginTop: 4 }}>
      {m.map(([a, b]) => <Text key={a} style={{ fontFamily: font.body, fontSize: 14, color: INK }}><Text style={{ fontFamily: font.bold }}>{a}</Text>  {b}</Text>)}
    </View>
  );
}

export function Tour() {
  const { open, rects } = useTour();
  const { session } = useAccount();
  const wide = useWide();
  const { width: W, height: H } = useWindowDimensions();
  const [i, setI] = useState(0);
  const name = (session?.user.user_metadata?.display_name as string | undefined)?.split(' ')[0];

  const steps: Step[] = [
    { title: `Hey${name ? ` ${name}` : ''}, I'm Scrawlie!`, body: "Here's a quick look around. It takes about a minute, and you can skip it any time." },
    { tab: 'index', title: 'Today', body: 'Your study plan for today. Tick sessions off, press play to start one with the tutor, and change the plan in plain words, like "take tomorrow off".' },
    { tab: 'calendar', title: 'Calendar', body: 'Every exam, assignment and study session from all your courses in one place.' },
    { tab: 'courses', title: 'Courses', body: 'Each course is a sticky note. Open one and you get its toolbox:', extra: <Toolbox /> },
    { tab: 'chat', title: 'Tutor', body: 'A tutor that has read your course files. Pick how you want help:', extra: <Modes /> },
    { tab: 'profile', title: 'You', body: 'Study hours, teaching style, reminders, calendar sync and your plan. You can replay this tour from here.' },
    { title: 'Start with one course', body: 'Upload its syllabus or course outline. Scrawlie pulls out the deadlines and builds your plan. Then add lecture slides to unlock the tutor and exam prep.' },
  ];
  const s = steps[i], last = i === steps.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => { if (open && s.tab) router.navigate(s.tab === 'index' ? '/' : `/${s.tab}`); }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  const pulse = useSharedValue(1);
  useEffect(() => { pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 600 }), withTiming(1, { duration: 600 })), -1); }, [pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!open) return null;
  const finish = () => endTour(session?.user.id);
  const r = s.tab ? rects[s.tab] : undefined;
  const cardW = Math.min(wide ? 380 : W - 32, 400);

  // Where the note goes: beside the sidebar button on a laptop, above the tab bar on a phone, centred otherwise.
  let pos: object = { left: (W - cardW) / 2, top: Math.max(40, H / 2 - 190) };
  if (r && wide) pos = { left: r.x + r.w + 28, top: Math.max(16, Math.min(r.y - 30, H - 380)) };
  else if (r) pos = { left: (W - cardW) / 2, bottom: H - r.y + 22 };

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <Pressable accessibilityLabel="Skip tour" onPress={() => {}} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,15,13,0.55)' }} />
      {r && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12, borderWidth: 3, borderColor: NOTE, borderRadius: wide ? 0 : 999 }, ring,
          Platform.OS === 'web' ? { boxShadow: `0 0 0 6px rgba(255,228,94,0.25), 0 0 30px ${NOTE}` } as object : {}]} />
      )}
      <Animated.View key={i} entering={FadeIn.duration(220)}
        style={[{ position: 'absolute', width: cardW, backgroundColor: NOTE, padding: space.xl, paddingTop: space.xl + 4, gap: space.sm, transform: [{ rotate: i % 2 ? '0.8deg' : '-0.8deg' }] },
          Platform.OS === 'web' ? { boxShadow: '0 22px 40px -12px rgba(0,0,0,0.6), 0 2px 0 rgba(0,0,0,0.15)' } as object : { elevation: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }, pos]}>
        <Tape />
        {r && wide && <View style={{ position: 'absolute', left: -12, top: Math.min(Math.max(r.y - (pos as { top: number }).top + r.h / 2 - 12, 20), 200), width: 0, height: 0, borderTopWidth: 12, borderBottomWidth: 12, borderRightWidth: 12, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: NOTE }} />}
        {r && !wide && <View style={{ position: 'absolute', bottom: -12, left: Math.min(Math.max(r.x + r.w / 2 - (W - cardW) / 2 - 12, 16), cardW - 40), width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: NOTE }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(!s.tab) && <LogoMark size={46} />}
          <Text style={{ fontFamily: font.hand, fontSize: 34, lineHeight: 38, color: INK, flex: 1 }}>{s.title}</Text>
          <Text style={{ fontFamily: font.semi, fontSize: 13, color: INK_SOFT }}>{i + 1}/{steps.length}</Text>
        </View>
        <Text style={{ fontFamily: font.body, fontSize: 16, lineHeight: 23, color: INK }}>{s.body}</Text>
        {s.extra}
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
          {steps.map((_, k) => <View key={k} style={{ height: 5, flex: 1, backgroundColor: k <= i ? INK : 'rgba(27,30,63,0.18)' }} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
          {!last ? <Pressable onPress={finish} hitSlop={8}><Text style={{ fontFamily: font.semi, fontSize: 14, color: INK_SOFT, textDecorationLine: 'underline' }}>Skip tour</Text></Pressable> : null}
          <View style={{ flex: 1 }} />
          {i > 0 && <TourBtn label="Back" soft onPress={() => setI(i - 1)} />}
          {last
            ? <TourBtn label="Add my first course" onPress={() => { finish(); router.push('/course/new'); }} />
            : <TourBtn label={i === 0 ? "Let's go" : 'Next'} onPress={() => setI(i + 1)} />}
        </View>
        {last && <Pressable onPress={() => { finish(); router.navigate('/'); }} hitSlop={8} style={{ alignSelf: 'flex-end' }}><Text style={{ fontFamily: font.semi, fontSize: 14, color: INK_SOFT, textDecorationLine: 'underline' }}>I'll look around first</Text></Pressable>}
      </Animated.View>
    </View>
  );
}

function TourBtn({ label, onPress, soft }: { label: string; onPress: () => void; soft?: boolean }) {
  return (
    <Pressy onPress={onPress} accessibilityRole="button"
      style={[{ backgroundColor: soft ? 'rgba(27,30,63,0.1)' : INK, paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
        Platform.OS === 'web' && !soft ? { boxShadow: '0 4px 0 rgba(0,0,0,0.35)' } as object : {}]}>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: soft ? INK : NOTE }}>{label}</Text>
      {!soft && <Icon name={ic('arrow.right', 'arrow_forward')} size={16} color={NOTE} />}
    </Pressy>
  );
}
