import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DICTATION_UNSUPPORTED,
  VoiceRecognitionService,
  recognitionErrorMessage,
  speechRecognitionSupported,
} from './VoiceRecognitionService';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  maxAlternatives = 1;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onnomatch: (() => void) | null = null;
  onend: (() => void) | null = null;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
  }
}

describe('VoiceRecognitionService', () => {
  beforeEach(() => vi.stubGlobal('window', { SpeechRecognition: FakeRecognition }));
  afterEach(() => vi.unstubAllGlobals());

  it('entrega la transcripción y todas las alternativas', () => {
    const result = vi.fn(),
      end = vi.fn();
    new VoiceRecognitionService().start('es-AR', result, vi.fn(), end);
    expect(FakeRecognition.last.lang).toBe('es-AR');
    expect(FakeRecognition.last.maxAlternatives).toBe(3);
    FakeRecognition.last.onresult?.({
      results: [[{ transcript: ' seno de x ' }, { transcript: 'seno de equis' }]],
    });
    expect(result).toHaveBeenCalledWith('seno de x', ['seno de x', 'seno de equis']);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('abort corta el micrófono y descarta un resultado tardío', () => {
    const result = vi.fn();
    const service = new VoiceRecognitionService();
    service.start('es-AR', result, vi.fn(), vi.fn());
    const recognition = FakeRecognition.last;
    service.abort();
    expect(recognition.aborted).toBe(true);
    expect(recognition.onresult).toBeNull();
    expect(result).not.toHaveBeenCalled();
  });
  it('avisa con un mensaje específico cada error', () => {
    const error = vi.fn();
    new VoiceRecognitionService().start('es-AR', vi.fn(), error, vi.fn());
    FakeRecognition.last.onerror?.({ error: 'audio-capture' });
    FakeRecognition.last.onerror?.({ error: 'aborted' });
    FakeRecognition.last.onnomatch?.();
    expect(error.mock.calls).toEqual([
      ['No se encontró micrófono. Conectá uno y volvé a intentar.'],
      ['No entendí lo que dijiste. Volvé a intentar.'],
    ]);
  });
  it('sin reconocimiento de voz avisa que el navegador no lo ofrece', () => {
    vi.stubGlobal('window', {});
    const error = vi.fn();
    expect(speechRecognitionSupported()).toBe(false);
    new VoiceRecognitionService().start('es-AR', vi.fn(), error, vi.fn());
    expect(error).toHaveBeenCalledWith(DICTATION_UNSUPPORTED);
  });
});

it.each([
  ['not-allowed', 'No se permitió usar el micrófono. Revisá el permiso del navegador.'],
  [
    'service-not-allowed',
    'No se permitió usar el micrófono. El navegador bloquea el dictado en esta página.',
  ],
  ['audio-capture', 'No se encontró micrófono. Conectá uno y volvé a intentar.'],
  ['network', 'El dictado necesita conexión a internet. Revisá la conexión y volvé a intentar.'],
  [
    'language-not-supported',
    'El navegador no reconoce voz en este idioma. Probá con otro idioma en Ajustes.',
  ],
  ['no-speech', 'No se detectó voz. Volvé a intentar.'],
  ['bad-grammar', 'El navegador no pudo completar el dictado. Volvé a intentar.'],
  ['aborted', null],
])('recognitionErrorMessage(%s)', (code, message) =>
  expect(recognitionErrorMessage(code)).toBe(message),
);
