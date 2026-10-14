import type { DecimalSeparator } from '../types';
import { MathInputError } from '../services/mathErrors';

// Alias que solo se aplican a una palabra completa seguida de «(».
const functionAliases: Record<string, string> = {
  raiz: 'sqrt',
  raíz: 'sqrt',
  sen: 'sin',
  seno: 'sin',
  coseno: 'cos',
  tangente: 'tan',
  tg: 'tan',
  cotg: 'cot',
  ctg: 'cot',
  cotangente: 'cot',
  secante: 'sec',
  cosec: 'csc',
  cosecante: 'csc',
  arcsen: 'asin',
  asen: 'asin',
  arcsin: 'asin',
  arccos: 'acos',
  arctg: 'atan',
  arctan: 'atan',
  senh: 'sinh',
  tgh: 'tanh',
  arcsenh: 'asinh',
  asenh: 'asinh',
  absoluto: 'abs',
  mcd: 'gcd',
  mcm: 'lcm',
  ncr: 'combinations',
  npr: 'permutations',
  derivada: 'diff',
  integral: 'integrate',
  limite: 'limit',
  límite: 'limit',
  resolver: 'solve',
  simplificar: 'simplify',
  factorizar: 'factor',
  expandir: 'expand',
};
// Alias de constantes: palabra completa que no es una llamada.
const constantAliases: Record<string, string> = { infinito: 'Infinity', inf: 'Infinity' };
const answerWords = new Set(['ans', 'resultado']);
/** Palabras que el normalizador traduce; no sirven como nombres de variables. */
export const reservedWords: ReadonlySet<string> = new Set([
  ...Object.keys(functionAliases),
  ...Object.keys(constantAliases),
  ...answerWords,
]);
const symbolReplacements: Record<string, string> = {
  '×': '*',
  '·': '*',
  '⋅': '*',
  '∙': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
};
const superscripts: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
};
const radicals: Record<string, [string, string]> = {
  '√': ['sqrt(', ')'],
  '∛': ['cbrt(', ')'],
  '∜': ['nthRoot(', ',4)'],
};

export interface NormalizeOptions {
  decimalSeparator?: DecimalSeparator;
  /** Valor de «ans» y «resultado». null: todavía no hay resultado. Sin definir: no se tocan. */
  ans?: string | null;
}

export interface MappedExpression {
  /** Texto tal como lo escribió la persona. */
  source: string;
  /** Texto listo para mathjs. */
  text: string;
  /** Índice en source de cada carácter de text, más uno final para «al final». */
  map: number[];
  /** Problemas detectados al normalizar, con posición sobre source. */
  issues: MathInputError[];
}

const isDigit = (c: string | undefined) => !!c && c >= '0' && c <= '9';
const isIdentStart = (c: string | undefined) => !!c && /[A-Za-z_áéíóúüñÁÉÍÓÚÜÑ]/.test(c);
const isIdentChar = (c: string | undefined) => !!c && /[\wáéíóúüñÁÉÍÓÚÜÑ]/.test(c);

