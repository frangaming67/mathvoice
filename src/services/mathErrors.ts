// Errores del motor con código y posición, en español y pensados para escucharse.
// Sin dependencias en tiempo de ejecución: se usa en el Worker y en el hilo principal.
import type { DecimalSeparator } from '../types';

export type MathErrorCode =
  | 'vacio'
  | 'largo'
  | 'sintaxis'
  | 'parentesis'
  | 'corchete'
  | 'comillas'
  | 'falta-valor'
  | 'coma-decimal'
  | 'simbolo'
  | 'funcion'
  | 'argumentos'
  | 'resto'
  | 'sin-resultado'
  | 'ecuacion'
  | 'variable'
  | 'texto'
  | 'division-por-cero'
  | 'indefinido'
  | 'desbordamiento'
  | 'dominio'
  | 'no-real'
  | 'matriz'
  | 'dimensiones'
  | 'calculo'
  | 'tiempo'
  | 'cancelado'
  | 'motor';

export class MathInputError extends Error {
  readonly code: MathErrorCode;
  /** Posición 1-based sobre el texto original; length + 1 significa «al final». */
  readonly position?: number;
  constructor(
    message: string,
    code: MathErrorCode = 'calculo',
    position?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MathInputError';
    this.code = code;
    if (position !== undefined) this.position = position;
  }
}

export interface SerializedMathError {
  message: string;
  code: MathErrorCode;
  position?: number;
}

/** Texto normalizado con la posición original de cada carácter (ver parser/expression). */
export interface SourceMapped {
  source: string;
  text: string;
  map: number[];
}

const WORDS: Record<string, string> = {
  '+': '«más»',
  '-': '«menos»',
  '*': '«por»',
  '/': '«dividido por»',
  '^': '«elevado a»',
  '=': '«igual»',
  ',': 'la coma',
  ';': 'el punto y coma',
  '<': '«menor que»',
  '>': '«mayor que»',
};

function positionAt(mapped: SourceMapped, index: number): number {
  const clamped = Math.max(0, Math.min(index, mapped.map.length - 1));
  return (mapped.map[clamped] ?? mapped.source.length) + 1;
}

function previousSignificant(text: string, index: number): { char: string; index: number } | null {
  for (let i = Math.min(index, text.length) - 1; i >= 0; i--)
    if (!/\s/.test(text[i])) return { char: text[i], index: i };
  return null;
}

interface Balance {
  unclosed: { char: string; index: number }[];
  extra?: { char: string; index: number };
}

function bracketBalance(text: string): Balance {
  const stack: { char: string; index: number }[] = [];
  let extra: Balance['extra'];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      continue;
    }
    if (char === '(' || char === '[') stack.push({ char, index: i });
    else if (char === ')' || char === ']') {
      if (stack.length && stack[stack.length - 1].char === (char === ')' ? '(' : '[')) stack.pop();
      else if (!extra) extra = { char, index: i };
    }
  }
  return { unclosed: stack, extra };
}

function unclosedMessage(mapped: SourceMapped, unclosed: Balance['unclosed']): MathInputError {
  const last = unclosed[unclosed.length - 1];
  const paren = last.char === '(';
  const noun = paren ? 'paréntesis' : 'corchete';
  const count = unclosed.filter((item) => item.char === last.char).length;
  const position = positionAt(mapped, last.index);
  const message =
    count === 1
      ? `Falta cerrar 1 ${noun} abierto en la posición ${position}.`
      : `Faltan cerrar ${count} ${paren ? 'paréntesis' : 'corchetes'}; el último se abrió en la posición ${position}.`;
  return new MathInputError(message, paren ? 'parentesis' : 'corchete', position);
}

function decimalCommaHint(mapped: SourceMapped, index: number): MathInputError | null {
  const at = mapped.map[index];
  const source = mapped.source;
  if (at === undefined || source[at] !== ',') return null;
  if (!/\d/.test(source[at - 1] ?? '') || !/\d/.test(source[at + 1] ?? '')) return null;
  let start = at - 1;
  while (start > 0 && /[\d.]/.test(source[start - 1])) start--;
  let end = at + 1;
  while (end < source.length && /\d/.test(source[end])) end++;
  const written = source.slice(start, end);
  return new MathInputError(
    `${written}: con separador punto escribí ${written.replace(',', '.')}, o activá la coma decimal en Configuración.`,
    'coma-decimal',
    at + 1,
  );
}

