import { cleanNumber, formatNumber } from '../accessibility/numberSpeech';
import { math } from './mathRuntime';
import type { CalculationResult, DecimalSeparator, NumberFormat } from '../types';

export interface FormatOptions {
  decimal?: DecimalSeparator;
  format?: NumberFormat;
  /** Decimales en formato fijo; cifras significativas en normal y científico. */
  digits?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

function withSeparator(text: string, decimal: DecimalSeparator) {
  return decimal === 'coma' ? text.replace('.', ',') : text;
}

/** Texto visible de un número real según el formato elegido (normal, fijo o científico). */
export function formatReal(value: number, options: FormatOptions = {}): string {
  const { decimal = 'punto', format = 'normal' } = options;
  if (!Number.isFinite(value)) return formatNumber(value, { decimal });
  if (format === 'fijo' && Math.abs(value) < 1e21) {
    const text = value.toFixed(clamp(options.digits ?? 10, 0, 15));
    return withSeparator(/^-0(\.0*)?$/.test(text) ? text.slice(1) : text, decimal);
  }
  if (format === 'cientifico') {
    if (value === 0) return '0';
    const [mantissa, exponent] = value
      .toExponential(clamp(options.digits ?? 10, 1, 17) - 1)
      .split('e');
    return withSeparator(`${mantissa}e${Number(exponent)}`, decimal);
  }
  const significant = clamp(options.digits ?? 10, 1, 17);
  if (Number.isSafeInteger(value)) return String(value);
  const size = Math.abs(value);
  if (value !== 0 && (size < 1e-6 || size >= 10 ** significant)) {
    // Notación científica: formatNumber borraría como ruido lo menor a 1e-12 (6.6e-34 es real)
    // y escribiría ceros inventados en los enteros grandes redondeados (2432902008000000000).
    const [mantissa, exponent] = value.toExponential(16).split('e');
    const digits = formatNumber(Number(mantissa), { significant, decimal });
    return digits === '10' || digits === '-10'
      ? `${digits.replace('10', '1')}e${Number(exponent) + 1}`
      : `${digits}e${Number(exponent)}`;
  }
  return formatNumber(value, { significant, decimal });
}

function formatComplex(re: number, im: number, options: FormatOptions) {
  if (!Number.isFinite(re) || !Number.isFinite(im))
    throw new Error('El resultado no es finito. Revisá el dominio de la operación.');
  const modulus = Math.hypot(re, im);
  const real = cleanNumber(re, modulus);
  const imaginary = cleanNumber(im, modulus);
  if (!imaginary) return formatReal(real, options);
  const size = Math.abs(imaginary) === 1 ? '' : formatReal(Math.abs(imaginary), options);
  if (!real) return `${imaginary < 0 ? '-' : ''}${size}i`;
  return `${formatReal(real, options)} ${imaginary < 0 ? '-' : '+'} ${size}i`;
}

export function formatMathValue(value: unknown, options: FormatOptions = {}): string {
  const separator = options.decimal === 'coma' ? '; ' : ', ';
  if (math.isMatrix(value)) return formatMathValue(value.toArray(), options);
  if (math.isComplex(value)) return formatComplex(value.re, value.im, options);
  if (math.isFraction(value)) return value.toFraction();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('La operación no tiene un resultado finito.');
    return formatReal(value, options);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return `[${value.map((item) => formatMathValue(item, options)).join(separator)}]`;
  if (value && typeof value === 'object')
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${formatMathValue(v, options)}`)
      .join('; ');
  throw new Error('El motor devolvió un resultado que no se puede representar.');
}

export function resultStructure(
  value: unknown,
  options: FormatOptions = {},
): Pick<CalculationResult, 'table' | 'matrix'> {
  if (math.isMatrix(value)) value = value.toArray();
  if (Array.isArray(value)) {
    const rows = value.every(Array.isArray) ? value : [value];
    return {
      matrix: rows.map((row) => (row as unknown[]).map((cell) => formatMathValue(cell, options))),
    };
  }
  if (value && typeof value === 'object' && !math.isComplex(value) && !math.isFraction(value))
    return {
      table: Object.entries(value).map(([label, v]) => ({
        label,
        value: formatMathValue(v, options),
      })),
    };
  return {};
}
