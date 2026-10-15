import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpeechService, pointerHint } from './SpeechService';
import { defaultPreferences } from '../types';

const speak = vi.fn(),
  cancel = vi.fn(),
  pause = vi.fn(),
  resume = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    speechSynthesis: { speak, cancel, pause, resume, getVoices: () => [] },
  });
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

it('lee la lista por elementos y mantiene el índice al pausar entre mensajes', () => {
  const service = new SpeechService();
  const index = vi.fn();
  service.hablarLista(['Primero', 'Segundo', 'Tercero'], index);
  expect(speak.mock.calls[0][0].text).toBe('Primero');
  service.pausar();
  speak.mock.calls[0][0].onend();
  expect(speak).toHaveBeenCalledTimes(1);
  service.continuar();
  expect(speak.mock.calls[1][0].text).toBe('Segundo');
  expect(index.mock.calls).toEqual([[0], [1]]);
  speak.mock.calls[1][0].onend();
  speak.mock.calls[2][0].onend();
  expect(index.mock.calls).toEqual([[0], [1], [2]]);
  expect(service.readingList).toBe(false);
});

it('detener o reemplazar una lista invalida sus callbacks tardíos', () => {
  const service = new SpeechService();
  service.hablarLista(['Primero', 'Segundo'], vi.fn());
  const first = speak.mock.calls[0][0];
  service.pausar();
  service.hablar('Otra lectura');
  first.onend();
  first.onerror();
  expect(speak.mock.calls.map(([utterance]) => utterance.text)).toEqual([
    'Primero',
    'Otra lectura',
  ]);
  expect(resume).toHaveBeenCalledOnce();
  expect(service.readingList).toBe(false);
});

it('el lector externo y los errores detienen una lista sin continuarla', () => {
  const service = new SpeechService();
  service.hablarLista(['Primero', 'Segundo'], vi.fn());
  const first = speak.mock.calls[0][0];
  service.configure({ ...defaultPreferences, guided: false });
  first.onend();
  expect(speak).toHaveBeenCalledTimes(1);
  service.hablarLista(['Nuevo', 'Último'], vi.fn());
  const next = speak.mock.calls[1][0];
  next.onerror();
  next.onend();
  expect(speak).toHaveBeenCalledTimes(2);
  expect(service.readingList).toBe(false);
});

it('unlock emite una sola locución silenciosa para habilitar la síntesis en iOS', () => {
  const service = new SpeechService();
  expect(service.unlock()).toBe(true);
  expect(speak).toHaveBeenCalledOnce();
  expect(speak.mock.calls[0][0]).toMatchObject({ text: '', volume: 0 });
  expect(cancel).not.toHaveBeenCalled();
  expect(service.unlock()).toBe(false);
  expect(speak).toHaveBeenCalledOnce();
});
it('unlock no hace nada sin síntesis de voz', () => {
  vi.stubGlobal('window', {});
  expect(new SpeechService().unlock()).toBe(false);
});
it('la pista de bienvenida no pide pasar el puntero en pantallas táctiles', () => {
  const media = (hover: boolean) =>
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query === '(hover: none)' && !hover }),
    });
  media(true);
  expect(pointerHint()).toBe('Pasá el puntero sobre cualquier control para escucharlo.');
  media(false);
  expect(pointerHint()).toBe('Al tocar un campo, se lee su nombre.');
  vi.stubGlobal('window', {});
  expect(pointerHint()).toBe('Pasá el puntero sobre cualquier control para escucharlo.');
});
