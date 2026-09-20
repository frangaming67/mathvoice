import { expect, it } from 'vitest';
import { exportHistory } from './ExportService';
const entries = [
  {
    id: '1',
    date: '2026-09-17T00:00:00.000Z',
    expression: '2+2',
    value: '4',
    kind: 'Básico',
    explanation: 'Suma',
    angleMode: 'rad' as const,
  },
];
it('exporta historial recuperable en JSON y texto', () => {
  expect(JSON.parse(exportHistory(entries, 'json')).calculations).toEqual(entries);
  expect(exportHistory(entries, 'txt')).toContain('2+2\n= 4');
});
it('protege celdas CSV de fórmulas al abrirlas en una planilla', () => {
  expect(exportHistory([{ ...entries[0], expression: '=HYPERLINK("test")' }], 'csv')).toContain(
    '"\'=HYPERLINK(""test"")"',
  );
});
