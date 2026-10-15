import { lazy, Suspense } from 'react';
import type { ToolId } from './toolCatalog';
import type { AngleMode, DecimalSeparator } from '../types';
const MatrixCalculator = lazy(() =>
  import('./MatrixCalculator').then((m) => ({ default: m.MatrixCalculator })),
);
const VectorComplexCalculator = lazy(() =>
  import('./VectorComplexCalculator').then((m) => ({ default: m.VectorComplexCalculator })),
);
const StatisticsCalculator = lazy(() =>
  import('./StatisticsCalculator').then((m) => ({ default: m.StatisticsCalculator })),
);
const ProbabilityCalculator = lazy(() =>
  import('./ProbabilityCalculator').then((m) => ({ default: m.ProbabilityCalculator })),
);
const Variables = lazy(() => import('./Variables').then((m) => ({ default: m.Variables })));
const Converters = lazy(() => import('./Converters').then((m) => ({ default: m.Converters })));
const Graphs = lazy(() => import('./Graphs').then((m) => ({ default: m.Graphs })));
type Props = {
  active: ToolId | null;
  visited: ToolId[];
  calculate: (expression: string) => void;
  busy: boolean;
  variables: Record<string, number>;
  removeVariable: (name: string) => void;
  insert: (value: string) => void;
  angle: AngleMode;
  decimalSeparator?: DecimalSeparator;
  announce: (text: string) => void;
  graphRequest?: { id: number; expression: string };
};
const labels = [
  ['matrices', 'Matrices'],
  ['vectors', 'Vectores y complejos'],
  ['statistics', 'Estadística'],
  ['probability', 'Probabilidad'],
  ['variables', 'Variables'],
  ['converters', 'Conversores'],
  ['graphs', 'Gráficos'],
];
export function FeatureHub(props: Props) {
  return (
    <>
      {labels.map(([id, label]) => (
        <div
          key={id}
          id={id}
          className="panel feature-section"
          hidden={props.active !== id}
          aria-label={label}
        >
          {props.visited.includes(id as ToolId) && (
            <div>
              <Suspense fallback={<p role="status">Cargando herramienta…</p>}>
                {id === 'matrices' ? (
                  <MatrixCalculator calculate={props.calculate} busy={props.busy} />
                ) : id === 'vectors' ? (
                  <VectorComplexCalculator calculate={props.calculate} busy={props.busy} />
                ) : id === 'statistics' ? (
                  <StatisticsCalculator calculate={props.calculate} busy={props.busy} />
                ) : id === 'probability' ? (
                  <ProbabilityCalculator calculate={props.calculate} busy={props.busy} />
                ) : id === 'converters' ? (
                  <Converters calculate={props.calculate} busy={props.busy} />
                ) : id === 'graphs' ? (
                  <Graphs
                    active={props.active === 'graphs'}
                    key={props.graphRequest?.id ?? 'initial'}
                    initialExpression={props.graphRequest?.expression}
                    variables={props.variables}
                    angle={props.angle}
                    decimalSeparator={props.decimalSeparator}
                    announce={props.announce}
                  />
                ) : (
                  <Variables
                    values={props.variables}
                    calculate={props.calculate}
                    remove={props.removeVariable}
                    insert={props.insert}
                  />
                )}
              </Suspense>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
