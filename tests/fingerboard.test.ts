import { describe, expect, it } from 'vitest';
import { BANDS, Fingerboard } from '../src/violin/fingerboard';

describe('Fingerboard', () => {
  const fb = new Fingerboard({ x: 20, y: 100, w: 400, h: 800 });

  it('splits the width into 4 string lanes', () => {
    expect(fb.laneAt(21)).toBe(0);
    expect(fb.laneAt(20 + 150)).toBe(1);
    expect(fb.laneAt(419)).toBe(3);
    expect(fb.laneAt(-50)).toBe(0);
    expect(fb.laneAt(9999)).toBe(3);
  });

  it('top band is the open string, lower is higher pitch, smoothly in between', () => {
    expect(fb.positionAt(100)).toBe(0);
    expect(fb.positionAt(fb.yForPosition(3))).toBeCloseTo(3);
    const between = fb.positionAt((fb.yForPosition(3) + fb.yForPosition(4)) / 2);
    expect(between).toBeCloseTo(3.5);
    expect(fb.positionAt(100 + 800)).toBe(BANDS - 1);
  });
});
