import type { InputFrameState } from '../input/actions.ts';
import type { AudioEvent, GameMode } from '../simulation/types.ts';

type AudioCueCounters = {
  asteroidBreakup: number;
  laser: number;
  scoreStinger: number;
  shipDestroyed: number;
  shipHit: number;
};

export type AudioDebugState = {
  available: boolean;
  ambientActive: boolean;
  cueCounts: AudioCueCounters;
  muted: boolean;
  suspended: boolean;
  thrustActive: boolean;
  unlocked: boolean;
};

type CreateAudioSystemParams = {
  muted?: boolean;
};

type SyncAudioStateParams = {
  input: Pick<InputFrameState, 'thrust'>;
  mode: GameMode;
  shipAlive: boolean;
};

type AudioContextConstructor = typeof AudioContext;

const AMBIENT_GAIN_ACTIVE = 0.26;
const MASTER_GAIN_ACTIVE = 0.82;
const THRUST_GAIN_ACTIVE = 0.22;

export class AudioSystem {
  private ambientGain: GainNode | null = null;

  private audioContext: AudioContext | null = null;

  private readonly available: boolean;

  private readonly cueCounts: AudioCueCounters = {
    asteroidBreakup: 0,
    laser: 0,
    scoreStinger: 0,
    shipDestroyed: 0,
    shipHit: 0,
  };

  private thrustFilter: BiquadFilterNode | null = null;

  private thrustGain: GainNode | null = null;

  private masterGain: GainNode | null = null;

  private mode: GameMode = 'menu';

  private muted: boolean;

  private noiseBuffer: AudioBuffer | null = null;

  private readonly audioContextConstructor: AudioContextConstructor | null;

  private shipAlive = true;

  private suspended = false;

  private thrustRequested = false;

  private unlocked = false;

  constructor({ muted = false }: CreateAudioSystemParams = {}) {
    this.muted = muted;
    this.audioContextConstructor = getAudioContextConstructor();
    this.available = this.audioContextConstructor !== null;
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();

    if (!context) {
      return;
    }

    try {
      await context.resume();
    } catch {
      this.unlocked = context.state === 'running';
      this.applyContinuousState();
      return;
    }

    this.unlocked = context.state === 'running';
    this.applyContinuousState();
  }

