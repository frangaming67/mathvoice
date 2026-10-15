import { describe, expect, it } from 'vitest';
import { describeReading, listExpression, parseList, parseNumber } from './dataParsing';

const values = (input: string) => {
  const parsed = parseList(input);
  if (parsed.status !== 'ok') throw new Error(`no ok: ${parsed.status}`);
  return parsed.reading.items.map((item) => item.value);
};

describe('parseList', () => {
  it('con punto y coma o un dato por línea, la coma es decimal', () => {
    expect(values('1,5;2,5;3,5')).toEqual([1.5, 2.5, 3.5]);
    expect(values('1,5\n2,5\n3,5')).toEqual([1.5, 2.5, 3.5]);
    expect(values('1,5\t2,5\t3,5')).toEqual([1.5, 2.5, 3.5]);
  });
  it('con comas sin espacios, separan datos con punto decimal', () => {
    expect(values('1,2,3,4,5')).toEqual([1, 2, 3, 4, 5]);
    expect(values('1.5, 2.5, 3.5')).toEqual([1.5, 2.5, 3.5]);
  });
  it('con espacios, la coma es decimal', () => {
    expect(values('1,5 2,5 3,5')).toEqual([1.5, 2.5, 3.5]);
  });
  it('pregunta en vez de adivinar cuando la coma es ambigua', () => {
    const parsed = parseList('1,5, 2,5');
    expect(parsed.status).toBe('ambiguous');
    if (parsed.status === 'ambiguous') expect(parsed.options).toHaveLength(2);
  });
  it('omite el encabezado de una columna pegada', () => {
    const parsed = parseList('Altura\n1,70\n1,65\n1,82');
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.reading.skippedHeader).toBe('Altura');
      expect(listExpression(parsed.reading)).toBe('[1.70,1.65,1.82]');
    }
  });
  it('señala el dato inválido y su posición', () => {
    const parsed = parseList('1; 2; tres; 4');
    expect(parsed.status).toBe('error');
    if (parsed.status === 'error') expect(parsed.message).toContain('dato 3');
  });
  it('confirma lo leído para mostrar y para escuchar', () => {
    const parsed = parseList('1,5;2,5;3,5');
    if (parsed.status !== 'ok') throw new Error('no ok');
    const described = describeReading(parsed.reading);
    expect(described.text).toBe('Se leyeron 3 datos: 1,5; 2,5; 3,5.');
    expect(described.speech).toBe('Se leyeron 3 datos: 1 coma 5; 2 coma 5; 3 coma 5.');
  });
});

describe('parseNumber', () => {
  it('acepta coma o punto decimal, miles y fracciones simples', () => {
    expect(parseNumber('2,5')).toMatchObject({ ok: true, value: 2.5 });
    expect(parseNumber('1.234,5')).toMatchObject({ ok: true, value: 1234.5 });
    expect(parseNumber('1/4')).toMatchObject({ ok: true, value: 0.25 });
    expect(parseNumber('abc')).toMatchObject({ ok: false });
  });
});
