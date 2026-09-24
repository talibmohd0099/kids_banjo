// Works out accompaniment chords for a song, one chord per half bar,
// by looking at which melody notes sound during that half bar.

import { chooseChord } from './theory';
import type { Song } from './songs';

export function halfBarBeats(song: Song): number {
  return song.beatsPerBar === 4 ? 2 : song.beatsPerBar;
}

export function songHarmony(song: Song): number[] {
  const span = halfBarBeats(song);
  const slots = Math.ceil(song.totalBeats / span);
  const chords: number[] = [];
  let prev = 0;
  for (let i = 0; i < slots; i++) {
    const from = i * span;
    const to = from + span;
    const notes = song.notes
      .map((n) => ({ midi: n.midi, weight: Math.max(0, Math.min(to, n.beat + n.beats) - Math.max(from, n.beat)) }))
      .filter((n) => n.weight > 0);
    prev = chooseChord(notes, prev);
    chords.push(prev);
  }
  // Songs end on the home chord.
  if (chords.length) chords[chords.length - 1] = 0;
  return chords;
}

export function chordAtBeat(song: Song, harmony: number[], beat: number): number {
  const i = Math.floor(beat / halfBarBeats(song));
  return harmony[Math.max(0, Math.min(harmony.length - 1, i))] ?? 0;
}
