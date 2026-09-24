// One shared AudioContext with a small "concert hall": everything goes through a
// reverb and a gentle limiter so many voices never get harsh or clip.
//
// Browsers (and iOS especially) only allow audio after a user gesture, so the
// context is created lazily by the first tap.

export class AudioEngine {
  readonly ctx: AudioContext;
  /** Instruments connect here. */
  readonly input: GainNode;
  /** Feed for "record my song" as an audio file. */
  readonly streamDest: MediaStreamAudioDestinationNode | null;
  private noise: AudioBuffer | null = null;

  constructor() {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    const ctx = this.ctx;

    this.input = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(2.2, 2.5);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.2;

    const master = ctx.createGain();
    master.gain.value = 0.9;

    this.input.connect(dry).connect(limiter);
    this.input.connect(reverb).connect(wet).connect(limiter);
    limiter.connect(master).connect(ctx.destination);

    this.streamDest = typeof ctx.createMediaStreamDestination === 'function' ? ctx.createMediaStreamDestination() : null;
    if (this.streamDest) master.connect(this.streamDest);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** Two seconds of white noise, shared by every instrument that needs "air" or "scratch". */
  noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
}

let engine: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}

export function hasEngine(): boolean {
  return engine !== null;
}
