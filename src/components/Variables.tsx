import { useState } from 'react';
export function Variables({
  values,
  calculate,
  remove,
  insert,
}: {
  values: Record<string, number>;
  calculate: (e: string) => void;
  remove: (name: string) => void;
  insert: (s: string) => void;
}) {
  const [name, setName] = useState('radio');
  const [value, setValue] = useState('7');
  return (
    <section aria-labelledby="variables-title">
      <h2 id="variables-title">Variables</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(`${name}=${value}`);
        }}
      >
        <div className="field-pair">
          <label>
            Nombre de variable
            <input
              required
              pattern="[a-zA-Z][a-zA-Z0-9_]{0,19}"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Valor o expresión
            <input required value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        <button>Guardar variable</button>
      </form>
      <p className="hint">
        Se guardan números reales. También podés escribir radio = 7 y después pi * radio^2. Guardar
        un nombre existente reemplaza su valor.
      </p>
      <ul>
        {Object.entries(values).map(([key, v]) => (
          <li key={key}>
            <span data-speech={`${key} igual a ${v}`}>
              {key} = {v}
            </span>
            <div className="actions">
              <button onClick={() => insert(key)}>Insertar {key}</button>
              <button onClick={() => remove(key)}>Eliminar {key}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
