import {
  type ArrayNode,
  type ConstantNode,
  type FunctionNode,
  type MathNode,
  type OperatorNode,
  type ParenthesisNode,
  type RelationalNode,
  type SymbolNode,
} from 'mathjs';
import { normalizeExpression } from '../parser/expression';
import { parseCommand } from '../parser/commands';
import type { DecimalSeparator } from '../types';
import { fractionName, speakNumber } from './numberSpeech';
import { letterName, symbolName } from './symbolSpeech';
import {
  isEquals,
  literalOf as literalIn,
  parse,
  protect,
  splitTop,
  stripParens,
} from './mathTree';

export type SpeechVerbosity = 'minimal' | 'normal' | 'detailed' | 'training';
export interface MathSpeechOptions {
  verbosity?: SpeechVerbosity;
  decimalSeparator?: DecimalSeparator;
  /** Cifras significativas al leer números; sin valor se leen todas las escritas. */
  significant?: number;
}
export interface SpokenMath {
  text: string;
  /** Algún número se leyó redondeado. */
  rounded: boolean;
}

interface Context {
  literals: string[];
  verbosity: SpeechVerbosity;
  significant: number;
  rounded: boolean;
}
interface Arg {
  node: MathNode;
  text: string;
  simple: boolean;
}

const CONSTANTS: Record<string, string> = {
  pi: 'pi',
  e: 'e',
  i: 'i',
  Infinity: 'infinito',
  NaN: 'no es un número',
  phi: 'fi',
  true: 'verdadero',
  false: 'falso',
  C: 'constante de integración',
  ans: 'resultado anterior',
};
// Textos entre comillas: unidades de convert y opciones de funciones.
const WORDS: Record<string, string> = {
  m: 'metros',
  km: 'kilómetros',
  cm: 'centímetros',
  mm: 'milímetros',
  in: 'pulgadas',
  inch: 'pulgadas',
  ft: 'pies',
  yd: 'yardas',
  mi: 'millas',
  'm^2': 'metros cuadrados',
  'km^2': 'kilómetros cuadrados',
  hectare: 'hectáreas',
  'ft^2': 'pies cuadrados',
  L: 'litros',
  mL: 'mililitros',
  'm^3': 'metros cúbicos',
  gallon: 'galones',
  kg: 'kilogramos',
  g: 'gramos',
  mg: 'miligramos',
  lb: 'libras',
  oz: 'onzas',
  s: 'segundos',
  min: 'minutos',
  h: 'horas',
  day: 'días',
  'm/s': 'metros por segundo',
  'km/h': 'kilómetros por hora',
  'mi/h': 'millas por hora',
  degC: 'grados Celsius',
  degF: 'grados Fahrenheit',
  K: 'kelvin',
  Pa: 'pascales',
  kPa: 'kilopascales',
  bar: 'bares',
  atm: 'atmósferas',
  psi: 'libras por pulgada cuadrada',
  J: 'julios',
  kJ: 'kilojulios',
  cal: 'calorías',
  kcal: 'kilocalorías',
  kWh: 'kilovatios hora',
  W: 'vatios',
  kW: 'kilovatios',
  hp: 'caballos de potencia',
  b: 'bits',
  B: 'bytes',
  kB: 'kilobytes',
  MB: 'megabytes',
  GB: 'gigabytes',
  KiB: 'kibibytes',
  MiB: 'mebibytes',
  GiB: 'gibibytes',
  rad: 'radianes',
  deg: 'grados',
  grad: 'gradianes',
  and: 'y',
  or: 'o',
  xor: 'o exclusivo',
  not: 'negación',
  left: 'desplazamiento a la izquierda',
  right: 'desplazamiento a la derecha',
  uncorrected: 'poblacional',
  unbiased: 'muestral',
};
// Funciones de un argumento: frase y nombre para la marca de cierre.
const SINGLE: Record<string, [string, string]> = {
  sin: ['seno de', 'seno'],
  cos: ['coseno de', 'coseno'],
  tan: ['tangente de', 'tangente'],
  sec: ['secante de', 'secante'],
  csc: ['cosecante de', 'cosecante'],
  cot: ['cotangente de', 'cotangente'],
  asin: ['arco seno de', 'arco seno'],
  acos: ['arco coseno de', 'arco coseno'],
  atan: ['arco tangente de', 'arco tangente'],
  asec: ['arco secante de', 'arco secante'],
  acsc: ['arco cosecante de', 'arco cosecante'],
  acot: ['arco cotangente de', 'arco cotangente'],
  sinh: ['seno hiperbólico de', 'seno hiperbólico'],
  cosh: ['coseno hiperbólico de', 'coseno hiperbólico'],
  tanh: ['tangente hiperbólica de', 'tangente hiperbólica'],
  asinh: ['arco seno hiperbólico de', 'arco seno hiperbólico'],
  acosh: ['arco coseno hiperbólico de', 'arco coseno hiperbólico'],
  atanh: ['arco tangente hiperbólica de', 'arco tangente hiperbólica'],
  sqrt: ['raíz cuadrada de', 'raíz'],
  cbrt: ['raíz cúbica de', 'raíz'],
  abs: ['valor absoluto de', 'valor absoluto'],
  ln: ['logaritmo natural de', 'logaritmo'],
  log10: ['logaritmo decimal de', 'logaritmo'],
  log2: ['logaritmo en base 2 de', 'logaritmo'],
  floor: ['redondeo hacia abajo de', 'redondeo'],
  ceil: ['redondeo hacia arriba de', 'redondeo'],
  fix: ['parte entera de', 'parte entera'],
  sign: ['signo de', 'signo'],
  gamma: ['función gamma de', 'función gamma'],
  erf: ['función error de', 'función error'],
  det: ['determinante de', 'determinante'],
  inv: ['inversa de', 'inversa'],
  transpose: ['transpuesta de', 'transpuesta'],
  trace: ['traza de', 'traza'],
  rank: ['rango de', 'rango'],
  eigvals: ['autovalores de', 'autovalores'],
  eigvecs: ['autovectores de', 'autovectores'],
  norm: ['norma de', 'norma'],
  normalize: ['vector normalizado de', 'vector normalizado'],
  conj: ['conjugado de', 'conjugado'],
  re: ['parte real de', 'parte real'],
  im: ['parte imaginaria de', 'parte imaginaria'],
  arg: ['argumento de', 'argumento'],
  polar: ['forma polar de', 'forma polar'],
  mean: ['media de', 'media'],
  median: ['mediana de', 'mediana'],
  mode: ['moda de', 'moda'],
  sum: ['suma de', 'suma'],
  prod: ['producto de', 'producto'],
  mixed: ['forma mixta de', 'forma mixta'],
  simplify: ['simplificación de', 'simplificación'],
  expand: ['expansión de', 'expansión'],
  factor: ['factorización de', 'factorización'],
};
/** Nombre hablado de una función de un argumento, suelta: «sin» → «seno». */
export function functionSpeechName(name: string): string | undefined {
  return Object.hasOwn(SINGLE, name) ? SINGLE[name][0].replace(/ de$/, '') : undefined;
}
const ORDINALS: Record<string, string> = {
  '4': 'cuarta',
  '5': 'quinta',
  '6': 'sexta',
  '7': 'séptima',
  '8': 'octava',
  '9': 'novena',
  '10': 'décima',
};
const COMPARISONS: Record<string, string> = {
  smaller: 'menor que',
  larger: 'mayor que',
  smallerEq: 'menor o igual que',
  largerEq: 'mayor o igual que',
  equal: 'igual a',
  unequal: 'distinto de',
};
const OPERATORS: Record<string, string> = {
  '<': 'menor que',
  '>': 'mayor que',
  '<=': 'menor o igual que',
  '>=': 'mayor o igual que',
  '==': 'igual a',
  '!=': 'distinto de',
  and: 'y',
  or: 'o',
};
const COMMANDS = new Set([
  'diff',
  'integrate',
  'limit',
  'solve',
  'system',
  'series',
  'inequality',
  'substitute',
  'nthRoots',
  'mixedNumber',
  'partfrac',
]);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const literalOf = (node: MathNode, ctx: Context) => literalIn(node, ctx.literals);
function significantCount(raw: string): number {
  const mantissa = raw.replace(/^[+-]/, '').split(/[eE]/)[0];
  return mantissa.replace(/[.,]/, '').replace(/^0+/, '').length;
}
function literalSpeech(raw: string, ctx: Context): string {
  if (
    Number.isFinite(ctx.significant) &&
    /[.,]\d/.test(raw) &&
    significantCount(raw) > ctx.significant
  )
    ctx.rounded = true;
  return speakNumber(raw, { significant: ctx.significant, markApproximate: false });
}
function symbolSpeech(name: string): string {
  return CONSTANTS[name] ?? letterName(name) ?? name.replace(/_/g, ' ');
}
function list(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '');
}
/** Átomo: se lee sin marcas de agrupación (número, letra, negativo o fracción numérica). */
function simple(node: MathNode, ctx: Context): boolean {
  if (literalOf(node, ctx) !== null) return true;
  const inner = stripParens(node);
  if (inner.type === 'SymbolNode') return true;
  if (inner.type === 'OperatorNode') {
    const operator = inner as OperatorNode;
    if (operator.fn === 'unaryMinus') return stripParens(operator.args[0]).type === 'SymbolNode';
    if (operator.op === '/')
      return operator.args.every((part) => /^\d+$/.test(literalOf(part, ctx) ?? ''));
  }
  return false;
}
/** Término que se puede nombrar sin marcas dentro de una fracción: «equis al cuadrado», «2 equis». */
function term(node: MathNode, ctx: Context): boolean {
  if (simple(node, ctx)) return true;
  const inner = stripParens(node);
  if (inner !== node || inner.type !== 'OperatorNode') return false;
  const operator = inner as OperatorNode;
  if (operator.op === '^') return operator.args.every((part) => simple(part, ctx));
  if (operator.op === '*' && operator.implicit)
    return operator.args.every((part) => term(part, ctx));
  return false;
}
function ending(arg: MathNode, name: string, ctx: Context): string {
  // Las listas y matrices ya anuncian su propio final.
  if (ctx.verbosity === 'minimal' || stripParens(arg).type === 'ArrayNode') return '';
  if (ctx.verbosity === 'normal' && simple(arg, ctx)) return '';
  return `, fin de ${name}`;
}
function wordOf(node: MathNode): string {
  const value = (stripParens(node) as ConstantNode).value;
  return typeof value === 'string' ? (WORDS[value] ?? value) : String(value);
}

