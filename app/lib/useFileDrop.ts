// Drag and drop files from the computer (website only; does nothing in the phone app).
import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { Picked } from './api';

export function useFileDrop(_ref: RefObject<View | null>, _onFiles: (files: Picked[]) => void, _setOver?: (over: boolean) => void) {}
