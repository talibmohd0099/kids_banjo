// Geometry of the on-screen fingerboard. Pure math, unit tested.
//
// The screen shows the violin neck from above, strings running top to bottom.
// Each string has its own vertical lane. Along a lane there are MAX_POSITION + 1
// finger "bands": the top band is the open string, each band lower is one semitone higher.
// Sliding a finger up/down moves smoothly between bands = pitch bend.

import { MAX_POSITION, STRINGS } from '../music/theory';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BANDS = MAX_POSITION + 1;

export class Fingerboard {
  constructor(public area: Rect) {}

  laneWidth(): number {
    return this.area.w / STRINGS.length;
  }

  /** Which string lane an x coordinate is in (clamped to the edges). */
  laneAt(x: number): number {
    const i = Math.floor((x - this.area.x) / this.laneWidth());
    return Math.max(0, Math.min(STRINGS.length - 1, i));
  }

  /** x of the string line in the middle of a lane. */
  stringX(lane: number): number {
    return this.area.x + (lane + 0.5) * this.laneWidth();
  }

  bandHeight(): number {
    return this.area.h / BANDS;
  }

  /**
   * Continuous finger position in semitones above the open string.
   * The centre of band n is exactly n; the top band (open string) is flat at 0.
   */
  positionAt(y: number): number {
    const p = (y - this.area.y) / this.bandHeight() - 0.5;
    return Math.max(0, Math.min(MAX_POSITION, p));
  }

  /** y of the centre of a finger position (inverse of positionAt). */
  yForPosition(position: number): number {
    return this.area.y + (position + 0.5) * this.bandHeight();
  }
}