function power(base: MathNode, exponent: MathNode, ctx: Context, baseText?: string): string {
  const inner = stripParens(base);
  const raw = literalOf(exponent, ctx);
  // sin(x)^2 se dice «seno al cuadrado de equis», como se lee en clase.
  if (
    !baseText &&
    inner.type === 'FunctionNode' &&
    SINGLE[(inner as FunctionNode).fn.toString()] &&
    (raw === '2' || raw === '3') &&
    (inner as FunctionNode).args.length === 1
  ) {
    const [phrase] = SINGLE[(inner as FunctionNode).fn.toString()];
    const arg = (inner as FunctionNode).args[0];
    return `${phrase.replace(/ de$/, '')} ${raw === '2' ? 'al cuadrado' : 'al cubo'} de ${read(arg, ctx)}${ending(arg, phrase.replace(/ de$/, ''), ctx)}`;
  }
  const negative = !baseText && (literalOf(base, ctx) ?? '').startsWith('-');
  // (−2)² nombra el paréntesis: «menos 2 al cuadrado» se confundiría con −2².
  const b =
    baseText ??
    (negative ? `abre paréntesis, ${read(base, ctx)}, cierra paréntesis` : read(base, ctx));
  if (raw === '2') return `${b} al cuadrado`;
  if (raw === '3') return `${b} al cubo`;
  if (raw === '-1') return `1 sobre ${b}`;
  if (raw !== null && ORDINALS[raw]) return `${b} a la ${ORDINALS[raw]}`;
  if (simple(exponent, ctx)) return `${b} a la ${read(exponent, ctx)}`;
  return `${b} elevado a ${read(stripParens(exponent), ctx)}, fin del exponente`;
}
function fraction(numerator: MathNode, denominator: MathNode, ctx: Context): string {
  const top = literalOf(numerator, ctx);
  const bottom = literalOf(denominator, ctx);
  if (top !== null && bottom !== null) {
    const name = /^-?\d+$/.test(top) && /^\d+$/.test(bottom) ? fractionName(top, bottom) : null;
    return name ?? `${literalSpeech(top, ctx)} sobre ${literalSpeech(bottom, ctx)}`;
  }
  if (term(numerator, ctx) && term(denominator, ctx))
    return `${read(numerator, ctx)} sobre ${read(denominator, ctx)}`;
  return `fracción con numerador ${read(stripParens(numerator), ctx)}, y denominador ${read(stripParens(denominator), ctx)}, fin de fracción`;
}
function leadsWithSymbol(node: MathNode, ctx: Context): boolean {
  const inner =
    node.type === 'OperatorNode' && (node as OperatorNode).op === '^'
      ? (node as OperatorNode).args[0]
      : node;
  return (
    (inner.type === 'SymbolNode' && literalOf(inner, ctx) === null) || inner.type === 'FunctionNode'
  );
}
function operator(node: OperatorNode, ctx: Context): string {
  const [a, b] = node.args;
  if (node.args.length === 1) {
    if (node.fn === 'unaryMinus') {
      const inner = stripParens(a);
      // −2² vale −4: «el opuesto de 2 al cuadrado» evita confundirlo con (−2)².
      if (
        inner === a &&
        inner.type === 'OperatorNode' &&
        (inner as OperatorNode).op === '^' &&
        literalOf((inner as OperatorNode).args[0], ctx) !== null
      )
        return `el opuesto de ${read(a, ctx)}`;
      return `menos ${read(a, ctx)}`;
    }
    if (node.fn === 'unaryPlus') return `más ${read(a, ctx)}`;
    if (node.op === '!') return `${read(a, ctx)} factorial`;
    if (node.op === '%') return `${read(a, ctx)} por ciento`;
    if (node.op === 'not') return `no ${read(a, ctx)}`;
    return `${node.op} ${read(a, ctx)}`;
  }
  if (node.op === '^') return power(a, b, ctx);
  if (node.op === '/') return fraction(a, b, ctx);
  if (node.op === '*') {
    if (node.implicit && literalOf(a, ctx) !== null && leadsWithSymbol(b, ctx))
      return `${read(a, ctx)} ${read(b, ctx)}`;
    return node.args.map((part) => read(part, ctx)).join(' por ');
  }
  if (node.op === '%' || node.op === 'mod') return `${read(a, ctx)} módulo ${read(b, ctx)}`;
  const word =
    node.op === '+' ? 'más' : node.op === '-' ? 'menos' : (OPERATORS[node.op] ?? node.op);
  return node.args.map((part) => read(part, ctx)).join(` ${word} `);
}
function args(node: FunctionNode, ctx: Context): Arg[] {
  return node.args.map((arg) => ({ node: arg, text: read(arg, ctx), simple: simple(arg, ctx) }));
}
function rootName(index: MathNode, ctx: Context): string {
  const raw = literalOf(index, ctx);
  return raw === '2'
    ? 'raíz cuadrada'
    : raw === '3'
      ? 'raíz cúbica'
      : `raíz de índice ${read(index, ctx)}`;
}
const TEMPLATES: Record<string, (a: Arg[], ctx: Context) => string | undefined> = {
  log: (a, ctx) =>
    `${a.length > 1 ? `logaritmo en base ${a[1].text}` : 'logaritmo decimal'} de ${a[0].text}${ending(a[0].node, 'logaritmo', ctx)}`,
  nthRoot: (a, ctx) =>
    a.length > 1
      ? `${rootName(a[1].node, ctx)} de ${a[0].text}${ending(a[0].node, 'raíz', ctx)}`
      : `raíz cuadrada de ${a[0].text}${ending(a[0].node, 'raíz', ctx)}`,
  exp: (a, ctx) => power(a[0].node, a[0].node, ctx, 'e'),
  mod: (a) => `${a[0].text} módulo ${a[1].text}`,
  _pct: (a) => `${a[0].text} por ciento`,
  // 12°30'45" llega como dms(12, 30, 45).
  dms: (a) =>
    [
      `${a[0].text} grados`,
      a[1] && a[1].text !== '0' ? `${a[1].text} minutos` : '',
      a[2] && a[2].text !== '0' ? `${a[2].text} segundos` : '',
    ]
      .filter(Boolean)
      .join(' '),
  // Σ: sum(f, x, a, b); con un solo dato sigue siendo la suma de una lista.
  sum: (a) =>
    a.length === 4
      ? `sumatoria para ${a[1].text} desde ${a[2].text} hasta ${a[3].text} de ${a[0].text}`
      : undefined,
  // Tabla de valores: table(f, desde, hasta, paso) o table(f, g, desde, hasta, paso).
  table: (a) => {
    if (a.length !== 4 && a.length !== 5) return undefined;
    const functions = a.slice(0, -3).map((x) => x.text);
    const [from, to, step] = a.slice(-3).map((x) => x.text);
    return `tabla de valores de ${functions.join(' y de ')}, para equis desde ${from} hasta ${to} con paso ${step}`;
  },
  gcd: (a) => `máximo común divisor de ${list(a.map((x) => x.text))}`,
  lcm: (a) => `mínimo común múltiplo de ${list(a.map((x) => x.text))}`,
  max: (a) => `máximo entre ${list(a.map((x) => x.text))}`,
  min: (a) => `mínimo entre ${list(a.map((x) => x.text))}`,
  combinations: (a) => `combinaciones de ${a[0].text} tomados de a ${a[1]?.text}`,
  permutations: (a) =>
    a.length > 1
      ? `permutaciones de ${a[0].text} tomados de a ${a[1].text}`
      : `permutaciones de ${a[0].text}`,
  round: (a, ctx) =>
    a.length > 1
      ? `${a[0].text} redondeado a ${a[1].text} decimales`
      : `redondeo de ${a[0].text}${ending(a[0].node, 'redondeo', ctx)}`,
  fraction: (a, ctx) =>
    a.length > 1 ? fraction(a[0].node, a[1].node, ctx) : `fracción de ${a[0].text}`,
  mixedNumber: (a, ctx) =>
    a.length === 3 ? `${a[0].text} enteros y ${fraction(a[1].node, a[2].node, ctx)}` : undefined,
  dot: (a) => `producto escalar de ${a[0].text} y ${a[1]?.text}`,
  cross: (a) => `producto vectorial de ${a[0].text} y ${a[1]?.text}`,
  distance: (a) => `distancia entre ${a[0].text} y ${a[1]?.text}`,
  vectorangle: (a) => `ángulo entre ${a[0].text} y ${a[1]?.text}`,
  rect: (a) => `forma rectangular con módulo ${a[0].text} y ángulo ${a[1]?.text}`,
  complex: (a) =>
    `número complejo con parte real ${a[0].text} y parte imaginaria ${a[1]?.text ?? '0'}`,
  percentile: (a) => `percentil ${a[1]?.text} de ${a[0].text}`,
  covariance: (a) => `covarianza entre ${a[0].text} y ${a[1]?.text}`,
  correlation: (a) => `correlación entre ${a[0].text} y ${a[1]?.text}`,
  regression: (a) => `regresión lineal de ${a[1]?.text} en función de ${a[0].text}`,
  stats: (a) =>
    `resumen estadístico ${a[1]?.text === '0' ? 'poblacional' : 'muestral'} de ${a[0].text}`,
  std: (a) => `desvío estándar${a[1] ? ` ${a[1].text}` : ''} de ${a[0].text}`,
  variance: (a) => `varianza${a[1] ? ` ${a[1].text}` : ''} de ${a[0].text}`,
  normalpdf: (a) =>
    `densidad normal en ${a[0].text}${a.length > 2 ? ` con media ${a[1].text} y desvío ${a[2].text}` : ''}`,
  normalcdf: (a) =>
    `probabilidad normal acumulada hasta ${a[0].text}${a.length > 2 ? ` con media ${a[1].text} y desvío ${a[2].text}` : ''}`,
  invnorm: (a) =>
    `normal inversa del área ${a[0].text}${a.length > 2 ? ` con media ${a[1].text} y desvío ${a[2].text}` : ''}`,
  binomialpdf: (a) =>
    `probabilidad binomial de ${a[0].text} éxitos en ${a[1]?.text} ensayos con probabilidad ${a[2]?.text}`,
  binomialcdf: (a) =>
    `probabilidad binomial acumulada de hasta ${a[0].text} éxitos en ${a[1]?.text} ensayos con probabilidad ${a[2]?.text}`,
  poissonpdf: (a) => `probabilidad de Poisson de ${a[0].text} con media ${a[1]?.text}`,
  poissoncdf: (a) =>
    `probabilidad de Poisson acumulada de hasta ${a[0].text} con media ${a[1]?.text}`,
  convert: (a) => `convertir ${a[0].text} ${a[1]?.text} a ${a[2]?.text}`,
  base: (a) => `convertir ${a[0].text} de base ${a[1]?.text} a base ${a[2]?.text}`,
  bitop: (a) =>
    `operación binaria ${a[0].text} entre ${a[1]?.text}${a[2] ? ` y ${a[2].text}` : ''}${a[3] ? ` en ${a[3].text} bits` : ''}`,
  multiply: (a) => `producto de ${a[0].text} por ${a[1]?.text}`,
  add: (a) => `suma de ${a[0].text} más ${a[1]?.text}`,
  subtract: (a) => `${a[0].text} menos ${a[1]?.text}`,
  lusolve: (a) => `solución del sistema ${a[0].text} por equis igual a ${a[1]?.text}`,
  nthRoots: (a) => `raíces complejas de índice ${a[1]?.text} de ${a[0].text}`,
  partfrac: (a) =>
    `descomposición en fracciones parciales de ${a[0].text}${a[1] ? ` respecto de ${a[1].text}` : ''}`,
};
function functionCall(node: FunctionNode, ctx: Context): string {
  const name = node.fn.toString();
  if (name === 'factorial' && node.args.length === 1) return `${read(node.args[0], ctx)} factorial`;
  const template = TEMPLATES[name];
  if (template) {
    const spoken = template(args(node, ctx), ctx);
    if (spoken) return spoken;
  }
  const single = SINGLE[name];
  if (single && node.args.length === 1)
    return `${single[0]} ${read(node.args[0], ctx)}${ending(node.args[0], single[1], ctx)}`;
  const label = symbolSpeech(name);
  const spoken = node.args.map((arg) => read(arg, ctx));
  const closing = node.args.length > 1 || !node.args.every((arg) => simple(arg, ctx));
  return `${label} de ${list(spoken)}${closing && ctx.verbosity !== 'minimal' ? `, fin de ${label}` : ''}`;
}
function array(node: ArrayNode, ctx: Context): string {
  const items = node.items;
  if (items.length && items.every((item) => item.type === 'ArrayNode')) {
    const rows = items as ArrayNode[];
    return `matriz de ${rows.length} por ${rows[0].items.length}. ${rows
      .map((row, i) => `Fila ${i + 1}: ${list(row.items.map((item) => read(item, ctx)))}`)
      .join('. ')}. Fin de matriz`;
  }
  return `lista de ${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}: ${list(items.map((item) => read(item, ctx)))}, fin de lista`;
}
function read(node: MathNode, ctx: Context): string {
  const raw = literalOf(node, ctx);
  if (raw !== null) return literalSpeech(raw, ctx);
  switch (node.type) {
    case 'ParenthesisNode': {
      const content = (node as ParenthesisNode).content;
      return simple(content, ctx)
        ? read(content, ctx)
        : `abre paréntesis, ${read(content, ctx)}, cierra paréntesis`;
    }
    case 'SymbolNode':
      return symbolSpeech((node as SymbolNode).name);
    case 'ConstantNode':
      return wordOf(node);
    case 'ArrayNode':
      return array(node as ArrayNode, ctx);
    case 'RelationalNode': {
      const relation = node as RelationalNode;
      return relation.params
        .map(
          (part, index) =>
            `${index ? `${COMPARISONS[relation.conditionals[index - 1]] ?? relation.conditionals[index - 1]} ` : ''}${read(part, ctx)}`,
        )
        .join(' ');
    }
    case 'FunctionNode':
      return functionCall(node as FunctionNode, ctx);
    case 'OperatorNode':
      return operator(node as OperatorNode, ctx);
    default:
      return node.toString().replace(/_n(\d+)_/g, (_, i: string) => ctx.literals[Number(i)] ?? '');
  }
}

