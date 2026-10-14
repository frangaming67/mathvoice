import type {
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  ParenthesisNode,
  SymbolNode,
} from 'mathjs';
import {
  normalizeWithMap,
  reservedWords,
  rewritePercentages,
  type MappedExpression,
} from '../parser/expression';
import type { AngleMode, CalculationResult, EvaluateOptions } from '../types';
import { SymbolicEngine } from './SymbolicEngine';
import { exactMath, math, userMath } from './mathRuntime';
import {
  angleUnitName,
  checkProduct,
  checkSameShape,
  createExtensionFunctions,
  extensionFunctions,
  fromRadians,
  sinCos,
} from './ExtensionFunctions';
import {
  formatMathValue,
  formatReal,
  resultStructure,
  type FormatOptions,
} from './ResultFormatter';
import { physicalConstants, physicalScope } from './PhysicalConstants';
import { MathInputError, translateRuntimeError, translateSyntaxError } from './mathErrors';

const symbolic = new SymbolicEngine();
const functions = new Set(
  'sin cos tan cot sec csc asin acos atan sinh cosh tanh asinh acosh atanh log ln log10 log2 exp sqrt cbrt nthRoot factorial gamma mod floor ceil round abs sign gcd lcm fraction det inv transpose trace add subtract multiply dot cross norm conj re im arg complex lusolve mean median mode min max variance std sum prod combinations permutations _pct'.split(
    ' ',
  ),
);
Object.keys(extensionFunctions).forEach((name) => functions.add(name));
const symbols = new Set(['pi', 'e', 'phi', 'Infinity', 'i', ...Object.keys(physicalScope)]);
const operators = new Set(['+', '-', '*', '/', '^', '!']);
const permitted = new Set([
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'ParenthesisNode',
  'ArrayNode',
]);
// Funciones que piden un resultado complejo de forma explícita, aun en modo real.
const complexFunctions = new Set([
  'complex',
  'nthRoots',
  'conj',
  're',
  'im',
  'arg',
  'polar',
  'rect',
  'eigvals',
  'eigvecs',
]);
const textArguments = new Set(['convert', 'base', 'bitop']);
const normalizations = new Set(['unbiased', 'uncorrected', 'biased']);
// Operadores que se calculan con funciones propias para dar errores claros.
const wrappedOperators = new Set(['add', 'subtract', 'multiply', 'divide', 'pow', 'factorial']);
const arities: Record<string, number[]> = {
  sin: [1],
  cos: [1],
  tan: [1],
  cot: [1],
  sec: [1],
  csc: [1],
  asin: [1],
  acos: [1],
  atan: [1],
  asinh: [1],
  acosh: [1],
  atanh: [1],
  sqrt: [1],
  ln: [1],
  log: [1, 2],
  log10: [1],
  log2: [1],
  gamma: [1],
  combinations: [2],
  permutations: [1, 2],
  _pct: [1],
  mixed: [1],
  mixedNumber: [3],
  nthRoots: [2],
  nthRoot: [1, 2],
  convert: [3],
  base: [3],
  bitop: [4],
  rank: [1],
  eigvals: [1],
  eigvecs: [1],
  normalize: [1],
  distance: [2],
  vectorangle: [2],
  polar: [1],
  rect: [2],
  stats: [1, 2],
  percentile: [2],
  covariance: [2],
  correlation: [2],
  regression: [2],
  normalpdf: [3],
  normalcdf: [3],
  binomialpdf: [3],
  binomialcdf: [3],
  poissonpdf: [2],
  poissoncdf: [2],
};
const OVERFLOW = 'El resultado es demasiado grande: excede 10 elevado a 308.';

interface Settings {
  angle: AngleMode;
  decimalSeparator: NonNullable<EvaluateOptions['decimalSeparator']>;
  numberMode: NonNullable<EvaluateOptions['numberMode']>;
  resultForm: NonNullable<EvaluateOptions['resultForm']>;
  numberFormat: NonNullable<EvaluateOptions['numberFormat']>;
  numberDigits: number;
  ans: string | null;
}

/** Completa las opciones de evaluación; acepta también la firma vieja con solo el modo angular. */
export function resolveOptions(value: AngleMode | EvaluateOptions = 'rad'): Settings {
  const options: EvaluateOptions = typeof value === 'string' ? { angle: value } : value;
  const digits = Number(options.numberDigits);
  return {
    angle: options.angle ?? 'rad',
    decimalSeparator: options.decimalSeparator ?? 'punto',
    numberMode: options.numberMode ?? 'real',
    resultForm: options.resultForm ?? 'auto',
    numberFormat: options.numberFormat ?? 'normal',
    numberDigits: Number.isFinite(digits) ? Math.round(digits) : 10,
    ans: options.ans?.trim() ? options.ans : null,
  };
}

