import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleKeyboard } from './KeyboardManager';

class Target {
  focus = vi.fn();
}
class Details extends Target {
  open = false;
  summary = new Target();
  querySelector = () => this.summary;
}
class Button extends Target {
  disabled = false;
  click = vi.fn();
}
const targets = new Map<string, Target>();
let modal = false;
const actions = { stop: vi.fn(), read: vi.fn(), help: vi.fn(), symbolic: vi.fn() };
function press(key: string, overrides: Partial<KeyboardEvent> = {}) {
  const event = {
    key,
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
  handleKeyboard(event as unknown as KeyboardEvent, actions);
  return event;
}
beforeEach(() => {
  vi.clearAllMocks();
  targets.clear();
  modal = false;
  vi.stubGlobal('HTMLDetailsElement', Details);
  vi.stubGlobal('HTMLButtonElement', Button);
  vi.stubGlobal('document', {
    getElementById: (id: string) => targets.get(id) ?? null,
    querySelector: () => (modal ? {} : null),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('abre gráficos y matrices y coloca el foco en su resumen', () => {
  for (const [key, id] of [
    ['g', 'graphs'],
    ['M', 'matrices'],
  ]) {
    const details = new Details();
    targets.set(id, details);
    expect(press(key).preventDefault).toHaveBeenCalledOnce();
    expect(details.open).toBe(true);
    expect(details.summary.focus).toHaveBeenCalledOnce();
  }
});
it('solicita derivadas y límites sin interceptar atajos reservados del navegador', () => {
  press('d');
  expect(press('i').preventDefault).not.toHaveBeenCalled();
  expect(press('t').preventDefault).not.toHaveBeenCalled();
  press('l');
  expect(actions.symbolic.mock.calls).toEqual([['diff'], ['limit']]);
  const browser = press('l', { ctrlKey: true, altKey: false, shiftKey: false });
  expect(browser.preventDefault).not.toHaveBeenCalled();
});
it('inicia dictado una sola vez y respeta botones deshabilitados', () => {
  const button = new Button();
  targets.set('dictation-button', button);
  press('v');
  press('v', { repeat: true });
  expect(button.click).toHaveBeenCalledOnce();
  expect(button.focus).toHaveBeenCalledOnce();
  button.disabled = true;
  expect(press('v').preventDefault).not.toHaveBeenCalled();
  expect(button.click).toHaveBeenCalledOnce();
});
it('mantiene el foco del diálogo y permite detener la voz con Escape', () => {
  modal = true;
  const target = new Target();
  targets.set('result-title', target);
  expect(press('r').preventDefault).not.toHaveBeenCalled();
  press('d');
  expect(target.focus).not.toHaveBeenCalled();
  expect(actions.symbolic).not.toHaveBeenCalled();
  press('Escape', { altKey: false, shiftKey: false });
  expect(actions.stop).toHaveBeenCalledOnce();
});
it('conserva los accesos a resultados e historial sin capturar destinos ausentes', () => {
  const target = new Target();
  targets.set('history-title', target);
  press('h');
  expect(target.focus).toHaveBeenCalledOnce();
  expect(press('r').preventDefault).not.toHaveBeenCalled();
});
