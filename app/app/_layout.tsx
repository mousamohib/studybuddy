import { useFonts } from 'expo-font';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { MenuProvider } from '@/components/Menu';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAccount } from '@/lib/auth';
import { refreshPhoneSchedule } from '@/lib/reminders';
import { font, themes } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
  });
  useEffect(() => { if (error) throw error; }, [error]);
  if (!loaded) return null;
  return (
    <AuthProvider>
      <RootNav />
    </AuthProvider>
  );
}

function RootNav() {
  const scheme = useColorScheme();
  const { session, loading, onboarded } = useAccount();
  const c = themes[scheme === 'dark' ? 'dark' : 'light'];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.border, primary: c.accent } };

  useEffect(() => { if (!loading) SplashScreen.hideAsync(); }, [loading]);

  // Keep reminders and the phone calendar in step with the plan whenever the app comes back.
  useEffect(() => {
    if (!session || !onboarded) return;
    refreshPhoneSchedule().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshPhoneSchedule().catch(() => {}); });
    return () => sub.remove();
  }, [session, onboarded]);

  if (loading) return null;

  return (
    <ThemeProvider value={navTheme}>
      <MenuProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShadowVisible: false, headerBackTitle: 'Back', headerTitleStyle: { fontFamily: font.heading, fontSize: 18 }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={!!session && !!onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="course/new" options={{ title: 'Add a course' }} />
            <Stack.Screen name="course/[id]" options={{ title: '' }} />
            <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
            <Stack.Screen name="doc/[id]" options={{ title: '' }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'StudyBuddy Pro' }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session && !onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="s/[token]" options={{ title: 'Shared from StudyBuddy' }} />
          <Stack.Screen name="legal" options={{ title: 'Legal' }} />
        </Stack>
      </MenuProvider>
    </ThemeProvider>
  );
}
