import { useState } from 'react';
export function VectorComplexCalculator({
  calculate,
  busy,
}: {
  calculate: (e: string) => void;
  busy: boolean;
}) {
  const [a, setA] = useState('1,2,3');
  const [b, setB] = useState('4,5,6');
  const [op, setOp] = useState('dot');
  const [z, setZ] = useState('3+4*i');
  const [cop, setCop] = useState('abs');
  const [power, setPower] = useState('2');
  return (
    <section aria-labelledby="vectors-title">
      <h2 id="vectors-title">Vectores y complejos</h2>
      <div className="tool-columns">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            calculate(`${op}([${a}]${['norm', 'normalize'].includes(op) ? '' : `,[${b}]`})`);
          }}
        >
          <fieldset>
            <legend>Vectores</legend>
            <label>
              Operación vectorial
              <select value={op} onChange={(e) => setOp(e.target.value)}>
                {[
                  ['norm', 'Módulo'],
                  ['normalize', 'Normalizar'],
                  ['dot', 'Producto punto'],
                  ['cross', 'Producto cruz'],
                  ['vectorangle', 'Ángulo en radianes'],
                  ['distance', 'Distancia'],
                  ['add', 'Suma'],
                  ['subtract', 'Resta'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vector A, valores separados por comas
              <input required value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            {!['norm', 'normalize'].includes(op) && (
              <label>
                Vector B, valores separados por comas
                <input required value={b} onChange={(e) => setB(e.target.value)} />
              </label>
            )}
            <button className="primary" aria-disabled={busy}>
              Calcular vector
            </button>
          </fieldset>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            calculate(
              cop === 'power'
                ? `(${z})^(${power})`
                : cop === 'root'
                  ? `(${z})^(1/(${power}))`
                  : cop === 'nthRoots'
                    ? `nthRoots(${z},${power})`
                    : `${cop}(${z})`,
            );
          }}
        >
          <fieldset>
            <legend>Números complejos</legend>
            <label>
              Número complejo
              <input required value={z} onChange={(e) => setZ(e.target.value)} />
            </label>
            <label>
              Operación compleja
              <select value={cop} onChange={(e) => setCop(e.target.value)}>
                {[
                  ['abs', 'Módulo'],
                  ['arg', 'Argumento en radianes'],
                  ['polar', 'Forma polar'],
                  ['conj', 'Conjugado'],
                  ['re', 'Parte real'],
                  ['im', 'Parte imaginaria'],
                  ['power', 'Potencia'],
                  ['root', 'Raíz principal'],
                  ['nthRoots', 'Todas las raíces de índice n'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {['power', 'root', 'nthRoots'].includes(cop) && (
              <label>
                Exponente o índice
                <input
                  type="number"
                  min={cop !== 'power' ? 1 : undefined}
                  max={cop === 'nthRoots' ? 32 : undefined}
                  required
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                />
              </label>
            )}
            <p className="hint">
              Podés elegir la raíz principal o todas las raíces. Escribí rect(módulo, argumento)
              para pasar de polar a rectangular.
            </p>
            <button className="primary" aria-disabled={busy}>
              Calcular complejo
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
