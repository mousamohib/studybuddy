// On the web the first render happens on the server (always light), then follows the browser setting.
import { useEffect, useState } from 'react';
import { useColorScheme as useRN } from 'react-native';

export function useColorScheme() {
  const scheme = useRN();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready && scheme === 'dark' ? 'dark' : 'light';
}
