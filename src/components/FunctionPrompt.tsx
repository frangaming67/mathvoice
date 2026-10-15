import { useEffect, useRef, useState } from 'react';
import type { MathCommand } from '../keyboard/commands';
import { fillFunctionTemplate } from '../keyboard/functionTemplate';
export function FunctionPrompt({
  command,
  close,
  insert,
}: {
  command: MathCommand;
  close: () => void;
  insert: (expression: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<string[]>([]);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  if (command.action.type !== 'function') return null;
  const action = command.action;
  return (
    <dialog ref={dialog} aria-labelledby="function-prompt-title" onCancel={close}>
      <h2 id="function-prompt-title">{command.name}</h2>
      <p>
        Completá los argumentos. Se insertará la función para que puedas revisarla antes de
        calcular.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const expression = fillFunctionTemplate(action.expression, values);
          dialog.current?.close();
          insert(expression);
        }}
      >
        {action.fields.map((field, index) => (
          <label key={field}>
            {field}
            <input
              autoFocus={index === 0}
              required
              maxLength={500}
              value={values[index] ?? ''}
              onChange={(event) =>
                setValues((previous) => {
                  const next = [...previous];
                  next[index] = event.target.value;
                  return next;
                })
              }
            />
          </label>
        ))}
        <div className="actions">
          <button>Insertar en expresión</button>
          <button type="button" onClick={close}>
            Cancelar función
          </button>
        </div>
      </form>
      {/* Avisos con el diálogo abierto: la región viva de la página queda inerte detrás. */}
      <p className="sr-only dialog-status" role="status" />
    </dialog>
  );
}
