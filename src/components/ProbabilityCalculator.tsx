import { useRef, useState } from 'react';
import { focusToolField, useToolCommands } from '../keyboard/CommandContext';
const configs: Record<string, { label: string; fields: string[]; defaults: string[] }> = {
  factorial: { label: 'Factorial', fields: ['Entero no negativo'], defaults: ['5'] },
  combinations: { label: 'Combinaciones nCr', fields: ['n', 'r'], defaults: ['10', '3'] },
  permutations: { label: 'Permutaciones nPr', fields: ['n', 'r'], defaults: ['10', '3'] },
  binomialpdf: {
    label: 'Binomial: P(X = k)',
    fields: ['k', 'Cantidad de ensayos n', 'Probabilidad p'],
    defaults: ['2', '5', '0.5'],
  },
  binomialcdf: {
    label: 'Binomial: P(X ≤ k)',
    fields: ['k', 'Cantidad de ensayos n', 'Probabilidad p'],
    defaults: ['2', '5', '0.5'],
  },
  normalcdf: {
    label: 'Normal: P(X ≤ x)',
    fields: ['x', 'Media', 'Desviación estándar'],
    defaults: ['0', '0', '1'],
  },
  normalpdf: {
    label: 'Normal: densidad en x',
    fields: ['x', 'Media', 'Desviación estándar'],
    defaults: ['0', '0', '1'],
  },
  invnorm: {
    label: 'Normal inversa: x con P(X ≤ x) igual al área',
    fields: ['Área a la izquierda', 'Media', 'Desviación estándar'],
    defaults: ['0.975', '0', '1'],
  },
  poissonpdf: { label: 'Poisson: P(X = k)', fields: ['k', 'Media lambda'], defaults: ['2', '3'] },
  poissoncdf: { label: 'Poisson: P(X ≤ k)', fields: ['k', 'Media lambda'], defaults: ['2', '3'] },
};
export function ProbabilityCalculator({
  calculate,
  busy,
}: {
  calculate: (e: string) => void;
  busy: boolean;
}) {
  const [op, setOp] = useState('combinations');
  const [args, setArgs] = useState(configs.combinations.defaults);
  const section = useRef<HTMLElement>(null);
  useToolCommands('probability', (command) => {
    if (command.type !== 'tool' || !command.operation || !configs[command.operation]) return;
    if (command.operation !== op) {
      setOp(command.operation);
      setArgs(configs[command.operation].defaults);
    }
    focusToolField(section.current);
  });
  return (
    <section ref={section}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(`${op}(${args.join(', ')})`);
        }}
      >
        <label>
          Distribución u operación
          <select
            value={op}
            onChange={(e) => {
              setOp(e.target.value);
              setArgs(configs[e.target.value].defaults);
            }}
          >
            {Object.entries(configs).map(([v, c]) => (
              <option key={v} value={v}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-pair">
          {configs[op].fields.map((label, i) => (
            <label key={`${op}-${i}`}>
              {label}
              <input
                type="number"
                step="any"
                required
                value={args[i]}
                onChange={(e) => setArgs(args.map((a, j) => (i === j ? e.target.value : a)))}
              />
            </label>
          ))}
        </div>
        <p className="hint">
          La densidad normal no es la probabilidad de un valor exacto. Las probabilidades se
          expresan entre 0 y 1.
        </p>
        <button className="primary" aria-disabled={busy}>
          Calcular probabilidad
        </button>
      </form>
    </section>
  );
}
