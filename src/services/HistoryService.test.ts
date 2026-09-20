import { expect, it } from 'vitest';
import { validHistory } from './HistoryService';
const entry = {
  id: '1',
  date: '2026-09-17',
  expression: '2+2',
  value: '4',
  kind: 'Básico',
  explanation: 'Suma',
  angleMode: 'rad',
};
it('acepta historial anterior y resultados estructurados nuevos', () => {
  expect(validHistory([entry])).toBe(true);
  expect(
    validHistory([{ ...entry, table: [{ label: 'Media', value: '4' }], variables: { a: 2 } }]),
  ).toBe(true);
});
it.each([{ matrix: [null] }, { table: [4] }, { variables: { a: 'dos' } }, { assigned: null }])(
  'rechaza datos persistentes corruptos %j',
  (extra) => {
    expect(validHistory([{ ...entry, ...extra }])).toBe(false);
  },
);
it('conserva procedimientos válidos y descarta pasos corruptos', () => {
  expect(
    validHistory([
      { ...entry, steps: [{ title: 'Sumar', detail: 'Dos más dos', formula: '2+2=4' }] },
    ]),
  ).toBe(true);
  for (const steps of [
    [null],
    [{ title: 'Título', detail: 4 }],
    [{ title: 'Título', detail: 'Texto', formula: {} }],
    Array(101).fill({ title: 'Paso', detail: 'Texto' }),
  ]) {
    expect(validHistory([{ ...entry, steps }])).toBe(false);
  }
});