function skipSpaces(text: string, i: number, end: number) {
  while (i < end && /\s/.test(text[i])) i++;
  return i;
}
function identEnd(text: string, i: number, end: number) {
  while (i < end && isIdentChar(text[i])) i++;
  return i;
}
function numberEnd(text: string, i: number, end: number, comma: boolean) {
  while (i < end && isDigit(text[i])) i++;
  if ((text[i] === '.' || (comma && text[i] === ',')) && isDigit(text[i + 1])) {
    i++;
    while (i < end && isDigit(text[i])) i++;
  }
  if (
    /[eE]/.test(text[i] ?? '') &&
    (isDigit(text[i + 1]) || (/[+-]/.test(text[i + 1] ?? '') && isDigit(text[i + 2])))
  ) {
    i += 2;
    while (i < end && isDigit(text[i])) i++;
  }
  return i;
}
function groupEnd(text: string, i: number, end: number) {
  let depth = 0;
  for (let j = i; j < end; j++) {
    if (text[j] === '(' || text[j] === '[') depth++;
    else if (text[j] === ')' || text[j] === ']') {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return end;
}
function operandEnd(text: string, start: number, end: number, comma: boolean): number {
  const k = skipSpaces(text, start, end);
  const c = text[k];
  let j: number;
  if (k >= end) return start;
  if (c === '(' || c === '[') j = groupEnd(text, k, end);
  else if (isDigit(c) || (c === '.' && isDigit(text[k + 1]))) j = numberEnd(text, k, end, comma);
  else if (isIdentStart(c)) {
    j = identEnd(text, k, end);
    const next = skipSpaces(text, j, end);
    if (text[next] === '(') j = groupEnd(text, next, end);
  } else if (c === 'π' || c === '∞') j = k + 1;
  else if (radicals[c] || c === '-' || c === '−') {
    const inner = operandEnd(text, k + 1, end, comma);
    if (inner === k + 1) return start;
    j = inner;
  } else return start;
  while (j < end && superscripts[text[j]]) j++;
  return j;
}

/** Normaliza una entrada y conserva, para cada carácter, su posición en el texto original. */
export function normalizeWithMap(source: string, options: NormalizeOptions = {}): MappedExpression {
  const comma = options.decimalSeparator === 'coma';
  const out: string[] = [];
  const map: number[] = [];
  const issues: MathInputError[] = [];
  const emit = (text: string, at: number) => {
    for (let k = 0; k < text.length; k++) {
      out.push(text[k]);
      map.push(at);
    }
  };
  const lastSignificant = () => {
    for (let k = out.length - 1; k >= 0; k--) if (out[k] !== ' ') return out[k];
    return undefined;
  };
  let start = 0;
  let end = source.length;
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;
  const closes: { at: number; text: string }[] = [];
  const bars: number[] = [];
  let i = start;
  while (i < end) {
    while (closes.length && closes[closes.length - 1].at <= i) emit(closes.pop()!.text, i);
    const c = source[i];
    if (c === '"') {
      let j = i + 1;
      while (j < end && source[j] !== '"') j += source[j] === '\\' ? 2 : 1;
      j = Math.min(j + 1, end);
      for (let k = i; k < j; k++) emit(source[k], k);
      i = j;
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(source[i + 1]))) {
      const j = numberEnd(source, i, end, comma);
      for (let k = i; k < j; k++) emit(source[k] === ',' ? '.' : source[k], k);
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      const j = identEnd(source, i, end);
      const word = source.slice(i, j);
      const lower = word.toLowerCase();
      const next = skipSpaces(source, j, end);
      const call = source[next] === '(';
      const assignment = source[next] === '=' && source[next + 1] !== '=';
      if (options.ans !== undefined && answerWords.has(lower) && !call && !assignment) {
        if (options.ans === null) {
          issues.push(
            new MathInputError(
              'Todavía no hay un resultado anterior. Calculá algo primero y después usá ans.',
              'sin-resultado',
              i + 1,
            ),
          );
          emit(word, i);
        } else {
          const value = normalizeWithMap(options.ans, {
            decimalSeparator: options.decimalSeparator,
          }).text;
          emit(`(${value})`, i);
        }
      } else if (call && functionAliases[lower]) emit(functionAliases[lower], i);
      else if (!call && constantAliases[lower]) emit(constantAliases[lower], i);
      else for (let k = i; k < j; k++) emit(source[k], k);
      i = j;
      continue;
    }
    if (c === 'π' || c === '∞') {
      const name = c === 'π' ? 'pi' : 'Infinity';
      emit(`${out.length && isIdentChar(out[out.length - 1]) ? ' ' : ''}${name}`, i);
      if (isIdentChar(source[i + 1]) || source[i + 1] === '.') emit(' ', i);
      i++;
      continue;
    }
    if (radicals[c]) {
      const [open, close] = radicals[c];
      const next = skipSpaces(source, i + 1, end);
      if (source[next] === '(' && close === ')') emit(open.slice(0, -1), i);
      else {
        const stop = operandEnd(source, i + 1, end, comma);
        emit(stop > i + 1 ? open : open.slice(0, -1), i);
        if (stop > i + 1) closes.push({ at: stop, text: close });
      }
      i++;
      continue;
    }
    if (superscripts[c]) {
      let j = i;
      emit('^', i);
      while (j < end && superscripts[source[j]]) {
        emit(superscripts[source[j]], j);
        j++;
      }
      i = j;
      continue;
    }
    if (c === '|') {
      const previous = lastSignificant();
      if (bars.length && previous !== undefined && /[\w.)\]!%"]/.test(previous)) {
        emit(')', i);
        bars.pop();
      } else {
        emit('abs(', i);
        bars.push(i);
      }
      i++;
      continue;
    }
    if (c === ';') emit(comma ? ',' : ';', i);
    else emit(symbolReplacements[c] ?? c, i);
    i++;
  }
  while (closes.length) emit(closes.pop()!.text, end);
  if (bars.length)
    issues.push(
      new MathInputError(
        `Falta cerrar la barra de valor absoluto abierta en la posición ${bars[bars.length - 1] + 1}.`,
        'parentesis',
        bars[bars.length - 1] + 1,
      ),
    );
  map.push(end);
  return { source, text: out.join(''), map, issues };
}

