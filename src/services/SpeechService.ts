import type { Preferences } from '../types';
/** Cómo escuchar los controles: en pantallas táctiles no hay puntero que pasar por encima. */
export function pointerHint() {
  const touch =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none)').matches;
  return touch
    ? 'Al tocar un campo, se lee su nombre.'
    : 'Pasá el puntero sobre cualquier control para escucharlo.';
}
export class SpeechService {
  private last = '';
  private voice = '';
  private language = 'es-AR';
  private rate = 1;
  private pitch = 1;
  private volume = 1;
  private automaticEnabled = false;
  private generation = 0;
  private paused = false;
  private pendingNext: (() => void) | undefined;
  private listActive = false;
  private unlocked = false;
  get readingList() {
    return this.listActive;
  }
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
    this.automaticEnabled = p.guided;
    if (!p.guided) this.detener();
    this.voice = p.voice;
    this.language = p.language;
    this.rate = p.rate;
    this.pitch = p.pitch;
    this.volume = p.volume;
  }
  /**
   * Safari e iOS solo habilitan la síntesis si la primera speak() ocurre dentro de un gesto.
   * Llamalo sincrónicamente en el onClick, antes de cualquier requestAnimationFrame o await.
   */
  unlock() {
    if (!this.available || this.unlocked) return false;
    this.unlocked = true;
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    return true;
  }
  hablarAutomatico(text: string) {
    return this.automaticEnabled ? this.hablar(text) : false;
  }
  hablar(text: string) {
    if (!this.available) return false;
    this.detener();
    this.last = text;
    window.speechSynthesis.speak(this.utterance(text));
    return true;
  }
  private utterance(text: string) {
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
    return utterance;
  }
  hablarLista(messages: string[], onIndex: (index: number) => void) {
    if (!this.available || !messages.length) return false;
    this.detener();
    const generation = this.generation;
    const items = [...messages];
    this.listActive = true;
    const next = (index: number) => {
      if (generation !== this.generation) return;
      if (index >= items.length) {
        this.listActive = false;
        return;
      }
      if (this.paused) {
        this.pendingNext = () => next(index);
        return;
      }
      this.last = items[index];
      const utterance = this.utterance(items[index]);
      utterance.onend = () => next(index + 1);
      utterance.onerror = () => {
        if (generation === this.generation) this.detener();
      };
      onIndex(index);
      if (generation === this.generation) window.speechSynthesis.speak(utterance);
    };
    next(0);
    return true;
  }
  detener() {
    this.generation++;
    this.pendingNext = undefined;
    this.listActive = false;
    if (this.available) {
      window.speechSynthesis.cancel();
      if (this.paused) window.speechSynthesis.resume();
    }
    this.paused = false;
  }
  pausar() {
    this.paused = true;
    if (this.available) window.speechSynthesis.pause();
  }
  continuar() {
    this.paused = false;
    if (this.available) window.speechSynthesis.resume();
    const next = this.pendingNext;
    this.pendingNext = undefined;
    next?.();
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