const formatOf = (settings: Settings): FormatOptions => ({
  decimal: settings.decimalSeparator,
  format: settings.numberFormat,
  digits: settings.numberDigits,
});

function trimmed(mapped: MappedExpression, from = 0, to = mapped.text.length): MappedExpression {
  let a = from;
  let b = to;
  while (a < b && /\s/.test(mapped.text[a])) a++;
  while (b > a && /\s/.test(mapped.text[b - 1])) b--;
  return {
    source: mapped.source,
    text: mapped.text.slice(a, b),
    map: [...mapped.map.slice(a, b), mapped.map[b] ?? mapped.source.length],
    issues: [],
  };
}

/** Posición original (1-based) de la primera aparición de un nombre o texto entre comillas. */
function positionOf(mapped: MappedExpression, word: string): number | undefined {
  if (!word) return undefined;
  const tokens = /"(?:\\.|[^"\\])*"|[A-Za-z_]\w*/g;
  for (let match = tokens.exec(mapped.text); match; match = tokens.exec(mapped.text))
    if (match[0] === word) return mapped.map[match.index] + 1;
  return undefined;
}

/** Índices de los «=» de nivel superior que no forman parte de ==, <=, >= ni !=. */
function topLevelEquals(text: string): number[] {
  const found: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    } else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '=' && depth === 0) {
      if (text[i + 1] === '=') i++;
      else if (!/[<>!=]/.test(text[i - 1] ?? '')) found.push(i);
    }
  }
  return found;
}

const isFunctionName = (child: MathNode, parent: MathNode | null) =>
  parent?.type === 'FunctionNode' && (parent as FunctionNode).fn === child;

function validate(node: MathNode, variables: Record<string, number>, mapped: MappedExpression) {
  node.traverse((child, _path, parent) => {
    if (!permitted.has(child.type))
      throw new MathInputError(
        'Esa sintaxis no está permitida. Usá operaciones matemáticas o los formularios de herramientas.',
        'sintaxis',
      );
    if (child.type === 'FunctionNode') {
      const fn = child as FunctionNode;
      const name = fn.fn.name ?? '';
      if (!functions.has(name))
        throw new MathInputError(
          `La función ${name || 'escrita'} todavía no está disponible. Consultá las herramientas científicas.`,
          'funcion',
          positionOf(mapped, name),
        );
      const allowed = arities[name];
      if (allowed && !allowed.includes(fn.args.length))
        throw new MathInputError(
          `La función ${name} necesita ${allowed.join(' o ')} ${allowed.length === 1 && allowed[0] === 1 ? 'argumento' : 'argumentos'}.`,
          'argumentos',
          positionOf(mapped, name),
        );
    }
    if (child.type === 'SymbolNode') {
      const name = (child as SymbolNode).name;
      if (!symbols.has(name) && !functions.has(name) && !Object.hasOwn(variables, name))
        throw new MathInputError(
          name.length === 1
            ? `No reconozco «${name}». Si es una incógnita, escribí una ecuación con = para resolverla, o guardá su valor con ${name}=3.`
            : `No reconozco «${name}». Revisá el nombre de la función o constante.`,
          'simbolo',
          positionOf(mapped, name),
        );
    }
    if (child.type === 'OperatorNode' && !operators.has((child as OperatorNode).op))
      throw new MathInputError(
        (child as OperatorNode).op === 'mod'
          ? 'Para el resto usá mod(a, b).'
          : 'Ese operador no está disponible en la calculadora.',
        'sintaxis',
      );
    if (child.type === 'ConstantNode' && typeof (child as ConstantNode).value === 'string') {
      const owner = parent?.type === 'FunctionNode' ? ((parent as FunctionNode).fn.name ?? '') : '';
      const value = (child as ConstantNode).value as unknown as string;
      if (
        !textArguments.has(owner) &&
        !(['std', 'variance'].includes(owner) && normalizations.has(value))
      )
        throw new MathInputError(
          'Los textos entre comillas solo se usan en convert, base y bitop.',
          'texto',
          positionOf(mapped, `"${value}"`),
        );
    }
  });
}

function usesComplex(node: MathNode) {
  let found = false;
  node.traverse((child, _path, parent) => {
    if (
      child.type === 'SymbolNode' &&
      (child as SymbolNode).name === 'i' &&
      !isFunctionName(child, parent)
    )
      found = true;
    if (
      child.type === 'FunctionNode' &&
      complexFunctions.has((child as FunctionNode).fn.name ?? '')
    )
      found = true;
  });
  return found;
}

