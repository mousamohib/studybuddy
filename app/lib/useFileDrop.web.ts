// Drag and drop files from the computer onto a part of the page.
import { useEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';
import type { Picked } from './api';

export function useFileDrop(ref: RefObject<View | null>, onFiles: (files: Picked[]) => void, setOver?: (over: boolean) => void) {
  const cb = useRef(onFiles); cb.current = onFiles;
  const over = useRef(setOver); over.current = setOver;
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; over.current?.(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) over.current?.(false); };
    const dragover = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; over.current?.(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) cb.current(files.map((f) => ({ uri: URL.createObjectURL(f), name: f.name, mimeType: f.type || undefined, size: f.size, file: f })));
    };
    el.addEventListener('dragenter', enter); el.addEventListener('dragleave', leave);
    el.addEventListener('dragover', dragover); el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragenter', enter); el.removeEventListener('dragleave', leave);
      el.removeEventListener('dragover', dragover); el.removeEventListener('drop', drop);
    };
  }, [ref]);
}
