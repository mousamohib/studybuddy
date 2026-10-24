import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = !!url && !!anonKey;

// During the web build there is no window, so there is nowhere to keep the session.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url ?? 'https://not-configured.supabase.co', anonKey ?? 'not-configured', {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

// Keep the login fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
