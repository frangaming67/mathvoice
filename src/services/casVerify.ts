import type { FunctionNode, MathNode } from 'mathjs';
import { math } from './mathRuntime';
import { derivativeWithError, integrate } from './numerics';

// Verificación numérica de los resultados del motor simbólico: nunca se muestra como
// confirmado algo que no coincidió al evaluarlo en puntos reales del dominio.

/** Error ya redactado en español para la persona usuaria; se muestra tal cual. */
export class SymbolicError extends Error {
  override name = 'SymbolicError';
}

const casMessages: [RegExp, string][] = [
  [
    /division by zero/i,
    'La expresión divide por cero en algún paso del cálculo simbólico. Revisá los denominadores y el dominio.',
  ],
  [
    /maximum call stack|too much recursion/i,
    'La expresión es demasiado compleja para el motor simbólico. Probá simplificarla o dividirla en partes.',
  ],
  [
    /not (yet )?(supported|implemented)|unsupported/i,
    'El motor simbólico no admite esa operación con esta expresión.',
  ],
  [
    /unexpected|syntax|parse|expect|missing|unmatched/i,
    'El motor simbólico no pudo interpretar la expresión. Revisá los paréntesis y los operadores.',
  ],
];

/** Traduce un error del motor simbólico (en inglés o interno) a un mensaje en español. */
export function translateCasError(error: unknown): SymbolicError {
  if (error instanceof SymbolicError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const known = casMessages.find(([pattern]) => pattern.test(message));
  return new SymbolicError(
    known?.[1] ??
      'El motor simbólico no pudo resolver esta operación. Revisá la expresión, su dominio y la variable.',
  );
}

/** Ejecuta una llamada al motor simbólico y traduce cualquier error al español. */
export function safeCas<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw translateCasError(error);
  }
}

/** 'user': sintaxis de la app (log en base 10, ln natural). 'cas': salida de nerdamer (log natural). */
export type Dialect = 'user' | 'cas';
export type Scope = Record<string, number>;
export type Evaluator = (scope: Scope) => number;
export type VerifyOutcome = 'ok' | 'mismatch' | 'unverifiable';

const constants = new Set(['pi', 'e', 'i', 'Infinity', 'phi']);
const EULER_GAMMA = 0.5772156649015329;
// Integrales seno, coseno y exponencial que devuelve nerdamer, evaluadas por cuadratura.
// Las de tipo logarítmico usan ln|x| para ser reales a ambos lados de 0.
function special(integrand: (t: number) => number, logarithmic: boolean) {
  return (x: unknown) => {
    const value = Number(x);
    if (!Number.isFinite(value) || (logarithmic && value === 0)) return NaN;
    const { value: area } = integrate(integrand, 0, value, { tolerance: 1e-13 });
    return logarithmic ? EULER_GAMMA + Math.log(Math.abs(value)) + area : area;
  };
}
const userScope: Record<string, unknown> = {
  ln: (x: unknown) => math.log(x as number),
  log: (x: unknown, base: unknown = 10) => math.log(x as number, base as number),
};
const casScope: Record<string, unknown> = {
  ln: (x: unknown) => math.log(x as number),
  fact: (x: unknown) => math.factorial(x as number),
  Si: special((t) => (t === 0 ? 1 : Math.sin(t) / t), false),
  Shi: special((t) => (t === 0 ? 1 : Math.sinh(t) / t), false),
  Ci: special((t) => (t === 0 ? 0 : (Math.cos(t) - 1) / t), true),
  Chi: special((t) => (t === 0 ? 0 : (Math.cosh(t) - 1) / t), true),
  Ei: special((t) => (t === 0 ? 1 : Math.expm1(t) / t), true),
};

/** Valor real de un resultado de mathjs; NaN si no es real o no es finito. */
export function toReal(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (math.isComplex(value)) {
    const { re, im } = value as { re: number; im: number };
    return Number.isFinite(re) && Math.abs(im) <= 1e-10 * Math.max(1, Math.abs(re)) ? re : NaN;
  }
  if (math.isFraction(value) || math.isBigNumber(value)) return Number(value);
  return NaN;
}

/**
 * Compila una expresión a una función real; null si no se puede interpretar o usa una función
 * que no se sabe evaluar (en ese caso no se puede afirmar ni negar nada sobre ella).
 */
export function compileReal(expression: string, dialect: Dialect): Evaluator | null {
  const extras = dialect === 'user' ? userScope : casScope;
  let code: { evaluate: (scope: Record<string, unknown>) => unknown };
  try {
    const node = math.parse(expression.replace(/\*\*/g, '^'));
    let known = true;
    node.traverse((child: MathNode) => {
      if (child.type !== 'FunctionNode') return;
      const name = (child as FunctionNode).fn.name ?? '';
      if (
        !(name in extras) &&
        typeof (math as unknown as Record<string, unknown>)[name] !== 'function'
      )
        known = false;
    });
    if (!known) return null;
    code = node.compile();
  } catch {
    return null;
  }
  return (scope) => {
    try {
      return toReal(code.evaluate({ ...scope, ...extras }));
    } catch {
      return NaN;
    }
  };
}

/** Variables libres de una expresión (sin constantes ni nombres de funciones). */
export function freeVariables(expression: string): string[] {
  const names = new Set<string>();
  try {
    math.parse(expression).traverse((node: MathNode, path: string) => {
      if (node.type === 'SymbolNode' && path !== 'fn' && !constants.has(node.toString()))
        names.add(node.toString());
    });
  } catch {
    return [];
  }
  return [...names].sort();
}