const isPercentage = (node: MathNode) =>
  node.type === 'FunctionNode' && (node as FunctionNode).fn.name === '_pct';

/** Pasa los operadores a funciones propias y aplica «a + b%» como a más el b% de a. */
function prepare(node: MathNode, notes: Set<string>): MathNode {
  const { FunctionNode: Call, SymbolNode: Name } = userMath().instance;
  const mapped = node.map((child) => prepare(child, notes));
  if (mapped.type !== 'OperatorNode') return mapped;
  const operator = mapped as OperatorNode;
  const args = operator.args as MathNode[];
  if (
    (operator.fn === 'add' || operator.fn === 'subtract') &&
    args.length === 2 &&
    isPercentage(args[1]) &&
    !isPercentage(args[0])
  ) {
    notes.add(
      'El porcentaje se calculó sobre el valor de la izquierda: a + b% es a más el b% de a.',
    );
    return new Call(new Name(operator.fn), [
      args[0],
      new Call(new Name('multiply'), [args[0], args[1]]),
    ]);
  }
  if (wrappedOperators.has(operator.fn) && (args.length === 2 || operator.fn === 'factorial'))
    return new Call(new Name(operator.fn), args);
  return mapped;
}

function smallIntegerExponent(node: MathNode): boolean {
  if (node.type === 'ParenthesisNode')
    return smallIntegerExponent((node as ParenthesisNode).content);
  if (node.type === 'OperatorNode' && (node as OperatorNode).fn === 'unaryMinus')
    return smallIntegerExponent((node as OperatorNode).args[0] as MathNode);
  if (node.type !== 'ConstantNode') return false;
  const value = (node as ConstantNode).value as unknown;
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 1000;
}

type Exact = { n: bigint; d: bigint; s: bigint; toFraction(): string };

/** Valor exacto (fracción) de una cuenta con números, + - * / y potencias enteras chicas. */
function exactValue(expression: string, node: MathNode): Exact | undefined {
  if (!/^[\d\s.+\-*/()^]+$/.test(expression)) return undefined;
  let simple = true;
  node.traverse((child) => {
    if (
      child.type === 'OperatorNode' &&
      (child as OperatorNode).fn === 'pow' &&
      !smallIntegerExponent((child as OperatorNode).args[1] as MathNode)
    )
      simple = false;
  });
  if (!simple) return undefined;
  try {
    const value: unknown = exactMath.evaluate(expression);
    return exactMath.isFraction(value) ? (value as unknown as Exact) : undefined;
  } catch (error) {
    if (error instanceof Error && /Division by zero/i.test(error.message))
      throw new MathInputError('No se puede dividir por cero.', 'division-por-cero');
    return undefined;
  }
}

/** Convierte una fracción a número sin perder rango cuando numerador y denominador son enormes. */
export function fractionToNumber(fraction: { n: bigint; d: bigint; s: bigint }): number {
  const n = BigInt(fraction.n);
  const d = BigInt(fraction.d);
  const sign = Number(fraction.s) < 0 ? -1 : 1;
  const limit = 2n ** 53n;
  if (n < limit && d < limit) return (sign * Number(n)) / Number(d);
  const p = 20 - (n.toString().length - d.toString().length);
  const q = p >= 0 ? (n * 10n ** BigInt(p)) / d : n / (d * 10n ** BigInt(-p));
  return sign * Number(`${q}e${-p}`);
}

/** Fracción p/q con q ≤ 1000 que aproxima x, o null. */
function asFraction(x: number): [number, number] | null {
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let v = x;
  for (let step = 0; step < 32; step++) {
    const a = Math.floor(v);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 1000) return null;
    if (Math.abs(h1 / k1 - x) <= 1e-12 * Math.max(1, Math.abs(x))) return [h1, k1];
    const rest = v - a;
    if (rest < 1e-15) return null;
    v = 1 / rest;
  }
  return null;
}

function hasComplex(value: unknown): boolean {
  if (math.isComplex(value)) return true;
  if (math.isMatrix(value)) return hasComplex(value.toArray());
  if (Array.isArray(value)) return value.some(hasComplex);
  return false;
}

function isZero(value: unknown) {
  if (typeof value === 'number') return value === 0;
  if (math.isFraction(value)) return Number(value) === 0;
  if (math.isComplex(value)) return value.re === 0 && value.im === 0;
  return false;
}

