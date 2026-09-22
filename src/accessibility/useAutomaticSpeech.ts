import { useCallback, useEffect, useRef } from 'react';
import type { FormEvent, FocusEvent, PointerEvent } from 'react';
import type { Preferences } from '../types';
import { speech } from '../services/SpeechService';
import { mathSpeech } from './MathSpeechFormatter';

const selector =
  'button, a, input, select, textarea, summary, h1, h2, h3, p, legend, label, li, dt, dd, td, th, tr, caption, output, [data-speech]';
const clean = (text: string | null | undefined) => text?.trim().replace(/\s+/g, ' ') ?? '';
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
          clone.querySelectorAll('input, select, textarea').forEach((control) => control.remove());
          return clone.textContent?.trim();
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
    return `${label}. ${element.value ? (element.id === 'expression' ? mathSpeech(element.value) : element.value) : 'Vacío'}`;
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
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  useEffect(() => {
    const stop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearTimeout(timer.current);
        speech.detener();
      }
    };
    window.addEventListener('keydown', stop);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('keydown', stop);
    };
  }, []);
  useEffect(() => {
    if (!preferences.guided || suspended) clearTimeout(timer.current);
  }, [preferences.guided, suspended]);
  function schedule(element: HTMLElement, delay: number) {
    cancel();
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
      if (
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
    onChangeCapture(event: FormEvent<HTMLDivElement>) {
      if (suspended || !preferences.guided || !preferences.readFocus) return;
      const element = event.target;
      if (
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLInputElement &&
          ['checkbox', 'radio', 'range'].includes(element.type))
      )
        schedule(element, 140);
    },
  };
}