// Puntos «raros» (lejos de 0, ±1, π y enteros) en tres escalas, por si el dominio es chico.
const tiers = [
  [-2.71, -1.37, -0.83, -0.29, 0.31, 0.77, 1.29, 1.93, 2.63, 3.41, -3.17, 0.53],
  [4.37, 5.9, 7.3, 11.3, 17.7, 25.1, -4.9, -7.7, -12.3, 37.9],
  [0.0137, 0.051, -0.047, 0.11, 1.07, -1.13, 0.97, -0.97, 0.21, -0.61],
];

/** Puntos de muestreo: cada variable recorre la lista con un desfase propio. */
export function samplePoints(variables: string[]): Scope[] {
  const points: Scope[] = [];
  for (const tier of tiers)
    for (let i = 0; i < tier.length; i++) {
      const scope: Scope = {};
      variables.forEach((name, k) => {
        scope[name] = tier[(i + 5 * k) % tier.length] * (k % 2 ? 1.13 : 1);
      });
      points.push(scope);
    }
  return points;
}

function close(a: number, b: number, tolerance: number, slack = 0): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)) + slack;
}

interface VerifyOptions {
  /** Puntos válidos necesarios para afirmar la coincidencia. */
  minimum?: number;
  tolerance?: number;
}

/** Compara dos expresiones en puntos donde la primera es real y finita. */
export function verifyEquivalent(
  input: Evaluator,
  output: Evaluator,
  variables: string[],
  { minimum = 4, tolerance = 1e-7 }: VerifyOptions = {},
): VerifyOutcome {
  let valid = 0;
  for (const scope of samplePoints(variables)) {
    const expected = input(scope);
    if (Number.isNaN(expected)) continue;
    const actual = output(scope);
    if (!close(expected, actual, tolerance)) return 'mismatch';
    if (++valid >= 10) break;
  }
  return valid >= minimum ? 'ok' : 'unverifiable';
}

function slopeAt(f: Evaluator, scope: Scope, variable: string) {
  return derivativeWithError((x) => f({ ...scope, [variable]: x }), scope[variable]);
}

/** Compara la derivada propuesta con la diferencia central numérica de la función. */
export function verifyDerivative(
  f: Evaluator,
  derivative: Evaluator,
  variable: string,
  variables: string[],
  { minimum = 4, tolerance = 1e-6 }: VerifyOptions = {},
): VerifyOutcome {
  let valid = 0;
  for (const scope of samplePoints(variables)) {
    if (Number.isNaN(f(scope))) continue;
    const numeric = slopeAt(f, scope, variable);
    if (
      !Number.isFinite(numeric.value) ||
      numeric.error > 1e-4 * Math.max(1, Math.abs(numeric.value))
    )
      continue;
    const proposed = derivative(scope);
    if (!close(numeric.value, proposed, tolerance, 10 * numeric.error)) return 'mismatch';
    if (++valid >= 10) break;
  }
  return valid >= minimum ? 'ok' : 'unverifiable';
}

/** Verifica una primitiva: su derivada numérica debe coincidir con el integrando. */
export function verifyAntiderivative(
  primitive: Evaluator,
  integrand: Evaluator,
  variable: string,
  variables: string[],
  { minimum = 4, tolerance = 1e-6 }: VerifyOptions = {},
): VerifyOutcome {
  let valid = 0;
  for (const scope of samplePoints(variables)) {
    const expected = integrand(scope);
    if (Number.isNaN(expected)) continue;
    // Una primitiva que no es real donde el integrando sí lo es no sirve en ese intervalo.
    if (Number.isNaN(primitive(scope))) return 'mismatch';
    const numeric = slopeAt(primitive, scope, variable);
    if (
      !Number.isFinite(numeric.value) ||
      numeric.error > 1e-4 * Math.max(1, Math.abs(numeric.value))
    )
      continue;
    if (!close(numeric.value, expected, tolerance, 10 * numeric.error)) return 'mismatch';
    if (++valid >= 10) break;
  }
  return valid >= minimum ? 'ok' : 'unverifiable';
}

// Verdadero si el texto completo es una sola llamada name(…), con paréntesis balanceados.
function isCall(text: string, name: string): boolean {
  if (!text.startsWith(`${name}(`) || !text.endsWith(')')) return false;
  let depth = 0;
  for (let i = name.length; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (depth === 0 && i < text.length - 1) return false;
  }
  return true;
}

/** Envuelve en valor absoluto el argumento de cada logaritmo natural de una salida de nerdamer. */
export function absoluteLogs(expression: string): string {
  let result = '';
  let i = 0;
  while (i < expression.length) {
    const match = /\blog\(/y;
    match.lastIndex = i;
    if (!match.test(expression)) {
      result += expression[i++];
      continue;
    }
    let depth = 1;
    let j = i + 4;
    let comma = false;
    for (; j < expression.length && depth; j++) {
      if (expression[j] === '(') depth++;
      if (expression[j] === ')') depth--;
      if (expression[j] === ',' && depth === 1) comma = true;
    }
    const argument = expression.slice(i + 4, j - 1);
    const inner = absoluteLogs(argument);
    result += comma || isCall(argument, 'abs') ? `log(${inner})` : `log(abs(${inner}))`;
    i = j;
  }
  return result;
}
