import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { explorerTree } from '../accessibility/expressionExplorer';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import type { DecimalSeparator } from '../types';

export interface PromptField {
  id: string;
  label: string;
  value?: string;
  /** Si es false, el campo puede quedar vacío. */
  required?: boolean;
  /** Una función de x o un número: cambia la ayuda y lo que se revisa antes de calcular. */
  kind?: 'expression' | 'number';
}

export interface PromptRequest {
  title: string;
  description: string;
  fields: PromptField[];
  submit: string;
  done: (values: Record<string, string>) => void;
}

/** Cómo se escribe cada tipo de dato, dicho para quien no ve la pantalla. */
const HINTS = {
  expression:
    'Escribila con el teclado, como en la calculadora: x^2 es equis al cuadrado, sqrt(x) la raíz, sin(x) el seno, 2*x dos por equis y pi es pi. Control más Enter lee lo que escribiste.',
  number:
    'Un número, por ejemplo 0, 3, -2 o 2.5; también vale pi o 1/2. Control más Enter lee lo que escribiste.',
};

/**
 * Diálogo de una tecla que necesita datos. Cada campo dice cómo se escribe, cada tecla se
 * escucha con la guía por voz, Control más Enter lee lo escrito y, antes de calcular, se revisa
 * que todo se pueda leer: si algo falta o no se entiende, se dice qué y el foco va a ese campo.
 */
export function KeyPrompt({
  request,
  close,
  announce,
  decimalSeparator = 'punto',
}: {
  request: PromptRequest;
  close: () => void;
  announce: (text: string) => void;
  decimalSeparator?: DecimalSeparator;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.fields.map((field) => [field.id, field.value ?? ''])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const spoken = (text: string) => (text.trim() ? mathSpeech(text, { decimalSeparator }) : 'vacío');

  /** Qué falta o qué no se entiende en un campo; vacío si está bien. */
  function problem(field: PromptField, raw: string): string {
    const text = raw.trim();
    if (!text) return field.required === false ? '' : `Falta completar ${field.label}.`;
    const tree = explorerTree(text, { decimalSeparator });
    if (!tree) return `No pude leer ${field.label}: revisá los paréntesis y los signos.`;
    if (field.kind !== 'expression' && /[a-z]/i.test(text.replace(/\b(pi|e)\b/gi, '')))
      return `${field.label} tiene que ser un número, sin letras.`;
    return '';
  }
  function readAll() {
    announce(
      request.fields
        .map((field) => `${field.label}: ${spoken(values[field.id] ?? '')}`)
        .join('. ') + '.',
    );
  }
  function onFieldKey(event: KeyboardEvent<HTMLInputElement>, field: PromptField) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      announce(`${field.label}: ${spoken(values[field.id] ?? '')}.`);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="key-prompt"
      aria-labelledby="key-prompt-title"
      aria-describedby="key-prompt-description"
      onCancel={close}
    >
      <h2 id="key-prompt-title">{request.title}</h2>
      <p id="key-prompt-description">{request.description}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const found = Object.fromEntries(
            request.fields.map((field) => [field.id, problem(field, values[field.id] ?? '')]),
          );
          setErrors(found);
          const first = request.fields.find((field) => found[field.id]);
          if (first) {
            announce(found[first.id]);
            dialog.current?.querySelector<HTMLInputElement>(`#key-prompt-${first.id}`)?.focus();
            return;
          }
          dialog.current?.close();
          request.done(values);
        }}
      >
        {request.fields.map((field, index) => {
          const kind = field.kind ?? 'number';
          const id = `key-prompt-${field.id}`;
          return (
            <div key={field.id} className="key-prompt-field">
              <label htmlFor={id}>{field.label}</label>
              <input
                id={id}
                autoFocus={index === 0}
                maxLength={500}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode={kind === 'number' ? 'decimal' : 'text'}
                aria-describedby={`${id}-hint${errors[field.id] ? ` ${id}-error` : ''}`}
                aria-invalid={errors[field.id] ? true : undefined}
                value={values[field.id] ?? ''}
                onKeyDown={(event) => onFieldKey(event, field)}
                onChange={(event) => {
                  setValues((previous) => ({ ...previous, [field.id]: event.target.value }));
                  if (errors[field.id]) setErrors((previous) => ({ ...previous, [field.id]: '' }));
                }}
              />
              <p className="hint" id={`${id}-hint`}>
                {HINTS[kind]}
              </p>
              {errors[field.id] && (
                <p className="field-error" id={`${id}-error`}>
                  {errors[field.id]}
                </p>
              )}
            </div>
          );
        })}
        <div className="actions">
          <button className="primary">{request.submit}</button>
          <button type="button" onClick={readAll}>
            Escuchar lo escrito
          </button>
          <button type="button" onClick={close}>
            Cancelar
          </button>
        </div>
      </form>
      {/* Avisos con el diálogo abierto: la región viva de la página queda inerte detrás. */}
      <p className="sr-only dialog-status" role="status" />
    </dialog>
  );
}
