// Hoja de cálculo de la calculadora de mano: 5 columnas (A a E) y 45 filas. Cada celda guarda
// un número o una fórmula. Aquí está solo la lógica: referencias, rangos y orden de cálculo; el
// motor que calcula cada fórmula llega de afuera.

import type { DecimalSeparator } from '../types';
import { readNumber } from './display';

export const COLUMNS = ['A', 'B', 'C', 'D', 'E'];
export const ROWS = 45;

/** Contenido escrito en cada celda con algo: { A1: '5', B1: 'A1*2' }. */
export type Cells = Record<string, string>;

export interface CellResult {
  /** Lo que se muestra: el valor, o «Error». */
  text: string;
  /** Valor numérico, si la celda es un número real: lo usan las fórmulas que la nombran. */
  number?: number;
  /** Por qué no se pudo calcular. */
  error?: string;
}

export const cellName = (row: number, column: number) => `${COLUMNS[column]}${row + 1}`;

/** Fila y columna de «A1» a «E45»; null si no es una celda de la hoja. */
export function cellPosition(name: string): { row: number; column: number } | null {
  const match = /^([A-E])([1-9]\d?)$/.exec(name);
  if (!match || Number(match[2]) > ROWS) return null;
  return { row: Number(match[2]) - 1, column: COLUMNS.indexOf(match[1]) };
}

// Una celda: A1, con «$» opcional para fijar la columna o la fila al copiar ($A$1, A$1).
const REFERENCE = /(?<![\w$])(\$?)([A-E])(\$?)([1-9]\d?)(?!\w)/g;
const RANGE = /(?<![\w$])\$?([A-E])\$?([1-9]\d?)\s*:\s*\$?([A-E])\$?([1-9]\d?)(?!\w)/g;

/** Funciones de la hoja con su nombre en castellano, como las escribe la gente. */
const ALIASES: Record<string, string> = {
  suma: 'sum',
  promedio: 'mean',
  media: 'mean',
  minimo: 'min',
  mínimo: 'min',
  maximo: 'max',
  máximo: 'max',
};

/** Celdas de un rango, fila por fila: A1:B2 son A1, B1, A2 y B2. */
export function rangeCells(from: string, to: string): string[] {
  const a = cellPosition(from),
    b = cellPosition(to);
  if (!a || !b) return [];
  const names: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++)
    for (
      let column = Math.min(a.column, b.column);
      column <= Math.max(a.column, b.column);
      column++
    )
      names.push(cellName(row, column));
  return names;
}

const bare = (text: string) => text.trim().replace(/^=\s*/, '');

/** Celdas que usa una fórmula, con los rangos expandidos. */
export function references(text: string): string[] {
  const found = new Set<string>();
  const body = bare(text).replace(RANGE, (_match, c1, r1, c2, r2) => {
    rangeCells(`${c1}${r1}`, `${c2}${r2}`).forEach((name) => found.add(name));
    return ' ';
  });
  for (const match of body.matchAll(REFERENCE)) {
    const name = `${match[2]}${match[4]}`;
    if (cellPosition(name)) found.add(name);
  }
  return [...found];
}

/** La fórmula lista para el motor: sin «=», con los nombres en inglés y los rangos como listas. */
export function prepareFormula(text: string, cells: Cells): string {
  return bare(text)
    .replace(/[a-záéíóú]+(?=\s*\()/gi, (word) => ALIASES[word.toLowerCase()] ?? word)
    .replace(RANGE, (_match, c1, r1, c2, r2) => {
      // Como en cualquier planilla, las celdas vacías de un rango no cuentan.
      const used = rangeCells(`${c1}${r1}`, `${c2}${r2}`).filter((name) => cells[name]?.trim());
      return `[${used.join(', ')}]`;
    })
    .replace(REFERENCE, (_match, _c, column, _r, row) => `${column}${row}`);
}

/**
 * Orden de cálculo: cada celda después de las que usa. Las que se usan a sí mismas, directa o
 * indirectamente, quedan como circulares.
 */
export function calculationOrder(cells: Cells): { order: string[]; circular: Set<string> } {
  const order: string[] = [];
  const circular = new Set<string>();
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  function visit(name: string) {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      stack.slice(stack.indexOf(name)).forEach((member) => circular.add(member));
      return;
    }
    state.set(name, 'visiting');
    stack.push(name);
    for (const used of references(cells[name] ?? '')) if (cells[used]?.trim()) visit(used);
    stack.pop();
    state.set(name, 'done');
    order.push(name);
  }
  Object.keys(cells)
    .filter((name) => cells[name].trim())
    .forEach(visit);
  return { order, circular };
}

/**
 * Copia una fórmula a otra fila: las referencias se corren tantas filas como se movió, salvo las
 * fijadas con «$». Devuelve null si alguna referencia queda fuera de la hoja.
 */
export function shiftFormula(text: string, rows: number): string | null {
  let outside = false;
  const shifted = text.replace(REFERENCE, (_match, fixColumn, column, fixRow, row) => {
    const next = fixRow ? Number(row) : Number(row) + rows;
    if (next < 1 || next > ROWS) outside = true;
    return `${fixColumn}${column}${fixRow}${next}`;
  });
  return outside ? null : shifted;
}

/**
 * Calcula todas las celdas en orden. `evaluate` calcula una fórmula con los valores de las celdas
 * que usa; si `current` deja de ser verdadero (la hoja cambió mientras tanto), se abandona.
 */
export async function evaluateSheet(
  cells: Cells,
  evaluate: (expression: string, scope: Record<string, number>) => Promise<CellResult>,
  decimal: DecimalSeparator = 'punto',
  current: () => boolean = () => true,
): Promise<Record<string, CellResult> | null> {
  const results: Record<string, CellResult> = {};
  const { order, circular } = calculationOrder(cells);
  for (const name of order) {
    if (!current()) return null;
    const text = bare(cells[name]);
    if (circular.has(name)) {
      results[name] = { text: 'Error', error: 'Referencia circular: la celda se usa a sí misma.' };
      continue;
    }
    const number = readNumber(text, decimal);
    if (number !== null) {
      results[name] = { text, number };
      continue;
    }
    const scope: Record<string, number> = {};
    const broken = references(text).find((used) => {
      if (!cells[used]?.trim()) {
        scope[used] = 0;
        return false;
      }
      const value = results[used]?.number;
      if (value !== undefined) scope[used] = value;
      return value === undefined;
    });
    if (broken) {
      results[name] = {
        text: 'Error',
        error: results[broken]?.error
          ? `Error en ${broken}.`
          : `${broken} no tiene un número real.`,
      };
      continue;
    }
    try {
      results[name] = await evaluate(prepareFormula(text, cells), scope);
    } catch (cause) {
      results[name] = {
        text: 'Error',
        error: cause instanceof Error ? cause.message : 'No se pudo calcular.',
      };
    }
  }
  return results;
}
