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
export type GraphEventType =
  | 'cero'
  | 'máximo local'
  | 'mínimo local'
  | 'intersección'
  | 'discontinuidad'
  | 'asíntota vertical';
export interface GraphEvent {
  type: GraphEventType;
  x: number;
  /** Sin valor en una asíntota o una discontinuidad. */
  y: number | null;
  functionIndex: number;
  otherFunctionIndex?: number;
  /** Cero en el que la curva toca el eje sin cruzarlo. */
  tangent?: boolean;
  /** Valores a cada lado de una discontinuidad. */
  left?: number | null;
  right?: number | null;
}
export interface GraphCurve {
  expression: string;
  points: GraphPoint[];
  /** Índices donde el trazo se levanta: sin valor, salto o asíntota antes de esa muestra. */
  breaks: number[];
  /** Intervalos de x con valor dentro de la ventana. */
  domain: { from: number; to: number }[];
  /** f(0) si el eje y está en la ventana; null si no está definida ahí. */
  yIntercept?: number | null;
}
export interface GraphData {
  curves: GraphCurve[];
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

interface Gap {
  type: 'discontinuidad' | 'asíntota vertical';
  x: number;
  left: number | null;
  right: number | null;
}
/** ¿Crece |f| sin cota al acercarse a x desde el lado de `from`? (1/x, log(x), tan(x)). */
function blowsUp(evaluate: Evaluator, x: number, from: number, scale: number) {
  const width = Math.abs(from - x);
  const near = evaluate(x + (from - x) * 1e-9);
  const nearer = evaluate(x + (from - x) * 1e-12);
  const far = evaluate(from);
  if (near === null || nearer === null || far === null || width === 0) return false;
  return (
    Math.abs(nearer) > Math.abs(near) &&
    Math.abs(near) > Math.abs(far) &&
    (Math.abs(nearer) > 1e6 * Math.max(1, scale) || Math.abs(nearer) > 5 * Math.abs(far) + 1)
  );
}
/**
 * Clasifica el tramo entre dos muestras finitas sospechosas acercándose al salto por bisección:
 * si al achicarlo la diferencia no baja, es una discontinuidad; si los valores crecen sin cota,
 * una asíntota. Una curva empinada pero continua se achica y no devuelve nada. No depende del
 * rango Y de la ventana.
 */
function classifyGap(
  evaluate: Evaluator,
  low: number,
  fLow: number,
  high: number,
  fHigh: number,
  scale: number,
): Gap | null {
  const initial = Math.abs(fHigh - fLow);
  let a = low,
    fa = fLow,
    b = high,
    fb = fHigh;
  for (let i = 0; i < 64; i++) {
    const m = a / 2 + b / 2;
    if (m === a || m === b) break;
    const fm = evaluate(m);
    if (fm === null) {
      // Un punto sin valor entre dos muestras finitas: asíntota si |f| crece a algún lado.
      // Se sondea desde las muestras originales: el tramo ya es tan corto que no se distingue.
      const pole = blowsUp(evaluate, m, low, scale) || blowsUp(evaluate, m, high, scale);
      return pole
        ? { type: 'asíntota vertical', x: m, left: null, right: null }
        : { type: 'discontinuidad', x: m, left: fa, right: fb };
    }
    if (Math.abs(fm - fa) >= Math.abs(fb - fm)) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  const x = a / 2 + b / 2;
  if (Math.max(Math.abs(fa), Math.abs(fb)) > 1e6 * Math.max(1, scale))
    return { type: 'asíntota vertical', x, left: null, right: null };
  if (Math.abs(fb - fa) > 0.5 * initial) return { type: 'discontinuidad', x, left: fa, right: fb };
  return null;
}
/** Borde del dominio entre una muestra finita y una sin valor; asíntota si |f| crece hacia él. */
function domainEdge(evaluate: Evaluator, finite: number, empty: number, scale: number): Gap | null {
  const b = edge(evaluate, finite, empty);
  return blowsUp(evaluate, b, finite, scale)
    ? { type: 'asíntota vertical', x: b, left: null, right: null }
    : null;
}
/** Dónde empieza o termina el dominio entre una muestra con valor y otra sin él. */
function edge(evaluate: Evaluator, finite: number, empty: number) {
  let a = finite,
    b = empty;
  for (let i = 0; i < 64; i++) {
    const m = a / 2 + b / 2;
    if (m === a || m === b) break;
    if (evaluate(m) === null) b = m;
    else a = m;
  }
  return Math.abs(a - b) <= Math.abs(finite - empty) * 1e-12 ? b : a;
}
/** Intervalos de x con valor dentro de la ventana, con los bordes afinados por bisección. */
function domainOf(evaluate: Evaluator, points: GraphPoint[]) {
  const domain: { from: number; to: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const defined = points[i].y !== null;
    if (defined && start === null) start = i;
    const last = i === points.length - 1;
    if (start !== null && (!defined || last)) {
      const end = defined ? i : i - 1;
      domain.push({
        from: start === 0 ? points[0].x : edge(evaluate, points[start].x, points[start - 1].x),
        to:
          end === points.length - 1
            ? points[end].x
            : edge(evaluate, points[end].x, points[end + 1].x),
      });
      start = null;
    }
  }
  return domain;
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
    const finite = points.filter((p) => p.y !== null).map((p) => Math.abs(p.y!));
    const scale = finite.length ? Math.max(...finite) : 1;
    const gap = (i: number) =>
      i > 0 && i < points.length && points[i].y !== null && points[i - 1].y !== null
        ? Math.abs(points[i].y! - points[i - 1].y!)
        : NaN;
    // Corte entre la muestra i-1 y la i: ahí el trazo se levanta y no se buscan extremos.
    const breaks: number[] = [];
    const cut = (i: number, found: Gap | null) => {
      if (!breaks.includes(i)) breaks.push(i);
      if (found)
        addEvent({
          type: found.type,
          x: found.x,
          y: null,
          functionIndex,
          ...(found.type === 'discontinuidad' && { left: found.left, right: found.right }),
        });
    };
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1],
        current = points[i];
      if (current.y === null && previous.y === null) {
        if (!breaks.includes(i)) breaks.push(i);
        continue;
      }
      if (current.y === null || previous.y === null) {
        const edge =
          current.y === null
            ? domainEdge(evaluate, previous.x, current.x, scale)
            : domainEdge(evaluate, current.x, previous.x, scale);
        cut(i, edge);
        continue;
      }
      const d = gap(i);
      const neighbors = [gap(i - 1), gap(i + 1)].filter((value) => !Number.isNaN(value));
      const calm = neighbors.length ? Math.min(...neighbors) : 0;
      if (d > 2 * calm + 1e-12 * scale) {
        const found = classifyGap(evaluate, previous.x, previous.y, current.x, current.y, scale);
        if (found) {
          cut(i, found);
          continue;
        }
      }
      if (Math.sign(previous.y) !== Math.sign(current.y) && previous.y !== 0 && current.y !== 0) {
        const root = refineZero(evaluate, previous.x, current.x);
        if (root) addEvent({ type: 'cero', x: root.x, y: root.y, functionIndex });
      }
    }
    const broken = (i: number) => breaks.includes(i);
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      if (current.y === null) continue;
      const before = points[i - 1]?.y ?? null,
        after = points[i + 1]?.y ?? null;
      // Cero justo sobre una muestra: aislado, en el borde del dominio (sqrt(x) en 0) o de la ventana.
      if (current.y === 0 && before !== 0 && after !== 0)
        addEvent({
          type: 'cero',
          x: current.x,
          y: 0,
          functionIndex,
          ...(before !== null &&
            after !== null &&
            !broken(i) &&
            !broken(i + 1) &&
            Math.sign(before) === Math.sign(after) && { tangent: true }),
        });
      if (before === null || after === null || broken(i) || broken(i + 1)) continue;
      const previous = points[i - 1] as { x: number; y: number },
        next = points[i + 1] as { x: number; y: number };
      const minimum = current.y < previous.y && current.y < next.y;
      const maximum = current.y > previous.y && current.y > next.y;
      if (!minimum && !maximum) continue;
      const refined = refineExtremum(evaluate, previous.x, next.x, minimum);
      if (!refined || refined.y === null) continue;
      const point = (minimum ? current.y <= refined.y : current.y >= refined.y) ? current : refined;
      // Un «extremo» que se dispara lejos de las muestras vecinas es un polo sin cambio de signo.
      const spread = Math.abs(current.y - previous.y) + Math.abs(next.y - current.y);
      if (
        Math.abs(point.y! - current.y) > 10 * spread + 1e-12 * scale &&
        (blowsUp(evaluate, point.x, previous.x, scale) || blowsUp(evaluate, point.x, next.x, scale))
      ) {
        cut(i, { type: 'asíntota vertical', x: point.x, left: null, right: null });
        continue;
      }
      addEvent({
        type: minimum ? 'mínimo local' : 'máximo local',
        x: point.x,
        y: point.y!,
        functionIndex,
      });
      if (point.y !== 0 && Math.sign(point.y!) !== Math.sign(current.y) && current.y !== 0) {
        // Cruza el eje entre muestras del mismo signo: dos raíces muy juntas.
        for (const root of [
          refineZero(evaluate, previous.x, point.x),
          refineZero(evaluate, point.x, next.x),
        ])
          if (root) addEvent({ type: 'cero', x: root.x, y: root.y, functionIndex });
      } else if (Math.abs(point.y!) <= 1e-9 * scale)
        // La curva toca el eje sin cruzarlo: cero doble.
        addEvent({ type: 'cero', x: point.x, y: 0, functionIndex, tangent: true });
    }
    return {
      expression: request.expressions[functionIndex],
      points,
      breaks: breaks.sort((a, b) => a - b),
      domain: domainOf(evaluate, points),
      ...(request.minX <= 0 && 0 <= request.maxX && { yIntercept: evaluate(0) }),
    };
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
