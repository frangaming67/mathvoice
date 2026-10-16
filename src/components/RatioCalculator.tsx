import { useState } from 'react';
import type { DecimalSeparator } from '../types';

/** Las dos formas del modo Proporción: la incógnita en el tercer o en el cuarto lugar. */
const forms = {
  third: { label: 'A es a B como X es a D (A : B = X : D)', fields: ['A', 'B', 'D'] },
  fourth: { label: 'A es a B como C es a X (A : B = C : X)', fields: ['A', 'B', 'C'] },
} as const;
type Form = keyof typeof forms;

/** Un número suelto va tal cual; cualquier otra cosa, entre paréntesis. */
const group = (text: string) => (/^[\d.,]+$/.test(text.trim()) ? text.trim() : `(${text.trim()})`);

/**
 * Modo Proporción (la regla de tres): A es a B como X es a D. Se resuelve como la ecuación
 * A/B = X/D, así el resultado trae los pasos del despeje.
 */
export function RatioCalculator({
  calculate,
  busy,
  decimalSeparator = 'punto',
}: {
  calculate: (expression: string) => void;
  busy: boolean;
  decimalSeparator?: DecimalSeparator;
}) {
  const [form, setForm] = useState<Form>('third');
  const [values, setValues] = useState<string[]>(['3', '4', '8']);
  const separator = decimalSeparator === 'coma' ? '; ' : ', ';
  return (
    <section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const [a, b, c] = values.map(group);
          const equation = form === 'third' ? `${a}/${b} = X/${c}` : `${a}/${b} = ${c}/X`;
          calculate(`solve(${equation}${separator}X)`);
        }}
      >
        <label>
          Forma de la proporción
          <select value={form} onChange={(event) => setForm(event.target.value as Form)}>
            {(Object.keys(forms) as Form[]).map((key) => (
              <option key={key} value={key}>
                {forms[key].label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-pair">
          {forms[form].fields.map((name, i) => (
            <label key={name}>
              {name}
              <input
                required
                autoComplete="off"
                value={values[i]}
                onChange={(event) =>
                  setValues(values.map((value, j) => (i === j ? event.target.value : value)))
                }
              />
            </label>
          ))}
        </div>
        <p className="hint">
          La regla de tres: si 3 es a 4 como X es a 8, X vale 6. También acepta fracciones,
          decimales y negativos.
        </p>
        <button className="primary" aria-disabled={busy}>
          Calcular X
        </button>
      </form>
    </section>
  );
}
