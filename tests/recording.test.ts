import { describe, expect, it } from 'vitest';
import { frameToState, funName, Recorder, Replayer } from '../src/record/recording';
import type { PlayState } from '../src/violin/violinView';

const st = (over: Partial<PlayState> = {}): PlayState => ({
  lane: 1, midi: 62.25, intensity: 0.5, vibrato: 0, direction: 'down', bowChanged: false, x: 0.4, y: 0.2, ...over,
});

describe('Recorder / Replayer', () => {
  it('returns null when nothing was played', () => {
    const r = new Recorder();
    r.begin(0);
    expect(r.finish(1000, 'x', 'wood')).toBeNull();
  });

  it('records, thins frames, keeps bow changes, and replays in order', () => {
    const r = new Recorder();
    r.begin(1000);
    r.capture('t1', st(), 1000);
    r.capture('t1', st({ intensity: 0.6 }), 1010); // dropped (too soon)
    r.capture('t1', st({ bowChanged: true, direction: 'up' }), 1015); // kept
    r.capture('t1', st({ midi: 64 }), 1100);
    r.capture('t1', null, 1200);
    const rec = r.finish(1300, 'Galaxy Dance', 'galaxy')!;
    expect(rec.frames).toHaveLength(4);
    expect(rec.durationMs).toBe(300);
    expect(frameToState(rec.frames[1])!.direction).toBe('up');

    const seen: [string, PlayState | null][] = [];
    const rp = new Replayer(rec, (k, s) => seen.push([k, s]));
    expect(rp.advance(50)).toBe(true);
    expect(seen).toHaveLength(2);
    expect(rp.advance(1000)).toBe(false);
    expect(seen.map(([k]) => k)).toEqual(['rt1', 'rt1', 'rt1', 'rt1']);
    expect(seen[2][1]!.midi).toBe(64);
    expect(seen[3][1]).toBeNull();
  });

  it('closes strings still held when recording stops', () => {
    const r = new Recorder();
    r.begin(0);
    r.capture('t7', st(), 10);
    const rec = r.finish(500, 'n', 'wood')!;
    expect(rec.frames.at(-1)).toEqual([500, 't7']);
  });

  it('makes fun song names', () => {
    expect(funName(() => 0)).toBe('Galaxy Dance');
  });
});
