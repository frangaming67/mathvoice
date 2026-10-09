import { describe, expect, it } from 'vitest';
import { cleanNumber, formatNumber, speakDigits, speakNumber, speakRadix } from './numberSpeech';

describe('formatNumber', () => {
  it('limpia ruido de coma flotante y redondea', () => {
    expect(formatNumber(Math.sin(Math.PI))).toBe('0');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(Math.PI, { significant: 6 })).toBe('3.14159');
    expect(formatNumber(2.5, { decimal: 'coma' })).toBe('2,5');
  });
  it('usa notación científica solo en magnitudes extremas', () => {
    expect(formatNumber(1234567)).toBe('1234567');
    expect(formatNumber(1.5e-9)).toBe('1.5e-9');
    expect(formatNumber(6.02214076e23, { significant: 6 })).toBe('6.02214e23');
    expect(formatNumber(-Infinity)).toBe('-∞');
  });
  it('respeta la escala al limpiar ruido', () => {
    expect(cleanNumber(1e-13, 1)).toBe(0);
    expect(cleanNumber(1e-13, 1e-14)).toBe(0);
    expect(cleanNumber(1e-9)).toBe(1e-9);
  });
});

describe('speakNumber', () => {
  it('lee los decimales cifra por cifra para no formar enteros gigantes', () => {
    expect(speakNumber('3.1415926535898')).toBe('aproximadamente 3 coma 1 4 1 5 9');
    expect(speakNumber('3.1415926535898', { significant: Infinity })).toBe(
      '3 coma 1 4 1 5 9 2 6 5 3 5 8 9 8',
    );
    expect(speakNumber('0.05')).toBe('0 coma 0 5');
  });
  it('dice decimales cortos de forma natural', () => {
    expect(speakNumber('3.14')).toBe('3 coma 14');
    expect(speakNumber('2,5')).toBe('2 coma 5');
    expect(speakNumber(-0.75)).toBe('menos 0 coma 75');
  });
  it('conserva los dígitos de enteros grandes escritos como texto', () => {
    expect(speakNumber('123456789012345678')).toBe('123456789012345678');
  });
  it('lee notación científica, infinito y NaN en español', () => {
    expect(speakNumber('1.2e-5')).toBe('1 coma 2 por diez a la menos 5');
    expect(speakNumber('Infinity')).toBe('infinito');
    expect(speakNumber('-Infinity')).toBe('menos infinito');
    expect(speakNumber('NaN')).toBe('no es un número');
  });
  it('no inventa texto ante algo que no es un número', () => {
    expect(speakNumber('abc')).toBe('abc');
  });
});

describe('speakRadix y speakDigits', () => {
  it('agrupa de a cuatro y nombra la base', () => {
    expect(speakRadix('11111111', 2)).toBe('1 1 1 1, 1 1 1 1; base dos');
    expect(speakRadix('7F', 16)).toBe('7 efe; base dieciséis');
    expect(speakRadix('1E3', 16)).toBe('1 e 3; base dieciséis');
  });
  it('separa cifras', () => {
    expect(speakDigits('2024')).toBe('2 0 2 4');
  });
});