/** Nombre de la función si la expresión entera es una sola llamada: «diff(x^2,x)». */
function wholeCall(text: string): string | null {
  const match = text.match(/^([a-zA-Z]+)\s*\(/);
  if (!match || !text.endsWith(')')) return null;
  let depth = 0;
  for (let i = match[0].length - 1; i < text.length; i++) {
    if (text[i] === '(' || text[i] === '[') depth++;
    else if (text[i] === ')' || text[i] === ']') {
      depth--;
      if (depth === 0 && i < text.length - 1) return null;
    }
  }
  return depth === 0 ? match[1] : null;
}
function command(name: string, a: string[], ctx: Context): string | undefined {
  const s = (text: string | undefined) => speakText(text ?? '', ctx);
  switch (name) {
    case 'system':
      return `Sistema de ${a.length} ecuaciones. ${a.map((equation, i) => `Ecuación ${i + 1}: ${s(equation)}`).join('. ')}`;
    case 'substitute':
      return `Sustituir ${s(a[1])} por ${s(a[2])} en ${s(a[0])}`;
    case 'diff':
      return `Derivada${a[2] ? ` de orden ${s(a[2])}` : ''} de ${s(a[0])}, respecto de ${s(a[1] ?? 'x')}`;
    case 'integrate':
      return `Integral de ${s(a[0])}, respecto de ${s(a[1] ?? 'x')}${a[2] !== undefined ? `, desde ${s(a[2])} hasta ${s(a[3])}` : ''}`;
    case 'limit':
      return `Límite${a[3] === 'left' ? ' por izquierda' : a[3] === 'right' ? ' por derecha' : ''} cuando ${s(a[1])} tiende a ${s(a[2])} de ${s(a[0])}`;
    case 'solve':
      return `Resolver ${s(a[0])} para ${s(a[1] ?? 'x')}`;
    case 'inequality':
      return `Resolver la desigualdad ${s(a[0])} para ${s(a[1] ?? 'x')}`;
    case 'series':
      return `Polinomio de Taylor${a[3] ? ` de orden ${s(a[3])}` : ''} de ${s(a[0])}, respecto de ${s(a[1] ?? 'x')}, centrado en ${s(a[2] ?? '0')}`;
    case 'nthRoots':
      return a.length === 2 ? `Raíces complejas de índice ${s(a[1])} de ${s(a[0])}` : undefined;
    case 'mixedNumber':
      return a.length === 3
        ? `Número mixto: ${s(a[0])} enteros y ${s(`${a[1]}/${a[2]}`)}`
        : undefined;
    case 'partfrac':
      return `Descomponer en fracciones parciales ${s(a[0])}${a[1] ? ` respecto de ${s(a[1])}` : ''}`;
  }
  return undefined;
}
// Lectura de lo que no se puede interpretar: palabra por palabra, sin inventar estructura.
function incomplete(text: string, ctx: Context): string {
  const tokens = text.match(/\d+(?:\.\d+)?|[A-Za-zÀ-ÿα-ω_][\wÀ-ÿα-ω]*|\S/g) ?? [];
  const words = tokens.map((token) =>
    /^\d/.test(token)
      ? literalSpeech(token, ctx)
      : /^[A-Za-zÀ-ÿα-ω_]/.test(token)
        ? (SINGLE[token]?.[0].replace(/ de$/, '') ?? symbolSpeech(token))
        : (symbolName(token) ?? token),
  );
  return `Expresión incompleta: ${words.join(' ')}`;
}
function speakText(text: string, ctx: Context): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (NUMBER.test(trimmed)) return literalSpeech(trimmed, ctx);
  if (/^[+-]?(Infinity|NaN)$/.test(trimmed))
    return speakNumber(trimmed, { significant: ctx.significant });
  const statements = splitTop(trimmed, (t, i) => t[i] === ';');
  if (statements.length > 1) return statements.map((part) => speakText(part, ctx)).join('. ');
  const plusMinus = splitTop(trimmed, (t, i) => t[i] === '±' || t[i] === '∓');
  if (plusMinus.length > 1) {
    const sign = trimmed.includes('∓') ? ' menos o más ' : ' más o menos ';
    return plusMinus.map((part) => speakText(part, ctx)).join(sign);
  }
  const name = wholeCall(trimmed);
  if (name && COMMANDS.has(name)) {
    try {
      const parsed = parseCommand(trimmed);
      const spoken = parsed && command(parsed.name, parsed.args, ctx);
      if (spoken) return spoken;
    } catch {
      // No es un comando bien formado: se lee como expresión.
    }
  }
  const sides = splitTop(trimmed, isEquals);
  if (sides.length > 1) return sides.map((side) => speakText(side, ctx)).join(' igual a ');
  try {
    return read(parse(protect(trimmed, ctx.literals)), ctx);
  } catch {
    return incomplete(trimmed, ctx);
  }
}