/** Traduce un SyntaxError de mathjs a un mensaje concreto con posición sobre el texto original. */
export function translateSyntaxError(
  error: unknown,
  mapped: SourceMapped,
  decimal: DecimalSeparator = 'punto',
): MathInputError {
  if (error instanceof MathInputError) return error;
  const message = error instanceof Error ? error.message : '';
  const char = (error as { char?: unknown } | null)?.char;
  const text = mapped.text;
  const index =
    typeof char === 'number' ? Math.max(0, Math.min(char - 1, text.length)) : text.length;
  const end = text.trimEnd().length;
  const where = (i: number) => (i >= end ? 'al final' : `en la posición ${positionAt(mapped, i)}`);
  const balance = bracketBalance(text);
  const before = previousSignificant(text, index);
  const missingAfter = (i: number) => {
    const previous = previousSignificant(text, i);
    if (previous && WORDS[previous.char])
      return new MathInputError(
        `Falta un número después de ${WORDS[previous.char]}, ${where(i)}.`,
        'falta-valor',
        positionAt(mapped, i),
      );
    if (previous && (previous.char === '(' || previous.char === '['))
      return new MathInputError(
        `Falta un número dentro del ${previous.char === '(' ? 'paréntesis' : 'corchete'} abierto en la posición ${positionAt(mapped, previous.index)}.`,
        'falta-valor',
        positionAt(mapped, i),
      );
    return null;
  };

  if (/Unexpected operator ([,;])/.test(message)) {
    if (decimal === 'punto') {
      const hint = decimalCommaHint(mapped, index);
      if (hint) return hint;
    }
    const original = mapped.source[mapped.map[index]] ?? message.match(/operator (.)/)?.[1];
    return new MathInputError(
      `Sobra ${original === ';' ? 'un punto y coma' : 'una coma'} en la posición ${positionAt(mapped, index)}.`,
      'sintaxis',
      positionAt(mapped, index),
    );
  }
  if (/Unexpected operator ([)\]])/.test(message) || (balance.extra && !balance.unclosed.length)) {
    const extra = /Unexpected operator ([)\]])/.test(message)
      ? { char: text[index] ?? ')', index }
      : balance.extra!;
    const paren = extra.char === ')';
    return new MathInputError(
      `Sobra un ${paren ? 'paréntesis' : 'corchete'} de cierre en la posición ${positionAt(mapped, extra.index)}.`,
      paren ? 'parentesis' : 'corchete',
      positionAt(mapped, extra.index),
    );
  }
  if (/Unexpected end of expression/.test(message)) {
    const missing = missingAfter(index);
    if (missing) return missing;
    if (balance.unclosed.length) return unclosedMessage(mapped, balance.unclosed);
    return new MathInputError(
      'La expresión está incompleta al final.',
      'falta-valor',
      positionAt(mapped, text.length),
    );
  }
  if (/Parenthesis \) expected|End of matrix \] expected|expected/.test(message)) {
    if (/End of string/.test(message))
      return new MathInputError(
        `Falta cerrar las comillas ${where(index)}.`,
        'comillas',
        positionAt(mapped, index),
      );
    if (/Value expected/.test(message)) {
      if (text[index] === ')' || text[index] === ']')
        return new MathInputError(
          `Falta un número antes del ${text[index] === ')' ? 'paréntesis' : 'corchete'} de cierre en la posición ${positionAt(mapped, index)}.`,
          'falta-valor',
          positionAt(mapped, index),
        );
      return (
        missingAfter(index) ??
        new MathInputError(
          `Falta un número ${where(index)}.`,
          'falta-valor',
          positionAt(mapped, index),
        )
      );
    }
    if (balance.unclosed.length) return unclosedMessage(mapped, balance.unclosed);
  }
  const part = message.match(/(?:Syntax error in part|Unexpected part) "(.+?)"/)?.[1];
  if (part) {
    if (part.startsWith('.'))
      return new MathInputError(
        `Sobra un punto decimal en la posición ${positionAt(mapped, index)}.`,
        'sintaxis',
        positionAt(mapped, index),
      );
    const symbol = mapped.source[mapped.map[index]] ?? part[0];
    return new MathInputError(
      `No reconozco «${symbol}» en la posición ${positionAt(mapped, index)}.`,
      'simbolo',
      positionAt(mapped, index),
    );
  }
  if (/Invalid left hand side of assignment/.test(message))
    return new MathInputError(
      'A la izquierda del signo igual va el nombre de una variable o un lado de la ecuación.',
      'ecuacion',
      positionAt(mapped, index),
    );
  const unexpected = message.match(/Unexpected operator (\S+)/)?.[1];
  if (unexpected) {
    const missing = before && WORDS[before.char] ? missingAfter(index) : null;
    if (missing) return missing;
    return new MathInputError(
      `No esperaba «${unexpected}» en la posición ${positionAt(mapped, index)}.`,
      'sintaxis',
      positionAt(mapped, index),
    );
  }
  if (balance.unclosed.length) return unclosedMessage(mapped, balance.unclosed);
  return new MathInputError(
    `No pude interpretar la expresión ${where(index)}. Revisá los paréntesis y los operadores.`,
    'sintaxis',
    positionAt(mapped, index),
    { cause: error },
  );
}

type Translation = [RegExp, (match: RegExpMatchArray) => [string, MathErrorCode]];

