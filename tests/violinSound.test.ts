import { describe, expect, it } from 'vitest';
import { nearestSample, synthViolin, violinSound } from '../src/audio/violinSound';
import { laneFor } from '../src/input/noteInput';

describe('sound sources', () => {
  it('uses the synth until real samples are loaded', () => {
    expect(violinSound()).toBe(synthViolin);
  });

  it('picks the nearest recorded note to re-pitch', () => {
    const s = [{ midi: 55 }, { midi: 59 }, { midi: 62 }, { midi: 66 }];
    expect(nearestSample(s, 60).midi).toBe(59);
    expect(nearestSample(s, 65).midi).toBe(66);
    expect(nearestSample(s, 40).midi).toBe(55);
  });

  it('maps pitches from lane-less sources (mic, MIDI) to strings', () => {
    expect(laneFor(55)).toBe(0);
    expect(laneFor(69)).toBe(2);
    expect(laneFor(80)).toBe(3);
  });
});
