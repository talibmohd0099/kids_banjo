// The playable violin: draws the fingerboard on a <canvas> and turns fingers into sound.
//
// Every sounding string is described by a PlayState. Real fingers produce PlayStates
// through the GestureTracker; a replayed recording feeds saved PlayStates back in through
// the same apply() call, so a replay sounds and looks exactly like the live performance.

import { getEngine } from '../audio/engine';
import { violinSound, type SoundingVoice } from '../audio/violinSound';
import { practiceFrame, practiceNote } from '../state/practice';
import { GestureTracker, type BowDirection } from '../input/gesture';
import { assistPitch, inKey, MAX_POSITION, noteLabel, STRINGS } from '../music/theory';
import { settings } from '../settings';
import { Fingerboard } from './fingerboard';
import { SKINS } from './skins';

export interface PlayState {
  lane: number;
  midi: number;
  intensity: number;
  vibrato: number;
  direction: BowDirection;
  bowChanged: boolean;
  /** Finger position inside the fingerboard, 0..1 on each axis. */
  x: number;
  y: number;
}

interface LiveVoice {
  voice: SoundingVoice;
  state: PlayState;
  lastNoteMidi: number;
  replay: boolean;
}

interface TouchInfo {
  key: string;
  lane: number;
  gesture: GestureTracker;
  lastMove: number;
  x: number;
  y: number;
  pressure?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  spin: number;
}

export interface Insets {
  top: number;
  bottom: number;
  side: number;
}

const STRING_WIDTH = [3.4, 2.7, 2.1, 1.6];
const HOLD_FLOOR = { beginner: 0.4, explorer: 0.25, free: 0 } as const;

export class ViolinView {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  board = new Fingerboard({ x: 0, y: 0, w: 1, h: 1 });
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private touches = new Map<number, TouchInfo>();
  private voices = new Map<string, LiveVoice>();
  private particles: Particle[] = [];
  private raf = 0;
  private resizeObs: ResizeObserver;
  private touchedOnce = false;
  private stars: { x: number; y: number; r: number; p: number }[] = [];

  /** Every change to a sounding string (used by the recorder). null = released. */
  onState: ((key: string, state: PlayState | null) => void) | null = null;
  /** A new note began (touch, bow change or clear pitch change). */
  onNoteOn: ((midi: number, lane: number, replay: boolean) => void) | null = null;
  /** A finger touched down on a lane (used by the games for timing). */
  onTouchDown: ((lane: number, midi: number) => void) | null = null;
  /** Once per frame with the loudest string's intensity (feeds the orchestra). */
  onFrame: ((maxIntensity: number) => void) | null = null;
  /** Games can force the pitch of a lane ("assisted" notes). */
  pitchOverride: ((lane: number) => number | null) | null = null;
  /** Games draw falling notes etc. on top of the violin. */
  drawOverlay: ((g: CanvasRenderingContext2D, board: Fingerboard, now: number) => void) | null = null;
  /** Hide the "slide here" hint (games show their own instructions). */
  showHint = true;

  constructor(private host: HTMLElement, private insets: Insets = { top: 76, bottom: 18, side: 14 }) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'violin-canvas';
    this.canvas.setAttribute('aria-label', 'Violin strings. Slide a finger across a string to play.');
    host.appendChild(this.canvas);
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('Canvas not supported');
    this.g = g;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();

