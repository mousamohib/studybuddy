// The website's front page for signed-out visitors (the phone app goes straight to sign-in).
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import Landing from '@/components/Landing';

export default function Welcome() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: 'Scrawlie: your semester, sorted' }} />
      <Landing
        onStart={() => router.push({ pathname: '/sign-in', params: { mode: 'up' } })}
        onSignIn={() => router.push({ pathname: '/sign-in', params: { mode: 'in' } })}
        onLegal={(doc) => router.push({ pathname: '/legal', params: { doc } })}
        dom={{ style: { flex: 1 } }}
      />
    </View>
  );
}
