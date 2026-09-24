// Turns the raw movement of one finger into violin controls.
// Pure logic (no DOM, no audio) so it is easy to unit test.
//
//   horizontal speed      -> bow intensity (how loud / bright)
//   horizontal direction  -> down bow (right) or up bow (left)
//   small quick wiggles   -> vibrato
//   touch pressure        -> extra intensity, when the device reports real pressure

export type BowDirection = 'down' | 'up';

export interface GestureSample {
  t: number; // ms
  x: number; // px
  y: number; // px
  pressure?: number; // 0..1, undefined if the device does not report it
}

export interface GestureState {
  intensity: number; // 0..1
  direction: BowDirection;
  vibrato: number; // 0..1 depth
  bowChanged: boolean; // true on the frame the bow direction flipped
}

export interface GestureOptions {
  /** Width of the playing area in px; speeds are measured relative to it. */
  width: number;
  /** Intensity kept while the finger rests (so little kids hear a sustained note). */
  holdFloor: number;
}

const FULL_SPEED = 1.1; // playing-area widths per second that count as "full bow"
const DIRECTION_SLOP = 0.02; // fraction of width travelled before a bow change counts
const VIBRATO_WINDOW = 450; // ms
const VIBRATO_MAX_SWING = 0.09; // fraction of width: bigger swings are bowing, not vibrato
const TAP_BOOST = 0.65; // a fresh touch starts with this much sound, then settles

export class GestureTracker {
  private samples: GestureSample[] = [];
  private smoothed = 0;
  private dir: BowDirection = 'down';
  private anchorX = 0; // x where the current bow stroke started
  private startT = 0;
  private vib = 0;

  constructor(private opts: GestureOptions) {}

  start(s: GestureSample): GestureState {
    this.samples = [s];
    this.anchorX = s.x;
    this.startT = s.t;
    this.smoothed = Math.max(TAP_BOOST, this.opts.holdFloor);
    this.vib = 0;
    return this.state(false);
  }

  update(s: GestureSample): GestureState {
    const prev = this.samples[this.samples.length - 1];
    this.samples.push(s);
    // Keep only recent history.
    while (this.samples.length > 2 && s.t - this.samples[0].t > VIBRATO_WINDOW) this.samples.shift();

    const dt = Math.max(1, s.t - prev.t);
    const w = Math.max(1, this.opts.width);
    const speed = (Math.abs(s.x - prev.x) / w) * (1000 / dt); // widths per second

    // Bow direction with a little slop so tiny jitters don't flip it.
    let bowChanged = false;
    const travel = (s.x - this.anchorX) / w;
    const wanted: BowDirection | null = travel > DIRECTION_SLOP ? 'down' : travel < -DIRECTION_SLOP ? 'up' : null;
    if (wanted && wanted !== this.dir) {
      this.dir = wanted;
      bowChanged = true;
    }
    // The anchor follows the finger while it keeps going the same way.
    if ((this.dir === 'down' && s.x > this.anchorX) || (this.dir === 'up' && s.x < this.anchorX)) {
      this.anchorX = s.x;
    }

    this.vib = this.detectVibrato();
    // Vibrato wiggles are not real bow changes: no bow-change "scrape".
    if (this.vib > 0.2) bowChanged = false;

    // Speed -> intensity. Rise fast, fall slowly (like a real string ringing on).
    let target = this.opts.holdFloor + (1 - this.opts.holdFloor) * Math.min(1, speed / FULL_SPEED);
    const p = s.pressure;
    if (p !== undefined && p > 0 && p !== 0.5) target = Math.min(1, target * (0.6 + 0.8 * p));
    const rise = 0.6;
    const fall = 1 - Math.exp(-dt / 220);
    this.smoothed += (target - this.smoothed) * (target > this.smoothed ? rise : fall);

    // The initial "tap" sound settles to the hold level over ~0.4s.
    if (s.t - this.startT < 400 && speed < 0.05) {
      this.smoothed = Math.max(this.smoothed, this.opts.holdFloor);
    }
    return this.state(bowChanged);
  }

  /** Called every animation frame while the finger is still, so the sound decays naturally. */
  idle(t: number): GestureState {
    const last = this.samples[this.samples.length - 1];
    if (!last) return this.state(false);
    const dt = Math.max(0, t - last.t);
    if (dt > 60) {
      const target = this.opts.holdFloor;
      this.smoothed = target + (this.smoothed - target) * Math.exp(-dt / 900);
      if (dt > VIBRATO_WINDOW) this.vib *= 0.9;
    }
    return this.state(false);
  }

  private detectVibrato(): number {
    const pts = this.samples;
    if (pts.length < 5) return this.vib * 0.9;
    let reversals = 0;
    let lastSign = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      minX = Math.min(minX, pts[i].x);
      maxX = Math.max(maxX, pts[i].x);
      if (Math.abs(dx) < 0.5) continue;
      const sign = Math.sign(dx);
      if (lastSign !== 0 && sign !== lastSign) reversals++;
      lastSign = sign;
    }
    const swing = (maxX - minX) / Math.max(1, this.opts.width);
    const isWiggle = reversals >= 2 && swing > 0.004 && swing < VIBRATO_MAX_SWING;
    const target = isWiggle ? Math.min(1, 0.4 + reversals * 0.15) : 0;
    return this.vib + (target - this.vib) * 0.35;
  }

  private state(bowChanged: boolean): GestureState {
    return {
      intensity: Math.max(0, Math.min(1, this.smoothed)),
      direction: this.dir,
      vibrato: Math.max(0, Math.min(1, this.vib)),
      bowChanged,
    };
  }
}
