interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onnomatch?: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export const DICTATION_UNSUPPORTED =
  'Este navegador no ofrece dictado. Probá con Chrome o Edge; podés seguir escribiendo.';
const errorMessages: Record<string, string> = {
  'not-allowed': 'No se permitió usar el micrófono. Revisá el permiso del navegador.',
  'service-not-allowed':
    'No se permitió usar el micrófono. El navegador bloquea el dictado en esta página.',
  'audio-capture': 'No se encontró micrófono. Conectá uno y volvé a intentar.',
  network: 'El dictado necesita conexión a internet. Revisá la conexión y volvé a intentar.',
  'language-not-supported':
    'El navegador no reconoce voz en este idioma. Probá con otro idioma en Ajustes.',
  'no-speech': 'No se detectó voz. Volvé a intentar.',
  nomatch: 'No entendí lo que dijiste. Volvé a intentar.',
};

/** Mensaje para un código de error del reconocimiento; null cuando la escucha se canceló a propósito. */
export function recognitionErrorMessage(code: string): string | null {
  if (code === 'aborted') return null;
  return errorMessages[code] ?? 'El navegador no pudo completar el dictado. Volvé a intentar.';
}

function recognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}
export function speechRecognitionSupported(): boolean {
  return !!recognitionConstructor();
}

export class VoiceRecognitionService {
  private recognition: Recognition | null = null;
  get supported() {
    return speechRecognitionSupported();
  }
  /**
   * Escucha una sola frase. `result` recibe la transcripción más probable y todas las
   * alternativas del reconocedor, en orden de confianza.
   */
  start(
    language: string,
    result: (text: string, alternatives: string[]) => void,
    error: (text: string) => void,
    end: () => void,
  ) {
    this.abort();
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      error(DICTATION_UNSUPPORTED);
      return;
    }
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (e) => {
      const options = e.results[0];
      const alternatives = Array.from({ length: options?.length ?? 0 }, (_, i) =>
        (options[i]?.transcript ?? '').trim(),
      ).filter(Boolean);
      if (alternatives.length) result(alternatives[0], alternatives);
      recognition.stop();
    };
    recognition.onerror = (e) => {
      const message = recognitionErrorMessage(e.error);
      if (message) error(message);
    };
    recognition.onnomatch = () => error(errorMessages.nomatch);
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      end();
    };
    try {
      recognition.start();
    } catch {
      this.recognition = null;
      error('No pude iniciar el micrófono. Volvé a intentarlo.');
      end();
    }
  }
  /** Corta la escucha y descarta cualquier resultado que llegue tarde. */
  abort() {
    const recognition = this.recognition;
    if (!recognition) return;
    this.recognition = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onnomatch = null;
    recognition.onend = null;
    recognition.abort();
  }
  cancel() {
    this.abort();
  }
}
