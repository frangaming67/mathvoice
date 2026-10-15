import { useRef, useState } from 'react';
import { focusToolField, useToolCommands } from '../keyboard/CommandContext';
import {
  describeReading,
  listExpression,
  parseList,
  type ListOption,
  type ListReading,
} from '../services/dataParsing';

type Field = 'x' | 'y';
const fieldIds: Record<Field, string> = { x: 'stats-data-x', y: 'stats-data-y' };

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
  const [problem, setProblem] = useState<{ field: Field; message: string } | null>(null);
  const [question, setQuestion] = useState<{
    field: Field;
    question: string;
    options: ListOption[];
  } | null>(null);
  const [reading, setReading] = useState('');
  const paired = ['regression', 'covariance', 'correlation'].includes(op);
  const section = useRef<HTMLElement>(null);
  useToolCommands('statistics', (command) => {
    if (command.type !== 'tool' || !command.operation) return;
    setOp(command.operation === 'quartiles' ? 'stats' : command.operation);
    focusToolField(section.current, 'textarea');
  });
  const focusField = (field: Field) =>
    requestAnimationFrame(() => document.getElementById(fieldIds[field])?.focus());
  // Lee los datos sin adivinar: un error señala el dato; una coma dudosa se pregunta.
  function read(field: Field, text: string): ListReading | null {
    const parsed = parseList(text);
    if (parsed.status === 'ok') return parsed.reading;
    if (parsed.status === 'error') {
      setProblem({ field, message: parsed.message });
      focusField(field);
    } else {
      // El foco va a la primera opción: el lector anuncia la pregunta como nombre del grupo.
      setQuestion({ field, question: parsed.question, options: parsed.options });
      requestAnimationFrame(() =>
        section.current?.querySelector<HTMLButtonElement>('.choice button')?.focus(),
      );
    }
    return null;
  }
  const errorFor = (field: Field) =>
    problem?.field === field ? `${fieldIds[field]}-error` : undefined;
  return (
    <section ref={section}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          setQuestion(null);
          const x = read('x', data);
          if (!x) return;
          const second = paired ? read('y', y) : null;
          if (paired && !second) return;
          if (second && second.items.length !== x.items.length) {
            setProblem({
              field: 'y',
              message: `X tiene ${x.items.length} datos e Y tiene ${second.items.length}: tienen que tener la misma cantidad.`,
            });
            focusField('y');
            return;
          }
          setReading(
            `${describeReading(x).text}${second ? ` Y: ${describeReading(second).text}` : ''}`,
          );
          calculate(
            `${op}(${listExpression(x)}${second ? `, ${listExpression(second)}` : op === 'stats' ? `, ${sample ? 1 : 0}` : ['std', 'variance'].includes(op) ? `, "${sample ? 'unbiased' : 'uncorrected'}"` : op === 'percentile' ? `, ${percentile}` : ''})`,
          );
        }}
      >
        <p className="hint" id="stats-data-help">
          Separá los datos con comas, punto y coma, espacios o uno por línea; también podés pegar
          una columna de una planilla. Con punto y coma o un dato por línea, la coma es decimal.
        </p>
        <label htmlFor={fieldIds.x}>Datos X</label>
        <textarea
          id={fieldIds.x}
          rows={3}
          required
          value={data}
          aria-invalid={problem?.field === 'x' || undefined}
          aria-describedby={['stats-data-help', errorFor('x')].filter(Boolean).join(' ')}
          onChange={(e) => {
            setData(e.target.value);
            if (problem?.field === 'x') setProblem(null);
          }}
        />
        {problem?.field === 'x' && (
          <p id={`${fieldIds.x}-error`} className="field-error">
            {problem.message}
          </p>
        )}
        <label>
          Análisis estadístico
          <select value={op} onChange={(e) => setOp(e.target.value)}>
            {[
              ['mean', 'Media'],
              ['median', 'Mediana'],
              ['mode', 'Moda'],
              ['std', 'Desviación estándar'],
              ['variance', 'Varianza'],
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
        {['stats', 'std', 'variance'].includes(op) && (
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
          <>
            <label htmlFor={fieldIds.y}>Datos Y</label>
            <textarea
              id={fieldIds.y}
              required
              rows={3}
              value={y}
              aria-invalid={problem?.field === 'y' || undefined}
              aria-describedby={['stats-data-help', errorFor('y')].filter(Boolean).join(' ')}
              onChange={(e) => {
                setY(e.target.value);
                if (problem?.field === 'y') setProblem(null);
              }}
            />
            {problem?.field === 'y' && (
              <p id={`${fieldIds.y}-error`} className="field-error">
                {problem.message}
              </p>
            )}
          </>
        )}
        {question && (
          <fieldset className="choice">
            <legend>{question.question}</legend>
            <div className="actions">
              {question.options.map((option) => (
                <button
                  type="button"
                  key={option.label}
                  onClick={() => {
                    (question.field === 'x' ? setData : setY)(option.text);
                    setQuestion(null);
                    focusField(question.field);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <p className="hint">
          Los cuartiles y percentiles usan interpolación de Math.js. X e Y deben tener la misma
          cantidad de datos.
        </p>
        <p className="hint" aria-live="polite">
          {reading}
        </p>
        <button className="primary" aria-disabled={busy}>
          Calcular estadística
        </button>
      </form>
    </section>
  );
}