export function normalizeExpression(input: string, options: NormalizeOptions = {}): string {
  return normalizeWithMap(input, options).text;
}

// Inicio del operando unario que termina en chars[i] (número, nombre, llamada o grupo).
function operandStart(chars: string[], i: number): number {
  while (i >= 0 && chars[i] === ' ') i--;
  while (i >= 0 && chars[i] === '!') i--;
  if (i < 0) return -1;
  let start: number;
  if (chars[i] === ')' || chars[i] === ']') {
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (chars[j] === ')' || chars[j] === ']') depth++;
      else if (chars[j] === '(' || chars[j] === '[') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j < 0) return -1;
    let k = j;
    while (k > 0 && /\w/.test(chars[k - 1])) k--;
    while (k < j && isDigit(chars[k])) k++;
    start = k;
  } else if (/[\w.]/.test(chars[i])) {
    let k = i;
    while (k > 0 && /[\w.]/.test(chars[k - 1])) k--;
    const run = chars.slice(k, i + 1).join('');
    if (!/^(\d+\.?\d*|\.\d+)e\d+$/i.test(run)) {
      const letter = run.search(/[A-Za-z_]/);
      if (letter > 0) k += letter;
    }
    start = k;
  } else return -1;
  let p = start - 1;
  while (p >= 0 && chars[p] === ' ') p--;
  if (p >= 0 && (chars[p] === '-' || chars[p] === '+')) {
    let q = p - 1;
    while (q >= 0 && chars[q] === ' ') q--;
    if (chars[q] === '^') {
      start = p;
      p = q;
    }
  }
  if (p >= 0 && chars[p] === '^') {
    const base = operandStart(chars, p - 1);
    if (base >= 0) return base;
  }
  return start;
}

/**
 * «%» siempre es porcentaje: x% pasa a _pct(x). Entre dos operandos (5%3) se informa que
 * el resto se escribe con mod. Uso interno del motor: el texto resultante no es para mostrar.
 */
export function rewritePercentages(input: MappedExpression, separator = ','): MappedExpression {
  if (!input.text.includes('%')) return input;
  const text = input.text;
  const out: string[] = [];
  const map: number[] = [];
  const issues = [...input.issues];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      for (let k = i; k <= Math.min(j, text.length - 1); k++) {
        out.push(text[k]);
        map.push(input.map[k]);
      }
      i = j;
      continue;
    }
    if (c !== '%') {
      out.push(c);
      map.push(input.map[i]);
      continue;
    }
    const at = input.map[i];
    const left = operandStart(out, out.length - 1);
    const next = skipSpaces(text, i + 1, text.length);
    if (next < text.length && /[\w.(["]/.test(text[next])) {
      const stop = operandEnd(text, next, text.length, false);
      const from = left >= 0 ? map[left] : at;
      const a = input.source.slice(from, at).trim() || 'a';
      const b =
        input.source.slice(input.map[next], (input.map[stop - 1] ?? input.map[next]) + 1).trim() ||
        'b';
      issues.push(
        new MathInputError(
          `El signo % es porcentaje. Para el resto usá mod(${a}${separator} ${b}).`,
          'resto',
          at + 1,
        ),
      );
      out.push(c);
      map.push(at);
      continue;
    }
    if (left < 0) {
      issues.push(
        new MathInputError(
          `Falta un número antes del signo % en la posición ${at + 1}.`,
          'falta-valor',
          at + 1,
        ),
      );
      out.push(c);
      map.push(at);
      continue;
    }
    out.splice(left, 0, '_', 'p', 'c', 't', '(');
    map.splice(left, 0, ...Array<number>(5).fill(map[left] ?? at));
    out.push(')');
    map.push(at);
  }
  map.push(input.map[text.length] ?? input.source.length);
  return { source: input.source, text: out.join(''), map, issues };
}
