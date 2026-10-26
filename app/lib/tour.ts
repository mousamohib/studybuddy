// The first-time walkthrough: whether it is showing, and where the menu buttons sit on screen so the
// tour can point at them. Remembered per account on this device once finished or skipped.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type Rect = { x: number; y: number; w: number; h: number };

let open = false;
const rects: Record<string, Rect> = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const key = (uid: string) => `scrawlie.tour.v1.${uid}`;

export function startTour() { open = true; emit(); }

export async function endTour(uid?: string) {
  open = false; emit();
  if (uid) await AsyncStorage.setItem(key(uid), 'done').catch(() => {});
}

/** Show the tour once to new accounts (made in the last 30 days) that haven't seen it. */
export async function maybeStartTour(uid: string, createdAt?: string) {
  const fresh = !createdAt || Date.now() - new Date(createdAt).getTime() < 30 * 864e5;
  if (!fresh) return;
  const seen = await AsyncStorage.getItem(key(uid)).catch(() => 'done');
  if (!seen) startTour();
}

export function setNavRect(name: string, r: Rect) { rects[name] = r; emit(); }

export function useTour() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return { open, rects };
}
