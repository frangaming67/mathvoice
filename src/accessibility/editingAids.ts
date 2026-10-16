import { functionSpeechName, mathSpeech } from './MathSpeechFormatter';
import { speakNumber } from './numberSpeech';
import { letterName, symbolName } from './symbolSpeech';

// Ayudas puras para editar una expresión sin mirarla: qué hay bajo el cursor, dónde está,
// qué paréntesis cierra cuál y qué se borró. No tocan el DOM.

export type EditTokenKind =
  'numero' | 'nombre' | 'operador' | 'abre' | 'cierra' | 'separador' | 'espacio' | 'otro';

export interface EditToken {
  text: string;
  start: number;
  end: number;
  kind: EditTokenKind;
}

export interface CaretToken extends EditToken {
  speech: string;
}

export interface ParenMatch {
  /** Posición del paréntesis junto al cursor. */
  at: number;
  /** Posición de su pareja, o null si no la tiene. */
  match: number | null;
  open: boolean;
  speech: string;
}

const TOKEN =
  /(\s+)|((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([\p{L}_][\p{L}\p{Nd}_]*)|(<=|>=|==|!=|[+\-*/^%!=<>:'×÷−·≤≥≠²³√∞])|([([{])|([)\]}])|([,;])|([\s\S])/uy;
const KINDS: EditTokenKind[] = [
  'espacio',
  'numero',
  'nombre',
  'operador',
  'abre',
  'cierra',
  'separador',
  'otro',
];
const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const BRACKET_NAMES: Record<string, string> = {
  '(': 'paréntesis',
  ')': 'paréntesis',
  '[': 'corchete',
  ']': 'corchete',
  '{': 'llave',
  '}': 'llave',
};
const BRACKET_PLURALS: Record<string, string> = {
  '(': 'paréntesis',
  '[': 'corchetes',
  '{': 'llaves',
};
/** Operadores de dos caracteres; los de uno salen de symbolSpeech. */
const OPERATORS: Record<string, string> = {
  '<=': 'menor o igual que',
  '>=': 'mayor o igual que',
  '==': 'igual a',
  '!=': 'distinto de',
};
/** Funciones de varios argumentos y comandos; las de uno salen de MathSpeechFormatter. */
const FUNCTION_NAMES: Record<string, string> = {
  diff: 'derivada',
  integrate: 'integral',
  limit: 'límite',
  solve: 'resolver',
  system: 'sistema de ecuaciones',
  substitute: 'sustitución',
  series: 'serie de Taylor',
  inequality: 'inecuación',
  partfrac: 'fracciones parciales',
  log: 'logaritmo',
  nthRoot: 'raíz enésima',
  nthRoots: 'raíces enésimas',
  exp: 'exponencial',
  mod: 'resto',
  gcd: 'máximo común divisor',
  lcm: 'mínimo común múltiplo',
  max: 'máximo',
  min: 'mínimo',
  combinations: 'combinaciones',
  permutations: 'permutaciones',
  round: 'redondeo',
  std: 'desvío estándar',
  variance: 'varianza',
  percentile: 'percentil',
  covariance: 'covarianza',
  correlation: 'correlación',
  regression: 'regresión',
  stats: 'resumen estadístico',
  dot: 'producto escalar',
  cross: 'producto vectorial',
  convert: 'conversión',
  base: 'cambio de base',
};
const KEYWORDS: Record<string, string> = {
  to: 'a',
  in: 'en',
  and: 'y',
  or: 'o',
  xor: 'o exclusivo',
  not: 'no',
};
const ALL_DIGITS = { significant: Infinity, markApproximate: false };

export function tokenizeExpression(text: string): EditToken[] {
  const tokens: EditToken[] = [];
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const group = match.slice(1).findIndex((value) => value !== undefined);
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      kind: KINDS[group],
    });
    if (TOKEN.lastIndex >= text.length) break;
  }
  return tokens;
}

/** Nombre hablado de una función o comando: «sin» → «seno», «diff» → «derivada». */
export function functionName(name: string): string {
  if (Object.hasOwn(FUNCTION_NAMES, name)) return FUNCTION_NAMES[name];
  if (Object.hasOwn(KEYWORDS, name)) return KEYWORDS[name];
  const single = functionSpeechName(name);
  if (single) return single;
  if (name.length === 1) return letterName(name) ?? name;
  const spoken = mathSpeech(name);
  return /incompleta/i.test(spoken) ? name : spoken;
}

function numberText(text: string): string {
  return text.endsWith('.')
    ? `${speakNumber(text.slice(0, -1), ALL_DIGITS)} coma`
    : speakNumber(text, ALL_DIGITS);
}

function tokenSpeech(token: EditToken): string {
  if (token.kind === 'numero') return numberText(token.text);
  if (token.kind === 'nombre') return functionName(token.text);
  if (token.kind === 'espacio') return 'espacio';
  return OPERATORS[token.text] ?? symbolName(token.text) ?? token.text;
}

/** Lectura de un solo carácter, como en el eco al mover el cursor. */
export function speakChar(char: string): string {
  if (!char) return '';
  if (/\s/.test(char)) return 'espacio';
  if (/\d/.test(char)) return char;
  if (/\p{L}/u.test(char)) {
    const name = letterName(char);
    if (name) return char === char.toLowerCase() ? name : `${name} mayúscula`;
  }
  return symbolName(char) ?? char;
}

function speakFragment(fragment: string): string {
  if (fragment.length === 1) return speakChar(fragment);
  return tokenizeExpression(fragment)
    .filter((token) => token.kind !== 'espacio')
    .map(tokenSpeech)
    .join(' ');
}

function clampCaret(text: string, caret: number): number {
  return Math.max(0, Math.min(text.length, Math.trunc(caret)));
}

function previousSolid(tokens: EditToken[], position: number): EditToken | undefined {
  for (let i = tokens.length - 1; i >= 0; i--)
    if (tokens[i].end <= position && tokens[i].kind !== 'espacio') return tokens[i];
  return undefined;
}

function nextSolid(tokens: EditToken[], position: number): EditToken | undefined {
  return tokens.find((token) => token.start >= position && token.kind !== 'espacio');
}

/** Nombre de la función dueña de un paréntesis de apertura, si lo tiene. */
function openerOwner(tokens: EditToken[], opener: number): string | undefined {
  const before = previousSolid(tokens, opener);
  return before?.kind === 'nombre' && !Object.hasOwn(KEYWORDS, before.text)
    ? functionName(before.text)
    : undefined;
}

interface BracketScan {
  pairs: Map<number, number>;
  unclosed: number[];
  unmatched: number[];
}

function scanBrackets(text: string): BracketScan {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  const unmatched: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (PAIRS[char]) stack.push(i);
    else if (char === ')' || char === ']' || char === '}') {
      const top = stack[stack.length - 1];
      if (top !== undefined && PAIRS[text[top]] === char) {
        stack.pop();
        pairs.set(top, i);
        pairs.set(i, top);
      } else unmatched.push(i);
    }
  }
  return { pairs, unclosed: stack, unmatched };
}