    this.canvas.addEventListener('pointerdown', this.down);
    this.canvas.addEventListener('pointermove', this.move);
    this.canvas.addEventListener('pointerup', this.up);
    this.canvas.addEventListener('pointercancel', this.up);
    this.canvas.addEventListener('lostpointercapture', this.up);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    for (let i = 0; i < 70; i++) this.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, p: Math.random() * 6 });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.releaseAll();
    this.canvas.remove();
  }

  releaseAll(): void {
    for (const key of [...this.voices.keys()]) this.apply(key, null);
    this.touches.clear();
  }

  /** Start, update or (with null) stop a sounding string. */
  apply(key: string, state: PlayState | null): void {
    const live = this.voices.get(key);
    const replay = key.startsWith('r');
    if (!state) {
      if (live) {
        live.voice.release();
        this.voices.delete(key);
        this.onState?.(key, null);
      }
      return;
    }
    const controls = { midi: state.midi, intensity: state.intensity, vibrato: state.vibrato, direction: state.direction, bowChanged: state.bowChanged };
    if (!live) {
      const engine = getEngine();
      this.voices.set(key, { voice: violinSound().createVoice(engine, controls), state, lastNoteMidi: state.midi, replay });
      this.noteOn(state, replay);
    } else {
      live.voice.set(controls);
      live.state = state;
      if (state.bowChanged || Math.abs(state.midi - live.lastNoteMidi) >= 0.8) {
        live.lastNoteMidi = state.midi;
        this.noteOn(state, replay);
      }
    }
    this.onState?.(key, state);
  }

  private noteOn(state: PlayState, replay: boolean): void {
    if (!replay) practiceNote();
    this.onNoteOn?.(Math.round(state.midi), state.lane, replay);
    const p = this.fingerPx(state);
    this.burst(p.x, p.y, 10, state.lane);
  }

  // ---------- input ----------

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    const engine = getEngine();
    void engine.resume();
    this.touchedOnce = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events in tests may not be capturable */
    }
    const { x, y } = this.local(e);
    const lane = this.board.laneAt(x);
    const gesture = new GestureTracker({ width: this.board.area.w, holdFloor: HOLD_FLOOR[settings.assist] });
    const info: TouchInfo = { key: `t${e.pointerId}`, lane, gesture, lastMove: e.timeStamp, x, y, pressure: pressureOf(e) };
    this.touches.set(e.pointerId, info);
    const g = gesture.start({ t: e.timeStamp, x, y, pressure: info.pressure });
    const state = this.stateFor(info, g.intensity, g.vibrato, g.direction, false);
    this.apply(info.key, state);
    this.onTouchDown?.(lane, Math.round(state.midi));
  };

  private move = (e: PointerEvent): void => {
    const info = this.touches.get(e.pointerId);
    if (!info) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = events.length ? events : [e];
    let changed = false;
    let last = info.gesture.idle(e.timeStamp);
    for (const ev of list) {
      const { x, y } = this.local(ev);
      info.x = x;
      info.y = y;
      info.pressure = pressureOf(ev);
      last = info.gesture.update({ t: ev.timeStamp, x, y, pressure: info.pressure });
      changed = changed || last.bowChanged;
    }
    info.lastMove = e.timeStamp;
    this.apply(info.key, this.stateFor(info, last.intensity, last.vibrato, last.direction, changed));
  };

  private up = (e: PointerEvent): void => {
    const info = this.touches.get(e.pointerId);
    if (!info) return;
    this.touches.delete(e.pointerId);
    this.apply(info.key, null);
  };

  private stateFor(info: TouchInfo, intensity: number, vibrato: number, direction: BowDirection, bowChanged: boolean): PlayState {
    const open = STRINGS[info.lane].openMidi;
    const override = this.pitchOverride?.(info.lane) ?? null;
    let midi: number;
    if (override !== null) midi = override;
    else if (settings.openStrings) midi = open;
    else midi = assistPitch(open, this.board.positionAt(info.y), settings.assist);
    const a = this.board.area;
    return {
      lane: info.lane,
      midi,
      intensity,
      vibrato,
      direction,
      bowChanged,
      x: (info.x - a.x) / a.w,
      y: (info.y - a.y) / a.h,
    };
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ---------- layout ----------

  private resize(): void {
    // clientWidth/Height ignore CSS transforms (e.g. the screen's pop-in animation).
    this.cssW = Math.max(1, this.host.clientWidth);
    this.cssH = Math.max(1, this.host.clientHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    const i = this.insets;
    const w = Math.min(this.cssW - i.side * 2, 560);
    this.board.area = {
      x: (this.cssW - w) / 2,
      y: i.top + 34,
      w,
      h: Math.max(80, this.cssH - i.top - 34 - i.bottom),
    };
  }

  private fingerPx(s: PlayState): { x: number; y: number } {
    const a = this.board.area;
    return { x: a.x + s.x * a.w, y: a.y + s.y * a.h };
  }

  // ---------- drawing ----------

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    // Fingers resting still: let the sound settle naturally.
    for (const info of this.touches.values()) {
      if (performance.now() - info.lastMove > 40) {
        const g = info.gesture.idle(performance.now());
        this.apply(info.key, this.stateFor(info, g.intensity, g.vibrato, g.direction, false));
      }
    }
    let max = 0;
    for (const v of this.voices.values()) max = Math.max(max, v.state.intensity);
    this.onFrame?.(max);
    let live = false;
    for (const v of this.voices.values()) live = live || (!v.replay && v.state.intensity > 0.05);
    practiceFrame(now, live);
    for (const v of this.voices.values()) {
      if (v.state.intensity > 0.3 && Math.random() < v.state.intensity * 0.35) {
        const p = this.fingerPx(v.state);
        this.burst(p.x, p.y, 1, v.state.lane);
      }
    }
    this.draw(now);
  };

  private draw(now: number): void {
    const g = this.g;
    const skin = SKINS[settings.skin];
    const a = this.board.area;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Violin body behind the fingerboard.
    const body = g.createLinearGradient(0, 0, this.cssW, this.cssH);
    body.addColorStop(0, skin.frame[0]);
    body.addColorStop(1, skin.frame[1]);
    g.fillStyle = body;
    g.fillRect(0, 0, this.cssW, this.cssH);
    if (skin.twinkles) {
      for (const s of this.stars) {
        g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 900 + s.p));
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(s.x * this.cssW, s.y * this.cssH, s.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Fingerboard.
    const boardGrad = g.createLinearGradient(a.x, 0, a.x + a.w, 0);
    boardGrad.addColorStop(0, skin.board[1]);
    boardGrad.addColorStop(0.5, skin.board[0]);
    boardGrad.addColorStop(1, skin.board[1]);
    g.fillStyle = boardGrad;
    roundRect(g, a.x, a.y - 30, a.w, a.h + 30, 18);
    g.fill();

    const lw = this.board.laneWidth();
    if (skin.rainbowLanes) {
      STRINGS.forEach((s, i) => {
        g.fillStyle = s.color + '33';
        g.fillRect(a.x + i * lw + 3, a.y, lw - 6, a.h);
      });
    }

    // Nut and string name bubbles.
    g.fillStyle = skin.nut;
    g.fillRect(a.x + 6, a.y - 6, a.w - 12, 6);
    const labelsOn = settings.labels !== 'off';
    STRINGS.forEach((s, i) => {
      const x = this.board.stringX(i);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(x, a.y - 22, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b1b2f';
      g.font = 'bold 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.name, x, a.y - 21);
    });

    // Finger spots ("tapes" like beginner violins have).
    const dark = skin.id === 'rainbow';
    STRINGS.forEach((s, lane) => {
      const x = this.board.stringX(lane);
      for (let p = 0; p <= MAX_POSITION; p++) {
        const y = this.board.yForPosition(p);
        const midi = s.openMidi + p;
        const good = inKey(midi);
        if (p > 0) {
          g.globalAlpha = good ? 0.85 : 0.25;
          g.fillStyle = good ? s.color : dark ? '#999' : '#fff';
          g.beginPath();
          g.arc(x, y, good ? 7 : 3, 0, Math.PI * 2);
          g.fill();
        }
        if (labelsOn && good && !(settings.openStrings && p > 0)) {
          g.globalAlpha = 0.9;
          g.fillStyle = dark ? '#3d2e5c' : '#fff';
          g.font = '600 11px system-ui, sans-serif';
          g.textAlign = 'left';
          g.fillText(noteLabel(midi, settings.labels === 'off' ? 'letters' : settings.labels), x + 11, y + 1);
        }
      }
    });
    g.globalAlpha = 1;

    // Strings, vibrating below the finger that stops them.
    STRINGS.forEach((_s, lane) => {
      const x = this.board.stringX(lane);
      let stopY = a.y;
      let amp = 0;
      for (const v of this.voices.values()) {
        if (v.state.lane !== lane) continue;
        stopY = Math.max(stopY, settings.openStrings ? a.y : a.y + v.state.y * a.h);
        amp = Math.max(amp, v.state.intensity);
      }
      stopY = Math.min(stopY, a.y + a.h - 10);
      g.strokeStyle = skin.string;
      g.lineWidth = STRING_WIDTH[lane];
      g.beginPath();
      g.moveTo(x, a.y - 6);
      g.lineTo(x, stopY);
      g.stroke();
      const A = amp * (4 + lw * 0.06);
      const wobble = Math.sin(now / (18 - lane * 3));
      for (const [k, alpha] of [[wobble, 1], [1, 0.22], [-1, 0.22]] as const) {
        g.globalAlpha = alpha;
        g.beginPath();
        const len = a.y + a.h - stopY;
        for (let j = 0; j <= 24; j++) {
          const u = j / 24;
          const dx = A * k * Math.sin(Math.PI * u);
          const py = stopY + u * len;
          if (j === 0) g.moveTo(x + dx, py);
          else g.lineTo(x + dx, py);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    });

    // Fingers (live glow, or a fairy for replays).
    for (const v of this.voices.values()) {
      const p = this.fingerPx(v.state);
      const col = STRINGS[v.state.lane].color;
      const r = 22 + 14 * v.state.intensity;
      const glow = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
      glow.addColorStop(0, '#ffffffee');
      glow.addColorStop(0.35, col + 'cc');
      glow.addColorStop(1, col + '00');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
      // Bowing sign above the finger: ⊓ = down bow, V = up bow (real violin notation).
      g.fillStyle = dark ? '#3d2e5c' : '#fff';
      g.font = 'bold 16px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(v.state.direction === 'down' ? '⊓' : 'V', p.x, p.y - r - 4);
      if (v.replay) {
        g.font = '28px system-ui, sans-serif';
        g.fillText('🧚', p.x + 16, p.y - 16);
      }
    }

    this.drawParticles(g, skin.particle);
    this.drawOverlay?.(g, this.board, now);

    if (this.showHint && !this.touchedOnce && this.voices.size === 0) {
      const t = (now / 1200) % 1;
      const x = a.x + a.w * (0.2 + 0.6 * Math.sin(t * Math.PI));
      const y = a.y + a.h * 0.55;
      g.font = '40px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('👆', x, y);
      g.font = 'bold 18px system-ui, sans-serif';
      g.fillStyle = dark ? '#3d2e5c' : '#fff';
      g.fillText('Slide your finger across a string!', a.x + a.w / 2, y + 48);
    }
  }

  private burst(x: number, y: number, n: number, lane: number): void {
    const colors = SKINS[settings.skin].particleColors;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.5,
        life: 1,
        size: 8 + Math.random() * 10,
        color: i % 3 === 0 ? STRINGS[lane].color : colors[Math.floor(Math.random() * colors.length)],
        spin: Math.random() * 6,
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private drawParticles(g: CanvasRenderingContext2D, kind: 'notes' | 'stars' | 'hearts'): void {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life -= 0.018;
      p.spin += 0.05;
      if (p.life <= 0) continue;
      g.globalAlpha = Math.min(1, p.life * 1.4);
      g.fillStyle = p.color;
      if (kind === 'stars') starPath(g, p.x, p.y, p.size * 0.5, p.spin);
      else if (kind === 'hearts') heartPath(g, p.x, p.y, p.size * 0.5);
      else {
        g.font = `${Math.round(p.size + 6)}px system-ui, sans-serif`;
        g.fillText(p.spin % 2 < 1 ? '♪' : '♫', p.x, p.y);
      }
    }
    g.globalAlpha = 1;
    g.textBaseline = 'alphabetic';
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}

function pressureOf(e: PointerEvent): number | undefined {
  // Mouse and many phones report a fake 0.5 (or 0); only trust real pressure.
  if (e.pointerType === 'mouse') return undefined;
  return e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : undefined;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function heartPath(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  g.fill();
}
