import { describe, expect, it } from 'vitest';
import {
  calculationOrder,
  cellPosition,
  evaluateSheet,
  prepareFormula,
  rangeCells,
  references,
  shiftFormula,
  type CellResult,
} from './sheet';
import { readNumber } from './display';
import { MathEngine } from '../services/MathEngine';

const engine = new MathEngine();
/** El mismo motor de la calculadora, como lo usa la hoja. */
const evaluate = async (expression: string, scope: Record<string, number>): Promise<CellResult> => {
  const result = engine.evaluate(
    expression,
    { angle: 'deg', resultForm: 'decimal', numberDigits: 15 },
    scope,
  );
  const number = readNumber(result.value);
  return number === null ? { text: result.value } : { text: result.value, number };
};

describe('referencias y rangos', () => {
  it('reconoce las celdas de A1 a E45', () => {
    expect(cellPosition('A1')).toEqual({ row: 0, column: 0 });
    expect(cellPosition('E45')).toEqual({ row: 44, column: 4 });
    expect(cellPosition('E46')).toBeNull();
    expect(cellPosition('F1')).toBeNull();
    expect(rangeCells('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
  it('encuentra las celdas que usa una fórmula, sin confundir números ni nombres', () => {
    expect(references('=A1*2 + B3')).toEqual(['A1', 'B3']);
    expect(references('suma(A1:A3) + $C$2')).toEqual(['A1', 'A2', 'A3', 'C2']);
    expect(references('2E1 + e1 + XA1 + A123 + E')).toEqual([]);
  });
  it('prepara la fórmula: nombres en castellano y rangos sin las celdas vacías', () => {
    const cells = { A1: '1', A3: '3' };
    expect(prepareFormula('=Suma(A1:A3)', cells)).toBe('sum([A1, A3])');
    expect(prepareFormula('promedio(A1:A3) + máximo(A1:A3)', cells)).toBe(
      'mean([A1, A3]) + max([A1, A3])',
    );
    expect(prepareFormula('$A$1*sqrt(A3)', cells)).toBe('A1*sqrt(A3)');
  });
  it('copia fórmulas hacia abajo corriendo las filas, salvo las fijas', () => {
    expect(shiftFormula('A1*2+$B$1+C$2', 3)).toBe('A4*2+$B$1+C$2');
    expect(shiftFormula('A45+1', 1)).toBeNull();
  });
  it('ordena el cálculo y marca las referencias circulares', () => {
    const { order, circular } = calculationOrder({ C1: 'B1+1', B1: 'A1*2', A1: '5' });
    expect(order).toEqual(['A1', 'B1', 'C1']);
    expect(circular.size).toBe(0);
    expect([...calculationOrder({ A1: 'B1', B1: 'A1', C1: '7' }).circular].sort()).toEqual([
      'A1',
      'B1',
    ]);
  });
});

describe('cálculo de la hoja con el motor de la calculadora', () => {
  it('calcula fórmulas encadenadas, rangos y funciones en castellano', async () => {
    const results = await evaluateSheet(
      {
        A1: '1',
        A2: '2',
        A3: '3',
        A4: '=suma(A1:A3)',
        B1: 'A1/3',
        B2: 'B1*3',
        B3: 'promedio(A1:A3)',
        C1: 'sin(30)',
        C2: 'D9 + 1',
      },
      evaluate,
    );
    expect(results!.A4.number).toBe(6);
    // Con 15 cifras, un tercio por tres vuelve a dar 1.
    expect(results!.B2.number).toBeCloseTo(1, 12);
    expect(results!.B3.number).toBe(2);
    expect(results!.C1.number).toBe(0.5);
    // Una celda vacía vale 0.
    expect(results!.C2.number).toBe(1);
  });
  it('los errores se explican y se propagan a las celdas que los usan', async () => {
    const results = await evaluateSheet(
      { A1: '1/0', A2: 'A2+1', A3: 'A1*2', A4: 'sqrt(-1)', B1: '2 + 3i', B2: 'B1*2' },
      evaluate,
    );
    expect(results!.A1).toMatchObject({ text: 'Error', error: 'No se puede dividir por cero.' });
    expect(results!.A2.error).toMatch(/circular/);
    expect(results!.A3.error).toBe('Error en A1.');
    expect(results!.A4.error).toMatch(/raíz cuadrada de un número negativo/);
    expect(results!.B1).toEqual({ text: '2 + 3i' });
    expect(results!.B2.error).toBe('B1 no tiene un número real.');
  });
  it('con coma decimal lee los números escritos con coma', async () => {
    const coma = async (expression: string, scope: Record<string, number>) => {
      const result = engine.evaluate(
        expression,
        { angle: 'rad', decimalSeparator: 'coma', resultForm: 'decimal', numberDigits: 15 },
        scope,
      );
      return { text: result.value, number: readNumber(result.value, 'coma') ?? undefined };
    };
    const results = await evaluateSheet({ A1: '2,5', A2: 'A1*2' }, coma, 'coma');
    expect(results!.A1.number).toBe(2.5);
    expect(results!.A2.number).toBe(5);
  });
  it('se abandona si la hoja cambió mientras calculaba', async () => {
    expect(await evaluateSheet({ A1: 'A2+1' }, evaluate, 'punto', () => false)).toBeNull();
  });
});
