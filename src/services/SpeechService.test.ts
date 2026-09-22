import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpeechService } from './SpeechService';
import { defaultPreferences } from '../types';

const speak = vi.fn(),
  cancel = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { speechSynthesis: { speak, cancel, getVoices: () => [] } });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

it('bloquea síntesis automática por defecto y permite una petición explícita', () => {
  const service = new SpeechService();
  expect(service.hablarAutomatico('Resultado')).toBe(false);
  expect(speak).not.toHaveBeenCalled();
  expect(service.hablar('Lectura solicitada')).toBe(true);
  expect(speak).toHaveBeenCalledOnce();
});
it('cambiar a lector externo detiene voz y bloquea callbacks automáticos tardíos', () => {
  const service = new SpeechService();
  service.configure({ ...defaultPreferences, guided: true });
  expect(service.hablarAutomatico('Guía')).toBe(true);
  service.configure({ ...defaultPreferences, guided: false });
  const calls = speak.mock.calls.length;
  expect(service.hablarAutomatico('Resultado tardío')).toBe(false);
  expect(speak.mock.calls).toHaveLength(calls);
  expect(cancel).toHaveBeenCalled();
});
