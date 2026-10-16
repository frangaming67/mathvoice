import { UNDEFINED_CELL, type CalculationResult, type DecimalSeparator } from '../types';
import { mathSpeechDetail, type SpeechVerbosity } from './MathSpeechFormatter';
import {
  fractionName,
  periodicDecimal,
  speakNumber,
  speakPeriodic,
  speakRadix,
} from './numberSpeech';

export interface ResultSpeechOptions {
  verbosity?: SpeechVerbosity;
  /** Cifras significativas al decir decimales; 0 lee todas. Por defecto 6. */
  spokenDigits?: number;
  decimalSeparator?: DecimalSeparator;
}

const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
const TEXT_ROW = /\b(desde|hasta|enteros|reales|incluido|infinito|unidad|sin moda)\b/i;

function radixOf(result: CalculationResult): number | undefined {
  if (result.radix && result.radix !== 10) return result.radix;
  // Resultados guardados antes de que el motor marcara la base.
  const match = result.expression.match(/^\s*base\(\s*"[^"]*"\s*,\s*\d+\s*,\s*(\d+)\s*\)\s*$/);
  const base = match ? Number(match[1]) : undefined;
  return base && base !== 10 ? base : undefined;
}

/** Fracción exacta p/q: nombre y decimal, periódico si es corto. */
function fractionSpeech(p: string, q: string, significant: number): string {
  const name = fractionName(p, q) ?? `${speakNumber(p)} sobre ${speakNumber(q)}`;
  const expansion = periodicDecimal(p, q);
  if (!expansion) return name;
  if (!expansion.period) {
    const decimal = `${expansion.negative ? '-' : ''}${expansion.integer}${expansion.head ? `.${expansion.head}` : ''}`;
    return `${name}, es decir ${speakNumber(decimal, { significant })}`;
  }
  const periodic = speakPeriodic(expansion);
  if (periodic) return `${name}, es decir ${periodic}`;
  const approximate = `${expansion.negative ? '-' : ''}${expansion.integer}.${expansion.head}${expansion.period.repeat(3)}`;
  return `${name}, ${speakNumber(approximate, { significant: Number.isFinite(significant) ? significant : 12 })}`;
}

function valueSpeech(
  value: string,
  result: CalculationResult | undefined,
  significant: number,
  options: ResultSpeechOptions,
): string {
  const text = value.trim();
  if (NUMBER.test(text) || /^[+-]?(Infinity|NaN)$/.test(text))
    return speakNumber(text, { significant });
  const fraction = text.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) return fractionSpeech(fraction[1], fraction[2], significant);
  const solutions = text.split(/;\s*/);
  const spoken = mathSpeechDetail(text, {
    verbosity: options.verbosity,
    decimalSeparator: options.decimalSeparator,
    significant,
  });
  const prefix =
    solutions.length > 1 && solutions.every((part) => /^[a-zA-Z]\w* = /.test(part))
      ? `${solutions.length} soluciones: `
      : '';
  const approximate = (spoken.rounded || result?.approximate) && !prefix ? 'aproximadamente ' : '';
  return `${prefix}${approximate}${spoken.text}`;
}

function matrixSpeech(matrix: string[][], significant: number, options: ResultSpeechOptions) {
  const cell = (value: string) => valueSpeech(value, undefined, significant, options);
  if (matrix.length === 1)
    return `Lista de ${matrix[0].length} ${matrix[0].length === 1 ? 'valor' : 'valores'}: ${matrix[0].map(cell).join(', ')}`;
  return `Matriz de ${matrix.length} por ${matrix[0]?.length ?? 0}. ${matrix
    .map((row, i) => `Fila ${i + 1}: ${row.map(cell).join(', ')}`)
    .join('. ')}`;
}

/** Filas que se dicen de una tabla de valores; el resto se recorre en la tabla. */
const SPOKEN_ROWS = 12;

/** Tabla de valores: cuántas filas y, fila por fila, x con lo que vale cada función. */
function valueTableSpeech(
  rows: string[][],
  headers: string[],
  significant: number,
  options: ResultSpeechOptions,
) {
  const cell = (value: string) =>
    value === UNDEFINED_CELL ? 'no definida' : valueSpeech(value, undefined, significant, options);
  const names = headers.slice(1).map((header) => header.replace(/^(\w)\(x\)$/, '$1 de equis'));
  const lines = rows.slice(0, SPOKEN_ROWS).map(
    (row) =>
      `equis igual a ${cell(row[0])}: ${row
        .slice(1)
        .map((value, i) => `${names[i]}, ${cell(value)}`)
        .join('; ')}`,
  );
  const rest = rows.length - lines.length;
  return `Tabla de valores de ${rows.length} ${rows.length === 1 ? 'fila' : 'filas'}. ${lines.join('. ')}${rest > 0 ? `. Y ${rest} ${rest === 1 ? 'fila' : 'filas'} más en la tabla` : ''}`;
}

/** Texto hablado de un resultado: números redondeados, fracciones con nombre y avisos. */
export function resultSpeech(result: CalculationResult, options: ResultSpeechOptions = {}): string {
  const digits = options.spokenDigits ?? 6;
  const significant = digits > 0 ? digits : Infinity;
  let spoken: string;
  if (result.table)
    spoken = result.table
      .map(
        (row) =>
          `${row.label}: ${TEXT_ROW.test(`${row.value} ${row.label}`) ? row.value : valueSpeech(row.value, undefined, significant, options)}`,
      )
      .join('. ');
  else if (result.matrix && result.headers)
    spoken = valueTableSpeech(result.matrix, result.headers, significant, options);
  else if (result.matrix) spoken = matrixSpeech(result.matrix, significant, options);
  else {
    const radix = radixOf(result);
    spoken = radix
      ? speakRadix(result.value, radix)
      : valueSpeech(result.value, result, significant, options);
    if (result.complex && !radix) spoken = `número complejo: ${spoken}`;
  }
  if (result.unit) spoken += ` ${result.unit}`;
  if (result.warnings?.length) spoken += `. Aviso: ${result.warnings.join(' ')}`;
  return spoken;
}
