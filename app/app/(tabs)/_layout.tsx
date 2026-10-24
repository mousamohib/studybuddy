import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useTheme } from '@/lib/theme';

type IconName = { ios: string; android: string; web: string };
const icon = (name: IconName) => ({ color }: { color: ColorValue }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <SymbolView name={name as any} tintColor={color as string} size={24} />
);

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon({ ios: 'sun.max', android: 'today', web: 'today' }) }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon({ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }) }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: icon({ ios: 'books.vertical', android: 'menu_book', web: 'menu_book' }) }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon({ ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' }) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon({ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }) }} />
    </Tabs>
  );
}
