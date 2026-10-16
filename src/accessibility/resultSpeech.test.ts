import { describe, expect, it } from 'vitest';
import type { CalculationResult } from '../types';
import { resultSpeech } from './resultSpeech';

const result = (patch: Partial<CalculationResult>): CalculationResult => ({
  expression: '1+1',
  value: '2',
  kind: 'Básico',
  explanation: '',
  angleMode: 'rad',
  ...patch,
});

describe('resultSpeech', () => {
  it('redondea los decimales largos y avisa que es una aproximación', () => {
    expect(resultSpeech(result({ value: '3.141592654' }))).toBe('aproximadamente 3 coma 1 4 1 5 9');
    expect(resultSpeech(result({ value: '3.141592654' }), { spokenDigits: 0 })).toBe(
      '3 coma 1 4 1 5 9 2 6 5 4',
    );
    expect(resultSpeech(result({ value: '146.2857143' }), { spokenDigits: 4 })).toBe(
      'aproximadamente 146 coma 3',
    );
  });
  it('dice las fracciones con su nombre y su decimal', () => {
    expect(resultSpeech(result({ value: '1/3' }))).toBe('un tercio, es decir 0 coma 3 periódico');
    expect(resultSpeech(result({ value: '7/2' }))).toBe('7 medios, es decir 3 coma 5');
    expect(resultSpeech(result({ value: '1/6' }))).toBe(
      'un sexto, es decir 0 coma 1 y luego 6 periódico',
    );
    expect(resultSpeech(result({ value: '1024/7' }))).toBe(
      '1024 sobre 7, es decir 146 coma 2 8 5 7 1 4 periódico',
    );
    expect(resultSpeech(result({ value: '-3/4' }))).toBe(
      'menos 3 cuartos, es decir menos 0 coma 75',
    );
  });
  it('lee los resultados en otra base cifra por cifra', () => {
    expect(resultSpeech(result({ value: 'FF', radix: 16 }))).toBe('efe efe; base dieciséis');
    expect(resultSpeech(result({ value: '11111111', radix: 2 }))).toBe(
      '1 1 1 1, 1 1 1 1; base dos',
    );
    expect(resultSpeech(result({ expression: 'base("483",10,16)', value: '1E3' }))).toBe(
      '1 e 3; base dieciséis',
    );
  });
  it('cuenta las soluciones', () => {
    expect(resultSpeech(result({ value: 'x = -2; x = 1' }))).toBe(
      '2 soluciones: equis igual a menos 2. equis igual a 1',
    );
  });
  it('conserva las cifras de los enteros grandes', () => {
    expect(resultSpeech(result({ value: '123456789012345678' }))).toBe('123456789012345678');
  });
  it('agrega los avisos y marca las aproximaciones del motor', () => {
    expect(
      resultSpeech(
        result({
          value: 'x = 1.609437912',
          approximate: true,
          warnings: ['Las soluciones decimales están redondeadas.'],
        }),
      ),
    ).toBe(
      'aproximadamente equis igual a 1 coma 6 0 9 4 4. Aviso: Las soluciones decimales están redondeadas.',
    );
  });
  it('anuncia la dimensión de las matrices y lee las filas', () => {
    expect(
      resultSpeech(
        result({
          value: '[[1, 2], [3, 4]]',
          matrix: [
            ['1', '2'],
            ['3', '4'],
          ],
        }),
      ),
    ).toBe('Matriz de 2 por 2. Fila 1: 1, 2. Fila 2: 3, 4');
    expect(resultSpeech(result({ value: '[i, -i]', matrix: [['i', '-i']] }))).toBe(
      'Lista de 2 valores: i, menos i',
    );
  });
  it('lee los números complejos', () => {
    expect(resultSpeech(result({ value: '2 + 3i', complex: true }))).toBe(
      'número complejo: 2 más 3 i',
    );
  });
});

it('una tabla de valores se dice fila por fila y avisa cuántas quedan', () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => [String(i), String(i * i), String(i + 1)]);
  const table = result({
    kind: 'Tabla',
    headers: ['x', 'f(x)', 'g(x)'],
    matrix: [
      ['-1', '1', 'No definida'],
      ['0.5', '0.25', '2'],
    ],
  });
  expect(resultSpeech(table)).toBe(
    'Tabla de valores de 2 filas. equis igual a menos 1: f de equis, 1; g de equis, no definida. equis igual a 0 coma 5: f de equis, 0 coma 25; g de equis, 2',
  );
  const long = resultSpeech(result({ headers: ['x', 'f(x)', 'g(x)'], matrix: rows(15) }));
  expect(long).toMatch(/^Tabla de valores de 15 filas\./);
  expect(long).toMatch(
    /equis igual a 11: f de equis, 121; g de equis, 12\. Y 3 filas más en la tabla$/,
  );
});
