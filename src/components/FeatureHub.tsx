import { lazy, Suspense } from 'react';
import type { ToolId } from './toolCatalog';
import type { AngleMode, CalculationResult, DecimalSeparator } from '../types';
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
const TableCalculator = lazy(() =>
  import('./TableCalculator').then((m) => ({ default: m.TableCalculator })),
);
const Spreadsheet = lazy(() => import('./Spreadsheet').then((m) => ({ default: m.Spreadsheet })));
const RatioCalculator = lazy(() =>
  import('./RatioCalculator').then((m) => ({ default: m.RatioCalculator })),
);
type Props = {
  active: ToolId | null;
  visited: ToolId[];
  calculate: (expression: string) => void;
  /** Calcula sin mostrar el resultado: lo usa la hoja de cálculo para cada celda. */
  evaluate: (expression: string, scope: Record<string, number>) => Promise<CalculationResult>;
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
  ['sheet', 'Hoja de cálculo'],
  ['probability', 'Probabilidad'],
  ['variables', 'Variables'],
  ['converters', 'Conversores'],
  ['graphs', 'Gráficos'],
  ['table', 'Tabla de valores'],
  ['ratio', 'Proporciones'],
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
                ) : id === 'sheet' ? (
                  <Spreadsheet
                    evaluate={props.evaluate}
                    decimalSeparator={props.decimalSeparator}
                    announce={props.announce}
                  />
                ) : id === 'table' ? (
                  <TableCalculator
                    calculate={props.calculate}
                    busy={props.busy}
                    decimalSeparator={props.decimalSeparator}
                  />
                ) : id === 'ratio' ? (
                  <RatioCalculator
                    calculate={props.calculate}
                    busy={props.busy}
                    decimalSeparator={props.decimalSeparator}
                  />
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
