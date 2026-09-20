import type { MathNode, FunctionNode, OperatorNode } from 'mathjs';
import { math } from './mathRuntime';
import { normalizeExpression } from '../parser/expression';
import type { AngleMode } from '../types';
import { physicalScope } from './PhysicalConstants';
export interface GraphRequest {
  expressions: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  angle: AngleMode;
  variables: Record<string, number>;
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
    node = math.parse(normalizeExpression(expression.replace(/^y\s*=\s*/, '')));
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
export function sampleGraph(request: GraphRequest): GraphData {
  if (
    !request.expressions.length ||
    request.expressions.length > 4 ||
    ![request.minX, request.maxX, request.minY, request.maxY].every(Number.isFinite) ||
    request.maxX <= request.minX ||
    request.maxY <= request.minY
  )
    throw new Error(
      'Ingresá de 1 a 4 funciones y rangos válidos, con el mínimo menor que el máximo.',
    );
  const count = 400;
  const step = (request.maxX - request.minX) / count;
  const evaluators = request.expressions.map((e) => graphEvaluator(e, request));
  const events: GraphEvent[] = [];
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
        const mid = evaluate((previous.x + current.x) / 2);
        if (mid === null || Math.abs(current.y - previous.y) > (request.maxY - request.minY) * 2) {
          breaks.push(i);
          continue;
        }
        if (previous.y * current.y < 0) {
          const x = previous.x - (previous.y * (current.x - previous.x)) / (current.y - previous.y);
          const y = evaluate(x);
          if (
            y !== null &&
            Math.abs(y) < Math.max(1, Math.abs(previous.y), Math.abs(current.y)) * 1e-3
          )
            events.push({ type: 'cero', x, y: 0, functionIndex });
        }
      }
      if (
        Math.abs(current.y) < 1e-10 &&
        !events.some(
          (e) =>
            e.functionIndex === functionIndex &&
            e.type === 'cero' &&
            Math.abs(e.x - current.x) < step,
        )
      )
        events.push({ type: 'cero', x: current.x, y: 0, functionIndex });
      if (previous?.y !== null && previous && next?.y !== null && next) {
        if (current.y > previous.y && current.y > next.y)
          events.push({ type: 'máximo local', x: current.x, y: current.y, functionIndex });
        if (current.y < previous.y && current.y < next.y)
          events.push({ type: 'mínimo local', x: current.x, y: current.y, functionIndex });
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
        if (d1 * d2 <= 0 && d1 !== d2) {
          const x = p.x - (d1 * (q.x - p.x)) / (d2 - d1),
            ya = evaluators[a](x),
            yb = evaluators[b](x);
          if (ya !== null && yb !== null && Math.abs(ya - yb) < 1e-3)
            events.push({ type: 'intersección', x, y: ya, functionIndex: a });
        }
      }
  return { curves, events: events.slice(0, 100), request };
}
