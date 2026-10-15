// Lectura y validación de lo que se escribe en los formularios de herramientas (listas de
// datos, celdas y matrices pegadas, números sueltos). No evalúa nada: valida y deja cada
// valor en la sintaxis canónica de mathjs (punto decimal, coma entre argumentos).
import type { DecimalSeparator } from '../types';
import { formatNumber, speakNumber } from '../accessibility/numberSpeech';

/** Datos opcionales que una herramienta le pasa a Calculator junto con la expresión. */
export interface ToolCalculation {
  /** Descripción en palabras de la operación, para el historial y la lectura del resultado. */
  description?: string;
  /** Texto que se anuncia antes del resultado, p. ej. «Se leyeron 3 datos: …». */
  preface?: string;
}
export type ToolCalculate = (expression: string, context?: ToolCalculation) => void;

export interface Noun {
  singular: string;
  plural: string;
}
const DATA_NOUN: Noun = { singular: 'dato', plural: 'datos' };

const normalize = (text: string) =>
  text.replace(/[\u2212\u2013]/g, '-').replace(/[\u00a0\u202f]/g, ' ');
const count = (n: number, noun: Noun) => `${n} ${n === 1 ? noun.singular : noun.plural}`;
const spokenNumber = (canonical: string) =>
  speakNumber(canonical, { significant: Infinity, markApproximate: false });
const writtenNumber = (value: number, decimal: DecimalSeparator) =>
  formatNumber(value, { significant: 15, decimal });

// ---------- Números ----------

interface NumberToken {
  canonical: string;
  value: number;
}
function build(sign: string, int = '', fraction = '', exponent?: string): NumberToken | null {
  if (!int && !fraction) return null;
  const canonical = `${sign === '-' ? '-' : ''}${int || '0'}${fraction ? `.${fraction}` : ''}${exponent ? `e${exponent}` : ''}`;
  const value = Number(canonical);
  return Number.isFinite(value) ? { canonical, value } : null;
}
const DOT = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;
const COMMA = /^([+-]?)(\d*)(?:,(\d*))?(?:[eE]([+-]?\d+))?$/;
const GROUPED_COMMA = /^([+-]?)(\d{1,3}(?:\.\d{3})+),(\d+)(?:[eE]([+-]?\d+))?$/;
const GROUPED_DOT = /^([+-]?)(\d{1,3}(?:,\d{3})+)\.(\d+)(?:[eE]([+-]?\d+))?$/;
const ONLY_THOUSANDS = /^[+-]?\d{1,3}(?:\.\d{3})+$/;

type NumberRead = NumberToken | 'thousands' | null;
function readNumber(raw: string, decimal: DecimalSeparator | 'auto'): NumberRead {
  const text = raw.trim();
  const fromMatch = (m: RegExpMatchArray | null, grouping?: RegExp) =>
    m ? build(m[1], grouping ? m[2].replace(grouping, '') : m[2], m[3], m[4]) : null;
  if (decimal === 'punto') return fromMatch(text.match(DOT));
  if (decimal === 'coma') {
    if (GROUPED_COMMA.test(text)) return fromMatch(text.match(GROUPED_COMMA), /\./g);
    if (COMMA.test(text)) return fromMatch(text.match(COMMA));
    if (ONLY_THOUSANDS.test(text)) return 'thousands';
    return fromMatch(text.match(DOT));
  }
  if (text.includes('.') && text.includes(',')) {
    if (GROUPED_COMMA.test(text)) return fromMatch(text.match(GROUPED_COMMA), /\./g);
    return fromMatch(text.match(GROUPED_DOT), /,/g);
  }
  return fromMatch(text.match(text.includes(',') ? COMMA : DOT));
}

export type NumberParse =
  { ok: true; value: number; canonical: string } | { ok: false; message: string };

/**
 * Lee un número escrito en un campo: acepta punto o coma decimal, separador de miles junto
 * con el decimal (1.234,5), notación científica y una fracción simple (1/6).
 */
export function parseNumber(input: string): NumberParse {
  const text = normalize(input).trim();
  if (!text) return { ok: false, message: 'Falta el número.' };
  const fraction = text.match(/^([^/]+)\/([^/]+)$/);
  if (fraction) {
    const top = readNumber(fraction[1], 'auto');
    const bottom = readNumber(fraction[2], 'auto');
    if (top && bottom && top !== 'thousands' && bottom !== 'thousands') {
      if (bottom.value === 0) return { ok: false, message: 'No se puede dividir por cero.' };
      const value = top.value / bottom.value;
      return { ok: true, value, canonical: `(${top.canonical}/${bottom.canonical})` };
    }
  }
  const read = readNumber(text, 'auto');
  if (!read || read === 'thousands')
    return {
      ok: false,
      message: `«${text}» no es un número. Usá cifras, con punto o coma decimal.`,
    };
  return { ok: true, value: read.value, canonical: read.canonical };
}

// ---------- Celdas con expresiones ----------

