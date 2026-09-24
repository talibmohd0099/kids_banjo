import { describe, expect, it } from 'vitest';
import { parseScore, SONGS } from '../src/music/songs';
import { songHarmony } from '../src/music/harmony';
import { stringForNote } from '../src/music/theory';

describe('songs', () => {
  it('has 10 songs with unique ids', () => {
    expect(SONGS).toHaveLength(10);
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(10);
  });

  it.each(SONGS.map((s) => [s.title, s] as const))('%s is playable on the violin and fills whole bars', (_t, song) => {
    for (const n of song.notes) expect(stringForNote(n.midi), `note ${n.midi}`).not.toBeNull();
    expect(song.totalBeats % song.beatsPerBar).toBe(0);
    expect(songHarmony(song).at(-1)).toBe(0); // ends on the home chord
  });

  it('parses rests and lengths', () => {
    const notes = parseScore('D4:1 R:1 E4:.5');
    expect(notes.map((n) => [n.midi, n.beat, n.beats])).toEqual([
      [62, 0, 1],
      [-1, 1, 1],
      [64, 2, 0.5],
    ]);
    expect(() => parseScore('D4:0')).toThrow();
  });
});
