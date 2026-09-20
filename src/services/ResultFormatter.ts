import { math } from './mathRuntime';
import type { CalculationResult } from '../types';

export function formatMathValue(value: unknown): string {
  if (math.isMatrix(value)) return formatMathValue(value.toArray());
  if (math.isComplex(value)) {
    if (!Number.isFinite(value.re) || !Number.isFinite(value.im))
      throw new Error('El resultado no es finito. Revisá el dominio de la operación.');
    return math.format(value, { precision: 12 });
  }
  if (math.isFraction(value)) return value.toFraction();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('La operación no tiene un resultado finito.');
    return math.format(value, { precision: 12 });
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map(formatMathValue).join(', ')}]`;
  if (value && typeof value === 'object')
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${formatMathValue(v)}`)
      .join('; ');
  throw new Error('El motor devolvió un resultado que no se puede representar.');
}
export function resultStructure(value: unknown): Pick<CalculationResult, 'table' | 'matrix'> {
  if (math.isMatrix(value)) value = value.toArray();
  if (Array.isArray(value)) {
    const rows = value.every(Array.isArray) ? value : [value];
    return { matrix: rows.map((row) => (row as unknown[]).map(formatMathValue)) };
  }
  if (value && typeof value === 'object' && !math.isComplex(value) && !math.isFraction(value))
    return {
      table: Object.entries(value).map(([label, v]) => ({ label, value: formatMathValue(v) })),
    };
  return {};
}
