import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Pressy, ic, type IconName } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { useWide } from '@/lib/useWide';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { title: string; icon: IconName; color: string }> = {
  index: { title: 'Today', icon: ic('sun.max.fill', 'wb_sunny'), color: '#E2A300' },
  calendar: { title: 'Calendar', icon: ic('calendar', 'calendar_month'), color: '#F0457E' },
  courses: { title: 'Courses', icon: ic('books.vertical.fill', 'menu_book'), color: '#0F9F74' },
  chat: { title: 'Tutor', icon: ic('bubble.left.and.bubble.right.fill', 'forum'), color: '#3442F5' },
  profile: { title: 'You', icon: ic('person.crop.circle.fill', 'account_circle'), color: '#8B4DF0' },
};

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
            <Pressy key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.title} onPress={() => go(navigation, r.key, r.name, on)}>
              <Animated.View layout={LinearTransition.springify().damping(18)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: on ? 16 : 13, borderRadius: 999, backgroundColor: on ? t.accent : 'transparent' }}>
                <Icon name={tab.icon} size={22} color={on ? t.onAccent : t.muted} />
                {on && <Text style={{ color: t.onAccent, fontFamily: font.bold, fontSize: 14 }}>{tab.title}</Text>}
              </Animated.View>
            </Pressy>
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
      <Pressable onPress={() => router.navigate('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.xl, paddingHorizontal: 8 }}>
        <View style={{ width: 30, height: 26 }}>
          {['#FFD43B', '#F0457E', '#3442F5'].map((c, i) => <View key={c} style={{ position: 'absolute', left: i * 6, top: i % 2 ? 3 : 0, width: 18, height: 18, borderRadius: 4, backgroundColor: c, transform: [{ rotate: `${[-10, 4, 12][i]}deg` }] }} />)}
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 21, color: t.text, letterSpacing: -0.5 }}>StudyBuddy</Text>
      </Pressable>
      {state.routes.map((r, i) => {
        const tab = TABS[r.name]; if (!tab) return null;
        const on = state.index === i;
        return (
          <Pressy key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => go(navigation, r.key, r.name, on)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: on ? tint(tab.color, t.dark ? 0.22 : 0.14) : 'transparent' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tab.color : t.surface, transform: [{ rotate: on ? '-6deg' : '0deg' }] }}>
              <Icon name={tab.icon} size={20} color={on ? '#FFFFFF' : t.muted} />
            </View>
            <Text style={{ fontFamily: on ? font.bold : font.semi, fontSize: 17, color: on ? t.text : t.muted }}>{tab.title}</Text>
          </Pressy>
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
  return (
    <Tabs tabBar={(p) => (wide ? <SideBar {...p} /> : <TabBar {...p} />)}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg }, tabBarPosition: wide ? 'left' : 'bottom' }}>
      {Object.entries(TABS).map(([name, v]) => <Tabs.Screen key={name} name={name} options={{ title: v.title }} />)}
    </Tabs>
  );
}