function radixOf(node: MathNode): CalculationResult['radix'] {
  let root = node;
  while (root.type === 'ParenthesisNode') root = (root as ParenthesisNode).content;
  if (root.type !== 'FunctionNode') return undefined;
  const fn = root as FunctionNode;
  if (fn.fn.name === 'bitop') return 2;
  if (fn.fn.name !== 'base' || fn.args[2]?.type !== 'ConstantNode') return undefined;
  const target = (fn.args[2] as ConstantNode).value as unknown;
  return target === 2 || target === 8 || target === 10 || target === 16 ? target : undefined;
}

function isExpressionInX(value: string) {
  if (!/\bx\b/.test(value) || /[=;]/.test(value)) return false;
  try {
    const node = userMath().parse(value);
    let valid = true;
    node.traverse((child, _path, parent) => {
      if (!permitted.has(child.type) || child.type === 'ArrayNode') valid = false;
      if (child.type === 'SymbolNode') {
        const name = (child as SymbolNode).name;
        if (
          isFunctionName(child, parent) ? !functions.has(name) : name !== 'x' && !symbols.has(name)
        )
          valid = false;
      }
    });
    return valid;
  } catch {
    return false;
  }
}

// En modo coma, los resultados se muestran con coma decimal y «;» entre elementos.
function withSeparators(text: string, settings: Settings) {
  if (settings.decimalSeparator !== 'coma') return text;
  return text.replace(/,/g, ';').replace(/(\d)\.(\d)/g, '$1,$2');
}