  playEvents(events: AudioEvent[]): void {
    for (const event of events) {
      if (event === 'laser_fired') {
        this.playLaser();
        continue;
      }

      if (event === 'asteroid_broke') {
        this.playAsteroidBreakup();
        continue;
      }

      if (event === 'ship_hit') {
        this.playShipHit();
        continue;
      }

      if (event === 'ship_destroyed') {
        this.playShipDestroyed();
        continue;
      }

      this.playScoreStinger();
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.applyContinuousState();
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    this.applyContinuousState();
  }

  syncState({ input, mode, shipAlive }: SyncAudioStateParams): void {
    this.mode = mode;
    this.shipAlive = shipAlive;
    this.thrustRequested = mode === 'playing' && shipAlive && input.thrust;
    this.applyContinuousState();
  }

  getDebugState(): AudioDebugState {
    return {
      available: this.available,
      ambientActive: this.isAmbientActive(),
      cueCounts: { ...this.cueCounts },
      muted: this.muted,
      suspended: this.suspended,
      thrustActive: this.isThrustActive(),
      unlocked: this.unlocked,
    };
  }

  private ensureContext(): AudioContext | null {
    if (!this.available || !this.audioContextConstructor) {
      return null;
    }

    if (this.audioContext) {
      return this.audioContext;
    }

    const context = new this.audioContextConstructor();
    const masterGain = context.createGain();
    const ambientGain = context.createGain();
    const crackleGain = context.createGain();
    const thrustGain = context.createGain();
    const thrustFilter = context.createBiquadFilter();
    const droneFilter = context.createBiquadFilter();
    const ambientNoiseFilter = context.createBiquadFilter();
    const ambientNoiseSource = context.createBufferSource();
    const thrustNoiseSource = context.createBufferSource();
    const dronePrimary = context.createOscillator();
    const droneSecondary = context.createOscillator();
    const dronePrimaryGain = context.createGain();
    const droneSecondaryGain = context.createGain();
    const thrustTone = context.createOscillator();
    const thrustToneGain = context.createGain();

    this.audioContext = context;
    this.masterGain = masterGain;
    this.ambientGain = ambientGain;
    this.thrustGain = thrustGain;
    this.thrustFilter = thrustFilter;
    this.noiseBuffer = this.createNoiseBuffer(context);

    masterGain.gain.value = 0;
    masterGain.connect(context.destination);

    ambientGain.gain.value = 0;
    ambientGain.connect(masterGain);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 240;
    droneFilter.Q.value = 0.7;
    droneFilter.connect(ambientGain);

    dronePrimary.type = 'sawtooth';
    dronePrimary.frequency.value = 47;
    dronePrimaryGain.gain.value = 0.07;
    dronePrimary.connect(dronePrimaryGain);
    dronePrimaryGain.connect(droneFilter);

    droneSecondary.type = 'triangle';
    droneSecondary.frequency.value = 79;
    droneSecondaryGain.gain.value = 0.05;
    droneSecondary.connect(droneSecondaryGain);
    droneSecondaryGain.connect(droneFilter);

    ambientNoiseFilter.type = 'bandpass';
    ambientNoiseFilter.frequency.value = 1600;
    ambientNoiseFilter.Q.value = 1.3;
    ambientNoiseFilter.connect(crackleGain);

    crackleGain.gain.value = 0.028;
    crackleGain.connect(ambientGain);

    ambientNoiseSource.buffer = this.noiseBuffer;
    ambientNoiseSource.loop = true;
    ambientNoiseSource.connect(ambientNoiseFilter);

    thrustFilter.type = 'bandpass';
    thrustFilter.frequency.value = 420;
    thrustFilter.Q.value = 3.2;
    thrustFilter.connect(thrustGain);

    thrustGain.gain.value = 0;
    thrustGain.connect(masterGain);

    thrustNoiseSource.buffer = this.noiseBuffer;
    thrustNoiseSource.loop = true;
    thrustNoiseSource.connect(thrustFilter);

    thrustTone.type = 'sawtooth';
    thrustTone.frequency.value = 118;
    thrustToneGain.gain.value = 0.05;
    thrustTone.connect(thrustToneGain);
    thrustToneGain.connect(thrustGain);

    dronePrimary.start();
    droneSecondary.start();
    ambientNoiseSource.start();
    thrustNoiseSource.start();
    thrustTone.start();

    this.applyContinuousState();

    return context;
  }

  private applyContinuousState(): void {
    if (!this.audioContext || !this.masterGain || !this.ambientGain || !this.thrustGain) {
      return;
    }

    const now = this.audioContext.currentTime;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      this.muted ? 0 : MASTER_GAIN_ACTIVE,
      now,
      0.03,
    );

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setTargetAtTime(
      this.isAmbientActive() ? AMBIENT_GAIN_ACTIVE : 0.0001,
      now,
      this.isAmbientActive() ? 0.22 : 0.16,
    );

    if (this.thrustFilter) {
      this.thrustFilter.frequency.cancelScheduledValues(now);
      this.thrustFilter.frequency.setTargetAtTime(
        this.isThrustActive() ? 980 : 420,
        now,
        0.08,
      );
    }

    this.thrustGain.gain.cancelScheduledValues(now);
    this.thrustGain.gain.setTargetAtTime(
      this.isThrustActive() ? THRUST_GAIN_ACTIVE : 0.0001,
      now,
      this.isThrustActive() ? 0.03 : 0.08,
    );
  }

