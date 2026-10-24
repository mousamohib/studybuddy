// A simple bottom menu that works the same on iPhone, Android and web (Alert has no buttons on web).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '@/lib/theme';

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
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }} onPress={close}>
          <Pressable style={{ backgroundColor: t.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: 4, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
            {state?.title ? <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{state.title}</Text> : null}
            {state?.message ? <Text style={{ color: t.muted, fontSize: 14, marginBottom: 8 }}>{state.message}</Text> : null}
            {state?.items.map((it) => (
              <Pressable key={it.label} onPress={() => { close(); it.onPress?.(); }}
                style={({ pressed }) => ({ paddingVertical: 13, paddingHorizontal: 4, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 16, color: it.destructive ? t.danger : it.label === 'Cancel' ? t.muted : t.text }}>{it.label}</Text>
              </Pressable>
            ))}
          </Pressable>
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
