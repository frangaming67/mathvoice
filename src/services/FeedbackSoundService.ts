export type FeedbackKind =
  | 'success'
  | 'error'
  | 'change'
  | 'dictation-start'
  | 'dictation-end'
  | 'sequence'
  | 'sequence-cancel'
  | 'unassigned';

/** Notas de cada aviso (en hercios, una tras otra) y duración total en segundos. */
export const feedbackTones: Record<FeedbackKind, { notes: number[]; duration: number }> = {
  success: { notes: [660, 880], duration: 0.12 },
  error: { notes: [262, 196], duration: 0.16 },
  change: { notes: [440], duration: 0.1 },
  'dictation-start': { notes: [440, 660], duration: 0.14 },
  'dictation-end': { notes: [660, 440], duration: 0.14 },
  sequence: { notes: [523], duration: 0.09 },
  'sequence-cancel': { notes: [392, 330], duration: 0.12 },
  unassigned: { notes: [300], duration: 0.08 },
};
const clampVolume = (volume: number) =>
  Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
/** Ganancia máxima para un volumen de 0 a 1: audible con el lector a volumen normal. */
export const feedbackGain = (volume: number) => 0.3 * clampVolume(volume);

export class FeedbackSoundService {
  private context: AudioContext | null = null;
  private generation = 0;
  private oscillator: OscillatorNode | null = null;
  private enabled = true;
  private volume = 0.5;
  configure({ enabled, volume }: { enabled?: boolean; volume?: number }) {
    if (enabled !== undefined) this.enabled = enabled;
    if (volume !== undefined) this.volume = clampVolume(volume);
    if (!this.enabled) this.stop();
  }
  play(kind: FeedbackKind) {
    return this.enabled ? this.emit(kind, this.volume) : Promise.resolve();
  }
  /** Prueba de sonido: suena aunque los avisos estén desactivados, con el volumen indicado. */
  test(volume = this.volume) {
    return this.emit('success', clampVolume(volume));
  }
  private async emit(kind: FeedbackKind, volume: number) {
    const generation = ++this.generation;
    if (volume <= 0) return;
    try {
      if (typeof AudioContext === 'undefined') return;
      this.context ??= new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return;
      this.oscillator?.stop();
      const { notes, duration } = feedbackTones[kind];
      const start = this.context.currentTime;
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      this.oscillator = oscillator;
      notes.forEach((frequency, index) =>
        oscillator.frequency.setValueAtTime(frequency, start + (index * duration) / notes.length),
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(feedbackGain(volume), start + 0.008);
      gain.gain.setValueAtTime(feedbackGain(volume), start + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        if (this.oscillator === oscillator) this.oscillator = null;
      };
    } catch {
      /* Optional feedback never blocks a spoken or textual message. */
    }
  }
  stop() {
    this.generation++;
    try {
      this.oscillator?.stop();
    } catch {
      /* Already ended. */
    }
    this.oscillator = null;
  }
}
export const feedbackSound = new FeedbackSoundService();
