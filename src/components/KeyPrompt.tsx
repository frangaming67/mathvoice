import { useEffect, useRef, useState } from 'react';

export interface PromptField {
  id: string;
  label: string;
  value?: string;
  /** Si es false, el campo puede quedar vacío. */
  required?: boolean;
}

export interface PromptRequest {
  title: string;
  description: string;
  fields: PromptField[];
  submit: string;
  done: (values: Record<string, string>) => void;
}

/** Diálogo de una tecla que necesita datos: el primer campo recibe el foco y Enter confirma. */
export function KeyPrompt({ request, close }: { request: PromptRequest; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.fields.map((field) => [field.id, field.value ?? ''])),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
        onSubmit={(event) => {
          event.preventDefault();
          dialog.current?.close();
          request.done(values);
        }}
      >
        {request.fields.map((field, index) => (
          <label key={field.id}>
            {field.label}
            <input
              autoFocus={index === 0}
              required={field.required !== false}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              value={values[field.id] ?? ''}
              onChange={(event) =>
                setValues((previous) => ({ ...previous, [field.id]: event.target.value }))
              }
            />
          </label>
        ))}
        <div className="actions">
          <button className="primary">{request.submit}</button>
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
