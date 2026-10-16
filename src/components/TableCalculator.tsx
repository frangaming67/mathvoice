import { useState } from 'react';
import type { DecimalSeparator } from '../types';

/**
 * Modo Tabla de la calculadora de mano: f(x), y si se quiere g(x), desde un x hasta otro con
 * un paso fijo. El resultado es una tabla con encabezados que se recorre con el lector.
 */
export function TableCalculator({
  calculate,
  busy,
  decimalSeparator = 'punto',
}: {
  calculate: (expression: string) => void;
  busy: boolean;
  decimalSeparator?: DecimalSeparator;
}) {
  const [f, setF] = useState('x^2');
  const [g, setG] = useState('');
  const [from, setFrom] = useState('-3');
  const [to, setTo] = useState('3');
  const [step, setStep] = useState('1');
  const separator = decimalSeparator === 'coma' ? '; ' : ', ';
  const field = (value: string, set: (value: string) => void) => ({
    value,
    spellCheck: false,
    autoComplete: 'off',
    autoCapitalize: 'off',
    onChange: (event: { target: { value: string } }) => set(event.target.value),
  });
  return (
    <section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const functions = [f, g].map((text) => text.trim()).filter(Boolean);
          calculate(
            `table(${[...functions, from.trim(), to.trim(), step.trim()].join(separator)})`,
          );
        }}
      >
        <label>
          f(x) =
          <input required {...field(f, setF)} />
        </label>
        <label>
          g(x) = (opcional)
          <input {...field(g, setG)} />
        </label>
        <div className="field-pair">
          <label>
            Desde x igual a
            <input required {...field(from, setFrom)} />
          </label>
          <label>
            Hasta x igual a
            <input required {...field(to, setTo)} />
          </label>
          <label>
            Paso
            <input required {...field(step, setStep)} />
          </label>
        </div>
        <p className="hint">
          Como el modo Tabla de la calculadora de mano: para cada x se calcula f(x) y, si la
          escribiste, g(x). Hasta 50 filas; si el final es menor que el inicio, usá un paso
          negativo. La tabla tiene encabezados: recorrela con los comandos de tabla de tu lector.
        </p>
        <button className="primary" aria-disabled={busy}>
          Calcular tabla
        </button>
      </form>
    </section>
  );
}
