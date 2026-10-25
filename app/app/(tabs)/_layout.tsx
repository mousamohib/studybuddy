import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Pressy, ic, type IconName } from '@/components/ui';
import { font, tint, useTheme } from '@/lib/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { title: string; icon: IconName }> = {
  index: { title: 'Today', icon: ic('sun.max.fill', 'wb_sunny') },
  calendar: { title: 'Calendar', icon: ic('calendar', 'calendar_month') },
  courses: { title: 'Courses', icon: ic('books.vertical.fill', 'menu_book') },
  chat: { title: 'Tutor', icon: ic('bubble.left.and.bubble.right.fill', 'forum') },
  profile: { title: 'You', icon: ic('person.crop.circle.fill', 'account_circle') },
};

// A floating bar: the open tab grows into an ink-blue pill with its name.
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
            <Pressy key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.title}
              onPress={() => { const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) navigation.navigate(r.name); }}>
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

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}>
      {Object.entries(TABS).map(([name, v]) => <Tabs.Screen key={name} name={name} options={{ title: v.title }} />)}
    </Tabs>
  );
}