const FUNCTIONS: Record<string, { name: string; arity: number[] }> = {
  sqrt: { name: 'sqrt', arity: [1] },
  raiz: { name: 'sqrt', arity: [1] },
  raíz: { name: 'sqrt', arity: [1] },
  cbrt: { name: 'cbrt', arity: [1] },
  nthroot: { name: 'nthRoot', arity: [2] },
  sin: { name: 'sin', arity: [1] },
  sen: { name: 'sin', arity: [1] },
  cos: { name: 'cos', arity: [1] },
  tan: { name: 'tan', arity: [1] },
  asin: { name: 'asin', arity: [1] },
  acos: { name: 'acos', arity: [1] },
  atan: { name: 'atan', arity: [1] },
  ln: { name: 'ln', arity: [1] },
  log: { name: 'log', arity: [1, 2] },
  exp: { name: 'exp', arity: [1] },
  abs: { name: 'abs', arity: [1] },
};
const CONSTANTS: Record<string, string> = { pi: 'pi', π: 'pi', e: 'e', phi: 'phi' };
const OPERATORS: Record<string, string> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '/': '/',
  '÷': '/',
  ':': '/',
  '^': '^',
};

type Token =
  | { type: 'number'; text: string; value: number; start: number; end: number }
  | { type: 'constant'; text: string; start: number; end: number }
  | { type: 'function'; text: string; source: string; arity: number[]; start: number; end: number }
  | { type: 'operator'; text: string; start: number; end: number }
  | { type: '(' | ')' | ','; text: string; start: number; end: number };

export type CellParse =
  | { ok: true; expression: string; value?: number }
  | { ok: false; message: string; start: number; end: number };

class CellError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
  }
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const calls: boolean[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    const number = text.slice(i).match(/^(\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      let raw = number[0];
      const inCall = calls[calls.length - 1] ?? false;
      // Dentro de una función, la coma separa argumentos y no es decimal.
      if (inCall && raw.includes(',')) raw = raw.slice(0, raw.indexOf(','));
      const read = readNumber(raw, raw.includes(',') ? 'coma' : 'punto');
      if (!read || read === 'thousands')
        throw new CellError(`«${raw}» no es un número`, i, i + raw.length);
      tokens.push({
        type: 'number',
        text: read.canonical,
        value: read.value,
        start: i,
        end: i + raw.length,
      });
      i += raw.length;
      continue;
    }
    const word = text.slice(i).match(/^[a-zA-ZáéíóúñÁÉÍÓÚÑπ]+/);
    if (word) {
      const source = word[0];
      const key = source.toLowerCase();
      const end = i + source.length;
      if (FUNCTIONS[key])
        tokens.push({
          type: 'function',
          text: FUNCTIONS[key].name,
          source,
          arity: FUNCTIONS[key].arity,
          start: i,
          end,
        });
      else if (CONSTANTS[key])
        tokens.push({ type: 'constant', text: CONSTANTS[key], start: i, end });
      else throw new CellError(`no reconozco «${source}»`, i, end);
      i = end;
      continue;
    }
    if (OPERATORS[char])
      tokens.push({ type: 'operator', text: OPERATORS[char], start: i, end: i + 1 });
    else if (char === '(') {
      calls.push(tokens[tokens.length - 1]?.type === 'function');
      tokens.push({ type: '(', text: '(', start: i, end: i + 1 });
    } else if (char === ')') {
      calls.pop();
      tokens.push({ type: ')', text: ')', start: i, end: i + 1 });
    } else if (char === ',') tokens.push({ type: ',', text: ',', start: i, end: i + 1 });
    else throw new CellError(`el signo «${char}» no corresponde`, i, i + 1);
    i++;
  }
  return tokens;
}

function validateTokens(tokens: Token[], length: number) {
  let position = 0;
  const peek = () => tokens[position];
  const fail = (message: string, token?: Token): never => {
    throw new CellError(message, token?.start ?? length, token?.end ?? length);
  };
  const startsOperand = (token?: Token) =>
    !!token && ['number', 'constant', 'function', '('].includes(token.type);
  function expression() {
    term();
    while (peek()?.type === 'operator' && ['+', '-'].includes(peek().text)) {
      position++;
      term();
    }
  }
  function term() {
    unary();
    for (;;) {
      const next = peek();
      if (next?.type === 'operator' && ['*', '/'].includes(next.text)) {
        position++;
        unary();
      } else if (startsOperand(next) && next.type !== 'number') unary();
      else return;
    }
  }
  function unary() {
    const next = peek();
    if (next?.type === 'operator' && ['+', '-'].includes(next.text)) {
      position++;
      unary();
      return;
    }
    power();
  }
  function power() {
    primary();
    if (peek()?.type === 'operator' && peek().text === '^') {
      position++;
      unary();
    }
  }
  function primary() {
    const token = peek();
    if (!token) {
      const previous = tokens[position - 1];
      return fail(previous ? `falta un valor después de «${previous.text}»` : 'falta el valor');
    }
    if (token.type === 'number' || token.type === 'constant') {
      position++;
      return;
    }
    if (token.type === 'function') {
      position++;
      if (peek()?.type !== '(') return fail(`después de «${token.source}» van paréntesis`, token);
      const open = peek();
      position++;
      let args = 1;
      expression();
      while (peek()?.type === ',') {
        position++;
        args++;
        expression();
      }
      if (peek()?.type !== ')') return fail('falta cerrar un paréntesis', open);
      position++;
      if (!token.arity.includes(args))
        fail(
          token.arity.includes(2) && !token.arity.includes(1)
            ? `«${token.source}» lleva 2 valores separados por coma; para decimales usá punto`
            : `«${token.source}» lleva un solo valor; para decimales dentro de la función usá punto`,
          token,
        );
      return;
    }
    if (token.type === '(') {
      position++;
      expression();
      if (peek()?.type !== ')') return fail('falta cerrar un paréntesis', token);
      position++;
      return;
    }
    if (token.type === ')') return fail('sobra un paréntesis de cierre', token);
    if (token.type === ',') return fail('sobra una coma', token);
    const previous = tokens[position - 1];
    return fail(
      previous
        ? `falta un valor entre «${previous.text}» y «${token.text}»`
        : `falta un valor antes de «${token.text}»`,
      token,
    );
  }
  expression();
  const rest = peek();
  if (rest)
    fail(
      rest.type === ')'
        ? 'sobra un paréntesis de cierre'
        : rest.type === ','
          ? 'sobra una coma'
          : `«${rest.text}» no corresponde ahí`,
      rest,
    );
}

