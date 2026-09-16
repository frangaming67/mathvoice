import type { Preferences } from '../types';
export class SpeechService {
  private last = '';
  private voice = '';
  private language = 'es-AR';
  private rate = 1;
  private pitch = 1;
  private volume = 1;
  get available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
  voices() {
    return this.available ? window.speechSynthesis.getVoices() : [];
  }
  subscribe(callback: () => void) {
    if (!this.available) return () => {};
    window.speechSynthesis.addEventListener('voiceschanged', callback);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
  }
  configure(p: Preferences) {
    this.voice = p.voice;
    this.language = p.language;
    this.rate = p.rate;
    this.pitch = p.pitch;
    this.volume = p.volume;
  }
  hablar(text: string) {
    if (!this.available) return false;
    this.detener();
    this.last = text;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.voices();
    utterance.voice =
      voices.find((v) => v.voiceURI === this.voice) ??
      voices.find((v) => v.lang === this.language) ??
      voices.find((v) => v.lang.startsWith(this.language.split('-')[0])) ??
      null;
    utterance.lang = this.language;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    window.speechSynthesis.speak(utterance);
    return true;
  }
  detener() {
    if (this.available) window.speechSynthesis.cancel();
  }
  pausar() {
    if (this.available) window.speechSynthesis.pause();
  }
  continuar() {
    if (this.available) window.speechSynthesis.resume();
  }
  repetir() {
    if (this.last) this.hablar(this.last);
  }
  cambiarVoz(voice: string) {
    this.voice = voice;
  }
  cambiarVelocidad(rate: number) {
    this.rate = Math.min(2.5, Math.max(0.5, rate));
  }
  cambiarTono(pitch: number) {
    this.pitch = Math.min(2, Math.max(0, pitch));
  }
  cambiarVolumen(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
  }
}
export const speech = new SpeechService();
