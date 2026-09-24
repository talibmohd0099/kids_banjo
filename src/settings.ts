// Small persisted preferences and progress. localStorage can throw (private mode,
// blocked storage), so every access is wrapped and the app works without it.

import type { AssistLevel, LabelStyle } from './music/theory';

export type SkinId = 'wood' | 'galaxy' | 'rainbow';

export interface Settings {
  assist: AssistLevel;
  labels: LabelStyle | 'off';
  skin: SkinId;
  openStrings: boolean;
}

const DEFAULTS: Settings = { assist: 'beginner', labels: 'letters', skin: 'wood', openStrings: false };

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function loadRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const settings: Settings = load('mv.settings', DEFAULTS);

export function saveSettings(): void {
  save('mv.settings', settings);
}
