import { useState } from 'react';
import { unitCategories } from '../services/ConversionService';
export function Converters({ calculate, busy }: { calculate: (e: string) => void; busy: boolean }) {
  const [category, setCategory] = useState('Longitud'),
    [from, setFrom] = useState('km'),
    [to, setTo] = useState('mi'),
    [value, setValue] = useState('100');
  const [number, setNumber] = useState('FF'),
    [baseFrom, setBaseFrom] = useState('16'),
    [baseTo, setBaseTo] = useState('10');
  const [op, setOp] = useState('and'),
    [a, setA] = useState('12'),
    [b, setB] = useState('10'),
    [width, setWidth] = useState('32');
  return (
    <section aria-labelledby="conversions-title">
      <h2 id="conversions-title">Conversores</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(`convert(${value},${JSON.stringify(from)},${JSON.stringify(to)})`);
        }}
      >
        <fieldset>
          <legend>Unidades</legend>
          <label>
            Categoría de unidades
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setFrom(unitCategories[e.target.value][0][0]);
                setTo(unitCategories[e.target.value][1][0]);
              }}
            >
              {Object.keys(unitCategories).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Valor a convertir
            <input
              type="number"
              step="any"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <div className="field-pair">
            <label>
              Unidad de origen
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {unitCategories[category].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unidad de destino
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {unitCategories[category].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary" aria-disabled={busy}>
            Convertir unidades
          </button>
        </fieldset>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(`base(${JSON.stringify(number)},${baseFrom},${baseTo})`);
        }}
      >
        <fieldset>
          <legend>Bases numéricas</legend>
          <label>
            Número entero
            <input required value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <div className="field-pair">
            <label>
              Base de origen
              <select value={baseFrom} onChange={(e) => setBaseFrom(e.target.value)}>
                {[2, 8, 10, 16].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Base de destino
              <select value={baseTo} onChange={(e) => setBaseTo(e.target.value)}>
                {[2, 8, 10, 16].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <button aria-disabled={busy}>Convertir base</button>
        </fieldset>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(
            `bitop(${JSON.stringify(op)},${JSON.stringify(a)},${JSON.stringify(b)},${width})`,
          );
        }}
      >
        <fieldset>
          <legend>Operaciones binarias sin signo</legend>
          <div className="field-pair">
            <label>
              Operación binaria
              <select value={op} onChange={(e) => setOp(e.target.value)}>
                {[
                  ['and', 'AND'],
                  ['or', 'OR'],
                  ['xor', 'XOR'],
                  ['not', 'NOT'],
                  ['left', 'Desplazar a izquierda'],
                  ['right', 'Desplazar a derecha'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ancho de bits
              <select value={width} onChange={(e) => setWidth(e.target.value)}>
                {[8, 16, 32, 64].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Entero A en decimal
              <input required value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            {op !== 'not' && (
              <label>
                {['left', 'right'].includes(op) ? 'Cantidad de posiciones' : 'Entero B en decimal'}
                <input required value={b} onChange={(e) => setB(e.target.value)} />
              </label>
            )}
          </div>
          <p className="hint">
            Los resultados se ajustan al ancho elegido; los bits sobrantes se descartan.
          </p>
          <button aria-disabled={busy}>Calcular operación binaria</button>
        </fieldset>
      </form>
    </section>
  );
}
