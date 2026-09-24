// "Record My Song": we save what the fingers did (not the audio). That keeps
// recordings tiny, and replaying them re-plays the violin with a fairy avatar
// showing every finger move.

import type { PlayState } from '../violin/violinView';
import { loadRaw, save } from '../settings';

/** [ms, key, lane, midi, intensity, vibrato, downBow(1/0), bowChanged(1/0), x, y] or [ms, key] for release. */
export type Frame = [number, string, number, number, number, number, number, number, number, number] | [number, string];

export interface Recording {
  id: string;
  name: string;
  createdAt: number;
  durationMs: number;
  skin: string;
  frames: Frame[];
}

const MIN_GAP_MS = 30;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export class Recorder {
  private frames: Frame[] = [];
  private start = 0;
  private lastByKey = new Map<string, number>();
  recording = false;

  begin(now: number): void {
    this.frames = [];
    this.lastByKey.clear();
    this.start = now;
    this.recording = true;
  }

  capture(key: string, state: PlayState | null, now: number): void {
    if (!this.recording) return;
    const t = Math.round(now - this.start);
    if (!state) {
      this.frames.push([t, key]);
      this.lastByKey.delete(key);
      return;
    }
    const last = this.lastByKey.get(key);
    // Thin out the stream (about 30 frames/s per finger) but never drop a bow change.
    if (last !== undefined && t - last < MIN_GAP_MS && !state.bowChanged) return;
    this.lastByKey.set(key, t);
    this.frames.push([
      t,
      key,
      state.lane,
      r3(state.midi),
      r3(state.intensity),
      r3(state.vibrato),
      state.direction === 'down' ? 1 : 0,
      state.bowChanged ? 1 : 0,
      r3(state.x),
      r3(state.y),
    ]);
  }

  finish(now: number, name: string, skin: string): Recording | null {
    this.recording = false;
    const durationMs = Math.round(now - this.start);
    // Close any string still held when "stop" was pressed.
    for (const key of this.lastByKey.keys()) this.frames.push([durationMs, key]);
    this.lastByKey.clear();
    if (!this.frames.some((f) => f.length > 2)) return null;
    return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, createdAt: Date.now(), durationMs, skin, frames: this.frames };
  }
}

export function frameToState(f: Frame): PlayState | null {
  if (f.length === 2) return null;
  return {
    lane: f[2],
    midi: f[3],
    intensity: f[4],
    vibrato: f[5],
    direction: f[6] === 1 ? 'down' : 'up',
    bowChanged: f[7] === 1,
    x: f[8],
    y: f[9],
  };
}

/** Plays a recording back through a callback, driven by the caller's clock. */
export class Replayer {
  private i = 0;
  constructor(private rec: Recording, private apply: (key: string, state: PlayState | null) => void) {}

  /** Apply every frame up to elapsed ms. Returns false once finished. */
  advance(elapsedMs: number): boolean {
    const frames = this.rec.frames;
    while (this.i < frames.length && frames[this.i][0] <= elapsedMs) {
      const f = frames[this.i++];
      this.apply(`r${f[1]}`, frameToState(f));
    }
    return this.i < frames.length;
  }

  get progress(): number {
    return this.rec.durationMs ? Math.min(1, this.i / this.rec.frames.length) : 1;
  }
}

// ---------- "My Music" library ----------

const KEY = 'mv.songs';

export function listRecordings(): Recording[] {
  return loadRaw<Recording[]>(KEY, []);
}

export function saveRecording(rec: Recording): boolean {
  const all = listRecordings();
  all.unshift(rec);
  // Keep the library from outgrowing browser storage: drop the oldest first.
  while (all.length > 0) {
    if (save(KEY, all)) return true;
    if (all.length === 1) return false;
    all.pop();
  }
  return false;
}

export function deleteRecording(id: string): void {
  save(KEY, listRecordings().filter((r) => r.id !== id));
}

const ADJ = ['Galaxy', 'Rainbow', 'Sparkle', 'Moonlight', 'Sunny', 'Butterfly', 'Dragon', 'Magic', 'Ocean', 'Jungle', 'Candy', 'Thunder'];
const NOUN = ['Dance', 'Song', 'Parade', 'Dream', 'Adventure', 'Waltz', 'Party', 'Journey', 'Lullaby', 'March'];

/** A fun name for a new song, e.g. "Galaxy Dance". */
export function funName(rand: () => number = Math.random): string {
  return `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`;
}
