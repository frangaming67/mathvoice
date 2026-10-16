import nerdamer from 'nerdamer/all.js';
import {
  parse,
  type Complex as MathComplex,
  type MathNode,
  type FunctionNode,
  type OperatorNode,
  type ParenthesisNode,
} from 'mathjs';
import { formatNumber } from '../accessibility/numberSpeech';
import { parseCommand, splitArguments } from '../parser/commands';
import type { AngleMode, CalculationResult, CalculationStep, NumberMode } from '../types';
import { continuousInterval } from './DomainService';
import {
  SymbolicError,
  absoluteLogs,
  compileReal,
  freeVariables,
  safeCas,
  samplePoints,
  translateCasError,
  verifyAntiderivative,
  verifyDerivative,
  verifyEquivalent,
  type Evaluator,
  type Scope,
} from './casVerify';
import { math } from './mathRuntime';
import {
  LIMIT_STEPS,
  integrate as quadrature,
  limitAtZero,
  polynomialRoots,
  rational,
  realRoots,
  type LimitEstimate,
} from './numerics';

const commands = new Set([
  'diff',
  'integrate',
  'limit',
  'solve',
  'simplify',
  'expand',
  'factor',
  'partfrac',
  'substitute',
  'system',
  'inequality',
  'series',
]);
const functions = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'exp',
  'ln',
  'log',
  'abs',
]);
const nodeTypes = new Set([
  'ConstantNode',
  'SymbolNode',
  'ParenthesisNode',
  'FunctionNode',
  'OperatorNode',
]);
function safeExpression(expression: string): MathNode {
  let node: MathNode;
  try {
    node = parse(expression);
  } catch {
    throw new SymbolicError(
      'No pude interpretar la expresión simbólica. Revisá los paréntesis y operadores.',
    );
  }
  node.traverse((child) => {
    if (!nodeTypes.has(child.type))
      throw new SymbolicError(
        'Usá números, variables, funciones y operadores matemáticos en esta operación.',
      );
    if (child.type === 'ConstantNode' && !/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(child.toString()))
      throw new SymbolicError('Solo se admiten constantes numéricas.');
    if (child.type === 'SymbolNode' && !/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/.test(child.toString()))
      throw new SymbolicError('Usá nombres de variables de hasta 20 caracteres.');
    if (child.type === 'FunctionNode' && !functions.has((child as FunctionNode).fn.name ?? ''))
      throw new SymbolicError('Esa función no está disponible dentro del cálculo simbólico.');
    if (child.type === 'FunctionNode') {
      const fn = child as FunctionNode;
      if (fn.args.length !== 1 && !(fn.fn.name === 'log' && fn.args.length === 2))
        throw new SymbolicError('Revisá la cantidad de argumentos de la función.');
    }
    if (
      child.type === 'OperatorNode' &&
      !['+', '-', '*', '/', '^'].includes((child as OperatorNode).op)
    )
      throw new SymbolicError('Ese operador no está disponible en el cálculo simbólico.');
  });
  return node;
}

// Toda llamada a nerdamer pasa por safeCas, que traduce sus errores al español.
const casText = (expression: string) => safeCas(() => nerdamer(expression).toString());
const casVariables = (expression: string) => safeCas(() => nerdamer(expression).variables());
const substitute = (expression: string, name: string, value: string) =>
  safeCas(() => nerdamer(expression).sub(name, value).toString());

