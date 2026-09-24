import { describe, expect, it } from 'vitest';
import { assistPitch, chooseChord, midiToFreq, noteLabel, parseNote, stringForNote, STRINGS } from '../src/music/theory';

describe('theory', () => {
  it('tunes the open strings to G3 D4 A4 E5', () => {
    expect(STRINGS.map((s) => s.openMidi)).toEqual([55, 62, 69, 76]);
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(55)).toBeCloseTo(196, 0);
  });

  it('parses note names', () => {
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('F#4')).toBe(66);
    expect(parseNote('Bb3')).toBe(58);
    expect(() => parseNote('H2')).toThrow();
  });

  it('prefers open strings and low finger positions', () => {
    expect(stringForNote(69)).toEqual({ string: 2, position: 0 }); // A4 on open A
    expect(stringForNote(66)).toEqual({ string: 1, position: 4 }); // F#4 on D string
    expect(stringForNote(57)).toEqual({ string: 0, position: 2 }); // A3 on G string
    expect(stringForNote(40)).toBeNull(); // below the violin
  });

  it('labels notes with letters, Do-Re-Mi and Sa-Re-Ga (D is Do/Sa)', () => {
    expect(noteLabel(62, 'letters')).toBe('D');
    expect(noteLabel(62, 'solfege')).toBe('Do');
    expect(noteLabel(69, 'solfege')).toBe('Sol');
    expect(noteLabel(69, 'sargam')).toBe('Pa');
    expect(noteLabel(73, 'sargam')).toBe('Ni');
  });

  describe('assistPitch', () => {
    it('free mode keeps the exact bend', () => {
      expect(assistPitch(62, 3.3, 'free')).toBeCloseTo(65.3);
    });
    it('explorer mode pulls towards the nearest semitone', () => {
      const p = assistPitch(62, 3.3, 'explorer');
      expect(p).toBeGreaterThan(65);
      expect(p).toBeLessThan(65.3);
    });
    it('beginner mode snaps to a note in D major', () => {
      // D string + 3 semitones = F natural (not in D major) -> snaps to E or F#.
      expect([64, 66]).toContain(assistPitch(62, 3, 'beginner'));
      expect(assistPitch(62, 4.4, 'beginner')).toBe(66);
    });
  });

  it('chooses chords that contain the melody', () => {
    expect(chooseChord([{ midi: 62, weight: 1 }, { midi: 66, weight: 1 }])).toBe(0); // D F# -> D
    expect(chooseChord([{ midi: 67, weight: 2 }, { midi: 71, weight: 1 }])).toBe(1); // G B -> G
    expect(chooseChord([{ midi: 64, weight: 1 }, { midi: 61, weight: 1 }])).toBe(2); // E C# -> A
    expect(chooseChord([], 3)).toBe(3);
  });
});