function buildScope(
  settings: Settings,
  variables: Record<string, number>,
  complexAllowed: boolean,
): Map<string, unknown> {
  const { angle, numberMode } = settings;
  const format = formatOf(settings);
  const show = (value: unknown) => formatMathValue(value, format);
  const factor = angle === 'deg' ? Math.PI / 180 : angle === 'grad' ? Math.PI / 200 : 1;
  const guard = (result: unknown, ...inputs: unknown[]) => {
    if (
      typeof result === 'number' &&
      Math.abs(result) === Infinity &&
      inputs.every((v) => typeof v !== 'number' || Number.isFinite(v))
    )
      throw new MathInputError(OVERFLOW, 'desbordamiento');
    return result;
  };
  // Una resta que cancela todas las cifras deja ruido de redondeo, no un valor.
  const cancel = (result: unknown, a: unknown, b: unknown) => {
    guard(result, a, b);
    if (typeof result === 'number' && typeof a === 'number' && typeof b === 'number')
      return Math.abs(result) <= 4 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))
        ? 0
        : result;
    return result;
  };
  const labels = {
    tan: 'La tangente',
    cot: 'La cotangente',
    sec: 'La secante',
    csc: 'La cosecante',
  };
  const circular =
    (name: 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'csc') =>
    (input: unknown): unknown => {
      const x = math.isFraction(input) ? Number(input) : input;
      if (typeof x !== 'number') {
        const argument = angle === 'rad' ? x : math.multiply(x as number, factor);
        return (math[name] as (value: unknown) => unknown)(argument);
      }
      const [s, c] = sinCos(x, angle);
      if (name === 'sin') return s;
      if (name === 'cos') return c;
      const zero = name === 'tan' || name === 'sec' ? c === 0 : s === 0;
      if (zero && Number.isFinite(x))
        throw new MathInputError(
          angle === 'rad'
            ? `${labels[name]} no está definida en ese ángulo: ${name === 'tan' || name === 'sec' ? 'el coseno' : 'el seno'} vale 0.`
            : `${labels[name]} no está definida en ${formatReal(x, format)} ${angleUnitName[angle]}.`,
          'dominio',
        );
      if (name === 'tan') return s === 0 ? 0 : s / c;
      if (name === 'cot') return c === 0 ? 0 : c / s;
      return name === 'sec' ? 1 / c : 1 / s;
    };
  const inverse =
    (name: 'asin' | 'acos' | 'atan') =>
    (input: unknown): unknown => {
      const x = math.isFraction(input) ? Number(input) : input;
      if (typeof x !== 'number') {
        const value = (math[name] as (v: unknown) => unknown)(x);
        return angle === 'rad' ? value : math.divide(value as number, factor);
      }
      if (name !== 'atan' && Math.abs(x) > 1) {
        if (angle !== 'rad' || !complexAllowed)
          throw new MathInputError(
            `${name === 'asin' ? 'El arcoseno' : 'El arcocoseno'} solo está definido entre -1 y 1, y ${formatReal(x, format)} está fuera de ese rango.`,
            'dominio',
          );
        return math[name](x);
      }
      return fromRadians(Math[name](x), angle);
    };
  const logarithm = (x: unknown, base?: unknown) => {
    if (typeof base === 'number' && (base <= 0 || base === 1))
      throw new MathInputError(
        'La base del logaritmo debe ser positiva y distinta de 1.',
        'dominio',
      );
    const compute = () =>
      base === undefined
        ? math.log(x as number)
        : base === 10
          ? math.log10(x as number)
          : base === 2
            ? math.log2(x as number)
            : math.log(x as number, base as number);
    if (typeof x === 'number') {
      if (x === 0) throw new MathInputError('El logaritmo de 0 no está definido.', 'dominio');
      if (x < 0 && !complexAllowed)
        throw new MathInputError(
          `El logaritmo de un número negativo no es real. Activá el modo complejo para obtener ${show(compute())}.`,
          'no-real',
        );
    }
    return compute();
  };
  const power = (a: unknown, b: unknown): unknown => {
    if (typeof a === 'number' && typeof b === 'number') {
      if (a === 0 && b < 0)
        throw new MathInputError(
          'No se puede dividir por cero: 0 elevado a un exponente negativo no está definido.',
          'division-por-cero',
        );
      if (a < 0 && !Number.isInteger(b)) {
        const ratio = asFraction(b);
        if (numberMode === 'real') {
          if (ratio && ratio[1] % 2 === 1) {
            const root = Math.pow(-a, b);
            return guard(Math.abs(ratio[0]) % 2 === 1 ? -root : root, a, b);
          }
          if (!complexAllowed)
            throw new MathInputError(
              ratio
                ? `La raíz par de un número negativo no es real. Activá el modo complejo para obtener ${show(math.pow(a, b))}.`
                : `Una potencia de base negativa con exponente no entero no es real. Activá el modo complejo para obtener ${show(math.pow(a, b))}.`,
              'no-real',
            );
        }
        return math.pow(a, b);
      }
      return guard(Math.pow(a, b), a, b);
    }
    return math.pow(a as number, b as number);
  };
  return new Map<string, unknown>([
    ...Object.entries(createExtensionFunctions({ angle, format })),
    ['sin', circular('sin')],
    ['cos', circular('cos')],
    ['tan', circular('tan')],
    ['cot', circular('cot')],
    ['sec', circular('sec')],
    ['csc', circular('csc')],
    ['asin', inverse('asin')],
    ['acos', inverse('acos')],
    ['atan', inverse('atan')],
    [
      'atanh',
      (x: unknown) => {
        if (x === 1 || x === -1)
          throw new MathInputError(
            'La tangente hiperbólica inversa no está definida en 1 ni en -1.',
            'dominio',
          );
        return math.atanh(x as number);
      },
    ],
    [
      'sqrt',
      (x: unknown) => {
        if (typeof x === 'number' && x < 0 && !complexAllowed)
          throw new MathInputError(
            `La raíz cuadrada de un número negativo no es real. Activá el modo complejo para obtener ${show(math.sqrt(x))}.`,
            'no-real',
          );
        return math.sqrt(x as number);
      },
    ],
    ['ln', (x: unknown) => logarithm(x)],
    ['log', (x: unknown, base: unknown = 10) => logarithm(x, base)],
    ['log10', (x: unknown) => logarithm(x, 10)],
    ['log2', (x: unknown) => logarithm(x, 2)],
    ['exp', (x: unknown) => guard(math.exp(x as number), x)],
    ['_pct', (x: unknown) => math.divide(x as number, 100)],
    [
      'add',
      (a: unknown, b: unknown) => {
        checkSameShape(a, b, 'sumar');
        return cancel(math.add(a as number, b as number), a, b);
      },
    ],
    [
      'subtract',
      (a: unknown, b: unknown) => {
        checkSameShape(a, b, 'restar');
        return cancel(math.subtract(a as number, b as number), a, b);
      },
    ],
    [
      'multiply',
      (a: unknown, b: unknown) => {
        checkProduct(a, b);
        return guard(math.multiply(a as number, b as number), a, b);
      },
    ],
    [
      'divide',
      (a: unknown, b: unknown) => {
        if (isZero(b))
          throw isZero(a)
            ? new MathInputError('0 dividido por 0 no está definido.', 'indefinido')
            : new MathInputError('No se puede dividir por cero.', 'division-por-cero');
        return guard(math.divide(a as number, b as number), a, b);
      },
    ],
    ['pow', power],
    [
      'factorial',
      (n: unknown) => {
        if (typeof n === 'number') {
          if (n < 0)
            throw new MathInputError(
              'El factorial solo está definido para enteros no negativos.',
              'dominio',
            );
          if (n > 170) throw new MathInputError(OVERFLOW, 'desbordamiento');
        }
        return math.factorial(n as number);
      },
    ],
    ...Object.entries(physicalScope),
    ...Object.entries(variables).filter(
      ([name, v]) =>
        !functions.has(name) && !symbols.has(name) && typeof v === 'number' && Number.isFinite(v),
    ),
  ]);
}

