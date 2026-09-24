import { describe, expect, it } from 'vitest';
import { GestureTracker } from '../src/input/gesture';

const W = 400;

function drag(tracker: GestureTracker, from: number, to: number, ms: number, t0 = 0, steps = 10) {
  let s = tracker.update({ t: t0 + 1, x: from, y: 100 });
  for (let i = 1; i <= steps; i++) s = tracker.update({ t: t0 + (ms * i) / steps, x: from + ((to - from) * i) / steps, y: 100 });
  return s;
}

describe('GestureTracker', () => {
  it('a tap makes sound straight away', () => {
    const g = new GestureTracker({ width: W, holdFloor: 0 });
    expect(g.start({ t: 0, x: 100, y: 100 }).intensity).toBeGreaterThan(0.5);
  });

  it('fast bowing is louder than slow bowing', () => {
    const fast = new GestureTracker({ width: W, holdFloor: 0 });
    fast.start({ t: 0, x: 0, y: 100 });
    const slow = new GestureTracker({ width: W, holdFloor: 0 });
    slow.start({ t: 0, x: 0, y: 100 });
    // Let the tap boost settle first.
    fast.idle(2000);
    slow.idle(2000);
    const f = drag(fast, 0, 300, 250, 2000);
    const s = drag(slow, 0, 30, 250, 2000);
    expect(f.intensity).toBeGreaterThan(s.intensity);
  });

  it('right is down bow, left is up bow, and flipping reports a bow change', () => {
    const g = new GestureTracker({ width: W, holdFloor: 0.3 });
    g.start({ t: 0, x: 200, y: 100 });
    expect(drag(g, 200, 320, 200, 0).direction).toBe('down');
    let changed = false;
    let s = g.update({ t: 260, x: 318, y: 100 });
    for (let i = 1; i <= 10; i++) {
      s = g.update({ t: 260 + i * 25, x: 318 - i * 15, y: 100 });
      changed = changed || s.bowChanged;
    }
    expect(s.direction).toBe('up');
    expect(changed).toBe(true);
  });

  it('small quick wiggles become vibrato', () => {
    const g = new GestureTracker({ width: W, holdFloor: 0.3 });
    g.start({ t: 0, x: 200, y: 100 });
    let s = g.update({ t: 1, x: 200, y: 100 });
    for (let i = 1; i <= 30; i++) s = g.update({ t: i * 30, x: 200 + (i % 2 ? 8 : -8), y: 100 });
    expect(s.vibrato).toBeGreaterThan(0.4);
    expect(s.bowChanged).toBe(false);
  });

  it('long strokes are not vibrato', () => {
    const g = new GestureTracker({ width: W, holdFloor: 0.3 });
    g.start({ t: 0, x: 50, y: 100 });
    const s = drag(g, 50, 350, 400, 0, 20);
    expect(s.vibrato).toBeLessThan(0.1);
  });

  it('a resting finger settles to the hold level', () => {
    const g = new GestureTracker({ width: W, holdFloor: 0.4 });
    g.start({ t: 0, x: 50, y: 100 });
    drag(g, 50, 350, 200, 0);
    expect(g.idle(6000).intensity).toBeCloseTo(0.4, 1);
  });

  it('real touch pressure adds intensity; fake 0.5 is ignored', () => {
    const run = (pressure: number) => {
      const g = new GestureTracker({ width: W, holdFloor: 0 });
      g.start({ t: 0, x: 0, y: 0 });
      g.idle(3000);
      let s = g.update({ t: 3001, x: 0, y: 0, pressure });
      for (let i = 1; i <= 5; i++) s = g.update({ t: 3000 + i * 40, x: i * 10, y: 0, pressure });
      return s.intensity;
    };
    expect(run(1)).toBeGreaterThan(run(0.5));
  });
});