  private getCueNodes(): { context: AudioContext; masterGain: GainNode } | null {
    const context = this.ensureContext();

    if (
      !context ||
      !this.masterGain ||
      !this.unlocked ||
      this.muted ||
      this.suspended
    ) {
      return null;
    }

    return {
      context,
      masterGain: this.masterGain,
    };
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const durationSeconds = 2;
    const length = context.sampleRate * durationSeconds;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      channelData[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private isAmbientActive(): boolean {
    return this.unlocked && !this.muted && !this.suspended && (
      this.mode === 'menu' || this.mode === 'playing'
    );
  }

  private isThrustActive(): boolean {
    return this.unlocked &&
      !this.muted &&
      !this.suspended &&
      this.mode === 'playing' &&
      this.shipAlive &&
      this.thrustRequested;
  }

  private playLaser(): void {
    const cueNodes = this.getCueNodes();

    if (!cueNodes) {
      return;
    }

    const { context, masterGain } = cueNodes;
    const now = context.currentTime;
    const lead = context.createOscillator();
    const tail = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    this.cueCounts.laser += 1;

    lead.type = 'square';
    lead.frequency.setValueAtTime(1400, now);
    lead.frequency.exponentialRampToValueAtTime(380, now + 0.08);

    tail.type = 'triangle';
    tail.frequency.setValueAtTime(880, now);
    tail.frequency.exponentialRampToValueAtTime(240, now + 0.09);

    filter.type = 'highpass';
    filter.frequency.value = 620;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    lead.connect(filter);
    tail.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    lead.start(now);
    tail.start(now);
    lead.stop(now + 0.11);
    tail.stop(now + 0.11);
    releaseDisposableNodes(lead, tail, filter, gain);
  }

  private playAsteroidBreakup(): void {
    const cueNodes = this.getCueNodes();

    if (!cueNodes || !this.noiseBuffer) {
      return;
    }

    const { context, masterGain } = cueNodes;
    const now = context.currentTime;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const tone = context.createOscillator();
    const toneGain = context.createGain();

    this.cueCounts.asteroidBreakup += 1;

    noise.buffer = this.noiseBuffer;

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(280, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    noiseFilter.Q.value = 0.8;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    tone.type = 'triangle';
    tone.frequency.setValueAtTime(240, now);
    tone.frequency.exponentialRampToValueAtTime(62, now + 0.2);

    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    tone.connect(toneGain);
    toneGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.22);
    tone.start(now);
    tone.stop(now + 0.22);
    releaseDisposableNodes(noise, noiseFilter, noiseGain, tone, toneGain);
  }

  private playScoreStinger(): void {
    const cueNodes = this.getCueNodes();

    if (!cueNodes) {
      return;
    }

    const now = cueNodes.context.currentTime;

    this.cueCounts.scoreStinger += 1;
    this.playStingerTone(now, 523.25, 0.12, 0.06);
    this.playStingerTone(now + 0.1, 783.99, 0.18, 0.05);
    this.playStingerTone(now + 0.2, 1046.5, 0.24, 0.045);
  }

  private playShipHit(): void {
    const cueNodes = this.getCueNodes();

    if (!cueNodes || !this.noiseBuffer) {
      return;
    }

    const { context, masterGain } = cueNodes;
    const now = context.currentTime;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const tone = context.createOscillator();
    const toneGain = context.createGain();

    this.cueCounts.shipHit += 1;

    noise.buffer = this.noiseBuffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(180, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(70, now + 0.28);
    noiseFilter.Q.value = 0.65;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.17, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    tone.type = 'sawtooth';
    tone.frequency.setValueAtTime(110, now);
    tone.frequency.exponentialRampToValueAtTime(48, now + 0.22);

    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.095, now + 0.018);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    tone.connect(toneGain);
    toneGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.3);
    tone.start(now);
    tone.stop(now + 0.24);
    releaseDisposableNodes(noise, noiseFilter, noiseGain, tone, toneGain);
  }

  private playShipDestroyed(): void {
    const cueNodes = this.getCueNodes();

    if (!cueNodes || !this.noiseBuffer) {
      return;
    }

    const { context, masterGain } = cueNodes;
    const now = context.currentTime;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const boom = context.createOscillator();
    const boomGain = context.createGain();
    const tail = context.createOscillator();
    const tailGain = context.createGain();

    this.cueCounts.shipDestroyed += 1;

    noise.buffer = this.noiseBuffer;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(420, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(110, now + 0.7);
    noiseFilter.Q.value = 0.9;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);

    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(88, now);
    boom.frequency.exponentialRampToValueAtTime(24, now + 0.55);

    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.17, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    tail.type = 'triangle';
    tail.frequency.setValueAtTime(220, now + 0.06);
    tail.frequency.exponentialRampToValueAtTime(58, now + 0.62);

    tailGain.gain.setValueAtTime(0.0001, now + 0.04);
    tailGain.gain.exponentialRampToValueAtTime(0.08, now + 0.11);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    boom.connect(boomGain);
    boomGain.connect(masterGain);

    tail.connect(tailGain);
    tailGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.8);
    boom.start(now);
    boom.stop(now + 0.62);
    tail.start(now + 0.04);
    tail.stop(now + 0.72);
    releaseDisposableNodes(
      noise,
      noiseFilter,
      noiseGain,
      boom,
      boomGain,
      tail,
      tailGain,
    );
  }

  private playStingerTone(
    startTime: number,
    frequency: number,
    duration: number,
    peakGain: number,
  ): void {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 1.05,
      startTime + duration * 0.45,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
    releaseDisposableNodes(oscillator, gain);
  }
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const globalWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };

  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext ?? null;
}

function releaseDisposableNodes(...nodes: AudioNode[]): void {
  const sourceNodes = nodes.filter(
    (node): node is AudioScheduledSourceNode =>
      'addEventListener' in node && 'stop' in node,
  );

  if (sourceNodes.length === 0) {
    window.setTimeout(() => {
      nodes.forEach((node) => node.disconnect());
    }, 320);
    return;
  }

  for (const sourceNode of sourceNodes) {
    sourceNode.addEventListener(
      'ended',
      () => {
        nodes.forEach((node) => node.disconnect());
      },
      { once: true },
    );
  }
}
