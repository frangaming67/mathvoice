import { useEffect, useRef } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import type { Preferences } from '../types';
import { speech } from '../services/SpeechService';
import { mathSpeech } from './MathSpeechFormatter';

const selector =
  'button, a, input, select, textarea, summary, h1, h2, h3, p, legend, [data-speech]';
export function describeElement(element: HTMLElement): string {
  const explicit = element.getAttribute('data-speech') || element.getAttribute('aria-label');
  if (explicit) return explicit;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const label = Array.from(element.labels ?? [])
      .map((l) => {
        const clone = l.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, select, textarea').forEach((control) => control.remove());
        return clone.textContent?.trim();
      })
      .join(' ');
    if (element instanceof HTMLInputElement && element.type === 'checkbox')
      return `${label}. ${element.checked ? 'Activado' : 'Desactivado'}`;
    if (element instanceof HTMLSelectElement)
      return `${label}: ${element.selectedOptions[0]?.text ?? ''}`;
    return `${label}. ${element.value ? (element.id === 'expression' ? mathSpeech(element.value) : element.value) : 'Vacío'}`;
  }
  return element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

export function useAutomaticSpeech(preferences: Preferences) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef<{ element: HTMLElement | null; text: string; time: number }>({
    element: null,
    text: '',
    time: 0,
  });
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
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
    if (!preferences.guided) clearTimeout(timer.current);
  }, [preferences.guided]);
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
      last.current = { element, text, time: Date.now() };
      speech.hablar(text);
    }, delay);
  }
  return {
    cancel,
    onFocusCapture(event: FocusEvent<HTMLDivElement>) {
      if (!preferences.guided || !preferences.readFocus) return;
      const element = (event.target as HTMLElement).closest<HTMLElement>(selector);
      if (element) schedule(element, 140);
    },
    onPointerOver(event: PointerEvent<HTMLDivElement>) {
      if (!preferences.guided || !preferences.readHover || event.pointerType === 'touch') return;
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
  };
}
