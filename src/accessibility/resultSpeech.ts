import type { CalculationResult } from '../types';
import { mathSpeech } from './MathSpeechFormatter';
export function resultSpeech(result: CalculationResult): string {
  if (result.table)
    return result.table
      .map(
        (row) =>
          `${row.label}: ${/\b(desde|hasta|enteros|reales|incluido|infinito|Unidad)\b/i.test(row.value + ' ' + row.label) ? row.value : mathSpeech(row.value)}`,
      )
      .join('. ');
  if (result.matrix)
    return result.matrix
      .map(
        (row, i) =>
          `Fila ${i + 1}. ${row.map((value, j) => `Columna ${j + 1}: ${mathSpeech(value)}`).join('. ')}`,
      )
      .join('. ');
  return `${mathSpeech(result.value)}${result.unit ? ` ${result.unit}` : ''}`;
}