/** Token que está bajo el cursor (el de la derecha; si no hay, el de la izquierda). */
export function tokenAt(text: string, caret: number): CaretToken | null {
  const position = clampCaret(text, caret);
  const tokens = tokenizeExpression(text);
  const token =
    tokens.find((t) => t.start <= position && position < t.end && t.kind !== 'espacio') ??
    previousSolid(tokens, position) ??
    nextSolid(tokens, position);
  return token ? { ...token, speech: tokenSpeech(token) } : null;
}

/** Carácter a la derecha del cursor, para el eco de flechas, Inicio y Fin. */
export function speakCharAt(text: string, caret: number): string {
  const position = clampCaret(text, caret);
  if (!text) return 'La expresión está vacía.';
  return position >= text.length ? 'Final de la expresión.' : speakChar(text[position]);
}

/** Lee todo lo que hay desde el cursor hasta el final, símbolo por símbolo. */
export function readFromCaret(text: string, caret: number): string {
  if (!text.trim()) return 'La expresión está vacía.';
  const position = clampCaret(text, caret);
  const rest = tokenizeExpression(text).filter((t) => t.end > position && t.kind !== 'espacio');
  return rest.length ? rest.map(tokenSpeech).join(' ') : 'Final de la expresión.';
}

/** Cantidad de paréntesis, corchetes o llaves abiertos y sin cerrar antes del cursor. */
export function parenDepth(text: string, caret: number): number {
  return scanBrackets(text.slice(0, clampCaret(text, caret))).unclosed.length;
}

