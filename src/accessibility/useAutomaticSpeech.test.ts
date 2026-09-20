import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FocusEvent, FormEvent, PointerEvent } from 'react';
import { defaultPreferences } from '../types';
import { speech } from '../services/SpeechService';
import { describeElement, useAutomaticSpeech } from './useAutomaticSpeech';

const cleanup = vi.hoisted(() => [] as (() => void)[]);
vi.mock('react', () => ({
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => {
    const release = effect();
    if (release) cleanup.push(release);
  },
}));
vi.mock('../services/SpeechService', () => ({ speech: { hablar: vi.fn(), detener: vi.fn() } }));

class Element {
  tagName = 'P';
  textContent = '';
  parentElement: Element | null = null;
  ownerDocument = { getElementById: () => null };
  attributes: Record<string, string> = {};
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  closest(): Element | null {
    return this;
  }
  contains(other: Element) {
    return other === this;
  }
  querySelector(): Element | null {
    return null;
  }
}
class Input extends Element {
  labels = [];
  id = '';
  type = 'text';
  checked = false;
  value = '';
}
class Select extends Element {
  labels = [];
  value = 'rad';
  id = '';
  selectedOptions = [{ text: 'Radianes' }];
}
class TextArea extends Input {}
class Table extends Element {
  caption = { textContent: 'Resultado matricial' };
  tHead: { rows: { cells: Cell[] }[] } | null = null;
}
class Row extends Element {
  rowIndex = 0;
  cells: Cell[] = [];
}
class Cell extends Element {
  cellIndex = 0;
  table = new Table();
  override closest() {
    return this.table;
  }
}
const asElement = (element: Element) => element as unknown as HTMLElement;
const keyListeners = new Set<(event: KeyboardEvent) => void>();
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('HTMLInputElement', Input);
  vi.stubGlobal('HTMLSelectElement', Select);
  vi.stubGlobal('HTMLTextAreaElement', TextArea);
  vi.stubGlobal('HTMLTableCellElement', Cell);
  vi.stubGlobal('HTMLTableRowElement', Row);
  vi.stubGlobal('Node', Element);
  vi.stubGlobal('window', {
    addEventListener: (_type: string, fn: (event: KeyboardEvent) => void) => keyListeners.add(fn),
    removeEventListener: (_type: string, fn: (event: KeyboardEvent) => void) =>
      keyListeners.delete(fn),
  });
});
afterEach(() => {
  cleanup.splice(0).forEach((release) => release());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('lee estado y selección incluso cuando el control usa aria-label', () => {
  const checkbox = new Input();
  checkbox.attributes['aria-label'] = 'Leer al pasar el puntero';
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  expect(describeElement(asElement(checkbox))).toBe('Leer al pasar el puntero. Activado');
  const select = new Select();
  select.attributes['aria-label'] = 'Modo angular';
  expect(describeElement(asElement(select))).toBe('Modo angular: Radianes');
});
it('incluye coordenadas, encabezado y valor hablado de una celda', () => {
  const row = new Row();
  row.rowIndex = 2;
  const cell = new Cell();
  cell.parentElement = row;
  cell.cellIndex = 1;
  cell.textContent = '-1.5e-7';
  expect(describeElement(asElement(cell))).toBe(
    'Fila 3. Resultado matricial. Columna 2: menos 1 coma 5 por diez elevado a menos 7',
  );
  const header = new Cell();
  header.textContent = 'Desviación';
  cell.table.tHead = { rows: [{ cells: [new Cell(), header] }] };
  expect(describeElement(asElement(cell))).toContain('Desviación: menos 1');
});
it('lee cambios de selector después de que se actualizó su valor', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const select = new Select();
  select.attributes['aria-label'] = 'Modo angular';
  automatic.onChangeCapture({ target: select } as unknown as FormEvent<HTMLDivElement>);
  select.selectedOptions[0].text = 'Grados';
  vi.advanceTimersByTime(150);
  expect(speech.hablar).toHaveBeenCalledWith('Modo angular: Grados');
});
it('Escape cancela la lectura pendiente al pasar el puntero', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const element = new Element();
  element.textContent = 'Resumen estadístico';
  automatic.onPointerOver({
    target: element,
    pointerType: 'mouse',
    relatedTarget: null,
  } as unknown as PointerEvent<HTMLDivElement>);
  keyListeners.forEach((listener) => listener({ key: 'Escape' } as KeyboardEvent));
  vi.advanceTimersByTime(200);
  expect(speech.hablar).not.toHaveBeenCalled();
  expect(speech.detener).toHaveBeenCalledOnce();
});
it('suspende foco, puntero y cambios durante el dictado', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true }, true);
  const select = new Select();
  select.attributes['aria-label'] = 'Modo angular';
  automatic.onFocusCapture({ target: select } as unknown as FocusEvent<HTMLDivElement>);
  automatic.onPointerOver({
    target: select,
    pointerType: 'mouse',
    relatedTarget: null,
  } as unknown as PointerEvent<HTMLDivElement>);
  automatic.onChangeCapture({ target: select } as unknown as FormEvent<HTMLDivElement>);
  vi.advanceTimersByTime(300);
  expect(speech.hablar).not.toHaveBeenCalled();
});
