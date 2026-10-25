import { Platform, useWindowDimensions } from 'react-native';

/** True on the website when the window is laptop-sized: use the sidebar and two-column layouts. */
export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 900;
}
