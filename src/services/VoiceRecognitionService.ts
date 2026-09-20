interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export class VoiceRecognitionService {
  private recognition: Recognition | null = null;
  get supported() {
    return (
      typeof window !== 'undefined' &&
      !!(
        (window as SpeechWindow).SpeechRecognition ||
        (window as SpeechWindow).webkitSpeechRecognition
      )
    );
  }
  start(
    language: string,
    result: (text: string) => void,
    error: (text: string) => void,
    end: () => void,
  ) {
    this.cancel();
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      error(
        'El dictado no está disponible en este navegador. Podés escribir o usar el teclado de la calculadora.',
      );
      return;
    }
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) result(text);
      recognition.stop();
    };
    recognition.onerror = (e) => {
      if (e.error === 'aborted') return;
      error(
        e.error === 'not-allowed'
          ? 'No se permitió usar el micrófono. Revisá el permiso del navegador.'
          : e.error === 'no-speech'
            ? 'No se detectó voz. Volvé a intentar.'
            : 'El navegador no pudo completar el dictado. Revisá la conexión y el micrófono.',
      );
    };
    recognition.onend = end;
    try {
      recognition.start();
    } catch {
      error('No pude iniciar el micrófono. Volvé a intentarlo.');
      end();
    }
  }
  cancel() {
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }
  }
}
