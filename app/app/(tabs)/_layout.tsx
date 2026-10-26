import { router, Tabs } from 'expo-router';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Pressy, ic, type IconName } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { Wordmark } from '@/components/Logo';
import { useWide } from '@/lib/useWide';
import { Tour } from '@/components/Tour';
import { maybeStartTour, setNavRect } from '@/lib/tour';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { title: string; icon: IconName; color: string }> = {
  index: { title: 'Today', icon: ic('sun.max.fill', 'wb_sunny'), color: '#E2A300' },
  calendar: { title: 'Calendar', icon: ic('calendar', 'calendar_month'), color: '#F0457E' },
  courses: { title: 'Courses', icon: ic('books.vertical.fill', 'menu_book'), color: '#0F9F74' },
  chat: { title: 'Tutor', icon: ic('bubble.left.and.bubble.right.fill', 'forum'), color: '#3442F5' },
  profile: { title: 'You', icon: ic('person.crop.circle.fill', 'account_circle'), color: '#8B4DF0' },
};

// Wraps a menu button and reports where it is on screen, so the walkthrough can point at it.
function Spot({ name, children }: { name: string; children: ReactNode }) {
  const ref = useRef<View>(null);
  const measure = () => setTimeout(() => ref.current?.measureInWindow((x, y, w, h) => { if (w) setNavRect(name, { x, y, w, h }); }), 60);
  return <View ref={ref} onLayout={measure} collapsable={false}>{children}</View>;
}

function go(navigation: BottomTabBarProps['navigation'], key: string, name: string, on: boolean) {
  const e = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
  if (!on && !e.defaultPrevented) navigation.navigate(name);
}

// Phone: a floating bar; the open tab grows into an ink-blue pill with its name.
function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12), alignItems: 'center' }}>
      <View style={{
        flexDirection: 'row', gap: 4, padding: 6, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
        ...(Platform.OS === 'web' ? { boxShadow: `0 10px 30px ${tint('#181A36', t.dark ? 0.5 : 0.14)}` } as object
          : { shadowColor: '#181A36', shadowOpacity: t.dark ? 0.5 : 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 }),
      }}>
        {state.routes.map((r, i) => {
          const tab = TABS[r.name]; if (!tab) return null;
          const on = state.index === i;
          return (
            <Spot key={r.key} name={r.name}>
            <Pressy accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.title} onPress={() => go(navigation, r.key, r.name, on)}>
              <Animated.View layout={LinearTransition.springify().damping(18)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: on ? 16 : 13, borderRadius: 999, backgroundColor: on ? t.accent : 'transparent' }}>
                <Icon name={tab.icon} size={22} color={on ? t.onAccent : t.muted} />
                {on && <Text style={{ color: t.onAccent, fontFamily: font.bold, fontSize: 14 }}>{tab.title}</Text>}
              </Animated.View>
            </Pressy>
            </Spot>
          );
        })}
      </View>
    </View>
  );
}

// Laptop: a sidebar with big, colourful buttons and one obvious action.
function SideBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const { plan, trialEndsAt } = useAccount();
  return (
    <View style={{ width: 248, paddingHorizontal: space.lg, paddingVertical: space.xl, gap: space.xs, borderRightWidth: 2, borderColor: t.surface, backgroundColor: t.bg }}>
      <Pressable onPress={() => router.navigate('/')} style={{ marginBottom: space.xl, paddingHorizontal: 6 }}>
        <Wordmark size={26} />
      </Pressable>
      {state.routes.map((r, i) => {
        const tab = TABS[r.name]; if (!tab) return null;
        const on = state.index === i;
        return (
          <Spot key={r.key} name={r.name}>
          <Pressy accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => go(navigation, r.key, r.name, on)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: on ? tint(tab.color, t.dark ? 0.22 : 0.14) : 'transparent' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tab.color : t.surface, transform: [{ rotate: on ? '-6deg' : '0deg' }] }}>
              <Icon name={tab.icon} size={20} color={on ? '#FFFFFF' : t.muted} />
            </View>
            <Text style={{ fontFamily: on ? font.bold : font.semi, fontSize: 17, color: on ? t.text : t.muted }}>{tab.title}</Text>
          </Pressy>
          </Spot>
        );
      })}
      <View style={{ flex: 1 }} />
      <Button title="Add a course" icon={ic('plus', 'add')} kind="highlight" onPress={() => router.push('/course/new')} />
      {(plan === 'free' || trialEndsAt) && (
        <Pressable onPress={() => router.push('/paywall')} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.semi, color: t.muted, fontSize: 14 }}>{trialEndsAt ? 'Pro trial' : 'Free plan'} · <Text style={{ color: t.accent }}>Upgrade</Text></Text>
        </Pressable>
      )}
    </View>
  );
}

export default function TabLayout() {
  const t = useTheme();
  const wide = useWide();
  const { session } = useAccount();
  useEffect(() => { if (session) maybeStartTour(session.user.id, session.user.created_at); }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flex: 1 }}>
    <Tabs tabBar={(p) => (wide ? <SideBar {...p} /> : <TabBar {...p} />)}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg }, tabBarPosition: wide ? 'left' : 'bottom' }}>
      {Object.entries(TABS).map(([name, v]) => <Tabs.Screen key={name} name={name} options={{ title: v.title }} />)}
    </Tabs>
    <Tour />
    </View>
  );
}