/** Paréntesis junto al cursor (derecha, si no izquierda) y su pareja. */
export function matchingParen(text: string, caret: number): ParenMatch | null {
  const position = clampCaret(text, caret);
  const at = BRACKET_NAMES[text[position]]
    ? position
    : position > 0 && BRACKET_NAMES[text[position - 1]]
      ? position - 1
      : -1;
  if (at < 0) return null;
  const open = Boolean(PAIRS[text[at]]);
  const match = scanBrackets(text).pairs.get(at) ?? null;
  const noun = BRACKET_NAMES[text[at]];
  if (match === null) return { at, match, open, speech: `Este ${noun} no tiene pareja.` };
  const owner = openerOwner(tokenizeExpression(text), open ? at : match);
  return {
    at,
    match,
    open,
    speech: `Pareja: ${open ? 'cierra' : 'abre'} ${owner ?? noun}, en la posición ${match + 1}.`,
  };
}

/** Dónde está el cursor: «después de seno de, dentro de seno, nivel 1, antes de equis». */
export function describeCaret(text: string, caret: number): string {
  if (!text.trim()) return 'La expresión está vacía.';
  const position = clampCaret(text, caret);
  const tokens = tokenizeExpression(text);
  const parts: string[] = [];
  const inside = tokens.find((t) => t.start < position && position < t.end && t.kind !== 'espacio');
  const left = inside ? undefined : previousSolid(tokens, position);
  const right = inside ? undefined : nextSolid(tokens, position);
  const scan = scanBrackets(text.slice(0, position));
  const opener = scan.unclosed[scan.unclosed.length - 1];
  const leftOwner = left?.kind === 'abre' ? openerOwner(tokens, left.start) : undefined;
  if (inside) parts.push(`en medio de ${tokenSpeech(inside)}`);
  else if (left) parts.push(`después de ${leftOwner ? `${leftOwner} de` : tokenSpeech(left)}`);
  else parts.push('al principio');
  if (opener !== undefined) {
    const owner = openerOwner(tokens, opener);
    const where =
      owner && left?.start !== opener
        ? `dentro de ${owner}`
        : `dentro de ${BRACKET_PLURALS[text[opener]]}`;
    parts.push(`${where}, nivel ${scan.unclosed.length}`);
  }
  if (!inside) parts.push(right ? `antes de ${tokenSpeech(right)}` : 'al final de la expresión');
  const sentence = parts.join(', ');
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

/** Qué se borró al pasar de «before» a «after». Vacío si no hubo borrado. */
export function describeDeletion(before: string, after: string): string {
  if (after.length >= before.length) return '';
  let prefix = 0;
  while (prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  const deleted = before.slice(prefix, before.length - suffix);
  const spoken = `Borraste ${speakFragment(deleted)}`;
  return after.trim() ? `${spoken}.` : `${spoken}. La expresión quedó vacía.`;
}

/** Aviso breve al escribir un cierre: «cierra raíz cuadrada», «cierra nivel 2». */
export function describeClosing(text: string, caret: number): string {
  const at = clampCaret(text, caret) - 1;
  const char = text[at];
  if (char !== ')' && char !== ']' && char !== '}') return '';
  const scan = scanBrackets(text);
  const opener = scan.pairs.get(at);
  if (opener === undefined) {
    const noun = BRACKET_NAMES[char];
    return `${noun[0].toUpperCase()}${noun.slice(1)} de cierre sin pareja.`;
  }
  const owner = openerOwner(tokenizeExpression(text), opener);
  const level = parenDepth(text, opener) + 1;
  const base = owner
    ? `Cierra ${owner}`
    : level > 1
      ? `Cierra nivel ${level}`
      : `Cierra ${BRACKET_NAMES[char]}`;
  const remaining = parenDepth(text, at + 1);
  if (!remaining) return `${base}.`;
  return `${base}; ${remaining === 1 ? 'queda 1 abierto' : `quedan ${remaining} abiertos`}.`;
}

/** Explica un desbalance de paréntesis, o devuelve '' si están bien. */
export function describeBalance(text: string): string {
  const scan = scanBrackets(text);
  if (scan.unmatched.length) {
    const at = scan.unmatched[0];
    return `Sobra un cierre de ${BRACKET_NAMES[text[at]]} en la posición ${at + 1}.`;
  }
  const count = scan.unclosed.length;
  if (!count) return '';
  const opener = scan.unclosed[count - 1];
  const tokens = tokenizeExpression(text);
  const owner = openerOwner(tokens, opener);
  const before = previousSolid(tokens, opener);
  const where = owner
    ? `después de ${owner}`
    : before
      ? `después de ${tokenSpeech(before)}`
      : 'al principio';
  const noun = BRACKET_NAMES[text[opener]];
  return count === 1
    ? `Falta cerrar 1 ${noun}, abierto ${where}.`
    : `Faltan cerrar ${count} ${noun === 'paréntesis' ? noun : `${noun}s`}; el último se abrió ${where}.`;
}