const RUNTIME: Translation[] = [
  [/Division by zero/i, () => ['No se puede dividir por cero.', 'division-por-cero']],
  [
    /columns \((\d+)\) must match .*rows \((\d+)\)/i,
    (m) => [
      `Para multiplicar, las columnas de A (${m[1]}) deben coincidir con las filas de B (${m[2]}).`,
      'dimensiones',
    ],
  ],
  [
    /Vectors with length 3 expected/i,
    () => ['El producto vectorial (cross) necesita dos vectores de 3 componentes.', 'dimensiones'],
  ],
  [
    /Vectors must have equal length \((\d+) != (\d+)\)/i,
    (m) => [
      `El producto escalar (dot) necesita vectores del mismo largo: A tiene ${m[1]} componentes y B tiene ${m[2]}.`,
      'dimensiones',
    ],
  ],
  [
    /shape mismatch|Dimension mismatch/i,
    () => ['Las dimensiones de las matrices o vectores no son compatibles.', 'dimensiones'],
  ],
  [
    /Matrix must be square|square matrix/i,
    () => [
      'La operación necesita una matriz cuadrada: igual cantidad de filas que de columnas.',
      'matriz',
    ],
  ],
  [
    /determinant is zero/i,
    () => ['La matriz es singular (su determinante es 0): no tiene inversa.', 'matriz'],
  ],
  [
    /matrix is singular/i,
    () => ['La matriz del sistema es singular: el sistema no tiene solución única.', 'matriz'],
  ],
  [
    /k must be less than or equal to (?:first argument )?n/i,
    () => ['En combinaciones y permutaciones, k no puede ser mayor que n.', 'dominio'],
  ],
  [
    /Positive integer value expected in function (\w+)/i,
    (m) => [`La función ${m[1]} necesita números enteros no negativos.`, 'dominio'],
  ],
  [
    /Value must be non-negative/i,
    () => ['El factorial solo está definido para enteros no negativos.', 'dominio'],
  ],
  [
    /Parameters in function (\w+) must be integer/i,
    (m) => [`La función ${m[1]} necesita números enteros.`, 'dominio'],
  ],
  [
    /Root must be odd when a is negative/i,
    () => ['La raíz par de un número negativo no es real.', 'no-real'],
  ],
  [/empty array/i, () => ['La lista está vacía: escribí al menos un número.', 'argumentos']],
  [
    /Too few arguments in function (\w+)/,
    (m) => [`Faltan argumentos en la función ${m[1]}.`, 'argumentos'],
  ],
  [
    /Too many arguments in function (\w+)/,
    (m) => [`Sobran argumentos en la función ${m[1]}.`, 'argumentos'],
  ],
  [
    /Unexpected type of argument in function (\w+)/,
    (m) => [
      `La función ${m[1]} no acepta ese tipo de dato. Revisá si va un número, una lista o una matriz.`,
      'argumentos',
    ],
  ],
  [
    /Function '(\w+)' doesn't apply to matrices/,
    (m) => [`La función ${m[1]} se aplica a un número, no a una matriz.`, 'argumentos'],
  ],
  [/Cannot convert "(.*)" to a number/, (m) => [`«${m[1]}» no es un número.`, 'texto']],
  [/Undefined symbol (\S+)/, (m) => [`No reconozco «${m[1]}».`, 'simbolo']],
  [/Undefined function (\S+)/, (m) => [`La función ${m[1]} no está disponible.`, 'funcion']],
  [
    /Maximum call stack|too much recursion|allocation failed|Invalid array length/i,
    () => ['La operación es demasiado grande para calcularla.', 'calculo'],
  ],
];

const SPANISH =
  /[áéíóúñ¿¡«]|^(El|La|Las|Los|Lo|Un|Una|No|Se|Si|Para|En|Por|Con|Sin|Hay|Falta|Faltan|Sobra|Solo|Usa|Ingresa|Elegi|Escribi|Revisa|Introduci|Todas|Todos|X|Y|Base|Debe|Esa|Ese|Esta|Este)\b/;

/** Convierte cualquier error del cálculo en un MathInputError en español. */
export function translateRuntimeError(error: unknown): MathInputError {
  if (error instanceof MathInputError) return error;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  for (const [pattern, build] of RUNTIME) {
    const match = message.match(pattern);
    if (match) {
      const [text, code] = build(match);
      return new MathInputError(text, code, undefined, { cause: error });
    }
  }
  if (message && SPANISH.test(message))
    return new MathInputError(message, 'calculo', undefined, { cause: error });
  return new MathInputError(
    'No pude calcular esa operación. Revisá los argumentos y los valores de las funciones.',
    'calculo',
    undefined,
    { cause: error },
  );
}

export function serializeMathError(error: unknown): SerializedMathError {
  const translated = translateRuntimeError(error);
  return {
    message: translated.message,
    code: translated.code,
    ...(translated.position !== undefined && { position: translated.position }),
  };
}

/** Reconstruye el error que cruzó el Worker. Acepta también el formato viejo (solo texto). */
export function mathErrorFrom(data: SerializedMathError | string | undefined): MathInputError {
  if (!data) return new MathInputError('No pude completar el cálculo.', 'motor');
  if (typeof data === 'string') return new MathInputError(data, 'calculo');
  return new MathInputError(data.message, data.code, data.position);
}
