import type { MathNode, FunctionNode, OperatorNode } from 'mathjs';
import { math } from './mathRuntime';
import { normalizeExpression } from '../parser/expression';
import type { AngleMode, DecimalSeparator } from '../types';
import { physicalScope } from './PhysicalConstants';
export interface GraphRequest {
  expressions: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  angle: AngleMode;
  variables: Record<string, number>;
  /** Con coma, las funciones se escriben «2,5*x» y los argumentos se separan con «;». */
  decimalSeparator?: DecimalSeparator;
}
export interface GraphPoint {
  x: number;
  y: number | null;
}
export interface GraphEvent {
  type: 'cero' | 'máximo local' | 'mínimo local' | 'intersección';
  x: number;
  y: number;
  functionIndex: number;
  otherFunctionIndex?: number;
}
export interface GraphData {
  curves: { expression: string; points: GraphPoint[]; breaks: number[] }[];
  events: GraphEvent[];
  request: GraphRequest;
}
const allowedFunctions = new Set(
  'sin cos tan asin acos atan sinh cosh tanh sqrt cbrt abs exp log ln floor ceil'.split(' '),
);
export function graphEvaluator(expression: string, request: GraphRequest) {
  if (expression.length > 300) throw new Error('Usá hasta 300 caracteres por función.');
  let node: MathNode;
  try {
    node = math.parse(
      normalizeExpression(expression.replace(/^y\s*=\s*/, ''), {
        decimalSeparator: request.decimalSeparator,
      }),
    );
  } catch {
    throw new Error('No pude interpretar una función del gráfico.');
  }
  node.traverse((child) => {
    if (
      !['ConstantNode', 'SymbolNode', 'OperatorNode', 'FunctionNode', 'ParenthesisNode'].includes(
        child.type,
      )
    )
      throw new Error('El gráfico solo admite funciones reales de x.');
    if (
      child.type === 'FunctionNode' &&
      !allowedFunctions.has((child as FunctionNode).fn.name ?? '')
    )
      throw new Error('Esa función no está disponible para graficar.');
    if (child.type === 'FunctionNode') {
      const fn = child as FunctionNode;
      if (fn.args.length !== 1 && !(fn.fn.name === 'log' && fn.args.length === 2))
        throw new Error('Revisá la cantidad de argumentos de la función del gráfico.');
    }
    if (
      child.type === 'OperatorNode' &&
      !['+', '-', '*', '/', '^', '%'].includes((child as OperatorNode).op)
    )
      throw new Error('Operador no permitido en gráficos.');
    if (
      child.type === 'SymbolNode' &&
      !['x', 'pi', 'e', 'phi'].includes(child.toString()) &&
      !allowedFunctions.has(child.toString()) &&
      !Object.hasOwn(physicalScope, child.toString()) &&
      !Object.hasOwn(request.variables, child.toString())
    )
      throw new Error(`Definí la variable ${child.toString()} antes de graficar.`);
  });
  const compiled = node.compile();
  const factor =
    request.angle === 'deg' ? Math.PI / 180 : request.angle === 'grad' ? Math.PI / 200 : 1;
  return (x: number): number | null => {
    try {
      const y: unknown = compiled.evaluate(
        new Map<string, unknown>([
          ...Object.entries(request.variables),
          ...Object.entries(physicalScope),
          ['x', x],
          ['sin', (v: number) => Math.sin(v * factor)],
          ['cos', (v: number) => Math.cos(v * factor)],
          ['tan', (v: number) => Math.tan(v * factor)],
          ['asin', (v: number) => Math.asin(v) / factor],
          ['acos', (v: number) => Math.acos(v) / factor],
          ['atan', (v: number) => Math.atan(v) / factor],
          ['ln', Math.log],
          ['log', (v: number, base = 10) => Math.log(v) / Math.log(base)],
        ]),
      );
      return typeof y === 'number' && Number.isFinite(y) ? y : null;
    } catch {
      return null;
    }
  };
}
type Evaluator = (x: number) => number | null;
// A sign change alone is not a root: require a decreasing residual as well.
function refineZero(evaluate: Evaluator, low: number, high: number): GraphPoint | null {
  let a = evaluate(low);
  const b = evaluate(high);
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === 0) return { x: low, y: 0 };
  if (b === 0) return { x: high, y: 0 };
  if (Math.sign(a) === Math.sign(b)) return null;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  let best = { x: Math.abs(a) < Math.abs(b) ? low : high, y: Math.abs(a) < Math.abs(b) ? a : b };
  for (let i = 0; i < 60; i++) {
    const x = low / 2 + high / 2;
    if (x === low || x === high) break;
    const y = evaluate(x);
    if (y === null || !Number.isFinite(y)) return null;
    if (Math.abs(y) < Math.abs(best.y)) best = { x, y };
    if (y === 0) return { x, y };
    if (Math.sign(y) === Math.sign(a)) {
      low = x;
      a = y;
    } else {
      high = x;
    }
  }
  return Math.abs(best.y) <= scale * 1e-9 ? best : null;
}
// Refine only extrema already bracketed by three samples. This is a local estimate.
function refineExtremum(
  evaluate: Evaluator,
  low: number,
  high: number,
  minimum: boolean,
): GraphPoint | null {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let left = high - ratio * (high - low),
    right = low + ratio * (high - low);
  let a = evaluate(left),
    b = evaluate(right);
  for (let i = 0; i < 48; i++) {
    if (a === null || b === null) return null;
    if (minimum ? a < b : a > b) {
      high = right;
      right = left;
      b = a;
      left = high - ratio * (high - low);
      a = evaluate(left);
    } else {
      low = left;
      left = right;
      a = b;
      right = low + ratio * (high - low);
      b = evaluate(right);
    }
  }
  const x = low / 2 + high / 2,
    y = evaluate(x);
  return y === null ? null : { x, y };
}
export function sampleGraph(request: GraphRequest): GraphData {
  if (
    !request.expressions.length ||
    request.expressions.length > 4 ||
    ![request.minX, request.maxX, request.minY, request.maxY].every(Number.isFinite) ||
    request.maxX <= request.minX ||
    request.maxY <= request.minY ||
    !Number.isFinite(request.maxX - request.minX) ||
    !Number.isFinite(request.maxY - request.minY)
  )
    throw new Error(
      'Ingresá de 1 a 4 funciones y rangos válidos, con el mínimo menor que el máximo.',
    );
  const count = 400;
  const step = (request.maxX - request.minX) / count;
  if (step <= 0 || request.minX + step === request.minX || request.maxX - step === request.maxX)
    throw new Error('El rango X es demasiado pequeño para distinguir 401 muestras con precisión.');
  const evaluators = request.expressions.map((e) => graphEvaluator(e, request));
  const events: GraphEvent[] = [];
  const addEvent = (event: GraphEvent) => {
    if (
      !events.some(
        (existing) =>
          existing.type === event.type &&
          existing.functionIndex === event.functionIndex &&
          existing.otherFunctionIndex === event.otherFunctionIndex &&
          Math.abs(existing.x - event.x) <= step * 1e-5,
      )
    )
      events.push(event);
  };
  const curves = evaluators.map((evaluate, functionIndex) => {
    const points = Array.from({ length: count + 1 }, (_, i) => {
      const x = request.minX + i * step;
      return { x, y: evaluate(x) };
    });
    const breaks: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const current = points[i],
        previous = points[i - 1],
        next = points[i + 1];
      if (current.y === null) {
        breaks.push(i);
        continue;
      }
      if (previous && previous.y !== null) {
        const mid = evaluate(previous.x / 2 + current.x / 2);
        if (mid === null || Math.abs(current.y - previous.y) > (request.maxY - request.minY) * 2) {
          breaks.push(i);
          continue;
        }
        if (Math.sign(previous.y) !== Math.sign(current.y) && previous.y !== 0 && current.y !== 0) {
          const root = refineZero(evaluate, previous.x, current.x);
          if (root) addEvent({ type: 'cero', x: root.x, y: root.y!, functionIndex });
        }
      }
      if (current.y === 0 && previous?.y !== 0 && next?.y !== 0)
        addEvent({ type: 'cero', x: current.x, y: 0, functionIndex });
      if (previous?.y !== null && previous && next?.y !== null && next) {
        if (
          evaluate(current.x / 2 + next.x / 2) === null ||
          Math.abs(next.y - current.y) > (request.maxY - request.minY) * 2
        )
          continue;
        const minimum = current.y < previous.y && current.y < next.y;
        const maximum = current.y > previous.y && current.y > next.y;
        if (minimum || maximum) {
          const refined = refineExtremum(evaluate, previous.x, next.x, minimum);
          if (refined && refined.y !== null) {
            const point = (minimum ? current.y <= refined.y : current.y >= refined.y)
              ? current
              : refined;
            addEvent({
              type: minimum ? 'mínimo local' : 'máximo local',
              x: point.x,
              y: point.y!,
              functionIndex,
            });
            if (point.y === 0) addEvent({ type: 'cero', x: point.x, y: 0, functionIndex });
          }
        }
      }
    }
    return { expression: request.expressions[functionIndex], points, breaks };
  });
  for (let a = 0; a < curves.length; a++)
    for (let b = a + 1; b < curves.length; b++)
      for (let i = 1; i <= count; i++) {
        const p = curves[a].points[i - 1],
          q = curves[a].points[i],
          r = curves[b].points[i - 1],
          s = curves[b].points[i];
        if ([p.y, q.y, r.y, s.y].some((y) => y === null)) continue;
        const d1 = p.y! - r.y!,
          d2 = q.y! - s.y!;
        if (curves[a].breaks.includes(i) || curves[b].breaks.includes(i)) continue;
        if (Math.sign(d1) !== Math.sign(d2) && d1 !== d2) {
          const root = refineZero(
            (x) => {
              const ya = evaluators[a](x),
                yb = evaluators[b](x);
              return ya === null || yb === null ? null : ya - yb;
            },
            p.x,
            q.x,
          );
          if (root) {
            const y = evaluators[a](root.x);
            if (y !== null)
              addEvent({
                type: 'intersección',
                x: root.x,
                y,
                functionIndex: a,
                otherFunctionIndex: b,
              });
          }
        }
      }
  return { curves, events: events.sort((a, b) => a.x - b.x).slice(0, 100), request };
}