interface Computed {
  result: CalculationResult;
  raw: unknown;
}

export class MathEngine {
  evaluate(
    input: string,
    angleOrOptions: AngleMode | EvaluateOptions = 'rad',
    variables: Record<string, number> = {},
  ): CalculationResult {
    const settings = resolveOptions(angleOrOptions);
    try {
      return this.run(input, settings, variables);
    } catch (error) {
      throw translateRuntimeError(error);
    }
  }

  private run(input: string, settings: Settings, variables: Record<string, number>) {
    if (!input.trim())
      throw new MathInputError('Escribí una expresión antes de calcular.', 'vacio');
    if (input.length > 10000)
      throw new MathInputError(
        'La expresión es demasiado larga. Usá hasta 10000 caracteres.',
        'largo',
      );
    const mapped = normalizeWithMap(input, {
      decimalSeparator: settings.decimalSeparator,
      ans: settings.ans,
    });
    if (mapped.issues.length) throw mapped.issues[0];
    const expression = mapped.text;
    if (symbolic.supports(expression)) {
      if (input.length > 500)
        throw new MathInputError(
          'La expresión simbólica es demasiado larga; usá hasta 500 caracteres.',
          'largo',
        );
      return this.symbolicResult(symbolic.evaluate(expression, input, settings.angle), settings);
    }
    const equals = topLevelEquals(expression);
    if (equals.length > 1)
      throw new MathInputError(
        'Usá un solo signo igual: para guardar una variable o para resolver una ecuación.',
        'ecuacion',
        mapped.map[equals[1]] + 1,
      );
    if (equals.length === 1) {
      const left = expression.slice(0, equals[0]).trim();
      const body = trimmed(mapped, equals[0] + 1);
      // x=5 guarda una variable; x=2x-3 (la incógnita aparece a la derecha) es una ecuación.
      const unknownOnRight =
        !Object.hasOwn(variables, left) && positionOf(body, left) !== undefined;
      if (/^[A-Za-z_]\w*$/.test(left) && !unknownOnRight)
        return this.assign(left, body, input, settings, variables);
      return this.solveEquation(mapped, equals[0], input, settings, variables);
    }
    return this.compute(trimmed(mapped), input, settings, variables).result;
  }

  private symbolicResult(result: CalculationResult, settings: Settings): CalculationResult {
    const graphable = result.graphable ?? isExpressionInX(result.value);
    const convert = (text: string) => withSeparators(text, settings);
    return {
      ...result,
      value: convert(result.value),
      ...(result.decimal !== undefined && { decimal: convert(result.decimal) }),
      ...(result.exact !== undefined && { exact: convert(result.exact) }),
      ...(result.matrix && { matrix: result.matrix.map((row) => row.map(convert)) }),
      ...(graphable && { graphable }),
    };
  }

  private assign(
    name: string,
    body: MappedExpression,
    input: string,
    settings: Settings,
    variables: Record<string, number>,
  ): CalculationResult {
    const at = input.indexOf(name) + 1;
    if (name.length > 20)
      throw new MathInputError(
        'El nombre de la variable puede tener hasta 20 caracteres.',
        'variable',
        at,
      );
    if (!Object.hasOwn(variables, name) && Object.keys(variables).length >= 100)
      throw new MathInputError(
        'Podés guardar hasta 100 variables. Eliminá una antes de agregar otra.',
        'variable',
      );
    if (
      functions.has(name) ||
      symbols.has(name) ||
      reservedWords.has(name.toLowerCase()) ||
      ['constructor', 'prototype', '__proto__'].includes(name)
    )
      throw new MathInputError(
        'Ese nombre está reservado. Elegí otro nombre para la variable.',
        'variable',
        at,
      );
    if (!body.text)
      throw new MathInputError(
        `Falta el valor de ${name} después del signo igual.`,
        'falta-valor',
        body.map[0] + 1,
      );
    const { result, raw } = this.compute(body, input, settings, variables);
    const value = math.isFraction(raw)
      ? fractionToNumber(raw as unknown as Exact)
      : typeof raw === 'number'
        ? raw
        : NaN;
    if (result.table || result.matrix || result.complex || !Number.isFinite(value))
      throw new MathInputError(
        'Las variables almacenadas deben ser números reales finitos.',
        'variable',
      );
    return {
      ...result,
      expression: input,
      assigned: { name, value },
      explanation: `Se guarda ${name} con valor ${result.value}. Podés usar ${name} en los próximos cálculos.`,
    };
  }

