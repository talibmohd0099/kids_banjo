import { describe, expect, it } from 'vitest';
import { Arranger } from '../src/audio/arranger';
import { voice } from '../src/audio/orchestra';

describe('Magic Orchestra arranger', () => {
  it('stays quiet until the child plays', () => {
    expect(new Arranger().layers(10)).toEqual({ piano: false, bass: false, drums: false, flute: false });
  });

  it('slow gentle playing brings only the piano', () => {
    const a = new Arranger();
    a.noteOn(62, 0);
    a.activity(0.3, 0.5);
    a.noteOn(64, 1.5);
    expect(a.layers(2)).toEqual({ piano: true, bass: false, drums: false, flute: false });
  });

  it('fast playing adds drums, long playing adds bass and flute', () => {
    const a = new Arranger();
    for (let t = 0; t <= 12; t += 0.25) {
      a.noteOn(62 + (Math.round(t * 4) % 5), t);
      a.activity(0.5, t);
    }
    expect(a.layers(12)).toEqual({ piano: true, bass: true, drums: true, flute: true });
  });

  it('the band rests after a few quiet seconds', () => {
    const a = new Arranger();
    a.noteOn(62, 0);
    expect(a.layers(1).piano).toBe(true);
    expect(a.layers(5).piano).toBe(false);
  });

  it('climax brings everyone in', () => {
    const a = new Arranger();
    a.climax(0, 3);
    expect(a.layers(1)).toEqual({ piano: true, bass: true, drums: true, flute: true });
    expect(a.layers(4).drums).toBe(false);
  });

  it('follows the melody with fitting chords', () => {
    const a = new Arranger();
    a.noteOn(67, 0); // G
    a.noteOn(71, 0.2); // B
    expect(a.chordFor(0.3)).toBe(1); // G major
  });

  it('voices chords in a comfortable piano range', () => {
    for (const m of voice([2, 6, 9])) {
      expect(m).toBeGreaterThanOrEqual(57);
      expect(m).toBeLessThanOrEqual(69);
    }
  });
});