const wordLike = (token: Token) => ['number', 'constant', 'function'].includes(token.type);

/**
 * Valida un valor de celda: número (punto o coma decimal), fracción o expresión con
 * constantes (pi, e) y funciones comunes (raíz, potencias, trigonométricas, logaritmos).
 */
export function parseCell(input: string): CellParse {
  const text = normalize(input);
  if (!text.trim()) return { ok: false, message: 'falta el valor', start: 0, end: 0 };
  try {
    const tokens = tokenize(text);
    validateTokens(tokens, text.length);
    const expression = tokens
      .map((token, i) =>
        i && wordLike(tokens[i - 1]) && wordLike(token) ? ` ${token.text}` : token.text,
      )
      .join('');
    const single = tokens.length === 1 && tokens[0].type === 'number' ? tokens[0].value : undefined;
    const negative =
      tokens.length === 2 && tokens[0].text === '-' && tokens[1].type === 'number'
        ? -tokens[1].value
        : undefined;
    return { ok: true, expression, value: single ?? negative };
  } catch (error) {
    if (error instanceof CellError)
      return { ok: false, message: error.message, start: error.start, end: error.end };
    throw error;
  }
}

// ---------- Listas de datos ----------

export interface ListItem {
  /** Texto para mostrar, con el separador decimal detectado. */
  text: string;
  /** Sintaxis canónica para mathjs. */
  expression: string;
  /** Valor numérico cuando el dato es un número (no una expresión). */
  value?: number;
}
export interface ListReading {
  items: ListItem[];
  decimal: DecimalSeparator;
  skippedHeader?: string;
}
export interface ListOption {
  label: string;
  /** Texto equivalente sin ambigüedad, para reemplazar lo escrito si se elige esta opción. */
  text: string;
  reading: ListReading;
}
export type ListParse =
  | { status: 'ok'; reading: ListReading }
  | { status: 'ambiguous'; question: string; options: ListOption[] }
  | { status: 'error'; message: string; start?: number; end?: number };

interface Piece {
  text: string;
  start: number;
}
function splitTopLevel(text: string, separator: RegExp): Piece[] {
  const pieces: Piece[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length;) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      separator.lastIndex = i;
      const match = separator.exec(text);
      if (match?.[0]) {
        pieces.push({ text: text.slice(start, i), start });
        i += match[0].length;
        start = i;
        continue;
      }
    }
    i++;
  }
  pieces.push({ text: text.slice(start), start });
  return pieces
    .map((piece) => {
      const offset = piece.text.length - piece.text.trimStart().length;
      return { text: piece.text.trim(), start: piece.start + offset };
    })
    .filter((piece) => piece.text);
}

const STRONG = /\s*[;\t\r\n]\s*|\s*,\s+|\s+/y;
const COMMAS = /\s*,\s*|\s+/y;
const SPACES = /\s+,?\s*|,\s+/y;

type Read =
  { ok: true; item: ListItem } | { ok: false; message: string; start: number; end: number };
