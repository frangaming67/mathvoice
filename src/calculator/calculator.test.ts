import { describe, expect, it } from 'vitest';
import { allKeys, resolveFace, SEP } from './keys';
import {
  engineering,
  engineeringStart,
  factorExpression,
  fillSeparators,
  freeVariables,
  mixedFraction,
  primeFactors,
  readNumber,
  toDms,
} from './display';

const key = (id: string) => allKeys.find((candidate) => candidate.id === id)!;

describe('teclado', () => {
  it('cada tecla tiene un id único y un nombre en cada capa', () => {
    const ids = allKeys.map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const candidate of allKeys)
      for (const face of [candidate.main, candidate.shift, candidate.alpha])
        if (face) expect(face.name.length, candidate.id).toBeGreaterThan(1);
  });
  it('Shift y Alpha eligen la función de la tecla; STO toma la variable sin Alpha', () => {
    expect(resolveFace(key('sin'), 'main').name).toBe('Seno');
    expect(resolveFace(key('sin'), 'shift').name).toBe('Arco seno');
    expect(resolveFace(key('sin'), 'alpha').name).toBe('Variable D');
    // Sin función en esa capa, la tecla hace lo de siempre.
    expect(resolveFace(key('k4'), 'shift').name).toBe('Cuatro');
    expect(resolveFace(key('neg'), 'main', true).action).toEqual({ op: 'variable', name: 'A' });
    expect(resolveFace(key('mplus'), 'main', true).action).toEqual({ op: 'variable', name: 'M' });
  });
  it('las plantillas con varios argumentos usan el separador elegido', () => {
    const power = resolveFace(key('power'), 'shift').action;
    expect(power).toEqual({ op: 'wrap', before: 'nthRoot(', after: `${SEP})` });
    expect(fillSeparators(`nthRoot(${SEP})`, 'punto')).toBe('nthRoot(, )');
    expect(fillSeparators(`nthRoot(${SEP})`, 'coma')).toBe('nthRoot(; )');
  });
});

describe('formas del resultado', () => {
  it('lee números con punto o coma y descarta lo que no es un número suelto', () => {
    expect(readNumber('2.5')).toBe(2.5);
    expect(readNumber('2,5', 'coma')).toBe(2.5);
    expect(readNumber('-1.5e-7')).toBe(-1.5e-7);
    expect(readNumber('1/2')).toBeNull();
    expect(readNumber('2 + 3i')).toBeNull();
  });
  it('notación de ingeniería con exponente múltiplo de tres', () => {
    expect(engineeringStart(12345)).toBe(3);
    expect(engineeringStart(0.00045)).toBe(-6);
    expect(engineering(12345, 3, 'punto')).toMatchObject({ mantissa: '12.345', exponent: 3 });
    expect(engineering(12345, 0, 'coma').expression).toBe('12345*10^0');
    expect(engineering(0.00045, -6, 'coma').mantissa).toBe('450');
  });
  it('grados, minutos y segundos', () => {
    expect(toDms(12.5125).text).toBe('12°30′45″');
    expect(toDms(-0.5).text).toBe('-0°30′0″');
    expect(toDms(1.2345, 'coma').text).toBe('1°14′4,2″');
  });
  it('factores primos', () => {
    expect(primeFactors(360)).toEqual([
      [2, 3],
      [3, 2],
      [5, 1],
    ]);
    expect(factorExpression(360)).toBe('2^3*3^2*5');
    expect(factorExpression(-14)).toBe('-2*7');
    expect(factorExpression(97)).toBe('97');
    expect(factorExpression(1)).toBeNull();
    expect(factorExpression(2.5)).toBeNull();
  });
  it('fracción mixta', () => {
    expect(mixedFraction('7/3')).toMatchObject({ whole: 2, numerator: 1, denominator: 3 });
    expect(mixedFraction('-9/4')).toMatchObject({ negative: true, whole: 2, numerator: 1 });
    expect(mixedFraction('1/2')).toBeNull();
    expect(mixedFraction('2.5')).toBeNull();
  });
});

it('CALC pregunta por las variables, no por funciones ni constantes', () => {
  expect(freeVariables('3x+y-sin(x)*pi+A')).toEqual(['x', 'y', 'A']);
  expect(freeVariables('2+2')).toEqual([]);
  expect(freeVariables('c_luz*t')).toEqual(['t']);
});