  private solveEquation(
    mapped: MappedExpression,
    at: number,
    input: string,
    settings: Settings,
    variables: Record<string, number>,
  ): CalculationResult {
    const sides = [trimmed(mapped, 0, at), trimmed(mapped, at + 1)];
    if (!sides[0].text)
      throw new MathInputError(
        'Falta el lado izquierdo de la ecuación, antes del signo igual.',
        'ecuacion',
        mapped.map[at] + 1,
      );
    if (!sides[1].text)
      throw new MathInputError(
        'Falta el lado derecho de la ecuación, después del signo igual.',
        'falta-valor',
        mapped.map[mapped.text.length] + 1,
      );
    const { parse } = userMath();
    const nodes = sides.map((side) => {
      try {
        return parse(side.text);
      } catch (error) {
        throw translateSyntaxError(error, side, settings.decimalSeparator);
      }
    });
    const free = new Set<string>();
    nodes.forEach((node) =>
      node.traverse((child, _path, parent) => {
        if (child.type !== 'SymbolNode' || isFunctionName(child, parent)) return;
        const name = (child as SymbolNode).name;
        if (!symbols.has(name)) free.add(name);
      }),
    );
    const names = [...free];
    const unknown = names.filter((name) => !Object.hasOwn(variables, name));
    const list = (items: string[]) =>
      items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0];
    if (unknown.length > 1)
      throw new MathInputError(
        `La ecuación tiene más de una incógnita: ${list(unknown)}. Usá solve(ecuación, ${unknown[0]}) para elegir la variable, o guardá un valor para las demás.`,
        'ecuacion',
      );
    if (!names.length) return this.compareSides(sides, input, settings, variables);
    if (!unknown.length && names.length > 1)
      throw new MathInputError(
        `Todas las letras de la ecuación tienen un valor guardado (${list(names)}). Para despejar una, usá solve(ecuación, ${names[0]}).`,
        'ecuacion',
      );
    const target = unknown[0] ?? names[0];
    const known = names.filter((name) => name !== target);
    const { ConstantNode: Constant } = userMath().instance;
    const [left, right] = known.length
      ? nodes.map((node) =>
          node
            .transform((child, _path, parent) =>
              child.type === 'SymbolNode' &&
              known.includes((child as SymbolNode).name) &&
              !isFunctionName(child, parent)
                ? new Constant(variables[(child as SymbolNode).name])
                : child,
            )
            .toString({ implicit: 'show' }),
        )
      : sides.map((side) => side.text);
    const result = symbolic.evaluate(`solve(${left}=${right},${target})`, input, settings.angle);
    return this.symbolicResult({ ...result, expression: input }, settings);
  }

  private compareSides(
    sides: MappedExpression[],
    input: string,
    settings: Settings,
    variables: Record<string, number>,
  ): CalculationResult {
    const [a, b] = sides.map((side) => this.compute(side, input, settings, variables));
    const [x, y] = [a.raw, b.raw].map((raw) =>
      math.isFraction(raw) ? fractionToNumber(raw as unknown as Exact) : raw,
    );
    if (typeof x !== 'number' || typeof y !== 'number')
      throw new MathInputError('Solo puedo comparar dos números reales.', 'ecuacion');
    const equal = Math.abs(x - y) <= 1e-12 * Math.max(1, Math.abs(x), Math.abs(y));
    const explanation = equal
      ? `Los dos lados valen ${a.result.value}.`
      : `El lado izquierdo vale ${a.result.value} y el derecho vale ${b.result.value}.`;
    return {
      expression: input,
      value: equal ? 'Verdadero' : 'Falso',
      kind: 'Básico',
      angleMode: settings.angle,
      variables,
      description: explanation,
      explanation: `Se calcularon los dos lados de la igualdad y se compararon. ${explanation}`,
    };
  }

  private compute(
    mapped: MappedExpression,
    input: string,
    settings: Settings,
    variables: Record<string, number>,
  ): Computed {
    const prepared = rewritePercentages(mapped, settings.decimalSeparator === 'coma' ? ';' : ',');
    if (prepared.issues.length) throw prepared.issues[0];
    const expression = prepared.text;
    let node: MathNode;
    try {
      node = userMath().parse(expression);
    } catch (error) {
      throw translateSyntaxError(error, prepared, settings.decimalSeparator);
    }
    validate(node, variables, prepared);
    const complexAllowed = settings.numberMode === 'complejo' || usesComplex(node);
    const notes = new Set<string>();
    let raw: unknown;
    try {
      raw = prepare(node, notes)
        .compile()
        .evaluate(buildScope(settings, variables, complexAllowed));
    } catch (error) {
      throw translateRuntimeError(error);
    }
    const result = this.present(raw, node, mapped.text, expression, input, settings, variables);
    if (!complexAllowed && result.complex)
      throw new MathInputError(
        `El resultado no es un número real. Activá el modo complejo para obtener ${result.value}.`,
        'no-real',
      );
    return { result: notes.size ? { ...result, warnings: [...notes] } : result, raw };
  }

  private present(
    raw: unknown,
    node: MathNode,
    typed: string,
    expression: string,
    input: string,
    settings: Settings,
    variables: Record<string, number>,
  ): CalculationResult {
    const format = formatOf(settings);
    const angleName = angleUnitName[settings.angle];
    const base = { expression: input, angleMode: settings.angle, variables };
    if (typeof raw === 'function' || raw === undefined || raw === null || typeof raw === 'boolean')
      throw new MathInputError(
        'Eso no es un cálculo completo: a una función le falta su valor, por ejemplo sin(30).',
        'sintaxis',
      );
    if (typeof raw !== 'number' && !math.isFraction(raw)) {
      const radix = radixOf(node);
      const complex = hasComplex(raw);
      return {
        ...base,
        value: formatMathValue(raw, format),
        ...resultStructure(raw, format),
        kind: math.isComplex(raw) ? 'Complejos' : 'Herramientas',
        ...(complex && { complex: true }),
        ...(radix && { radix }),
        explanation: `Se aplicó la operación con bibliotecas numéricas. Las matrices y listas se presentan también como tablas; sus valores pueden estar redondeados. Los ángulos se expresan en ${angleName}.`,
      };
    }
    const numeric = math.isFraction(raw) ? fractionToNumber(raw as unknown as Exact) : raw;
    if (Number.isNaN(numeric))
      throw new MathInputError(
        'El resultado no está definido: la cuenta produce una forma indeterminada, como 0 dividido por 0 o infinito menos infinito.',
        'indefinido',
      );
    if (!Number.isFinite(numeric))
      throw /Infinity/.test(expression)
        ? new MathInputError(
            'El resultado es infinito; la calculadora solo muestra números finitos.',
            'desbordamiento',
          )
        : new MathInputError(OVERFLOW, 'desbordamiento');
    const explicit = math.isFraction(raw);
    const exact =
      exactValue(expression, node) ?? (explicit ? (raw as unknown as Exact) : undefined);
    const form = settings.resultForm;
    let value = formatReal(numeric, format);
    let decimal: string | undefined;
    let exactText: string | undefined;
    if (exact) {
      value = formatReal(fractionToNumber(exact), format);
      if (String(exact.d) === '1') {
        // Un entero exacto se muestra con todas sus cifras (2^64 = 18446744073709551616).
        const integer = exact.toFraction();
        if (settings.numberFormat === 'normal' && integer.replace('-', '').length <= 21)
          value = integer;
      } else {
        const fraction = exact.toFraction();
        const typedDecimals = /\d\.\d|(^|[^\w])\.\d/.test(typed);
        const fractionFirst =
          form === 'exacto' ||
          form === 'ambos' ||
          (form === 'auto' &&
            (explicit || (!typedDecimals && typed.includes('/') && String(exact.d).length <= 6)));
        if (fractionFirst) {
          decimal = form === 'exacto' ? undefined : value;
          value = fraction;
        } else if (form !== 'decimal' && fraction.length <= 40) exactText = fraction;
      }
    }
    const digits = settings.numberDigits;
    const shown =
      settings.numberFormat === 'fijo'
        ? `Los decimales se muestran fijos, con ${digits} decimales.`
        : settings.numberFormat === 'cientifico'
          ? `Los números se muestran en notación científica con ${digits} cifras.`
          : `Los decimales se muestran con hasta ${digits} cifras significativas.`;
    const forms = decimal
      ? 'Se muestra una fracción y su aproximación decimal.'
      : exactText
        ? 'Se muestra el decimal y, aparte, su forma exacta como fracción.'
        : '';
    return {
      ...base,
      value,
      decimal,
      ...(exactText && { exact: exactText }),
      kind: /[a-z]/i.test(typed) ? 'Científico' : 'Básico',
      unit: physicalConstants.find((constant) => constant.symbol === typed)?.unit,
      explanation: `Se evaluó la expresión respetando paréntesis y precedencia: primero potencias, después multiplicaciones y divisiones, luego sumas y restas. Modo angular: ${angleName}. ${forms ? `${forms} ` : ''}${shown} Esta explicación describe el método general; no es una demostración paso a paso.`,
    };
  }
}
