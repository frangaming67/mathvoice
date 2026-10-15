import type { GraphEventType } from './GraphService';

/** Altura por semitonos, de Do 3 (MIDI 48) a Do 6 (MIDI 84): los cambios se oyen parejos. */
export function pitchFor(y: number, min: number, max: number): number {
  const t = Math.max(0, Math.min(1, (y - min) / (max - min)));
  return 440 * 2 ** ((48 + t * 36 - 69) / 12);
}
/** Paneo según x: el comienzo del intervalo suena a la izquierda y el final a la derecha. */
export function panFor(x: number, min: number, max: number): number {
  return Math.max(-1, Math.min(1, ((x - min) / (max - min)) * 2 - 1));
}

export interface Cue {
  frequency: number;
  /** Segundos desde el tono del dato. */
  delay: number;
  duration: number;
  wave: OscillatorType;
  gain: number;
}
const tick = (frequency: number, delay = 0): Cue => ({
  frequency,
  delay,
  duration: 0.03,
  wave: 'square',
  gain: 0.04,
});
/** Señales cortas que se suman al tono del dato, sin reemplazarlo. */
export const eventCues: Record<GraphEventType | 'eje', Cue[]> = {
  cero: [tick(1568)],
  eje: [tick(1568)],
  'máximo local': [tick(1319), tick(1760, 0.045)],
  'mínimo local': [tick(1760), tick(1319, 0.045)],
  intersección: [tick(1175), tick(1175, 0.05)],
  discontinuidad: [{ frequency: 220, delay: 0, duration: 0.05, wave: 'square', gain: 0.05 }],
  'asíntota vertical': [{ frequency: 70, delay: 0, duration: 0.12, wave: 'sawtooth', gain: 0.07 }],
};

export interface SonificationSample {
  x: number;
  y: number | null;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Eventos alcanzados desde la muestra anterior. */
  events?: GraphEventType[];
  /** La curva cruzó y = 0 desde la muestra anterior. */
  crossedAxis?: boolean;
}
export interface SoundPlan {
  pan: number;
  /** Tono del dato; «outside» tiembla si la curva sale del rango Y. */
  tone?: { frequency: number; outside: 'arriba' | 'abajo' | null };
  /** Sin valor: un soplido suave en lugar de silencio. */
  noise: boolean;
  cues: Cue[];
}
/** Qué suena en una muestra. Es puro para poder probarlo sin audio. */
export function soundPlan(sample: SonificationSample): SoundPlan {
  const events = sample.events ?? [];
  const cues = events.flatMap((event) => eventCues[event]);
  if (sample.crossedAxis && !events.includes('cero')) cues.push(...eventCues.eje);
  const pan = panFor(sample.x, sample.minX, sample.maxX);
  if (sample.y === null) return { pan, noise: true, cues };
  const outside = sample.y > sample.maxY ? 'arriba' : sample.y < sample.minY ? 'abajo' : null;
  return {
    pan,
    noise: false,
    tone: { frequency: pitchFor(sample.y, sample.minY, sample.maxY), outside },
    cues,
  };
}

export class SonificationService {
  private context: AudioContext | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private noiseBuffer: AudioBuffer | null = null;
  async activate() {
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  play(sample: SonificationSample) {
    const context = this.context;
    if (!context) return;
    const plan = soundPlan(sample);
    const now = context.currentTime;
    const output = this.output(context, plan.pan);
    const ends: Promise<void>[] = [];
    if (plan.noise) ends.push(this.noise(context, output, now));
    if (plan.tone)
      ends.push(
        this.beep(context, output, {
          frequency: plan.tone.frequency,
          delay: 0,
          duration: 0.09,
          wave: 'sine',
          gain: 0.08,
          tremolo: plan.tone.outside !== null,
        }),
      );
    for (const cue of plan.cues) ends.push(this.beep(context, output, cue));
    // El paneo de esta muestra se suelta cuando terminó todo lo que pasaba por él.
    if (output !== context.destination) void Promise.all(ends).then(() => output.disconnect());
  }
  private output(context: AudioContext, pan: number): AudioNode {
    if (typeof context.createStereoPanner !== 'function') return context.destination;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(context.destination);
    return panner;
  }
  private track(source: AudioScheduledSourceNode, release: () => void) {
    this.sources.add(source);
    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.sources.delete(source);
        release();
        resolve();
      };
    });
  }
  private beep(
    context: AudioContext,
    output: AudioNode,
    { frequency, delay, duration, wave, gain: level, tremolo = false }: Cue & { tremolo?: boolean },
  ) {
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    let lfo: OscillatorNode | null = null;
    if (tremolo) {
      // Fuera del rango Y: el tono tiembla en el borde en lugar de quedar fijo.
      lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = 18;
      depth.gain.value = level * 0.7;
      lfo.connect(depth);
      depth.connect(gain.gain);
      lfo.start(at);
      lfo.stop(at + duration);
    }
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
    return this.track(oscillator, () => {
      oscillator.disconnect();
      gain.disconnect();
      lfo?.disconnect();
    });
  }
  private noise(context: AudioContext, output: AudioNode, at: number) {
    if (!this.noiseBuffer) {
      const length = Math.round(context.sampleRate * 0.1);
      this.noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const channel = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.03, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(at);
    source.stop(at + 0.09);
    return this.track(source, () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  }
  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
  }
}
export const sonification = new SonificationService();
