// Everything the app remembers about the child: song results, the Music Garden,
// and practice stats. One object, saved to localStorage (MVP persistence).
//
// The rules (how plants grow, streaks, unlocking) are pure functions of the
// profile so they are easy to test and could later sync to a server unchanged.

import { loadRaw, save } from '../settings';

export interface SongRecord {
  bestStars: number; // 0..3
  plays: number; // times started
  completions: number; // times finished
  bestAccuracy: number; // 0..1
  lastPlayed: number; // epoch ms
}

export interface Stats {
  notesPlayed: number;
  practiceMs: number;
  songsCompleted: number;
  streakDays: number;
  lastPracticeDay: string; // YYYY-MM-DD, '' if never
}

export interface Profile {
  version: 1;
  songs: Record<string, SongRecord>;
  stats: Stats;
}

export type PlantStage = 0 | 1 | 2 | 3; // seed, sprout, leafy, flower

export interface Reward {
  songId: string;
  stars: number;
  firstCompletion: boolean;
  newBest: boolean;
  plantBefore: PlantStage;
  plantAfter: PlantStage;
  unlockedSongId: string | null;
  totalCompletions: number;
  treeBefore: number;
  treeAfter: number;
}

/** Songs completed in total needed to grow the giant Magic Tree. */
export const TREE_GOAL = 100;

export function emptyProfile(): Profile {
  return {
    version: 1,
    songs: {},
    stats: { notesPlayed: 0, practiceMs: 0, songsCompleted: 0, streakDays: 0, lastPracticeDay: '' },
  };
}

export function songRecord(p: Profile, id: string): SongRecord {
  return p.songs[id] ?? { bestStars: 0, plays: 0, completions: 0, bestAccuracy: 0, lastPlayed: 0 };
}

/** A song's plant: 🌰 until finished once, then it grows with better stars. */
export function plantStage(rec: SongRecord | undefined): PlantStage {
  if (!rec || rec.completions === 0) return 0;
  return Math.max(1, Math.min(3, rec.bestStars)) as PlantStage;
}

/** Magic Tree growth, 0..5, from the total number of completed songs. */
export function treeStage(completions: number): number {
  const steps = [0, 1, 10, 25, 50, TREE_GOAL];
  let s = 0;
  steps.forEach((need, i) => {
    if (completions >= need) s = i;
  });
  return s;
}

/** Song i is playable once the song before it has been finished (the first is always open). */
export function isUnlocked(p: Profile, order: readonly string[], i: number): boolean {
  return i === 0 || songRecord(p, order[i - 1]).completions > 0;
}

export function recordStart(p: Profile, songId: string, now: number): void {
  const rec = songRecord(p, songId);
  p.songs[songId] = { ...rec, plays: rec.plays + 1, lastPlayed: now };
}

/** Save a finished song and work out what the child earned. */
export function recordResult(
  p: Profile,
  order: readonly string[],
  songId: string,
  result: { stars: number; hits: number; total: number },
  now: number,
): Reward {
  const before = songRecord(p, songId);
  const idx = order.indexOf(songId);
  const nextLockedBefore = idx >= 0 && idx + 1 < order.length && !isUnlocked(p, order, idx + 1);
  const treeBefore = treeStage(p.stats.songsCompleted);

  const after: SongRecord = {
    ...before,
    completions: before.completions + 1,
    bestStars: Math.max(before.bestStars, result.stars),
    bestAccuracy: Math.max(before.bestAccuracy, result.total ? result.hits / result.total : 0),
    lastPlayed: now,
  };
  p.songs[songId] = after;
  p.stats.songsCompleted += 1;
  touchStreak(p, now);

  return {
    songId,
    stars: result.stars,
    firstCompletion: before.completions === 0,
    newBest: result.stars > before.bestStars,
    plantBefore: plantStage(before),
    plantAfter: plantStage(after),
    unlockedSongId: nextLockedBefore ? order[idx + 1] : null,
    totalCompletions: p.stats.songsCompleted,
    treeBefore,
    treeAfter: treeStage(p.stats.songsCompleted),
  };
}

/** Add practice time / notes, and keep the daily streak up to date. */
export function recordPractice(p: Profile, ms: number, notes: number, now: number): void {
  p.stats.practiceMs += Math.max(0, ms);
  p.stats.notesPlayed += Math.max(0, notes);
  if (ms > 0 || notes > 0) touchStreak(p, now);
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function touchStreak(p: Profile, now: number): void {
  const today = dayKey(now);
  const s = p.stats;
  if (s.lastPracticeDay === today) return;
  const yesterday = dayKey(now - 86_400_000);
  s.streakDays = s.lastPracticeDay === yesterday ? s.streakDays + 1 : 1;
  s.lastPracticeDay = today;
}

/** Older builds stored only best stars per song under "mv.progress". */
export function migrate(raw: unknown, legacyStars: Record<string, number> | null): Profile {
  const p = emptyProfile();
  if (raw && typeof raw === 'object' && (raw as Profile).version === 1) {
    const r = raw as Profile;
    return { version: 1, songs: { ...r.songs }, stats: { ...p.stats, ...r.stats } };
  }
  if (legacyStars) {
    for (const [id, stars] of Object.entries(legacyStars)) {
      if (stars > 0) {
        p.songs[id] = { bestStars: stars, plays: 1, completions: 1, bestAccuracy: 0, lastPlayed: 0 };
        p.stats.songsCompleted += 1;
      }
    }
  }
  return p;
}

// ---------- the live profile for this session ----------

const KEY = 'mv.profile';

export const profile: Profile = migrate(loadRaw<unknown>(KEY, null), loadRaw<Record<string, number> | null>('mv.progress', null));

let saveTimer: number | undefined;

/** Save soon (batched), so frequent updates like note counts stay cheap. */
export function saveProfile(immediate = false): void {
  if (immediate) {
    window.clearTimeout(saveTimer);
    save(KEY, profile);
    return;
  }
  if (saveTimer !== undefined) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    save(KEY, profile);
  }, 1000);
}

if (typeof window !== 'undefined') {
  // Don't lose the last second of practice when the app is closed or backgrounded.
  window.addEventListener('pagehide', () => saveProfile(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveProfile(true));
}
