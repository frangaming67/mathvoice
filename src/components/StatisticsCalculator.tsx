import { useState } from 'react';
export function StatisticsCalculator({
  calculate,
  busy,
}: {
  calculate: (e: string) => void;
  busy: boolean;
}) {
  const [data, setData] = useState('1,2,3,4,5');
  const [y, setY] = useState('2,4,6,8,10');
  const [op, setOp] = useState('stats');
  const [sample, setSample] = useState(true);
  const [percentile, setPercentile] = useState('90');
  const paired = ['regression', 'covariance', 'correlation'].includes(op);
  return (
    <section aria-labelledby="stats-title">
      <h2 id="stats-title">Estadística</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(
            `${op}([${data}]${paired ? `,[${y}]` : op === 'stats' ? `,${sample ? 1 : 0}` : op === 'percentile' ? `,${percentile}` : ''})`,
          );
        }}
      >
        <label>
          Datos X, separados por comas
          <textarea rows={3} required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Análisis estadístico
          <select value={op} onChange={(e) => setOp(e.target.value)}>
            {[
              ['stats', 'Resumen estadístico completo'],
              ['percentile', 'Percentil'],
              ['covariance', 'Covarianza muestral'],
              ['correlation', 'Correlación de Pearson'],
              ['regression', 'Regresión lineal'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {op === 'stats' && (
          <label>
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} />
            Datos de una muestra (divisor n−1 en la varianza)
          </label>
        )}
        {op === 'percentile' && (
          <label>
            Percentil, entre 0 y 100
            <input
              type="number"
              min="0"
              max="100"
              required
              value={percentile}
              onChange={(e) => setPercentile(e.target.value)}
            />
          </label>
        )}
        {paired && (
          <label>
            Datos Y, separados por comas
            <textarea required rows={3} value={y} onChange={(e) => setY(e.target.value)} />
          </label>
        )}
        <p className="hint">
          Los cuartiles y percentiles usan interpolación de Math.js. X e Y deben tener la misma
          cantidad de datos.
        </p>
        <button className="primary" aria-disabled={busy}>
          Calcular estadística
        </button>
      </form>
    </section>
  );
}
