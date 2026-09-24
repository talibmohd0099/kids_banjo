// The games listen for "a note was played" events, not for touches. Today the only
// source is the touch violin; a microphone pitch detector (a real violin), a MIDI
// keyboard or an AI partner can later feed the very same events, and the song game,
// scoring and Magic Orchestra will work with them unchanged.

import { stringForNote } from '../music/theory';

export interface NoteEvent {
  /** MIDI pitch, rounded to the nearest semitone. */
  midi: number;
  /** String lane 0-3 (G D A E). Sources that don't know it can use laneFor(). */
  lane: number;
  source: 'touch' | 'mic' | 'midi' | 'replay';
}

export type NoteListener = (e: NoteEvent) => void;

/** Anything that can produce played notes (touch violin, microphone, MIDI...). */
export interface NoteSource {
  start(listener: NoteListener): void;
  stop(): void;
}

/** The string a violinist would most likely use for a pitch (for sources without lanes). */
export function laneFor(midi: number): number {
  return stringForNote(midi)?.string ?? 0;
}
