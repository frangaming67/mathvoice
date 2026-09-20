import type { GraphEvent } from './GraphService';
export class SonificationService {
  private context: AudioContext | null = null;
  private oscillators = new Set<OscillatorNode>();
  async activate() {
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  tone(y: number, min: number, max: number, event?: GraphEvent['type']) {
    if (!this.context) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = event
      ? { cero: 440, 'máximo local': 1046.5, 'mínimo local': 261.6, intersección: 659.3 }[event]
      : 180 + Math.max(0, Math.min(1, (y - min) / (max - min))) * 700;
    oscillator.type = event ? 'triangle' : 'sine';
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    this.oscillators.add(oscillator);
    oscillator.onended = () => {
      this.oscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  stop() {
    for (const oscillator of this.oscillators) {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    }
    this.oscillators.clear();
  }
}
export const sonification = new SonificationService();