function readItem(piece: Piece, decimal: DecimalSeparator, position: number, noun: Noun): Read {
  const fail = (detail: string): Read => ({
    ok: false,
    message: `El ${noun.singular} ${position}, «${piece.text}», ${detail}`,
    start: piece.start,
    end: piece.start + piece.text.length,
  });
  const number = readNumber(piece.text, decimal);
  if (number === 'thousands')
    return fail(
      `no se entiende: ¿lleva punto de miles? Escribilo sin el punto (${piece.text.replace(/\./g, '')}) o con coma decimal.`,
    );
  if (number)
    return {
      ok: true,
      item: {
        text: writtenNumber(number.value, decimal),
        expression: number.canonical,
        value: number.value,
      },
    };
  if (!/[a-zA-Zπ(/*^×÷]/.test(piece.text))
    return fail(
      decimal === 'coma'
        ? 'no es un número. Con punto y coma o un dato por línea, la coma es decimal.'
        : 'no es un número.',
    );
  const cell = parseCell(decimal === 'punto' ? piece.text : piece.text);
  if (!cell.ok) return fail(`no es válido: ${cell.message}.`);
  return { ok: true, item: { text: piece.text, expression: cell.expression, value: cell.value } };
}

type Attempt =
  | { ok: true; reading: ListReading; pieces: Piece[] }
  | { ok: false; message: string; start?: number; end?: number };
function readPieces(pieces: Piece[], decimal: DecimalSeparator, noun: Noun): Attempt {
  const items: ListItem[] = [];
  for (const [index, piece] of pieces.entries()) {
    const read = readItem(piece, decimal, index + 1, noun);
    if (!read.ok) return read;
    items.push(read.item);
  }
  return { ok: true, reading: { items, decimal }, pieces };
}

const listLabel = (reading: ListReading, noun: Noun) =>
  `${count(reading.items.length, noun)}${reading.decimal === 'coma' && reading.items.some((i) => /,/.test(i.text)) ? ' con coma decimal' : ''}: ${preview(reading.items.map((i) => i.text))}`;
function preview(texts: string[], limit = 10) {
  return texts.length <= limit
    ? texts.join('; ')
    : `${texts.slice(0, 5).join('; ')}; … y ${texts.length - 5} más`;
}
const rewrite = (reading: ListReading) =>
  reading.decimal === 'coma'
    ? reading.items.map((i) => i.text).join('; ')
    : reading.items.map((i) => i.text).join(', ');

function readFlat(
  text: string,
  noun: Noun,
): Attempt | { ambiguous: [Attempt & { ok: true }, Attempt & { ok: true }] } {
  if (/[;\t\r\n]/.test(text)) return readPieces(splitTopLevel(text, STRONG), 'coma', noun);
  const byCommas = readPieces(splitTopLevel(text, COMMAS), 'punto', noun);
  const bySpaces = readPieces(splitTopLevel(text, SPACES), 'coma', noun);
  if (!bySpaces.ok) return byCommas;
  if (!byCommas.ok) return bySpaces;
  const same =
    byCommas.reading.items.length === bySpaces.reading.items.length &&
    byCommas.reading.items.every(
      (item, i) => item.expression === bySpaces.reading.items[i].expression,
    );
  if (same) return byCommas;
  if (/\s/.test(text.trim()) && !/,\s|\s,/.test(text)) return bySpaces;
  return { ambiguous: [bySpaces, byCommas] };
}

function tableShape(text: string) {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim());
  if (lines.length < 2 || !lines.every((line) => line.includes('\t'))) return null;
  const rows = lines.map((line) => line.split('\t').map((cell) => cell.trim()));
  return rows.every((row) => row.length === rows[0].length) ? rows : null;
}

const looksLikeData = (text: string) => /\d/.test(text) || /^(pi|π|e)$/i.test(text.trim());

/**
 * Lee una lista de datos escrita o pegada. Separadores: comas, punto y coma, espacios,
 * tabulaciones y saltos de línea. Si hay punto y coma, tabulaciones o saltos de línea, la
 * coma es decimal. Si la lectura es dudosa, devuelve las opciones en vez de adivinar.
 */
export function parseList(input: string, options: { max?: number; noun?: Noun } = {}): ListParse {
  const { max = 500, noun = DATA_NOUN } = options;
  const text = normalize(input);
  if (!text.trim()) return { status: 'error', message: `Escribí al menos un ${noun.singular}.` };
  const empty = text.match(/[,;]\s*[,;]/);
  if (empty?.index !== undefined)
    return {
      status: 'error',
      message: `Hay un ${noun.singular} vacío entre dos separadores.`,
      start: empty.index,
      end: empty.index + empty[0].length,
    };
  const limit = (reading: ListReading): ListParse =>
    reading.items.length > max
      ? {
          status: 'error',
          message: `Hay ${count(reading.items.length, noun)}; el máximo es ${max}.`,
        }
      : { status: 'ok', reading };

  const table = tableShape(text);
  if (table) {
    const header = table[0].every((cell) => !looksLikeData(cell)) ? table[0].join(' ') : undefined;
    const body = header ? table.slice(1) : table;
    const first = readPieces(
      body.map((row) => ({ text: row[0], start: 0 })),
      'coma',
      noun,
    );
    const all = readPieces(
      body.flat().map((cell) => ({ text: cell, start: 0 })),
      'coma',
      noun,
    );
    if (!first.ok) return { status: 'error', message: first.message };
    if (!all.ok) return { status: 'error', message: all.message };
    for (const attempt of [first, all]) attempt.reading.skippedHeader = header;
    if (all.reading.items.length > max) return limit(all.reading);
    return {
      status: 'ambiguous',
      question: `Pegaste una tabla de ${count(body.length, { singular: 'fila', plural: 'filas' })} y ${table[0].length} columnas. ¿Qué datos uso?`,
      options: [
        {
          label: `Solo la primera columna: ${listLabel(first.reading, noun)}`,
          text: rewrite(first.reading),
          reading: first.reading,
        },
        {
          label: `Toda la tabla: ${listLabel(all.reading, noun)}`,
          text: rewrite(all.reading),
          reading: all.reading,
        },
      ],
    };
  }

  let attempt = readFlat(text, noun);
  let header: string | undefined;
  if ('ok' in attempt && !attempt.ok) {
    const lines = text.split(/\r\n|\r|\n/);
    const firstLine = lines.findIndex((line) => line.trim());
    if (firstLine >= 0 && lines.length > firstLine + 1 && !looksLikeData(lines[firstLine])) {
      const rest = readFlat(lines.slice(firstLine + 1).join('\n'), noun);
      if (!('ok' in rest) || rest.ok) {
        attempt = rest;
        header = lines[firstLine].trim();
      }
    }
  }
  if ('ambiguous' in attempt) {
    const [decimalComma, separators] = attempt.ambiguous;
    return {
      status: 'ambiguous',
      question: 'No sé si la coma separa datos o es decimal. ¿Cómo lo leo?',
      options: [
        {
          label: listLabel(decimalComma.reading, noun),
          text: rewrite(decimalComma.reading),
          reading: decimalComma.reading,
        },
        {
          label: `${listLabel(separators.reading, noun)}`,
          text: rewrite(separators.reading),
          reading: separators.reading,
        },
      ],
    };
  }
  if (!attempt.ok)
    return { status: 'error', message: attempt.message, start: attempt.start, end: attempt.end };
  if (header) attempt.reading.skippedHeader = header;
  return limit(attempt.reading);
}

/** Lectura confirmatoria: «Se leyeron 3 datos: 1,5; 2,5; 3,5.», para mostrar y para hablar. */
export function describeReading(
  reading: ListReading,
  options: { noun?: Noun; speakExpression?: (text: string) => string } = {},
): { text: string; speech: string } {
  const { noun = DATA_NOUN, speakExpression = (t: string) => t } = options;
  const n = reading.items.length;
  const verb = n === 1 ? 'Se leyó' : 'Se leyeron';
  const header = reading.skippedHeader
    ? `Se omitió el encabezado «${reading.skippedHeader}». `
    : '';
  const spoken = reading.items.map((item) =>
    item.value !== undefined && /^-?[\d.]+(e-?\d+)?$/.test(item.expression)
      ? spokenNumber(item.expression)
      : speakExpression(item.expression),
  );
  const list = (texts: string[], separator: string) =>
    texts.length <= 10
      ? texts.join(separator)
      : `${texts.slice(0, 5).join(separator)}${separator}y ${texts.length - 5} más`;
  return {
    text: `${header}${verb} ${count(n, noun)}: ${preview(reading.items.map((i) => i.text))}.`,
    speech: `${header}${verb} ${count(n, noun)}: ${list(spoken, '; ')}.`,
  };
}

/** Sintaxis de mathjs de una lista leída: «[1.5,2.5,3.5]». */
export const listExpression = (reading: ListReading) =>
  `[${reading.items.map((item) => item.expression).join(',')}]`;

// ---------- Matrices escritas o pegadas como texto ----------

export type MatrixParse =
  | { status: 'ok'; cells: string[][] }
  | { status: 'ambiguous'; question: string; options: { label: string; cells: string[][] }[] }
  | { status: 'error'; message: string };

const ROW_NOUN: Noun = { singular: 'valor', plural: 'valores' };

function readRows(
  rows: string[],
  separator: RegExp,
  decimal: DecimalSeparator,
): { ok: true; cells: string[][] } | { ok: false; message: string } {
  const cells: string[][] = [];
  for (const [index, row] of rows.entries()) {
    const read = readPieces(splitTopLevel(row, separator), decimal, ROW_NOUN);
    if (!read.ok) return { ok: false, message: `Fila ${index + 1}: ${read.message}` };
    cells.push(read.reading.items.map((item) => item.text));
  }
  const width = cells[0]?.length ?? 0;
  const uneven = cells.findIndex((row) => row.length !== width);
  if (uneven > 0)
    return {
      ok: false,
      message: `La fila ${uneven + 1} tiene ${count(cells[uneven].length, ROW_NOUN)} y la fila 1 tiene ${width}. Todas las filas deben tener la misma cantidad.`,
    };
  return { ok: true, cells };
}

const size = (cells: string[][]) => `${cells.length} por ${cells[0].length}`;

/**
 * Lee una matriz escrita como texto: filas separadas por salto de línea o punto y coma;
 * columnas por espacio, tabulación o coma. También acepta [[1,2],[3,4]].
 */
export function parseMatrixText(
  input: string,
  options: { maxRows?: number; maxColumns?: number } = {},
): MatrixParse {
  const { maxRows = 8, maxColumns = 8 } = options;
  const text = normalize(input).trim();
  if (!text) return { status: 'error', message: 'Escribí al menos una fila de valores.' };
  const limit = (cells: string[][]): MatrixParse =>
    cells.length > maxRows || cells[0].length > maxColumns
      ? {
          status: 'error',
          message: `La matriz puede tener hasta ${maxRows} filas y ${maxColumns} columnas; esta es de ${size(cells)}.`,
        }
      : { status: 'ok', cells };
  const finish = (read: ReturnType<typeof readRows>): MatrixParse =>
    read.ok ? limit(read.cells) : { status: 'error', message: read.message };

  if (text.startsWith('[')) {
    const inner = text.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
    const rows = inner.startsWith('[')
      ? inner.split(/\]\s*[,;]?\s*\[/).map((row) => row.replace(/[[\]]/g, ''))
      : inner.split(';');
    return finish(readRows(rows, COMMAS, 'punto'));
  }
  const lines = /[\r\n]/.test(text);
  const rows = text.split(lines ? /\s*(?:\r\n|\r|\n)\s*/ : /\s*;\s*/).filter((row) => row.trim());
  if (text.includes('\t')) return finish(readRows(rows, /\s*\t\s*/y, 'coma'));
  if (lines && rows.every((row) => row.includes(';')))
    return finish(readRows(rows, /\s*;\s*/y, 'coma'));
  const byCommas = readRows(rows, COMMAS, 'punto');
  const bySpaces = readRows(rows, SPACES, 'coma');
  if (!bySpaces.ok) return finish(byCommas);
  if (!byCommas.ok) return finish(bySpaces);
  const same =
    byCommas.cells.flat().join('|') === bySpaces.cells.flat().join('|') &&
    size(byCommas.cells) === size(bySpaces.cells);
  if (same || !/,/.test(text)) return finish(byCommas);
  // La coma separa columnas, salvo que las columnas ya vayan separadas por espacios.
  if (!/\s/.test(text.replace(/\s*(?:\r\n|\r|\n|;)\s*/g, ''))) return finish(byCommas);
  if (!/,\s|\s,/.test(text)) return finish(bySpaces);
  return {
    status: 'ambiguous',
    question: 'No sé si la coma separa columnas o es decimal. ¿Cómo lo leo?',
    options: [
      { label: `Matriz de ${size(bySpaces.cells)}, con coma decimal`, cells: bySpaces.cells },
      {
        label: `Matriz de ${size(byCommas.cells)}, con comas entre columnas`,
        cells: byCommas.cells,
      },
    ],
  };
}

/** Texto editable de una matriz: una fila por línea y columnas separadas por espacios. */
export const matrixToText = (cells: string[][]) =>
  cells.map((row) => row.map((cell) => cell.replace(/\s+/g, '')).join(' ')).join('\n');

// ---------- Navegación en cuadrículas ----------

/** Celda de destino para una tecla en una cuadrícula, o null si la tecla no navega. */
export function gridTarget(
  key: string,
  ctrlKey: boolean,
  row: number,
  column: number,
  rows: number,
  columns: number,
): { row: number; column: number } | null {
  const clamp = (r: number, c: number) => ({
    row: Math.min(rows - 1, Math.max(0, r)),
    column: Math.min(columns - 1, Math.max(0, c)),
  });
  switch (key) {
    case 'ArrowUp':
      return clamp(row - 1, column);
    case 'ArrowDown':
      return clamp(row + 1, column);
    case 'ArrowLeft':
      return clamp(row, column - 1);
    case 'ArrowRight':
      return clamp(row, column + 1);
    case 'Home':
      return ctrlKey ? clamp(0, 0) : clamp(row, 0);
    case 'End':
      return ctrlKey ? clamp(rows - 1, columns - 1) : clamp(row, columns - 1);
    case 'PageUp':
      return clamp(0, column);
    case 'PageDown':
      return clamp(rows - 1, column);
    default:
      return null;
  }
}

/**
 * En una celda editable, las flechas laterales, Inicio y Fin recorren el texto; solo pasan
 * a otra celda cuando el cursor ya está en el borde o todo el texto está seleccionado.
 * Arriba, abajo y Control más Inicio o Fin siempre cambian de celda.
 */
export function leavesCell(
  key: string,
  ctrlKey: boolean,
  selectionStart: number | null,
  selectionEnd: number | null,
  length: number,
): boolean {
  if (key === 'ArrowUp' || key === 'ArrowDown') return true;
  if (key === 'Home' || key === 'End') {
    if (ctrlKey) return true;
  } else if (key !== 'ArrowLeft' && key !== 'ArrowRight') return false;
  else if (ctrlKey) return false;
  if (selectionStart === null || selectionEnd === null) return true;
  const all = selectionStart === 0 && selectionEnd === length;
  return key === 'ArrowLeft' || key === 'Home'
    ? all || (selectionStart === 0 && selectionEnd === 0)
    : all || (selectionStart === length && selectionEnd === length);
}

// ---------- Validaciones previas por herramienta ----------

export interface Dimensions {
  rows: number;
  columns: number;
}
export type MatrixControl = { matrix: 'A' | 'B'; control: 'rows' | 'columns' };
export type MatrixProblem = MatrixControl & { message: string };

const SQUARE: Record<string, string> = {
  det: 'El determinante necesita',
  inv: 'La inversa necesita',
  trace: 'La traza necesita',
  eigvals: 'Los autovalores necesitan',
  eigvecs: 'Los autovectores necesitan',
};
const dims = (d: Dimensions) => `${d.rows} por ${d.columns}`;

/** Problema de dimensiones de una operación matricial, o null si se puede calcular. */
export function matrixOperationProblem(
  operation: string,
  a: Dimensions,
  b?: Dimensions,
): MatrixProblem | null {
  if (SQUARE[operation] && a.rows !== a.columns)
    return {
      matrix: 'A',
      control: 'columns',
      message: `${SQUARE[operation]} una matriz cuadrada. A es de ${dims(a)}.`,
    };
  if (!b) return null;
  if (operation === 'add' || operation === 'subtract') {
    if (a.rows === b.rows && a.columns === b.columns) return null;
    return {
      matrix: 'B',
      control: a.rows !== b.rows ? 'rows' : 'columns',
      message: `Para ${operation === 'add' ? 'sumar' : 'restar'}, A y B deben tener el mismo tamaño. A es de ${dims(a)} y B es de ${dims(b)}.`,
    };
  }
  if (operation === 'multiply' && a.columns !== b.rows)
    return {
      matrix: 'B',
      control: 'rows',
      message: `Para multiplicar A por B, las columnas de A (${a.columns}) deben ser tantas como las filas de B (${b.rows}).`,
    };
  if (operation === 'lusolve') {
    if (a.rows !== a.columns)
      return {
        matrix: 'A',
        control: 'columns',
        message: `Para resolver A por X igual a B, A debe ser cuadrada. A es de ${dims(a)}.`,
      };
    if (b.rows !== a.rows)
      return {
        matrix: 'B',
        control: 'rows',
        message: `B debe tener tantas filas como A (${a.rows}). B tiene ${b.rows}.`,
      };
  }
  return null;
}

/** Primera celda inválida de una matriz, con su mensaje. */
export function matrixCellProblem(
  name: string,
  cells: string[][],
): { row: number; column: number; message: string; start: number; end: number } | null {
  for (const [row, values] of cells.entries())
    for (const [column, value] of values.entries()) {
      const cell = parseCell(value);
      if (!cell.ok)
        return {
          row,
          column,
          message: `${name}, fila ${row + 1}, columna ${column + 1}: ${cell.message}.`,
          start: cell.start,
          end: cell.end,
        };
    }
  return null;
}

/** Sintaxis de mathjs de una matriz de celdas ya validadas: «[[1,2],[3,4]]». */
export function matrixExpression(cells: string[][]): string {
  return `[${cells
    .map(
      (row) =>
        `[${row
          .map((value) => {
            const cell = parseCell(value);
            if (!cell.ok) throw new Error(cell.message);
            return cell.expression;
          })
          .join(',')}]`,
    )
    .join(',')}]`;
}

const BINARY_VECTOR = ['dot', 'distance', 'vectorangle', 'add', 'subtract'];

/** Problema de tamaño entre dos vectores, o null. */
export function vectorProblem(
  operation: string,
  a: number,
  b?: number,
): { field: 'A' | 'B'; message: string } | null {
  if (operation === 'cross') {
    if (a !== 3)
      return {
        field: 'A',
        message: `El producto cruz necesita vectores de 3 componentes. A tiene ${a}.`,
      };
    if (b !== undefined && b !== 3)
      return {
        field: 'B',
        message: `El producto cruz necesita vectores de 3 componentes. B tiene ${b}.`,
      };
    return null;
  }
  if (BINARY_VECTOR.includes(operation) && b !== undefined && a !== b)
    return {
      field: 'B',
      message: `A y B deben tener la misma cantidad de componentes. A tiene ${a} y B tiene ${b}.`,
    };
  return null;
}

export const PAIRED_STATISTICS = ['regression', 'covariance', 'correlation'];

/** Problema de cantidad de datos en estadística, o null. */
export function statisticsProblem(
  operation: string,
  x: number,
  options: { y?: number; sample?: boolean } = {},
): { field: 'x' | 'y'; message: string } | null {
  if (PAIRED_STATISTICS.includes(operation)) {
    if (x < 2) return { field: 'x', message: 'Hacen falta al menos dos datos en X.' };
    if (options.y !== undefined && options.y !== x)
      return {
        field: 'y',
        message: `X e Y deben tener la misma cantidad de datos. X tiene ${x} e Y tiene ${options.y}.`,
      };
    return null;
  }
  if (options.sample && ['stats', 'std', 'variance'].includes(operation) && x < 2)
    return {
      field: 'x',
      message:
        'La varianza muestral necesita al menos dos datos. Agregá datos o desmarcá «Datos de una muestra».',
    };
  return null;
}

/** Valida el percentil (0 a 100). */
export function percentileProblem(text: string): string | null {
  const read = parseNumber(text);
  if (!read.ok) return `Percentil: ${read.message}`;
  return read.value < 0 || read.value > 100 ? 'El percentil debe estar entre 0 y 100.' : null;
}

type Rule = 'integer' | 'factorial' | 'real' | 'probability' | 'positive';
const PROBABILITY_RULES: Record<string, Rule[]> = {
  factorial: ['factorial'],
  combinations: ['integer', 'integer'],
  permutations: ['integer', 'integer'],
  binomialpdf: ['integer', 'integer', 'probability'],
  binomialcdf: ['integer', 'integer', 'probability'],
  normalcdf: ['real', 'real', 'positive'],
  normalpdf: ['real', 'real', 'positive'],
  poissonpdf: ['integer', 'positive'],
  poissoncdf: ['integer', 'positive'],
};

export type FieldsCheck =
  | { ok: true; values: number[]; expressions: string[] }
  | { ok: false; index: number; message: string };

/** Valida los campos de una operación de probabilidad; labels son las etiquetas visibles. */
export function probabilityCheck(
  operation: string,
  labels: string[],
  texts: string[],
): FieldsCheck {
  const rules = PROBABILITY_RULES[operation] ?? [];
  const values: number[] = [];
  const expressions: string[] = [];
  for (const [index, rule] of rules.entries()) {
    const label = labels[index];
    const fail = (message: string): FieldsCheck => ({
      ok: false,
      index,
      message: `${label}: ${message}`,
    });
    const read = parseNumber(texts[index] ?? '');
    if (!read.ok) return fail(read.message);
    const v = read.value;
    if ((rule === 'integer' || rule === 'factorial') && (!Number.isInteger(v) || v < 0))
      return fail('tiene que ser un entero mayor o igual que cero.');
    if (rule === 'integer' && v > 100000) return fail('usá un entero hasta 100000.');
    if (rule === 'factorial' && v > 170)
      return fail('usá un entero hasta 170; los factoriales mayores no se pueden representar.');
    if (rule === 'probability' && (v < 0 || v > 1)) return fail('tiene que estar entre 0 y 1.');
    if (rule === 'positive' && v <= 0) return fail('tiene que ser mayor que cero.');
    values.push(v);
    expressions.push(read.canonical);
  }
  if (['combinations', 'permutations'].includes(operation) && values[1] > values[0])
    return { ok: false, index: 1, message: `r no puede ser mayor que n (${values[0]}).` };
  if (operation.startsWith('binomial') && values[0] > values[1])
    return {
      ok: false,
      index: 0,
      message: `k no puede ser mayor que la cantidad de ensayos n (${values[1]}).`,
    };
  return { ok: true, values, expressions };
}

const ABSOLUTE_ZERO: Record<string, number> = { K: 0, degC: -273.15, degF: -459.67 };

/** Aviso si una temperatura está por debajo del cero absoluto en su unidad. */
export function temperatureProblem(value: number, unit: string): string | null {
  const zero = ABSOLUTE_ZERO[unit];
  if (zero === undefined || value >= zero) return null;
  const c = writtenNumber(-273.15, 'coma');
  const f = writtenNumber(-459.67, 'coma');
  return `No existe una temperatura menor que el cero absoluto: ${c} °C, ${f} °F o 0 K.`;
}

const BASE_DIGITS: Record<number, string> = {
  2: 'Usá solo 0 y 1.',
  8: 'Usá dígitos del 0 al 7.',
  10: 'Usá dígitos del 0 al 9.',
  16: 'Usá dígitos del 0 al 9 y letras de la A a la F.',
};

/** Problema de un entero escrito en base 2, 8, 10 o 16, con la posición del dígito culpable. */
export function baseNumberProblem(
  text: string,
  base: number,
): { message: string; start?: number } | null {
  const clean = text.trim();
  const digits = clean.replace(/^[-+]/, '');
  if (!digits) return { message: 'Escribí un número entero.' };
  if (clean.length > 256) return { message: 'Usá hasta 256 dígitos.' };
  const offset = text.indexOf(clean) + (clean.length - digits.length);
  for (const [i, char] of [...digits].entries()) {
    const digit = parseInt(char, 16);
    if (!Number.isInteger(digit) || digit >= base)
      return {
        message: `«${char}» no es un dígito de base ${base}. ${BASE_DIGITS[base] ?? ''}`.trim(),
        start: offset + i,
      };
  }
  return null;
}

/** Valida un entero en decimal para operaciones binarias. */
export function decimalIntegerProblem(
  text: string,
  range?: { min: number; max: number },
): string | null {
  const clean = text.trim();
  if (!/^[-+]?\d+$/.test(clean)) return 'Escribí un entero en decimal, sin comas ni puntos.';
  if (clean.replace(/^[-+]/, '').length > 256) return 'Usá hasta 256 dígitos.';
  if (range && (Number(clean) < range.min || Number(clean) > range.max))
    return `Tiene que estar entre ${range.min} y ${range.max}.`;
  return null;
}
