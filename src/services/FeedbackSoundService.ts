class FeedbackSoundService {
  private context: AudioContext | null = null;
  private generation = 0;
  private oscillator: OscillatorNode | null = null;
  async play(kind: 'success' | 'error' | 'change') {
    const generation = ++this.generation;
    try {
      if (typeof AudioContext === 'undefined') return;
      this.context ??= new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return;
      this.oscillator?.stop();
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      this.oscillator = oscillator;
      oscillator.frequency.value = kind === 'error' ? 260 : kind === 'success' ? 660 : 440;
      gain.gain.setValueAtTime(0.035, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.07);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.08);
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
