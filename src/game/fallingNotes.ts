// Falling Notes game rules. Notes fall down their string lane; play that string
// when the note reaches the glowing line. Pure logic (time is passed in), unit tested.
//
// Beginner  : the violin plays the right note for you (and, with "wait", the song waits for you).
// Explorer  : the song keeps going; your finger must be near the right spot.
// Free      : real timing and real finger position.

import type { AssistLevel } from '../music/theory';
import { stringForNote } from '../music/theory';
import type { Song } from '../music/songs';

export type Grade = 'perfect' | 'great' | 'good';

export interface GameNote {
  index: number;
  midi: number;
  lane: number;
  position: number;
  beat: number;
  beats: number;
  time: number; // seconds from song start
  state: 'pending' | 'hit' | 'missed';
  grade?: Grade;
}

export interface GameResult {
  hits: number;
  total: number;
  stars: 1 | 2 | 3;
  message: string;
}

const TEMPO_SCALE: Record<AssistLevel, number> = { beginner: 0.8, explorer: 0.9, free: 1 };
const WINDOW: Record<AssistLevel, number> = { beginner: 0.7, explorer: 0.35, free: 0.25 };
const PITCH_TOLERANCE: Record<AssistLevel, number> = { beginner: Infinity, explorer: 1.2, free: 0.6 };

export class FallingNotesGame {
  readonly notes: GameNote[];
  readonly secPerBeat: number;
  readonly waitMode: boolean;
  readonly travel: number; // seconds a note takes to fall to the line
  songTime: number;
  waiting = false;
  streak = 0;

  constructor(readonly song: Song, readonly level: AssistLevel, opts: { wait?: boolean } = {}) {
    this.secPerBeat = 60 / (song.tempo * TEMPO_SCALE[level]);
    this.waitMode = opts.wait ?? level === 'beginner';
    this.travel = Math.max(1.6, this.secPerBeat * 4);
    this.notes = song.notes.map((n, index) => {
      const where = stringForNote(n.midi);
      if (!where) throw new Error(`Note ${n.midi} in "${song.title}" is not playable`);
      return { index, midi: n.midi, lane: where.string, position: where.position, beat: n.beat, beats: n.beats, time: n.beat * this.secPerBeat, state: 'pending' };
    });
    this.songTime = -this.travel; // the first note starts at the top
  }

  get endTime(): number {
    return this.song.totalBeats * this.secPerBeat;
  }

  /** Next note still to be played. */
  nextPending(): GameNote | undefined {
    return this.notes.find((n) => n.state === 'pending');
  }

  /** Advance the song clock. In wait mode the clock pauses on the next note. */
  update(dt: number): GameNote[] {
    const missed: GameNote[] = [];
    let t = this.songTime + dt;
    if (this.waitMode) {
      const next = this.nextPending();
      this.waiting = !!next && t >= next.time;
      if (next && t > next.time) t = next.time;
    } else {
      for (const n of this.notes) {
        if (n.state === 'pending' && n.time < t - WINDOW[this.level]) {
          n.state = 'missed';
          this.streak = 0;
          missed.push(n);
        }
      }
    }
    this.songTime = t;
    return missed;
  }

  /** Song beat for the orchestra, or null before the song starts. */
  beat(): number | null {
    return this.songTime < 0 ? null : this.songTime / this.secPerBeat;
  }

  /** Pitch the violin should play on a lane (beginner help), or null for the finger's own pitch. */
  assistedPitch(lane: number): number | null {
    if (this.level !== 'beginner') return null;
    const n = this.notes.find((x) => x.state === 'pending' && x.lane === lane && x.time - this.songTime < 1.5);
    return n ? n.midi : null;
  }

  /** The child played a note on a lane. Returns the note it scored, if any. */
  play(lane: number, midi: number): GameNote | null {
    const win = WINDOW[this.level];
    let best: GameNote | null = null;
    let bestDt = Infinity;
    for (const n of this.notes) {
      if (n.state !== 'pending') continue;
      const dt = Math.abs(n.time - this.songTime);
      if (dt > win) {
        if (n.time > this.songTime) break; // later notes are even further away
        continue;
      }
      if (n.lane !== lane || Math.abs(n.midi - midi) > PITCH_TOLERANCE[this.level]) continue;
      if (dt < bestDt) {
        best = n;
        bestDt = dt;
      }
    }
    if (!best) return null;
    // In wait mode only the note we are waiting for (or about to reach) counts, in order.
    if (this.waitMode && best !== this.nextPending()) return null;
    best.state = 'hit';
    best.grade = this.waiting || bestDt < 0.1 ? 'perfect' : bestDt < 0.2 ? 'great' : 'good';
    this.streak++;
    return best;
  }

  get finished(): boolean {
    return this.songTime >= this.endTime + 0.5 || this.notes.every((n) => n.state !== 'pending');
  }

  progress(): number {
    return this.notes.filter((n) => n.state !== 'pending').length / this.notes.length;
  }

  hits(): number {
    return this.notes.filter((n) => n.state === 'hit').length;
  }

  result(): GameResult {
    const total = this.notes.length;
    const hits = this.hits();
    const ratio = hits / total;
    // No "FAILED" ever: finishing a song always earns at least one star.
    const stars: 1 | 2 | 3 = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    let message: string;
    if (stars === 3) message = 'Amazing! Great timing!';
    else if (stars === 2) message = 'Nice rhythm!';
    else {
      const lastQuarter = this.notes.slice(Math.floor(total * 0.75));
      const endMisses = lastQuarter.filter((n) => n.state !== 'hit').length;
      message = endMisses > lastQuarter.length / 2 ? 'Try the ending again!' : "Great start! Let's play it again together.";
    }
    return { hits, total, stars, message };
  }
}

export const GRADE_WORDS: Record<Grade, string[]> = {
  perfect: ['Great timing!', 'Perfect!', 'Wow!'],
  great: ['Nice!', 'Lovely!', 'Super!'],
  good: ['Good!', 'Yay!', 'Keep going!'],
};