const cache = new Map<string, SpokenMath>();
/** Lectura y si hubo redondeo; la usa la lectura de resultados. */
export function mathSpeechDetail(expression: string, options: MathSpeechOptions = {}): SpokenMath {
  const verbosity = options.verbosity ?? 'normal';
  const significant = options.significant ?? Infinity;
  const key = `${verbosity}|${options.decimalSeparator ?? 'punto'}|${significant}|${expression}`;
  const known = cache.get(key);
  if (known) return known;
  let text = expression
    .replace(/∞/g, 'Infinity')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=');
  if (!text.trim()) return { text: 'La expresión está vacía.', rounded: false };
  // mathjs lee 50% como 50/100: se marca antes para decir «50 por ciento».
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*%(?![\d(])/g, '_pct($1)');
  try {
    text = normalizeExpression(text, { decimalSeparator: options.decimalSeparator });
  } catch {
    // Se lee el texto tal cual si la normalización no puede con él.
  }
  const ctx: Context = { literals: [], verbosity, significant, rounded: false };
  const spoken = { text: speakText(text, ctx) || 'La expresión está vacía.', rounded: ctx.rounded };
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(key, spoken);
  return spoken;
}
export function mathSpeech(expression: string, options: MathSpeechOptions = {}): string {
  return mathSpeechDetail(expression, options).text;
}
