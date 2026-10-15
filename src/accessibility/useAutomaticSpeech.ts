import { useCallback, useEffect, useRef } from 'react';
import type { FormEvent, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import type { Preferences } from '../types';
import { speech } from '../services/SpeechService';
import { mathSpeech } from './MathSpeechFormatter';

const selector =
  'button, a, input, select, textarea, summary, h1, h2, h3, p, legend, label, li, dt, dd, td, th, tr, caption, output, [data-speech]';
const clean = (text: string | null | undefined) => text?.trim().replace(/\s+/g, ' ') ?? '';
const notTyped = ['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file'];
const modifiers = ['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS'];
function editable(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return !target.readOnly;
  if (target instanceof HTMLInputElement)
    return !target.readOnly && !notTyped.includes(target.type);
  return (target as HTMLElement | null)?.isContentEditable === true;
}
function expressionSpeech(value: string) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 1
    ? lines.map((line, index) => `Línea ${index + 1}: ${mathSpeech(line)}`).join('. ')
    : mathSpeech(value);
}
function cellDescription(cell: HTMLTableCellElement): string {
  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = cell.closest('table');
  const column = table?.tHead?.rows[0]?.cells[cell.cellIndex];
  const rowHeading = row?.querySelector('th[scope="row"]');
  const context = [
    clean(table?.caption?.textContent),
    rowHeading && rowHeading !== cell ? clean(rowHeading.textContent) : '',
    column && column !== cell ? clean(column.textContent) : `Columna ${cell.cellIndex + 1}`,
  ].filter(Boolean);
  const text = clean(cell.textContent);
  const numeric = /^[\s\d+\-−*/().eEi]+$/.test(text) && /\d/.test(text);
  return `Fila ${(row?.rowIndex ?? 0) + 1}. ${context.join('. ')}: ${numeric ? mathSpeech(text) : text}`;
}
export function describeElement(element: HTMLElement): string {
  const speechLabel = element.getAttribute('data-speech');
  if (speechLabel) return speechLabel;
  const explicit =
    element.getAttribute('aria-label') ||
    element
      .getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map((id) => clean(element.ownerDocument.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(' ');
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const label =
      explicit ||
      Array.from(element.labels ?? [])
        .map((l) => {
          const clone = l.cloneNode(true) as HTMLElement;
          // El valor visible de un deslizador va oculto en la etiqueta: se lee por aria-valuetext.
          clone
            .querySelectorAll('input, select, textarea, [aria-hidden="true"]')
            .forEach((node) => node.remove());
          return clean(clone.textContent);
        })
        .join(' ');
    if (element instanceof HTMLInputElement && element.type === 'checkbox')
      return `${label}. ${element.checked ? 'Activado' : 'Desactivado'}`;
    if (element instanceof HTMLInputElement && element.type === 'radio')
      return `${label}. ${element.checked ? 'Seleccionado' : 'No seleccionado'}`;
    if (element instanceof HTMLSelectElement)
      return `${label}: ${element.selectedOptions[0]?.text ?? ''}`;
    const spokenValue = element.getAttribute('aria-valuetext');
    if (spokenValue) return `${label}: ${spokenValue}`;
    // Matrix inputs already include coordinates and the current value in their label.
    if (explicit && /\bvalor\b/i.test(explicit)) return explicit;
    const expression = element.id === 'expression' || element.hasAttribute('data-expression');
    return `${label}. ${element.value ? (expression ? expressionSpeech(element.value) : element.value) : 'Vacío'}`;
  }
  if (explicit) return explicit;
  if (element instanceof HTMLTableCellElement) return cellDescription(element);
  if (element instanceof HTMLTableRowElement)
    return Array.from(element.cells).map(cellDescription).join('. ');
  const text = clean(element.textContent);
  if (element.tagName === 'SUMMARY')
    return `${text}. ${(element.parentElement as HTMLDetailsElement | null)?.open ? 'Expandido' : 'Contraído'}`;
  return text;
}

export function useAutomaticSpeech(preferences: Preferences, suspended = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef<{ element: HTMLElement | null; text: string; time: number }>({
    element: null,
    text: '',
    time: 0,
  });
  // Si la página se desplaza o cambia de vista bajo un puntero quieto, el navegador genera
  // «pointerover» sin que la persona mueva el ratón: eso no cuenta como pasar el puntero.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!preferences.guided || suspended) clearTimeout(timer.current);
  }, [preferences.guided, suspended]);
  function schedule(target: HTMLElement, delay: number) {
    cancel();
    // Una etiqueta se lee igual que su control, con su estado y su valor actual.
    const element = (target.tagName === 'LABEL' && (target as HTMLLabelElement).control) || target;
    if (speech.readingList && element.closest('[data-preserve-reading]')) return;
    const text = describeElement(element);
    if (!text) return;
    if (
      last.current.element === element &&
      last.current.text === text &&
      Date.now() - last.current.time < 700
    )
      return;
    timer.current = setTimeout(() => {
      // React may update labels and selected values after the capture event.
      const currentText = describeElement(element);
      last.current = { element, text: currentText, time: Date.now() };
      speech.hablarAutomatico(currentText);
    }, delay);
  }
  return {
    cancel,
    onFocusCapture(event: FocusEvent<HTMLDivElement>) {
      if (suspended || !preferences.guided || !preferences.readFocus) return;
      const element = (event.target as HTMLElement).closest<HTMLElement>(selector);
      if (element) schedule(element, 140);
    },
    onPointerOver(event: PointerEvent<HTMLDivElement>) {
      const position = { x: event.clientX, y: event.clientY };
      const still =
        Number.isFinite(position.x) &&
        pointer.current?.x === position.x &&
        pointer.current?.y === position.y;
      pointer.current = position;
      if (
        still ||
        suspended ||
        !preferences.guided ||
        !preferences.readHover ||
        event.pointerType === 'touch'
      )
        return;
      const element = (event.target as HTMLElement).closest<HTMLElement>(selector);
      if (
        element &&
        !(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
      )
        schedule(element, 180);
    },
    onPointerOut(event: PointerEvent<HTMLDivElement>) {
      const element = (event.target as HTMLElement).closest<HTMLElement>(selector);
      if (
        element &&
        !(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
      )
        cancel();
    },
    // Al empezar a escribir, la lectura pendiente del campo ya no sirve y taparía el eco.
    onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
      if (!modifiers.includes(event.key) && editable(event.target)) cancel();
    },
    onChangeCapture(event: FormEvent<HTMLDivElement>) {
      const element = event.target;
      if (editable(element)) {
        cancel();
        return;
      }
      if (suspended || !preferences.guided || !preferences.readFocus) return;
      if (
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLInputElement &&
          ['checkbox', 'radio', 'range'].includes(element.type))
      )
        schedule(element, 140);
    },
  };
}