// Texto para nerdamer. La multiplicación implícita se escribe con «*»: nerdamer descarta el
// segundo factor de «(x - 2) (x + 3)».
function casString(node: MathNode): string {
  return node.toString({
    implicit: 'show',
    handler: (child: MathNode) => {
      if (child.type !== 'FunctionNode') return undefined;
      const fn = child as FunctionNode;
      if (fn.fn.name === 'ln') return `log(${casString(fn.args[0])})`;
      if (fn.fn.name === 'log') {
        const argument = casString(fn.args[0]);
        const base = fn.args[1] ? casString(fn.args[1]) : '10';
        if (!casVariables(argument).length && !casVariables(base).length)
          return casText(`log(${argument},${base})`);
        return `(log(${argument})/log(${base}))`;
      }
      return undefined;
    },
  });
}
function toCas(expression: string): string {
  return casString(safeExpression(expression));
}
function variable(value = 'x') {
  if (!/^[a-zA-Z]$/.test(value) || ['e', 'i'].includes(value))
    throw new SymbolicError(
      'Elegí una variable de una letra, por ejemplo x, y o t; e e i son constantes.',
    );
  return value;
}
/** Función real de una salida de nerdamer; null si usa algo que no se sabe evaluar. */
function evaluatorOf(expression: string): Evaluator | null {
  return compileReal(expression, 'cas');
}
const never: Evaluator = () => NaN;
/** Valor de una constante devuelta por el motor (∞ incluido); NaN si no es un número real. */
function numberOf(expression: string): number {
  const text = expression.trim();
  if (text === 'Infinity') return Infinity;
  if (text === '-Infinity') return -Infinity;
  const value = evaluatorOf(text)?.({}) ?? NaN;
  if (!Number.isNaN(value)) return value;
  try {
    return Number(nerdamer(text).evaluate().text('decimals'));
  } catch {
    return NaN;
  }
}
// Resuelve llamadas con argumento numérico que nerdamer deja sin evaluar y valen un entero
// (erf(0), sqrt(1), cos(0)): así no se lee «raíz cuadrada de 1» ni «erf de 0».
function tidy(text: string): string {
  let current = text;
  for (let i = 0; i < 5; i++) {
    const next = current.replace(/\b[a-zA-Z]+\(-?\d+(?:\.\d+)?\)/g, (call) => {
      const value = evaluatorOf(call)?.({}) ?? NaN;
      return Number.isInteger(value) && Math.abs(value) <= 1e6
        ? value < 0
          ? `(${value})`
          : String(value)
        : call;
    });
    if (next === current) break;
    current = next;
  }
  if (current === text) return text;
  try {
    return casText(current);
  } catch {
    return text;
  }
}
// Constante exacta en su forma más corta que conserve el valor (nunca con fracciones aproximadas).
function tidyConstant(text: string): string {
  const base = tidy(text);
  const value = numberOf(base);
  try {
    const expanded = tidy(casText(`expand(${base})`));
    if (
      !approximated(expanded) &&
      expanded.length < base.length &&
      Math.abs(numberOf(expanded) - value) <= 1e-12 * Math.max(1, Math.abs(value))
    )
      return expanded;
  } catch {
    return base;
  }
  return base;
}
function realNumber(value: string): number {
  const expression = toCas(value);
  if (casVariables(expression).length)
    throw new SymbolicError('El extremo debe ser un número real, sin variables.');
  const n = numberOf(expression);
  if (!Number.isFinite(n)) throw new SymbolicError('El extremo debe ser un número real finito.');
  return n;
}
function polynomial(node: MathNode): boolean {
  if (node.type === 'FunctionNode') return false;
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode;
    if (op.op === '/' && op.args[1].filter((child) => child.type === 'SymbolNode').length)
      return false;
    if (op.op === '^' && !/^\d+$/.test(op.args[1].toString())) return false;
  }
  let valid = true;
  node.forEach((child) => {
    if (!polynomial(child)) valid = false;
  });
  return valid;
}
const readable = (value: string) => value.replace(/\blog\(/g, 'ln(');
function resolved(raw: string): string {
  if (/\b(integrate|defint|limit|solve|diff)\(/.test(raw))
    throw new SymbolicError(
      'El motor no encontró una solución cerrada para esta expresión. No se muestra una operación sin resolver como resultado.',
    );
  if (raw.includes('NaN') || raw.includes('undefined'))
    throw new SymbolicError('La operación no tiene un resultado definido en ese dominio.');
  return raw;
}
const unverified = (what: string) =>
  new SymbolicError(
    `No pude verificar el resultado del motor simbólico: ${what}. No lo muestro para no darte un resultado falso.`,
  );
function constantDecimal(raw: string): string | undefined {
  if (freeVariables(readable(raw)).length) return undefined;
  const n = numberOf(raw);
  if (!Number.isFinite(n)) return undefined;
  const text = formatNumber(n, { significant: 12 });
  return text !== raw ? text : undefined;
}
/** Cifras significativas confiables de una estimación numérica, entre 3 y 10. */
function significantDigits(value: number, error: number): number {
  if (!(error > 0) || value === 0) return 10;
  return Math.min(10, Math.max(3, Math.floor(Math.log10(Math.abs(value) / error))));
}
function complexText(re: number, im: number, significant = 10, scale = 1): string {
  const real = formatNumber(re, { significant, scale });
  const imaginary = formatNumber(Math.abs(im), { significant, scale });
  if (imaginary === '0') return real;
  const unit = imaginary === '1' ? 'i' : `${imaginary}i`;
  if (real === '0') return im < 0 ? `-${unit}` : unit;
  return `${real} ${im < 0 ? '-' : '+'} ${unit}`;
}
// Paréntesis solo donde hacen falta al sustituir: negativos, fracciones y sumas.
function wrap(value: string): string {
  return /^[\w.]+$/.test(value) || /^[a-z]+\([^()]*\)$/i.test(value) ? value : `(${value})`;
}
function plural(count: number, singular: string, many: string) {
  return `${count} ${count === 1 ? singular : many}`;
}
function graphable(value: string): boolean {
  if (/[=;]/.test(value)) return false;
  const names = freeVariables(value);
  return names.length === 1 && names[0] === 'x';
}

type Value = number | MathComplex;
const parts = (z: Value): [number, number] => (typeof z === 'number' ? [z, 0] : [z.re, z.im]);
const modulus = (z: Value) => Math.hypot(...parts(z));
const distance = (a: Value, b: Value) => {
  const [ar, ai] = parts(a);
  const [br, bi] = parts(b);
  return Math.hypot(ar - br, ai - bi);
};
function byValue(a: Value, b: Value) {
  const [ar, ai] = parts(a);
  const [br, bi] = parts(b);
  if ((ai === 0) !== (bi === 0)) return ai === 0 ? -1 : 1;
  return ar - br || ai - bi;
}
function complexValue(text: string): Value | null {
  try {
    const value: unknown = math.evaluate(readable(text), { ln: math.log });
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (math.isComplex(value)) {
      const z = value as MathComplex;
      if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return null;
      return Math.abs(z.im) <= 1e-14 * Math.max(1, Math.abs(z.re)) ? z.re : z;
    }
    return null;
  } catch {
    return null;
  }
}
const approximated = (text: string) => /\d{7,}/.test(text);

interface Check {
  ok: boolean;
  a: unknown;
  b: unknown;
  size: number;
}
type Checker = (scope: Record<string, unknown>) => Check | null;
// Compara ambos lados de la ecuación original (con su dominio) en un valor candidato.
function equationChecker(leftText: string, rightText: string): Checker {
  const left = safeExpression(leftText).compile();
  const right = safeExpression(rightText).compile();
  const finite = (value: unknown) =>
    typeof value === 'number'
      ? Number.isFinite(value)
      : math.isComplex(value) &&
        Number.isFinite((value as MathComplex).re) &&
        Number.isFinite((value as MathComplex).im);
  return (scope) => {
    try {
      const map = new Map<string, unknown>([
        ...Object.entries(scope),
        ['ln', math.log],
        ['log', (n: number, base = 10) => math.log(n, base)],
      ]);
      const a: unknown = left.evaluate(map);
      const b: unknown = right.evaluate(map);
      if (!finite(a) || !finite(b)) return null;
      const size = Math.max(1, Number(math.abs(a as number)), Number(math.abs(b as number)));
      const difference = Number(math.abs(math.subtract(a as number, b as number) as number));
      return { ok: difference <= 1e-8 * size, a, b, size };
    } catch {
      return null;
    }
  };
}
function sideText(value: unknown, scale: number): string {
  if (typeof value === 'number') return formatNumber(value, { significant: 12, scale });
  const z = value as MathComplex;
  return complexText(z.re, z.im, 12, scale);
}
function verificationStep(v: string, text: string, check: Check): CalculationStep {
  const left = sideText(check.a, check.size);
  const right = sideText(check.b, check.size);
  return {
    title: `Verificar ${v} = ${text}`,
    detail:
      left === '0' && right === '0'
        ? 'Sustitución en la ecuación original: ambos lados valen 0.'
        : 'Sustitución en la ecuación original: ambos lados coinciden dentro de la tolerancia relativa de 10 elevado a menos 8.',
    formula: `${left} = ${right}`,
  };
}

function equationSteps(body: string, v: string): CalculationStep[] {
  const steps: CalculationStep[] = [
    {
      title: 'Reunir los términos',
      detail: 'Restar el lado derecho al izquierdo y simplificar, conservando el dominio original.',
      formula: `${readable(body)} = 0`,
    },
  ];
  try {
    if (
      !polynomial(safeExpression(readable(body))) ||
      casVariables(body).some((name) => name !== v)
    )
      return steps;
    const raw = casText(`coeffs(expand(${body}),${v})`);
    const coefficients = splitArguments(raw.slice(1, -1));
    if (coefficients.length === 2) {
      const [b, a] = coefficients;
      steps.push({
        title: 'Despejar la incógnita',
        detail: `Ecuación lineal: coeficiente de ${v} = ${a}; término independiente = ${b}. Dividir el opuesto del término independiente por el coeficiente.`,
        formula: `${v} = -${wrap(b)}/${wrap(a)}`,
      });
    } else if (coefficients.length === 3) {
      const [c, b, a] = coefficients;
      const discriminant = casText(`(${b})^2-4*(${a})*(${c})`);
      steps.push(
        {
          title: 'Identificar los coeficientes',
          detail: `Forma a por ${v} al cuadrado, más b por ${v}, más c igual a cero.`,
          formula: `a = ${a}; b = ${b}; c = ${c}`,
        },
        {
          title: 'Calcular el discriminante',
          detail: 'Elevar b al cuadrado y restar cuatro por a por c.',
          formula: `${wrap(b)}^2 - 4*${wrap(a)}*${wrap(c)} = ${discriminant}`,
        },
        {
          title: 'Aplicar la fórmula cuadrática',
          detail:
            'Obtener un candidato con cada signo de la raíz cuadrada. Un discriminante negativo produce candidatos complejos.',
          formula: `${v} = (-${wrap(b)} + sqrt(${discriminant}))/(2*${wrap(a)}); ${v} = (-${wrap(b)} - sqrt(${discriminant}))/(2*${wrap(a)})`,
        },
      );
    }
  } catch {
    return steps.slice(0, 1);
  }
  return steps;
}

// Coeficientes (c0, c1, …) exactos y numéricos si la expresión es de verdad un polinomio en v.
function polynomialCoefficients(
  expression: string,
  v: string,
): { texts: string[]; values: number[] } | null {
  let texts: string[];
  try {
    const raw = casText(`coeffs(expand(${expression}),${v})`);
    if (!/^\[.*\]$/.test(raw)) return null;
    texts = splitArguments(raw.slice(1, -1));
  } catch {
    return null;
  }
  if (texts.length < 2 || texts.length > 41) return null;
  const values = texts.map(numberOf);
  const original = evaluatorOf(expression);
  if (!values.every(Number.isFinite) || !original) return null;
  // nerdamer a veces pierde coeficientes irracionales: se reconstruye y se compara.
  const rebuilt: Evaluator = (scope) =>
    values.reduceRight((sum, coefficient) => sum * scope[v] + coefficient, 0);
  return verifyEquivalent(original, rebuilt, [v]) === 'ok' ? { texts, values } : null;
}
// ∫ 1/(a·x² + b·x + c) con discriminante negativo, que nerdamer resuelve mal:
// 2/√(4ac − b²) · atan((2a·x + b)/√(4ac − b²)). También cubre k/(…), porque usa 1/f.
function quadraticPrimitive(body: string, v: string): string | null {
  try {
    const reciprocal = casText(`simplify(1/(${body}))`);
    const coefficients = polynomialCoefficients(reciprocal, v);
    if (coefficients?.texts.length !== 3) return null;
    const [c, b, a] = coefficients.texts;
    const gap = casText(`4*(${a})*(${c})-(${b})^2`);
    if (!(numberOf(gap) > 0)) return null;
    return casText(`2/sqrt(${gap})*atan((2*(${a})*${v}+(${b}))/sqrt(${gap}))`);
  } catch {
    return null;
  }
}
// Primitivas candidatas en orden de preferencia: la de nerdamer, la misma con ln|u| y la regla
// propia para recíprocos de cuadráticas. Cada una se verifica antes de usarla.
function primitiveCandidates(body: string, v: string): string[] {
  const candidates: string[] = [];
  try {
    const primitive = tidy(casText(`integrate(${body},${v})`));
    if (!/\bintegrate\(/.test(primitive)) {
      candidates.push(primitive);
      if (/\blog\(/.test(primitive)) candidates.push(absoluteLogs(primitive));
    }
  } catch {
    // Sin primitiva de nerdamer: quedan las alternativas.
  }
  const quadratic = quadraticPrimitive(body, v);
  if (quadratic) candidates.push(quadratic);
  return candidates;
}
function exactCandidates(residual: string, v: string): { text: string; value: Value }[] {
  try {
    const raw = casText(`solve(${residual}=0,${v})`);
    if (!/^\[.+\]$/.test(raw)) return [];
    return splitArguments(raw.slice(1, -1)).flatMap((text) => {
      if (approximated(text) || casVariables(text).length) return [];
      const value = complexValue(text);
      return value === null ? [] : [{ text, value }];
    });
  } catch {
    return [];
  }
}
function polynomialValue(coefficients: number[], z: Value) {
  let value: Value = 0;
  let size = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    value = math.add(math.multiply(value, z) as Value, coefficients[i]) as Value;
    size = size * modulus(z) + Math.abs(coefficients[i]);
  }
  return { value: modulus(value), size };
}
/**
 * Raíces reales de un polinomio (coeficientes de menor a mayor grado). Las raíces de la derivada
 * parten la recta en tramos donde el polinomio es monótono: en cada tramo con cambio de signo hay
 * una raíz, que se encierra por bisección; un punto crítico donde el polinomio se anula es una
 * raíz doble (la curva toca el eje sin cruzarlo).
 */
function realPolynomialRoots(coefficients: number[]): number[] {
  const degree = coefficients.length - 1;
  const p = (x: number) => coefficients.reduceRight((value, c) => value * x + c, 0);
  const scale = (x: number) =>
    coefficients.reduce((sum, c, i) => sum + Math.abs(c * x ** i), 0) || 1;
  if (degree < 1) return [];
  if (degree === 1) return [-coefficients[0] / coefficients[1]];
  if (degree === 2) {
    const [c, b, a] = coefficients;
    const discriminant = b * b - 4 * a * c;
    if (Math.abs(discriminant) <= 1e-12 * (b * b + Math.abs(4 * a * c))) return [-b / (2 * a)];
    if (discriminant < 0) return [];
    const q = -(b + Math.sign(b || 1) * Math.sqrt(discriminant)) / 2;
    return [q / a, c / q].sort((x, y) => x - y);
  }
  const critical = realPolynomialRoots(coefficients.slice(1).map((c, i) => c * (i + 1)));
  const bound =
    1 + Math.max(...coefficients.slice(0, -1).map((c) => Math.abs(c / coefficients[degree])));
  const points = [-bound, ...critical.filter((x) => Math.abs(x) < bound), bound];
  const roots = critical.filter((x) => Math.abs(p(x)) <= 1e-12 * scale(x));
  for (let i = 0; i < points.length - 1; i++) {
    let low = points[i],
      high = points[i + 1];
    const start = Math.sign(p(low));
    if (!start || !Math.sign(p(high)) || start === Math.sign(p(high))) continue;
    for (let mid = (low + high) / 2; mid !== low && mid !== high; mid = (low + high) / 2) {
      const sign = Math.sign(p(mid));
      if (!sign) low = high = mid;
      else if (sign === start) low = mid;
      else high = mid;
    }
    roots.push((low + high) / 2);
  }
  return roots
    .sort((a, b) => a - b)
    .filter((x, i, all) => i === 0 || x - all[i - 1] > 1e-9 * Math.max(1, Math.abs(x)));
}
function periodOf(residual: string, v: string): number | null {
  if (!/\b(sin|cos|tan|sec|csc|cot)\(/.test(residual)) return null;
  const f = evaluatorOf(residual) ?? never;
  for (const period of [Math.PI, 2 * Math.PI]) {
    let compared = 0;
    let periodic = true;
    for (const x of [-2.71, -1.37, -0.29, 0.31, 0.77, 1.93, 2.63, 3.41, 4.37, 5.9]) {
      const a = f({ [v]: x });
      const b = f({ [v]: x + period });
      if (Number.isNaN(a) && Number.isNaN(b)) continue;
      if (!(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))) {
        periodic = false;
        break;
      }
      compared++;
    }
    if (periodic && compared >= 6) return period;
  }
  return null;
}
function multiplicityText(count: number) {
  return (
    ({ 2: 'doble', 3: 'triple', 4: 'cuádruple' } as Record<number, string>)[count] ??
    `de multiplicidad ${count}`
  );
}
function rootCountText(degree: number, real: number, multiple: boolean) {
  const complex = degree - real;
  const total = `${plural(degree, 'raíz', 'raíces')}${multiple ? ' contando multiplicidad' : ''}`;
  if (!complex) return `${total}, ${degree === 1 ? 'real' : 'todas reales'}`;
  if (!real) return `${total}, ${degree === 1 ? 'compleja' : 'todas complejas'}`;
  return `${total}: ${plural(real, 'real', 'reales')} y ${plural(complex, 'compleja', 'complejas')}`;
}
const MAX_SHOWN = 10;
interface Root {
  text: string;
  value: Value;
  exact: boolean;
  check: Check;
  multiplicity: number;
}
function listRoots(v: string, roots: Root[], hidden: number) {
  const warnings: string[] = [];
  if (hidden)
    warnings.push(
      `Hay ${plural(hidden, 'raíz compleja', 'raíces complejas')} que no se ${hidden === 1 ? 'muestra' : 'muestran'} porque está activo el modo real.`,
    );
  if (roots.length > MAX_SHOWN) {
    const rest = roots.length - MAX_SHOWN;
    warnings.push(
      `Y ${plural(rest, 'solución', 'soluciones')} más que no se ${rest === 1 ? 'muestra' : 'muestran'}; se muestran las ${MAX_SHOWN} primeras.`,
    );
  }
  const shown = roots.slice(0, MAX_SHOWN);
  return {
    value: shown.length
      ? shown.map((root) => `${v} = ${readable(root.text)}`).join('; ')
      : 'Sin soluciones reales',
    steps: roots.slice(0, 100).map((root) => verificationStep(v, readable(root.text), root.check)),
    warnings,
    approximate: shown.some((root) => !root.exact),
  };
}

const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
// Término de Taylor ya simplificado: «x^3/6», «3*(x - 1)^2/2», «(1/2)*e*(x - 1)^2».
function taylorTerm(exact: string, value: number, order: number, power: string) {
  let text: string;
  let negative: boolean;
  const match = exact.match(/^(-?\d+)(?:\/(\d+))?$/);
  const simple =
    match &&
    Math.abs(Number(match[1]) / Number(match[2] ?? 1) - value) <=
      1e-9 * Math.max(1, Math.abs(value))
      ? match
      : null;
  const fraction = simple
    ? [Number(simple[1]), Number(simple[2] ?? 1)]
    : rational(value, 10000, 1e-12);
  if (fraction && Number.isSafeInteger(fraction[0]) && Number.isSafeInteger(fraction[1])) {
    const [p, q0] = fraction;
    const q = q0 * factorials[order];
    const d = gcd(Math.abs(p), q) || 1;
    const numerator = Math.abs(p) / d;
    const denominator = q / d;
    negative = p < 0;
    if (numerator === 0) return { text: '0', negative: false, zero: true };
    text = power
      ? `${numerator === 1 ? '' : `${numerator}*`}${power}${denominator === 1 ? '' : `/${denominator}`}`
      : `${numerator}${denominator === 1 ? '' : `/${denominator}`}`;
  } else {
    let coefficient = readable(casText(`(${exact})/${factorials[order]}`));
    negative = coefficient.startsWith('-');
    if (negative) coefficient = coefficient.slice(1);
    const node = parse(coefficient);
    const compound = node.type === 'OperatorNode' && ['+', '-'].includes((node as OperatorNode).op);
    text = power ? `${compound ? `(${coefficient})` : coefficient}*${power}` : coefficient;
  }
  return { text, negative, zero: false };
}
function joinTerms(terms: { text: string; negative: boolean; zero: boolean }[]) {
  const present = terms.filter((term) => !term.zero);
  if (!present.length) return '0';
  return present
    .map((term, k) =>
      k === 0
        ? `${term.negative ? '-' : ''}${term.text}`
        : ` ${term.negative ? '-' : '+'} ${term.text}`,
    )
    .join('');
}
// Polinomio de coeficientes enteros ordenado por grado descendente: «x^29 + x^28 + … + 1».
function orderedPolynomial(text: string, v: string): string {
  try {
    const coefficients = splitArguments(casText(`coeffs(${text},${v})`).slice(1, -1));
    if (!coefficients.every((c) => /^-?\d+$/.test(c))) return text;
    const terms = coefficients
      .map((c, i) => {
        const n = Number(c);
        const power = i === 0 ? '' : i === 1 ? v : `${v}^${i}`;
        const size = Math.abs(n);
        return {
          negative: n < 0,
          zero: n === 0,
          text: power ? `${size === 1 ? '' : `${size}*`}${power}` : String(size),
        };
      })
      .reverse();
    const ordered = joinTerms(terms);
    const [original, rebuilt] = [evaluatorOf(text), evaluatorOf(ordered)];
    return original && rebuilt && verifyEquivalent(original, rebuilt, [v]) === 'ok'
      ? ordered
      : text;
  } catch {
    return text;
  }
}
// Cociente de polinomios de grado alto reducido con mcd y división: evita la factorización
// completa de nerdamer, que tarda segundos (simplify((x^30-1)/(x-1)) tardaba 4 s).
function reducedFraction(expression: string): string | null {
  let node = safeExpression(expression);
  while (node.type === 'ParenthesisNode') node = (node as ParenthesisNode).content;
  if (node.type !== 'OperatorNode' || (node as OperatorNode).op !== '/') return null;
  const [top, bottom] = (node as OperatorNode).args;
  const names = freeVariables(casString(node));
  if (names.length !== 1 || !polynomial(top) || !polynomial(bottom)) return null;
  const [v] = names;
  const numerator = casString(top);
  const denominator = casString(bottom);
  const degree = Math.max(
    Number(casText(`deg(${numerator},${v})`)),
    Number(casText(`deg(${denominator},${v})`)),
  );
  if (!(degree >= 6)) return null;
  const divisor = casText(`gcd(${numerator},${denominator})`);
  const [p, pRest] = splitArguments(casText(`div(${numerator},${divisor})`).slice(1, -1));
  const [q, qRest] = splitArguments(casText(`div(${denominator},${divisor})`).slice(1, -1));
  if (pRest !== '0' || qRest !== '0') return null;
  const quotient = casText(`(${p})/(${q})`);
  return casVariables(q).length ? quotient : orderedPolynomial(quotient, v);
}
function polynomialDegree(expression: string): number {
  const node = safeExpression(expression);
  const names = freeVariables(casString(node));
  if (names.length !== 1 || !polynomial(node)) return 0;
  const degree = Number(casText(`deg(${casString(node)},${names[0]})`));
  return Number.isFinite(degree) ? degree : 0;
}

function sameLimit(a: LimitEstimate, b: LimitEstimate): boolean {
  if (a.kind === 'finite' && b.kind === 'finite')
    return (
      Math.abs(a.value - b.value) <=
      Math.max(1e-6 * Math.max(1, Math.abs(a.value), Math.abs(b.value)), 10 * (a.error + b.error))
    );
  return a.kind === 'infinite' && b.kind === 'infinite' && a.sign === b.sign;
}
function estimateText(estimate: LimitEstimate): string {
  if (estimate.kind === 'infinite') return `${estimate.sign > 0 ? 'más' : 'menos'} infinito`;
  if (estimate.kind === 'finite')
    return formatNumber(estimate.value, {
      significant: Math.min(6, significantDigits(estimate.value, estimate.error)),
    });
  return 'un valor desconocido';
}
// Coherencia entre el resultado del motor y el muestreo numérico de un lado.
function agreement(
  limit: number,
  estimate: LimitEstimate,
  samples: number[],
): 'yes' | 'weak' | 'no' {
  if (Number.isNaN(limit)) return 'no';
  if (estimate.kind === 'finite')
    return Number.isFinite(limit) &&
      Math.abs(limit - estimate.value) <=
        Math.max(1e-6 * Math.max(1, Math.abs(limit)), 10 * estimate.error)
      ? 'yes'
      : 'no';
  if (estimate.kind === 'infinite') return limit === estimate.sign * Infinity ? 'yes' : 'no';
  const tail = samples.slice(-6);
  if (tail.some((value) => !Number.isFinite(value))) return 'no';
  if (!Number.isFinite(limit))
    return tail.every(
      (value, i) =>
        Math.sign(value) === Math.sign(limit) &&
        (i === 0 || Math.abs(value) >= Math.abs(tail[i - 1])),
    )
      ? 'weak'
      : 'no';
  const distances = samples.filter(Number.isFinite).map((value) => Math.abs(value - limit));
  const recent = distances.slice(-6);
  return recent.every((d, i) => i === 0 || d <= recent[i - 1] * 1.05) &&
    recent.at(-1)! < 0.5 * distances[0]
    ? 'weak'
    : 'no';
}
function casLimit(request: () => string): string | null {
  try {
    const raw = casText(request());
    return raw.includes('limit(') || raw.startsWith('[') ? null : raw;
  } catch {
    return null;
  }
}
function limitText(raw: string, value: number): string {
  if (raw === 'Infinity' || raw === '-Infinity') return raw;
  if (raw.includes('Infinity'))
    return Number.isFinite(value)
      ? formatNumber(value, { significant: 12 })
      : value > 0
        ? 'Infinity'
        : '-Infinity';
  return readable(raw);
}

/** Opciones del motor simbólico tomadas de las preferencias. */
export interface SymbolicOptions {
  /** En modo real, solve oculta las raíces complejas y avisa cuántas hay. Sin valor, las muestra. */
  numberMode?: NumberMode;
}
interface Outcome {
  value: string;
  decimal?: string;
  steps: CalculationStep[];
  explanation: string;
  approximate?: boolean;
  warnings?: string[];
  angleMode?: AngleMode;
  angleNote?: string;
}
interface Side {
  estimate: LimitEstimate;
  samples: number[];
}

export class SymbolicEngine {
  supports(expression: string) {
    return commands.has(expression.match(/^([a-z]+)\s*\(/)?.[1] ?? '');
  }
  evaluate(
    expression: string,
    original: string,
    angleMode: AngleMode,
    options: SymbolicOptions = {},
  ): CalculationResult {
    const command = parseCommand(expression);
    if (!command || !commands.has(command.name))
      throw new SymbolicError('Revisá el formato de la operación simbólica.');
    try {
      return this.run(command.name, command.args, original, angleMode, options);
    } catch (error) {
      throw translateCasError(error);
    }
  }

  private run(
    name: string,
    args: string[],
    original: string,
    angleMode: AngleMode,
    options: SymbolicOptions,
  ): CalculationResult {
    if (name === 'system') return this.system(args, original);
    if (name === 'inequality') return this.inequality(args, original);
    const counts: Record<string, number[]> = {
      diff: [1, 2, 3],
      integrate: [1, 2, 4],
      limit: [3, 4],
      solve: [1, 2],
      simplify: [1],
      expand: [1],
      factor: [1],
      partfrac: [2],
      substitute: [3],
      series: [4],
    };
    if (!counts[name].includes(args.length))
      throw new SymbolicError(
        'Faltan argumentos o hay demasiados. Usá el formulario de álgebra y cálculo para completar la operación.',
      );
    const v = ['diff', 'integrate', 'limit', 'solve', 'partfrac', 'substitute', 'series'].includes(
      name,
    )
      ? variable(args[1])
      : 'x';
    const limitSide = name === 'limit' ? (args[3] ?? 'both') : 'both';
    if (!['both', 'left', 'right'].includes(limitSide))
      throw new SymbolicError('El sentido del límite debe ser both, left o right.');
    const outcome =
      name === 'diff'
        ? this.derive(args, v)
        : name === 'integrate'
          ? args.length === 4
            ? this.definiteIntegral(args, v)
            : this.indefiniteIntegral(args, v)
          : name === 'limit'
            ? this.limit(args, v, limitSide as 'both' | 'left' | 'right')
            : name === 'solve'
              ? this.solve(args, v, angleMode, options.numberMode ?? 'complejo')
              : name === 'series'
                ? this.series(args, v)
                : name === 'substitute'
                  ? this.substitute(args, v)
                  : this.transform(name, args, v);
    const warnings = outcome.warnings ?? [];
    return {
      expression: original,
      value: outcome.value,
      ...(outcome.decimal ? { decimal: outcome.decimal } : {}),
      ...(outcome.steps.length ? { steps: outcome.steps } : {}),
      angleMode: outcome.angleMode ?? 'rad',
      kind: ['diff', 'integrate', 'limit', 'series'].includes(name) ? 'Cálculo' : 'Álgebra',
      explanation: `${outcome.explanation} ${outcome.angleNote ?? `El cálculo simbólico usa radianes${angleMode !== 'rad' ? ', independientemente del modo numérico seleccionado' : ''}.`}`,
      ...(outcome.approximate ? { approximate: true } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(graphable(outcome.value) ? { graphable: true } : {}),
    };
  }

  private derive(args: string[], v: string): Outcome {
    const body = toCas(args[0]);
    const order = args[2] ?? '1';
    if (!/^[1-9]$|^10$/.test(order))
      throw new SymbolicError('El orden de la derivada debe ser un entero entre 1 y 10.');
    const steps: CalculationStep[] = [
      {
        title: 'Elegir la variable',
        detail: `Derivar respecto de ${v}; las demás variables son constantes. Se usan radianes.`,
        formula: readable(body),
      },
    ];
    let current = body;
    let checked = true;
    for (let i = 1; i <= Number(order); i++) {
      const next = casText(`diff(${current},${v})`);
      const check = this.checkDerivative(current, next, v);
      if (check === 'mismatch')
        throw unverified('la derivada no coincide con la aproximación numérica');
      if (check === 'unverifiable') checked = false;
      steps.push({
        title: `Derivada de orden ${i}`,
        detail: 'Derivar la expresión del paso anterior y simplificar.',
        formula: `diff(${readable(current)},${v}) = ${readable(next)}`,
      });
      current = next;
    }
    const raw = resolved(casText(current));
    return {
      value: readable(raw),
      decimal: constantDecimal(raw),
      steps,
      explanation: `Derivada de orden ${order} respecto de ${v}. Las demás variables se consideran constantes. El resultado describe la tasa de cambio de la función.${checked ? ' Cada derivada se comparó con una aproximación numérica en varios puntos.' : ''}`,
      warnings: checked
        ? []
        : ['No pude comprobar numéricamente la derivada en puntos de su dominio.'],
    };
  }

  private checkDerivative(f: string, df: string, v: string) {
    const names = [...new Set([v, ...freeVariables(f), ...freeVariables(df)])];
    const [function_, derivative] = [evaluatorOf(f), evaluatorOf(df)];
    return function_ && derivative
      ? verifyDerivative(function_, derivative, v, names)
      : 'unverifiable';
  }

  private indefiniteIntegral(args: string[], v: string): Outcome {
    const body = toCas(args[0]);
    const integrand = evaluatorOf(body) ?? never;
    const candidates = primitiveCandidates(body, v);
    if (!candidates.length)
      throw new SymbolicError(
        'El motor no encontró una solución cerrada para esta expresión. No se muestra una operación sin resolver como resultado.',
      );
    const outcomes = candidates.map((candidate) => {
      const primitive = evaluatorOf(candidate);
      const names = [...new Set([v, ...freeVariables(body), ...freeVariables(candidate)])];
      return primitive ? verifyAntiderivative(primitive, integrand, v, names) : 'unverifiable';
    });
    // La primera verificada; si ninguna lo está, la de nerdamer solo si no se pudo refutar.
    let chosen = outcomes.indexOf('ok');
    if (chosen < 0 && outcomes[0] === 'unverifiable') chosen = 0;
    if (chosen < 0) throw unverified('la derivada de la primitiva no coincide con la función');
    const primitive = resolved(candidates[chosen]);
    const outcome = outcomes[chosen];
    const absolute = chosen > 0 && primitive.includes('log(abs(');
    let derivative: string | undefined;
    try {
      derivative = casText(`diff(${primitive},${v})`);
    } catch {
      derivative = undefined;
    }
    const value = `${readable(primitive)} + C`;
    return {
      value,
      steps: [
        {
          title: 'Obtener una primitiva',
          detail: `Integrar respecto de ${v}.`,
          formula: readable(primitive),
        },
        {
          title: 'Derivar la primitiva',
          detail:
            outcome === 'ok'
              ? 'Se derivó la primitiva y se comparó numéricamente con el integrando en varios puntos de su dominio: coinciden.'
              : 'Esta derivada permite comparar la primitiva con el integrando en su dominio de validez.',
          ...(derivative
            ? { formula: `diff(${readable(primitive)},${v}) = ${readable(derivative)}` }
            : {}),
        },
        {
          title: 'Añadir la constante',
          detail:
            'Las primitivas difieren por una constante en cada intervalo de validez. La derivada de C es cero.',
          formula: value,
        },
      ],
      explanation: `Se busca una primitiva cuya derivada respecto de ${v} sea la expresión original. C es una constante de integración arbitraria. Revisá los intervalos de validez de la primitiva.${absolute ? ' Se agregó valor absoluto dentro de los logaritmos para que la primitiva valga donde la función es real.' : ''}`,
      warnings:
        outcome === 'ok'
          ? []
          : ['No pude comprobar numéricamente la primitiva; verificala derivándola.'],
    };
  }

  private definiteIntegral(args: string[], v: string): Outcome {
    const body = toCas(args[0]);
    const lower = realNumber(args[2]);
    const upper = realNumber(args[3]);
    const low = Math.min(lower, upper);
    const high = Math.max(lower, upper);
    continuousInterval(safeExpression(args[0]), v, [low, high]);
    const f = evaluatorOf(body) ?? never;
    const numeric = quadrature((x) => f({ [v]: x }), lower, upper);
    const reliable =
      Number.isFinite(numeric.value) &&
      (numeric.converged ||
        numeric.error <= 1e-8 * Math.max(Math.abs(numeric.value), 1e-3 * numeric.absolute));
    const interval: CalculationStep = {
      title: 'Comprobar el intervalo',
      detail: `El análisis conservador confirmó continuidad real entre ${formatNumber(low)} y ${formatNumber(high)}. Se conserva el orden de los límites ingresados.`,
    };
    const evaluated = primitiveCandidates(body, v).flatMap((primitive) => {
      try {
        const upperText = tidy(substitute(primitive, v, toCas(args[3])));
        const lowerText = tidy(substitute(primitive, v, toCas(args[2])));
        const exact = tidyConstant(casText(`(${upperText})-(${lowerText})`));
        if (/NaN|undefined|Infinity/.test(exact)) return [];
        return [{ primitive, upper: upperText, lower: lowerText, exact, value: numberOf(exact) }];
      } catch {
        return [];
      }
    });
    const close = (value: number) =>
      Number.isFinite(value) &&
      Math.abs(value - numeric.value) <=
        1e-6 * Math.max(Math.abs(value), Math.abs(numeric.value)) +
          1e-9 * Math.max(1, numeric.absolute);
    // Entre las que coinciden, mejor una con F(a) y F(b) reales (ln|x| antes que ln de un negativo).
    const matches = reliable ? evaluated.filter(({ value }) => close(value)) : [];
    const agreeing =
      matches.find(
        ({ upper: top, lower: bottom }) =>
          Number.isFinite(numberOf(top)) && Number.isFinite(numberOf(bottom)),
      ) ?? matches[0];
    // Sin cuadratura confiable, solo sirve una primitiva verificada derivándola.
    const derived = reliable
      ? undefined
      : evaluated.find(
          ({ primitive, value }) =>
            Number.isFinite(value) &&
            verifyAntiderivative(evaluatorOf(primitive) ?? never, f, v, [v]) === 'ok',
        );
    const symbolic = agreeing ?? derived;
    const agrees = Boolean(agreeing);
    if (symbolic) {
      const value = readable(resolved(symbolic.exact));
      return {
        value,
        decimal: constantDecimal(symbolic.exact),
        steps: [
          interval,
          {
            title: 'Obtener una primitiva',
            detail: `El motor simbólico integra respecto de ${v}.`,
            formula: `F(${v}) = ${readable(symbolic.primitive)}`,
          },
          {
            title: 'Evaluar el extremo superior',
            detail: `Sustituir ${v} por ${args[3]} en la primitiva.`,
            formula: `F(${args[3]}) = ${readable(symbolic.upper)}`,
          },
          {
            title: 'Evaluar el extremo inferior',
            detail: `Sustituir ${v} por ${args[2]} en la primitiva.`,
            formula: `F(${args[2]}) = ${readable(symbolic.lower)}`,
          },
          {
            title: 'Restar los valores de la primitiva',
            detail: agrees
              ? 'Valor en el extremo superior menos valor en el inferior. Coincide con la integración numérica del integrando original.'
              : 'Valor en el extremo superior menos valor en el inferior.',
            formula: `F(${args[3]}) - F(${args[2]}) = ${value}`,
          },
        ],
        explanation: `Se obtiene una primitiva F respecto de ${v} y se calcula F(${args[3]}) menos F(${args[2]}), por el teorema fundamental del cálculo.${agrees ? ' El valor se contrastó con una integración numérica adaptativa.' : ''}`,
        warnings: agrees
          ? []
          : [
              'No pude contrastar el valor con una integración numérica; la primitiva sí se verificó derivándola.',
            ],
      };
    }
    if (!reliable)
      throw new SymbolicError(
        'No pude calcular esta integral con garantías: ni la primitiva del motor ni la integración numérica son confiables en este intervalo.',
      );
    const digits = significantDigits(
      numeric.value,
      Math.max(numeric.error, Number.EPSILON * Math.abs(numeric.value)),
    );
    const value = formatNumber(numeric.value, { significant: digits });
    return {
      value,
      approximate: true,
      steps: [
        interval,
        ...(evaluated.length
          ? [
              {
                title: 'Descartar la primitiva del motor',
                detail:
                  'La primitiva que dio el motor simbólico no coincide con la integración numérica en este intervalo, así que no se usa.',
              },
            ]
          : []),
        {
          title: 'Integrar numéricamente',
          detail: `Cuadratura adaptativa de Gauss–Kronrod sobre el integrando original, con ${digits} cifras significativas confiables.`,
          formula: value,
        },
      ],
      explanation: `Se aproxima la integral entre ${args[2]} y ${args[3]} con una cuadratura adaptativa de Gauss–Kronrod sobre el integrando original. Es un valor numérico con ${digits} cifras significativas confiables.`,
      warnings: [
        evaluated.length
          ? 'La primitiva del motor no es válida en este intervalo; muestro el valor numérico.'
          : 'El motor simbólico no encontró una primitiva cerrada; muestro el valor numérico.',
      ],
    };
  }

  private limit(args: string[], v: string, side: 'both' | 'left' | 'right'): Outcome {
    const body = toCas(args[0]);
    if (freeVariables(body).some((name) => name !== v))
      throw new SymbolicError(
        'Para comprobar el límite, la expresión solo puede depender de la variable del límite.',
      );
    const f = evaluatorOf(body) ?? never;
    const g = (x: number) => f({ [v]: x });
    const pointText = args[2].trim();
    const explanation = `Se estudia el valor al que se acerca la expresión cuando ${v} tiende a ${args[2]}. El punto no necesita pertenecer al dominio de la función.`;
    if (/^[+-]?Infinity$/.test(pointText)) {
      if (side !== 'both')
        throw new SymbolicError(
          'Los límites laterales requieren un punto finito. Para infinito usá el límite sin sentido lateral.',
        );
      const sign = pointText.startsWith('-') ? -1 : 1;
      const at = (t: number) => g(sign / t);
      const raw = casLimit(() => `limit(${body},${v},${sign < 0 ? '-' : ''}Infinity)`);
      return this.limitOutcome(
        raw,
        [{ estimate: limitAtZero(at), samples: LIMIT_STEPS.map(at) }],
        explanation,
        'No pude confirmar el límite: los valores no se estabilizan al crecer la variable. Puede que el límite no exista.',
      );
    }
    const point = realNumber(pointText);
    const scale = Math.max(1, Math.abs(point));
    const directions = side === 'both' ? [-1, 1] : [side === 'left' ? -1 : 1];
    const sides: Side[] = directions.map((direction) => {
      const at = (t: number) => g(point + direction * t * scale);
      return { estimate: limitAtZero(at), samples: LIMIT_STEPS.map(at) };
    });
    if (sides.some(({ samples }) => samples.every(Number.isNaN)))
      throw new SymbolicError(
        side === 'both'
          ? `No pude confirmar un límite bilateral: la expresión no está definida en los reales a ambos lados de ${pointText}.`
          : 'No pude confirmar el límite lateral en el dominio real del lado solicitado.',
      );
    if (sides.length === 2) {
      const [left, right] = sides.map(({ estimate }) => estimate);
      // Laterales distintos: no hace falta (ni conviene) consultar al motor simbólico.
      if (left.kind !== 'none' && right.kind !== 'none' && !sameLimit(left, right))
        throw new SymbolicError(
          `El límite no existe: por izquierda ${left.kind === 'infinite' ? 'tiende a' : 'se acerca a'} ${estimateText(left)} y por derecha ${right.kind === 'infinite' ? 'tiende a' : 'se acerca a'} ${estimateText(right)}. Como los límites laterales no coinciden, no hay límite bilateral.`,
        );
    }
    const delta = 1e-3 * scale;
    let raw: string | null;
    let continuous = false;
    try {
      continuousInterval(
        safeExpression(args[0]),
        v,
        side === 'left'
          ? [point - delta, point]
          : side === 'right'
            ? [point, point + delta]
            : [point - delta, point + delta],
      );
      raw = casText(substitute(body, v, toCas(pointText)));
      continuous = true;
    } catch {
      const sign = side === 'left' ? -1 : 1;
      raw = casLimit(() =>
        side === 'both'
          ? `limit(${body},${v},${point})`
          : `limit(${substitute(body, v, `(${point})+(${sign})/(${v})`)},${v},Infinity)`,
      );
    }
    const lateral =
      side === 'both'
        ? ''
        : ` Límite por ${side === 'left' ? 'izquierda' : 'derecha'} cuando ${v} tiende a ${args[2]}.`;
    return this.limitOutcome(
      raw,
      sides,
      `${explanation}${lateral}${continuous ? ` La expresión es continua ${side === 'both' ? 'alrededor del punto' : 'en un intervalo lateral cerrado'}, así que el límite es su valor en el punto.` : ''}`,
      side === 'both'
        ? 'No pude confirmar un límite bilateral: revisá los límites por izquierda y por derecha.'
        : 'No pude confirmar el límite lateral en el dominio real del lado solicitado.',
    );
  }

  private limitOutcome(
    raw: string | null,
    sides: Side[],
    explanation: string,
    failure: string,
  ): Outcome {
    const value = raw === null ? NaN : numberOf(raw);
    const verdicts = sides.map(({ estimate, samples }) => agreement(value, estimate, samples));
    if (raw !== null && verdicts.every((verdict) => verdict !== 'no')) {
      const weak = verdicts.includes('weak');
      return {
        value: limitText(raw, value),
        decimal: Number.isFinite(value) ? constantDecimal(raw) : undefined,
        steps: [],
        explanation: `${explanation}${weak ? '' : ` Se comprobaron aproximaciones numéricas ${sides.length === 2 ? 'por ambos lados' : 'al acercarse al punto'} como control de coherencia, no como demostración de convergencia.`}`,
        warnings: weak
          ? [
              'El muestreo numérico es compatible con este valor, pero no lo confirma con precisión.',
            ]
          : [],
      };
    }
    const estimates = sides.map(({ estimate }) => estimate);
    const known = estimates.every((estimate) => estimate.kind !== 'none');
    if (!known || (estimates.length === 2 && !sameLimit(estimates[0], estimates[1])))
      throw new SymbolicError(failure);
    const best = estimates.reduce((a, b) =>
      a.kind === 'finite' && b.kind === 'finite' && b.error < a.error ? b : a,
    );
    // Una estimación por muestreo no da más de 6 cifras confiables (la cancelación en
    // expresiones como sqrt(x^2+1)-x deja residuos del orden de 1e-11 donde el límite es 0).
    const text =
      best.kind === 'finite'
        ? formatNumber(Math.abs(best.value) < 1e-9 ? 0 : best.value, {
            significant: Math.min(6, significantDigits(best.value, best.error)),
          })
        : best.kind === 'infinite' && best.sign > 0
          ? 'Infinity'
          : '-Infinity';
    return {
      value: text,
      approximate: true,
      steps: [],
      explanation: `${explanation} El valor es una estimación numérica obtenida al acercarse al punto, no una demostración.`,
      warnings: [
        raw === null
          ? 'El motor simbólico no resolvió el límite; muestro una estimación numérica.'
          : 'El motor simbólico dio un resultado que no coincide con el muestreo numérico; muestro una estimación numérica.',
      ],
    };
  }

  private solve(args: string[], v: string, angleMode: AngleMode, mode: NumberMode): Outcome {
    const sides = args[0].split('=');
    if (sides.length > 2)
      throw new SymbolicError('Introducí una ecuación con un solo signo igual.');
    if (sides.length === 2 && sides.some((side) => !side.trim()))
      throw new SymbolicError(
        'Falta completar un lado de la ecuación. Escribí una expresión a cada lado del signo igual.',
      );
    const [leftText, rightText = '0'] = sides;
    const residual = casText(`simplify((${toCas(leftText)})-(${toCas(rightText)}))`);
    if (residual === '0')
      throw new SymbolicError(
        'La ecuación se simplifica a una identidad. Puede tener infinitas soluciones dentro de su dominio original; no hay una lista finita de raíces.',
      );
    const check = equationChecker(leftText, rightText);
    const steps = equationSteps(residual, v);
    const parameters = freeVariables(readable(residual)).filter((name) => name !== v);
    if (parameters.length) return this.solveWithParameters(residual, v, parameters, check, steps);
    const coefficients = polynomialCoefficients(residual, v);
    if (coefficients)
      return this.solvePolynomial(coefficients.values, residual, v, check, steps, mode);
    const period = periodOf(residual, v);
    if (period) return this.solvePeriodic(residual, v, period, check, steps, angleMode);
    return this.solveGeneral(residual, v, check, steps, mode);
  }

  private solvePolynomial(
    coefficients: number[],
    residual: string,
    v: string,
    check: Checker,
    steps: CalculationStep[],
    mode: NumberMode,
  ): Outcome {
    const found = polynomialRoots(coefficients);
    const degree = found?.reduce((sum, root) => sum + root.multiplicity, 0) ?? 0;
    if (!found || !degree) return this.solveGeneral(residual, v, check, steps, mode);
    const exact = degree <= 4 ? exactCandidates(residual, v) : [];
    const roots: Root[] = [];
    const rejected: string[] = [];
    let hidden = 0;
    const exactFor = (root: { re: number; im: number }) => {
      const numeric: Value = root.im === 0 ? root.re : math.complex(root.re, root.im);
      return exact.find(
        (candidate) => distance(candidate.value, numeric) <= 1e-6 * Math.max(1, modulus(numeric)),
      );
    };
    // Las raíces complejas se muestran todas exactas o todas decimales: nerdamer suele dar
    // formas ilegibles como ((1/2)*i*sqrt(3)+1/2)^2*2^(1/3) para una sola del par conjugado.
    const complexExact = found
      .filter((root) => root.im !== 0)
      .every((root) => {
        const candidate = exactFor(root);
        return candidate !== undefined && !candidate.text.includes('^');
      });
    for (const root of found) {
      const numeric: Value = root.im === 0 ? root.re : math.complex(root.re, root.im);
      const match = root.im !== 0 && !complexExact ? undefined : exactFor(root);
      if (mode === 'real' && root.im !== 0) {
        hidden += root.multiplicity;
        continue;
      }
      const text = match ? match.text : complexText(root.re, root.im, 10);
      const value = match ? match.value : numeric;
      const verdict = check({ [v]: value });
      if (!verdict?.ok) {
        rejected.push(readable(text));
        continue;
      }
      let isExact = Boolean(match);
      if (!match) {
        const shown = complexValue(text);
        if (shown !== null) {
          const { value: residue, size } = polynomialValue(coefficients, shown);
          isExact = residue <= 1e-13 * size;
        }
      }
      roots.push({ text, value, exact: isExact, check: verdict, multiplicity: root.multiplicity });
    }
    if (!roots.length && !hidden)
      throw new SymbolicError(
        'No pude verificar soluciones en la ecuación original. Revisá su dominio; las ecuaciones con parámetros necesitan valores definidos.',
      );
    const real = found
      .filter((root) => root.im === 0)
      .reduce((sum, root) => sum + root.multiplicity, 0);
    const multiple = found.some((root) => root.multiplicity > 1);
    const list = listRoots(v, roots, hidden);
    const notes = roots
      .filter((root) => root.multiplicity > 1)
      .map(
        (root) => `${v} = ${readable(root.text)} es raíz ${multiplicityText(root.multiplicity)}.`,
      );
    return {
      value: list.value,
      steps: [
        ...steps,
        ...(degree >= 3
          ? [
              {
                title: 'Buscar todas las raíces',
                detail:
                  'Método numérico de Aberth sobre los coeficientes del polinomio; se agrupan las raíces repetidas y se conservan las formas exactas que el motor verificó.',
              },
            ]
          : []),
        ...list.steps,
      ],
      explanation: [
        `Ecuación polinómica de grado ${degree}: ${rootCountText(degree, real, multiple)}.`,
        ...notes,
        'Cada solución mostrada se verificó por sustitución en ambos lados de la ecuación original, con tolerancia relativa de 10 elevado a menos 8.',
        ...(list.approximate
          ? ['Las soluciones decimales están redondeadas a 10 cifras significativas.']
          : []),
      ].join(' '),
      approximate: list.approximate,
      warnings: [
        ...list.warnings,
        ...rejected.map(
          (text) =>
            `Se descartó ${v} = ${text} porque no cumple la ecuación original; queda fuera de su dominio.`,
        ),
      ],
    };
  }

  private solvePeriodic(
    residual: string,
    v: string,
    period: number,
    check: Checker,
    steps: CalculationStep[],
    angleMode: AngleMode,
  ): Outcome {
    const f = evaluatorOf(residual) ?? never;
    const unit = { rad: 1, deg: 180 / Math.PI, grad: 200 / Math.PI }[angleMode];
    const full = period === Math.PI ? 1 : 2;
    const periodText = {
      rad: full === 1 ? 'pi' : '2*pi',
      deg: String(180 * full),
      grad: String(200 * full),
    }[angleMode];
    const periodWords = {
      rad: full === 1 ? 'pi' : 'dos pi',
      deg: `${180 * full} grados`,
      grad: `${200 * full} gradianes`,
    }[angleMode];
    const solutions: { text: string; exact: boolean; check: Check }[] = [];
    for (const root of realRoots((x) => f({ [v]: x }), 0, period)) {
      const ratio = rational(root / Math.PI, 12, 1e-9);
      const verdict = check({ [v]: ratio ? (ratio[0] * Math.PI) / ratio[1] : root });
      if (!verdict?.ok) continue;
      let text: string;
      let exact = true;
      if (angleMode === 'rad') {
        if (ratio) {
          const [p, q] = ratio;
          text = p === 0 ? '0' : `${p === 1 ? '' : `${p}*`}pi${q === 1 ? '' : `/${q}`}`;
        } else {
          text = formatNumber(root, { significant: 10 });
          exact = false;
        }
      } else {
        const angle = root * unit;
        const fraction = rational(angle, 12, 1e-9);
        if (fraction)
          text = fraction[1] === 1 ? String(fraction[0]) : `${fraction[0]}/${fraction[1]}`;
        else {
          text = formatNumber(angle, { significant: 10 });
          exact = false;
        }
      }
      solutions.push({ text, exact, check: verdict });
    }
    if (!solutions.length)
      throw new SymbolicError(
        `No encontré soluciones reales: la ecuación se repite cada ${periodWords} y no se anula en un período completo.`,
      );
    const general = solutions
      .map(({ text }) => {
        const shift = angleMode === 'rad' ? `${full === 2 ? '2*' : ''}k*pi` : `${periodText}*k`;
        return `${v} = ${text === '0' ? shift : `${text} + ${shift}`}`;
      })
      .join('; ');
    const approximate = solutions.some(({ exact }) => !exact);
    const unitWords = { rad: 'radianes', deg: 'grados', grad: 'gradianes' }[angleMode];
    return {
      value: solutions.map(({ text }) => `${v} = ${text}`).join('; '),
      steps: [
        ...steps,
        {
          title: 'Buscar las soluciones en un período',
          detail: `La ecuación se repite cada ${periodWords}. Se buscan todas sus raíces reales entre 0 y ${periodWords} y se verifican en la ecuación original.`,
        },
        ...solutions.map(({ text, check: verdict }) => verificationStep(v, text, verdict)),
        {
          title: 'Escribir la forma general',
          detail:
            'Sumar a cada solución un múltiplo entero del período; k es un entero cualquiera.',
          formula: general,
        },
      ],
      explanation: `Soluciones principales entre 0 y ${periodWords}, en ${unitWords}. La ecuación se repite cada ${periodWords}, así que la forma general es ${general}, con k entero. Cada solución se verificó por sustitución en la ecuación original.${approximate ? ' Las soluciones decimales están redondeadas a 10 cifras significativas.' : ''}`,
      approximate,
      warnings: [
        `Hay infinitas soluciones: a cada una se le puede sumar un múltiplo entero de ${periodWords}.`,
      ],
      angleMode,
      angleNote:
        angleMode === 'rad'
          ? 'Las soluciones están en radianes.'
          : `Las soluciones están en ${unitWords}, como el modo angular seleccionado.`,
    };
  }

  private solveGeneral(
    residual: string,
    v: string,
    check: Checker,
    steps: CalculationStep[],
    mode: NumberMode,
  ): Outcome {
    const raw = resolved(casText(`solve(${residual}=0,${v})`));
    if (raw === '[]')
      throw new SymbolicError(
        'No se encontraron soluciones. Esto no demuestra que la ecuación no tenga solución.',
      );
    const roots: Root[] = [];
    for (const candidate of splitArguments(raw.replace(/^\[|\]$/g, ''))) {
      if (casVariables(candidate).length) continue;
      const value = complexValue(candidate);
      if (value === null) continue;
      const verdict = check({ [v]: value });
      if (!verdict?.ok) continue;
      const exact = !approximated(candidate);
      const [re, im] = parts(value);
      const text = exact ? candidate : complexText(re, im, 10);
      const duplicate = roots.findIndex(
        (root) => distance(root.value, value) <= 1e-9 * Math.max(1, modulus(value)),
      );
      if (duplicate >= 0) {
        if (exact && !roots[duplicate].exact)
          roots[duplicate] = { text, value, exact, check: verdict, multiplicity: 1 };
        continue;
      }
      roots.push({ text, value, exact, check: verdict, multiplicity: 1 });
    }
    const visible = roots.filter((root) => mode !== 'real' || parts(root.value)[1] === 0);
    const hidden = roots.length - visible.length;
    if (!roots.length)
      throw new SymbolicError(
        'No pude verificar soluciones en la ecuación original. Revisá su dominio; las ecuaciones con parámetros necesitan valores definidos.',
      );
    visible.sort((a, b) => byValue(a.value, b.value));
    const list = listRoots(v, visible, hidden);
    return {
      value: list.value,
      steps: [...steps, ...list.steps],
      explanation: `Cada solución mostrada se verificó por sustitución numérica en ambos lados de la ecuación original, con tolerancia relativa de 10 elevado a menos 8. Se descartaron candidatos no verificables o fuera del dominio y los repetidos. El motor puede no encontrar todas las raíces de ecuaciones trascendentes.${list.approximate ? ' Las soluciones decimales están redondeadas a 10 cifras significativas.' : ''}`,
      approximate: list.approximate,
      warnings: list.warnings,
    };
  }

  private solveWithParameters(
    residual: string,
    v: string,
    parameters: string[],
    check: Checker,
    steps: CalculationStep[],
  ): Outcome {
    const raw = resolved(casText(`solve(${residual}=0,${v})`));
    const candidates = /^\[.+\]$/.test(raw) ? splitArguments(raw.slice(1, -1)) : [];
    const scopes = samplePoints(parameters).slice(0, 16);
    const solutions: string[] = [];
    for (const candidate of candidates) {
      let text: string;
      try {
        text = casText(`simplify(${candidate})`);
      } catch {
        text = candidate;
      }
      if (casVariables(text).includes(v)) continue;
      const formula = evaluatorOf(text) ?? never;
      let verified = 0;
      let failed = false;
      for (const scope of scopes) {
        const value = formula(scope);
        if (Number.isNaN(value)) continue;
        const verdict = check({ ...scope, [v]: value });
        if (!verdict) continue;
        if (!verdict.ok) {
          failed = true;
          break;
        }
        if (++verified >= 4) break;
      }
      if (!failed && verified >= 3) solutions.push(readable(text));
    }
    if (!solutions.length)
      throw new SymbolicError(
        `No pude despejar ${v} con una fórmula verificable. Si la ecuación tiene otros parámetros, probá darles valores.`,
      );
    const names = parameters.join(', ');
    return {
      value: solutions.map((text) => `${v} = ${text}`).join('; '),
      steps: [
        ...steps,
        {
          title: 'Verificar con valores de prueba',
          detail: `Se reemplazó ${names} por varios valores de prueba y, en cada caso, la fórmula de ${v} cumple la ecuación original.`,
        },
      ],
      explanation: `Se despeja ${v} en función de ${names}. Cada fórmula se verificó con valores de prueba en la ecuación original; puede no valer para los valores que anulan un denominador.`,
    };
  }

  private series(args: string[], v: string): Outcome {
    const body = toCas(args[0]);
    const center = realNumber(args[2]);
    if (!/^\d$|^10$/.test(args[3]))
      throw new SymbolicError('El orden de Taylor debe estar entre 0 y 10.');
    const order = Number(args[3]);
    const radius = Math.max(1, Math.abs(center)) * 1e-6;
    continuousInterval(safeExpression(args[0]), v, [center - radius, center + radius], true);
    const centerCas = toCas(args[2]);
    const centerFraction = rational(center, 1000, 1e-12);
    const centerText = centerFraction
      ? centerFraction[1] === 1
        ? String(Math.abs(centerFraction[0]))
        : `${Math.abs(centerFraction[0])}/${centerFraction[1]}`
      : centerCas.replace(/\s+/g, '');
    const base =
      center === 0
        ? v
        : centerFraction
          ? `(${v} ${center < 0 ? '+' : '-'} ${centerText})`
          : `(${v} - ${/^[\w.]+(\/[\w.]+)?$/.test(centerText) ? centerText : `(${centerText})`})`;
    let derivative = body;
    let checked = true;
    const terms: ReturnType<typeof taylorTerm>[] = [];
    const steps: CalculationStep[] = [];
    for (let i = 0; i <= order; i++) {
      const at = substitute(derivative, v, centerCas);
      const valueAt = numberOf(at);
      if (!Number.isFinite(valueAt))
        throw new SymbolicError(
          'No pude confirmar derivadas reales finitas en el centro de la serie.',
        );
      let exact: string;
      try {
        exact = casText(`simplify(${at})`);
      } catch {
        exact = at;
      }
      // nerdamer simplifica mal algunos valores (simplify(tan(0)) da 1): se descarta si no
      // coincide con el valor numérico de la derivada.
      const simplified = numberOf(exact);
      if (!(Math.abs(simplified - valueAt) <= 1e-9 * Math.max(1, Math.abs(valueAt)))) exact = at;
      const power = i === 0 ? '' : i === 1 ? base : `${base}^${i}`;
      const term = taylorTerm(exact, valueAt, i, power);
      terms.push(term);
      steps.push({
        title: `Término de orden ${i}`,
        detail: `La derivada de orden ${i} en ${v} = ${args[2]} vale ${readable(exact)}. Se divide por ${i} factorial, que es ${factorials[i]}${i ? `, y se multiplica por la potencia ${i} de la distancia al centro` : ''}.`,
        formula: term.zero ? '0' : `${term.negative ? '-' : ''}${term.text}`,
      });
      if (i < order) {
        const next = casText(`diff(${derivative},${v})`);
        const verdict = this.checkDerivative(derivative, next, v);
        if (verdict === 'mismatch')
          throw unverified('una de las derivadas no coincide con la aproximación numérica');
        if (verdict === 'unverifiable') checked = false;
        derivative = next;
      }
    }
    const value = joinTerms(terms);
    steps.push({
      title: 'Sumar los términos',
      detail:
        'Ordenar los términos por grado. Aproximación local sin cota de error ni radio de convergencia calculados.',
      formula: value,
    });
    return {
      value,
      steps,
      explanation: `Polinomio de Taylor de orden ${args[3]} alrededor de ${v} = ${args[2]}, calculado con las derivadas en ese punto divididas por sus factoriales.${center !== 0 ? ` Se escribe en potencias de la distancia al centro, ${base}.` : ''} Es una aproximación local; no se ha calculado una cota del error ni el radio de convergencia.`,
      warnings: checked ? [] : ['No pude comprobar numéricamente todas las derivadas usadas.'],
    };
  }

  private substitute(args: string[], v: string): Outcome {
    // d/dx en un punto: substitute(diff(f, x), x, a) deriva primero y después reemplaza.
    const nested = parseCommand(args[0].trim());
    if (nested?.name === 'diff' && nested.args.length >= 2) {
      const derivative = this.derive(nested.args, variable(nested.args[1]));
      const outcome = this.substitute([derivative.value, ...args.slice(1)], v);
      return {
        ...outcome,
        explanation: `Se deriva ${nested.args[0]} respecto de ${variable(nested.args[1])}: ${derivative.value}. ${outcome.explanation}`,
      };
    }
    const body = toCas(args[0]);
    const replacement = toCas(args[2]);
    const raw = resolved(casText(substitute(body, v, replacement)));
    const names = [
      ...new Set([
        ...freeVariables(raw),
        ...freeVariables(replacement),
        ...freeVariables(body).filter((name) => name !== v),
      ]),
    ];
    const f = evaluatorOf(body) ?? never;
    const g = evaluatorOf(replacement) ?? never;
    const composed: Evaluator = (scope: Scope) => f({ ...scope, [v]: g(scope) });
    const output = evaluatorOf(raw);
    const outcome = output ? verifyEquivalent(composed, output, names) : 'unverifiable';
    if (outcome === 'mismatch')
      throw unverified('la sustitución no coincide con la evaluación numérica de la expresión');
    return {
      value: readable(raw),
      decimal: constantDecimal(raw),
      steps: [],
      explanation: `Se reemplaza ${v} por ${args[2]} en la expresión y se simplifica el resultado.${outcome === 'ok' ? ' El resultado se comparó numéricamente con la expresión original.' : ''}`,
      warnings:
        outcome === 'ok' ? [] : ['No pude comprobar numéricamente el resultado de la sustitución.'],
    };
  }

  private transform(name: string, args: string[], v: string): Outcome {
    const body = toCas(args[0]);
    if (name === 'factor' && polynomialDegree(args[0]) > 24)
      throw new SymbolicError(
        'Para factorizar con garantías, usá polinomios de grado 24 o menor. Con grados mayores el motor simbólico es lento y poco confiable.',
      );
    const raw = resolved(
      (name === 'simplify' ? reducedFraction(args[0]) : null) ??
        casText(name === 'partfrac' ? `partfrac(${body},${v})` : `${name}(${body})`),
    );
    const names = [...new Set([...freeVariables(body), ...freeVariables(raw)])];
    const [input, output] = [evaluatorOf(body) ?? never, evaluatorOf(raw)];
    const outcome = output ? verifyEquivalent(input, output, names) : 'unverifiable';
    const label = {
      simplify: 'la simplificación',
      factor: 'la factorización',
      expand: 'la expansión',
      partfrac: 'la descomposición en fracciones parciales',
    }[name];
    if (outcome === 'mismatch')
      throw unverified(
        `${label} no coincide con la expresión original al evaluarlas en varios puntos`,
      );
    return {
      value: readable(raw),
      decimal: constantDecimal(raw),
      steps: [],
      explanation: `Se transforma la expresión mediante ${{ simplify: 'simplificación', factor: 'factorización', expand: 'la propiedad distributiva', partfrac: 'fracciones parciales' }[name]}. Se mantienen las restricciones de dominio de la expresión original, incluso cuando se cancelan factores.${outcome === 'ok' ? ' El resultado se comparó numéricamente con la expresión original en varios puntos.' : ''}`,
      warnings:
        outcome === 'ok'
          ? []
          : [
              'No pude comprobar numéricamente que el resultado sea equivalente a la expresión original.',
            ],
    };
  }

  private inequality(args: string[], original: string): CalculationResult {
    if (args.length !== 2) throw new SymbolicError('Usá inequality(desigualdad,x).');
    const v = variable(args[1]);
    const match = args[0].match(/^(.+?)(<=|>=|<|>)([^<>=]+)$/);
    if (!match) throw new SymbolicError('Usá una desigualdad con <, <=, > o >=.');
    const [, left, operator, right] = match;
    if (!polynomial(safeExpression(left)) || !polynomial(safeExpression(right)))
      throw new SymbolicError(
        'Las desigualdades admiten polinomios de una variable, hasta grado 4.',
      );
    const body = casText(`expand((${toCas(left)})-(${toCas(right)}))`);
    if (casVariables(body).some((name) => name !== v))
      throw new SymbolicError('La desigualdad debe tener una sola variable.');
    const raw = casText(`coeffs(${body},${v})`);
    const coefficientExpressions = splitArguments(raw.slice(1, -1));
    const coefficients = coefficientExpressions.map(numberOf);
    while (coefficients.length > 1 && coefficients.at(-1) === 0) coefficients.pop();
    if (!coefficients.length || coefficients.length > 5 || !coefficients.every(Number.isFinite))
      throw new SymbolicError(
        'Las desigualdades admiten coeficientes reales finitos y grado máximo 4.',
      );
    // Grado 3 y 4, como el modo Inecuación de la calculadora de mano: raíces por tramos monótonos.
    const roots =
      coefficients.length === 1
        ? []
        : coefficients.length > 3
          ? realPolynomialRoots(coefficients)
          : [
              ...new Set(
                math
                  .polynomialRoot(coefficients[0], coefficients[1], coefficients[2] ?? 0)
                  .filter(
                    (root): root is number => typeof root === 'number' && Number.isFinite(root),
                  ),
              ),
            ].sort((a, b) => a - b);
    const strict = !operator.includes('=');
    const positive = operator.startsWith('>');
    const compiled = safeExpression(body).compile();
    if (coefficients.length === 3) {
      const discriminant = numberOf(
        casText(
          `(${coefficientExpressions[1]})^2-4*(${coefficientExpressions[0]})*(${coefficientExpressions[2]})`,
        ),
      );
      const expected = discriminant < 0 ? 0 : discriminant === 0 ? 1 : 2;
      if (!Number.isFinite(discriminant) || roots.length !== expected)
        throw new SymbolicError(
          'No pude separar las raíces con precisión suficiente. Revisá la escala de los coeficientes.',
        );
    }
    for (const root of roots) {
      const residual = Number(compiled.evaluate({ [v]: root }));
      const scale = coefficients.reduce(
        (sum, coefficient, i) => sum + Math.abs(coefficient * root ** i),
        0,
      );
      if (
        !Number.isFinite(scale) ||
        !Number.isFinite(residual) ||
        Math.abs(residual) > scale * 1e-10
      )
        throw new SymbolicError(
          'No pude verificar las raíces con precisión suficiente. Revisá la escala de los coeficientes.',
        );
    }
    const bounds = [-Infinity, ...roots, Infinity];
    const steps: CalculationStep[] = [
      {
        title: 'Reunir los términos',
        detail: 'Restar el lado derecho al izquierdo.',
        formula: `${body} ${operator} 0`,
      },
      {
        title: 'Separar los intervalos',
        detail: roots.length
          ? `Raíces reales aproximadas: ${roots.map((root) => math.format(root, { precision: 10 })).join('; ')}. Entre raíces consecutivas el polinomio conserva su signo.`
          : 'No hay raíces reales que separen intervalos; comprobar el signo en la recta real.',
      },
    ];
    const intervals: { low: number; high: number }[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const low = bounds[i],
        high = bounds[i + 1];
      const point =
        low === -Infinity
          ? high === Infinity
            ? 0
            : high - Math.max(1, Math.abs(high))
          : high === Infinity
            ? low + Math.max(1, Math.abs(low))
            : low / 2 + high / 2;
      const value: unknown = compiled.evaluate({ [v]: point });
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new SymbolicError('No pude verificar el signo entre las raíces.');
      steps.push({
        title: `Comprobar el intervalo ${i + 1}`,
        detail: `Entre ${low === -Infinity ? 'menos infinito' : low} y ${high === Infinity ? 'más infinito' : high}, elegir ${v} = ${point}. El polinomio vale ${value}; su signo es ${value > 0 ? 'positivo' : value < 0 ? 'negativo' : 'cero'}.`,
        formula: `(${body}) ${operator} 0`,
      });
      if (positive ? (strict ? value > 0 : value >= 0) : strict ? value < 0 : value <= 0) {
        const previous = intervals.at(-1);
        if (!strict && previous?.high === low) previous.high = high;
        else intervals.push({ low, high });
      }
    }
    const text = (n: number) =>
      n === -Infinity
        ? 'menos infinito'
        : n === Infinity
          ? 'más infinito'
          : math.format(n, { precision: 14 });
    const solutions = intervals.map(({ low, high }) =>
      low === -Infinity && high === Infinity
        ? 'Todos los números reales'
        : `Desde ${text(low)} ${Number.isFinite(low) && !strict ? 'incluido' : 'excluido'} hasta ${text(high)} ${Number.isFinite(high) && !strict ? 'incluido' : 'excluido'}`,
    );
    if (!strict)
      for (const root of roots) {
        if (!intervals.some(({ low, high }) => root >= low && root <= high))
          solutions.push(`${v} igual a ${text(root)}`);
      }
    if (!solutions.length) solutions.push('Sin soluciones reales');
    steps.push({
      title: 'Elegir intervalos y extremos',
      detail: `${strict ? 'La desigualdad estricta excluye las raíces.' : 'La desigualdad incluye la igualdad, por lo que se añaden las raíces.'} ${solutions.join('; ')}.`,
    });
    return {
      expression: original,
      value: solutions.join('; '),
      steps,
      table: solutions.map((value, i) => ({ label: `Conjunto ${i + 1}`, value })),
      kind: 'Álgebra',
      angleMode: 'rad',
      explanation:
        'Se pasa todo al lado izquierdo, se calculan las raíces del polinomio y se comprueba su signo en cada intervalo. Los extremos numéricos pueden ser aproximados. Se incluyen las raíces únicamente cuando la desigualdad permite igualdad.',
    };
  }

  private system(equations: string[], original: string): CalculationResult {
    if (equations.length < 2 || equations.length > 5)
      throw new SymbolicError('Introducí entre 2 y 5 ecuaciones lineales.');
    const residuals = equations.map((equation) => {
      const sides = equation.split('=');
      if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim())
        throw new SymbolicError(
          'Cada ecuación del sistema necesita dos lados separados por igual.',
        );
      return casText(`(${toCas(sides[0])})-(${toCas(sides[1])})`);
    });
    const variables = [
      ...new Set(residuals.flatMap((expression) => casVariables(expression))),
    ].sort();
    if (variables.length !== equations.length)
      throw new SymbolicError(
        'Para este método, usá tantas ecuaciones independientes como incógnitas.',
      );
    for (const residual of residuals)
      for (const v of variables) {
        if (
          casVariables(casText(`diff(${residual},${v})`)).some((name) => variables.includes(name))
        )
          throw new SymbolicError('El solucionador de sistemas admite ecuaciones lineales.');
      }
    const linear = nerdamer as typeof nerdamer & {
      solveEquations: (equations: string[]) => Array<[string, number | string]>;
    };
    let solutions: Array<[string, number | string]>;
    try {
      solutions = linear.solveEquations(residuals.map((expression) => `${expression}=0`));
    } catch {
      throw new SymbolicError(
        'No pude obtener una solución única. Revisá si las ecuaciones son independientes y compatibles.',
      );
    }
    if (
      solutions.length !== variables.length ||
      solutions.some(([, value]) => !Number.isFinite(Number(value)))
    )
      throw new SymbolicError('El sistema no tiene una solución real única confirmada.');
    for (const residual of residuals) {
      let check = residual;
      for (const [name, value] of solutions) check = substitute(check, name, String(value));
      const remainder = numberOf(check);
      if (!Number.isFinite(remainder) || Math.abs(remainder) > 1e-7)
        throw new SymbolicError(
          'No pude verificar las soluciones del sistema. Revisá los coeficientes.',
        );
    }
    return {
      expression: original,
      value: solutions.map(([v, value]) => `${v} = ${value}`).join('; '),
      kind: 'Álgebra',
      angleMode: 'rad',
      explanation:
        'Se resolvió el sistema lineal y se sustituyeron las soluciones en cada ecuación para comprobar que ambos lados coinciden. Los resultados pueden incluir aproximaciones numéricas.',
    };
  }
}
