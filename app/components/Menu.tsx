// A simple bottom menu that works the same on iPhone, Android and web (Alert has no buttons on web).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, space, useTheme } from '@/lib/theme';
import Animated, { SlideInDown } from 'react-native-reanimated';

export type MenuItem = { label: string; onPress?: () => void; destructive?: boolean };
type Open = (title: string | null, items: MenuItem[], message?: string) => void;
const Ctx = createContext<{ open: Open; confirm: (title: string, message: string, action: string, destructive?: boolean) => Promise<boolean> } | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ title: string | null; message?: string; items: MenuItem[] } | null>(null);
  const open: Open = (title, items, message) => setState({ title, items, message });
  const confirm = (title: string, message: string, action: string, destructive = true) =>
    new Promise<boolean>((resolve) => setState({ title, message, items: [{ label: action, destructive, onPress: () => resolve(true) }, { label: 'Cancel', onPress: () => resolve(false) }] }));
  const close = () => setState(null);
  return (
    <Ctx.Provider value={{ open, confirm }}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' }} onPress={close}>
          <Animated.View entering={SlideInDown.springify().damping(20)} style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>
            <Pressable style={{ backgroundColor: t.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, paddingTop: 10, paddingBottom: space.lg + insets.bottom, gap: 4 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.border, marginBottom: space.md }} />
              {state?.title ? <Text style={{ color: t.text, fontSize: 19, fontFamily: font.heading, marginBottom: 2 }}>{state.title}</Text> : null}
              {state?.message ? <Text style={{ color: t.muted, fontSize: 15, fontFamily: font.body, lineHeight: 21, marginBottom: 8 }}>{state.message}</Text> : null}
              {state?.items.map((it) => {
                const cancel = it.label === 'Cancel' || it.label === 'OK' || it.label === 'Done';
                return (
                  <Pressable key={it.label} onPress={() => { close(); it.onPress?.(); }}
                    style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: space.md, borderRadius: radius.md, marginTop: cancel ? 6 : 0, alignItems: cancel ? 'center' : 'flex-start',
                      backgroundColor: cancel ? t.surface : pressed ? t.surface : 'transparent' })}>
                    <Text style={{ fontSize: 16, fontFamily: cancel ? font.bold : font.medium, color: it.destructive ? t.danger : cancel && it.label !== 'Cancel' ? t.accent : t.text }}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

export function useMenu() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMenu must be inside MenuProvider');
  return v;
}

/** Shows a short message. Uses the menu so it also works on the web. */
export function useNotice() {
  const { open } = useMenu();
  return (title: string, message?: string) => open(title, [{ label: 'OK' }], message);
}
