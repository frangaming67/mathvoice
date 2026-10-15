import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  FocusEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent,
} from 'react';
import { defaultPreferences } from '../types';
import { speech } from '../services/SpeechService';
import { mathSpeech } from './MathSpeechFormatter';
import { describeElement, useAutomaticSpeech } from './useAutomaticSpeech';

const cleanup = vi.hoisted(() => [] as (() => void)[]);
vi.mock('react', () => ({
  useCallback: (callback: () => void) => callback,
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => {
    const release = effect();
    if (release) cleanup.push(release);
  },
}));
vi.mock('../services/SpeechService', () => ({
  speech: { hablarAutomatico: vi.fn(), detener: vi.fn() },
}));

class Element {
  tagName = 'P';
  textContent = '';
  parentElement: Element | null = null;
  ownerDocument = { getElementById: () => null };
  attributes: Record<string, string> = {};
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string) {
    return name in this.attributes;
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
type LabelPart = { text: string; hidden?: boolean; control?: boolean; removed?: boolean };
class Label {
  constructor(private parts: LabelPart[]) {}
  cloneNode() {
    const parts = this.parts.map((part) => ({ ...part }));
    return {
      querySelectorAll: (selector: string) =>
        parts
          .filter(
            (part) =>
              (part.control && selector.includes('input')) ||
              (part.hidden && selector.includes('[aria-hidden="true"]')),
          )
          .map((part) => ({ remove: () => (part.removed = true) })),
      get textContent() {
        return parts
          .filter((part) => !part.removed)
          .map((part) => part.text)
          .join('');
      },
    };
  }
}
class Input extends Element {
  labels: Label[] = [];
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
    'Fila 3. Resultado matricial. Columna 2: menos 1 coma 5 por diez a la menos 7',
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
  expect(speech.hablarAutomatico).toHaveBeenCalledWith('Modo angular: Grados');
});
it('el gestor puede cancelar la lectura pendiente al pasar el puntero', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const element = new Element();
  element.textContent = 'Resumen estadístico';
  automatic.onPointerOver({
    target: element,
    pointerType: 'mouse',
    relatedTarget: null,
  } as unknown as PointerEvent<HTMLDivElement>);
  automatic.cancel();
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).not.toHaveBeenCalled();
  expect(keyListeners.size).toBe(0);
});
it('no lee lo que queda bajo un puntero quieto cuando la página se desplaza', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const link = new Element();
  link.textContent = 'Configuración';
  const select = new Select();
  select.attributes['aria-label'] = 'Escala general';
  const over = (target: Element, x: number, y: number) =>
    automatic.onPointerOver({
      target,
      pointerType: 'mouse',
      relatedTarget: null,
      clientX: x,
      clientY: y,
    } as unknown as PointerEvent<HTMLDivElement>);
  over(link, 40, 20);
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).toHaveBeenLastCalledWith('Configuración');
  // Mismo lugar, otro elemento: lo movió el desplazamiento, no la persona.
  over(select, 40, 20);
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).toHaveBeenCalledOnce();
  over(select, 42, 21);
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).toHaveBeenLastCalledWith('Escala general: Radianes');
});
it('lee con mathSpeech el valor de cualquier campo de expresión', () => {
  const graph = new TextArea();
  graph.labels = [new Label([{ text: 'Funciones de x, una por línea (hasta 4)' }])];
  graph.attributes['data-expression'] = 'true';
  graph.value = 'x^2';
  expect(describeElement(asElement(graph))).toBe(
    `Funciones de x, una por línea (hasta 4). ${mathSpeech('x^2')}`,
  );
  graph.value = 'x^2\n\nsin(x)\n';
  expect(describeElement(asElement(graph))).toBe(
    `Funciones de x, una por línea (hasta 4). Línea 1: ${mathSpeech('x^2')}. Línea 2: ${mathSpeech('sin(x)')}`,
  );
  const plain = new Input();
  plain.attributes['aria-label'] = 'Nombre de la variable';
  plain.value = 'x^2';
  expect(describeElement(asElement(plain))).toBe('Nombre de la variable. x^2');
});
it('el deslizador se nombra con su etiqueta fija y se lee con aria-valuetext', () => {
  const slider = new Input();
  slider.type = 'range';
  slider.value = '1.1';
  slider.attributes['aria-valuetext'] = '1,1 veces';
  slider.labels = [
    new Label([
      { text: 'Velocidad ' },
      { text: '1.1×', hidden: true },
      { text: '', control: true },
    ]),
  ];
  expect(describeElement(asElement(slider))).toBe('Velocidad: 1,1 veces');
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const label = Object.assign(new Element(), {
    tagName: 'LABEL',
    textContent: 'Velocidad: 1.1×',
    control: slider,
  });
  automatic.onPointerOver({
    target: label,
    pointerType: 'mouse',
    relatedTarget: null,
  } as unknown as PointerEvent<HTMLDivElement>);
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).toHaveBeenCalledWith('Velocidad: 1,1 veces');
  automatic.onPointerOver({
    target: slider,
    pointerType: 'mouse',
    relatedTarget: label,
  } as unknown as PointerEvent<HTMLDivElement>);
  vi.advanceTimersByTime(200);
  expect(speech.hablarAutomatico).toHaveBeenCalledOnce();
});
it('la primera tecla en un campo editable cancela la lectura pendiente del foco', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const field = new Input();
  field.attributes['aria-label'] = 'Expresión matemática';
  automatic.onFocusCapture({ target: field } as unknown as FocusEvent<HTMLDivElement>);
  automatic.onKeyDownCapture({
    target: field,
    key: 's',
  } as unknown as ReactKeyboardEvent<HTMLDivElement>);
  field.value = 's';
  vi.advanceTimersByTime(300);
  expect(speech.hablarAutomatico).not.toHaveBeenCalled();
});
it('escribir o pegar en un campo editable cancela la lectura pendiente del puntero', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const field = new TextArea();
  field.attributes['aria-label'] = 'Funciones de x';
  field.attributes['data-expression'] = 'true';
  automatic.onPointerOver({
    target: field,
    pointerType: 'mouse',
    relatedTarget: null,
  } as unknown as PointerEvent<HTMLDivElement>);
  field.value = 'x^';
  automatic.onChangeCapture({ target: field } as unknown as FormEvent<HTMLDivElement>);
  vi.advanceTimersByTime(300);
  expect(speech.hablarAutomatico).not.toHaveBeenCalled();
});
it('las teclas modificadoras y los controles no editables conservan la lectura', () => {
  const automatic = useAutomaticSpeech({ ...defaultPreferences, guided: true });
  const field = new Input();
  field.attributes['aria-label'] = 'Expresión matemática';
  automatic.onFocusCapture({ target: field } as unknown as FocusEvent<HTMLDivElement>);
  automatic.onKeyDownCapture({
    target: field,
    key: 'Shift',
  } as unknown as ReactKeyboardEvent<HTMLDivElement>);
  vi.advanceTimersByTime(150);
  expect(speech.hablarAutomatico).toHaveBeenLastCalledWith('Expresión matemática. Vacío');
  const checkbox = new Input();
  checkbox.type = 'checkbox';
  checkbox.attributes['aria-label'] = 'Leer teclas escritas';
  automatic.onFocusCapture({ target: checkbox } as unknown as FocusEvent<HTMLDivElement>);
  automatic.onKeyDownCapture({
    target: checkbox,
    key: ' ',
  } as unknown as ReactKeyboardEvent<HTMLDivElement>);
  vi.advanceTimersByTime(150);
  expect(speech.hablarAutomatico).toHaveBeenLastCalledWith('Leer teclas escritas. Desactivado');
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
  expect(speech.hablarAutomatico).not.toHaveBeenCalled();
});
