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
it('incluye los pasos y las fórmulas en los tres formatos', () => {
  const steps = [{ title: 'Calcular', detail: 'Sumar ambos números.', formula: '2+2=4' }];
  const history = [{ ...entries[0], steps }];
  for (const format of ['txt', 'csv'] as const) {
    expect(exportHistory(history, format)).toContain('Paso 1. Calcular. Sumar ambos números.');
    expect(exportHistory(history, format)).toContain('2+2=4');
  }
  expect(JSON.parse(exportHistory(history, 'json')).calculations[0].steps).toEqual(steps);
});
it('el informe HTML muestra las fórmulas en MathML con su lectura y escapa el texto', () => {
  const html = exportHistory(
    [
      { ...entries[0], expression: '1/3+1/6', value: '1/2' },
      { ...entries[0], id: '2', expression: '<script>', value: '0', warnings: ['Ojo & cuidado'] },
    ],
    'html',
  );
  expect(html).toMatch(/^<!doctype html>/);
  expect(html).toContain('<html lang="es">');
  expect(html).toContain('2 cálculos');
  expect(html).toContain('<mfrac>');
  expect(html).toContain('alttext="un tercio más un sexto"');
  expect(html).toContain('<code>&lt;script&gt;</code>');
  expect(html).not.toContain('<script>');
  expect(html).toContain('Aviso: Ojo &amp; cuidado');
});
