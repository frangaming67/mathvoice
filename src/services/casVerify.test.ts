import { describe, expect, it } from 'vitest';
import {
  absoluteLogs,
  compileReal,
  freeVariables,
  samplePoints,
  toReal,
  verifyAntiderivative,
  verifyDerivative,
  verifyEquivalent,
} from './casVerify';
import { math } from './mathRuntime';

const user = (expression: string) => compileReal(expression, 'user')!;
const cas = (expression: string) => compileReal(expression, 'cas')!;

describe('compileReal', () => {
  it('respeta el logaritmo de cada dialecto', () => {
    expect(user('log(100)')({})).toBeCloseTo(2, 14);
    expect(user('log(8,2)')({})).toBeCloseTo(3, 14);
    expect(user('ln(e)')({})).toBeCloseTo(1, 14);
    expect(cas('log(e)')({})).toBeCloseTo(1, 14);
    expect(cas('ln(e^2)')({})).toBeCloseTo(2, 14);
  });
  it('devuelve NaN fuera del dominio real y null si no se puede leer', () => {
    expect(user('sqrt(x)')({ x: -1 })).toBeNaN();
    expect(user('1/x')({ x: 0 })).toBeNaN();
    expect(compileReal('x +* 2', 'user')).toBeNull();
    // Una función desconocida no permite afirmar ni negar nada.
    expect(compileReal('Foo(x) + 1', 'cas')).toBeNull();
    expect(compileReal('Si(x)', 'user')).toBeNull();
  });
  it('evalúa las integrales especiales que devuelve nerdamer', () => {
    expect(cas('Si(x)')({ x: 1 })).toBeCloseTo(0.946083070367183, 12);
    expect(cas('Ci(x)')({ x: 1 })).toBeCloseTo(0.3374039229009681, 12);
    expect(cas('Ei(x)')({ x: 1 })).toBeCloseTo(1.8951178163559368, 12);
    expect(cas('Ei(x)')({ x: -1 })).toBeCloseTo(-0.21938393439552029, 12);
    expect(cas('Shi(x)')({ x: 1 })).toBeCloseTo(1.0572508753757286, 12);
    expect(cas('Chi(x)')({ x: 1 })).toBeCloseTo(0.8378669409802082, 12);
    expect(cas('Ci(x)')({ x: 0 })).toBeNaN();
  });
  it('acepta complejos con parte imaginaria despreciable', () => {
    expect(toReal(math.complex(2, 1e-14))).toBe(2);
    expect(toReal(math.complex(2, 1))).toBeNaN();
    expect(toReal(math.fraction(1, 4))).toBe(0.25);
    expect(toReal('texto')).toBeNaN();
  });
});

it('enumera las variables libres sin constantes ni funciones', () => {
  expect(freeVariables('x*y + sin(z) + pi + e')).toEqual(['x', 'y', 'z']);
  expect(freeVariables('2 + 3')).toEqual([]);
  expect(freeVariables('x +* 2')).toEqual([]);
});

it('genera puntos distintos para cada variable', () => {
  const points = samplePoints(['x', 'y']);
  expect(points.length).toBeGreaterThan(20);
  expect(points.every(({ x, y }) => x !== y)).toBe(true);
});

describe('verifyEquivalent', () => {
  it('acepta transformaciones correctas', () => {
    expect(verifyEquivalent(user('x^2-9'), cas('(-3+x)*(3+x)'), ['x'])).toBe('ok');
    expect(verifyEquivalent(user('(x^2-1)/(x-1)'), cas('1+x'), ['x'])).toBe('ok');
    expect(verifyEquivalent(user('x*y+x*y'), cas('2*x*y'), ['x', 'y'])).toBe('ok');
    expect(verifyEquivalent(user('sin(x)^2+cos(x)^2'), cas('1'), ['x'])).toBe('ok');
  });
  it('rechaza la factorización incorrecta de nerdamer para x^12 - 1', () => {
    const wrong = '(-1+x)^6*(-1-x^3-x^4+x+x^2+x^5)*(-x+x^2+1)^2*(1+x)^3*(1+x+x^2)^2*(1+x^2)';
    expect(verifyEquivalent(user('x^12-1'), cas(wrong), ['x'])).toBe('mismatch');
  });
  it('detecta el factor perdido de la multiplicación implícita', () => {
    expect(verifyEquivalent(user('(x-2)*(x+3)'), cas('-2+x'), ['x'])).toBe('mismatch');
  });
  it('no afirma nada con muy pocos puntos del dominio', () => {
    expect(verifyEquivalent(user('sqrt(x-100)'), cas('sqrt(x-100)'), ['x'])).toBe('unverifiable');
  });
  it('rechaza una salida indefinida donde la entrada es real', () => {
    expect(verifyEquivalent(user('ln(x^2)'), cas('2*log(x)'), ['x'])).toBe('mismatch');
  });
});

describe('verifyDerivative', () => {
  it('acepta derivadas correctas aun cerca de singularidades', () => {
    expect(verifyDerivative(user('1/x'), cas('-x^(-2)'), 'x', ['x'])).toBe('ok');
    expect(verifyDerivative(user('tan(x)'), cas('sec(x)^2'), 'x', ['x'])).toBe('ok');
    expect(verifyDerivative(user('x^2*y'), cas('2*x*y'), 'x', ['x', 'y'])).toBe('ok');
    expect(verifyDerivative(user('log(x,2)'), cas('1/(x*log(2))'), 'x', ['x'])).toBe('ok');
  });
  it('rechaza derivadas incorrectas', () => {
    expect(verifyDerivative(user('(x+1)*(x-1)'), cas('1'), 'x', ['x'])).toBe('mismatch');
  });
});

describe('verifyAntiderivative', () => {
  it('acepta primitivas correctas', () => {
    expect(verifyAntiderivative(cas('(1/3)*x^3'), user('x^2'), 'x', ['x'])).toBe('ok');
    expect(verifyAntiderivative(cas('(1/2)*erf(x)*sqrt(pi)'), user('e^(-x^2)'), 'x', ['x'])).toBe(
      'ok',
    );
    expect(verifyAntiderivative(cas('-e^x+e^x*x'), user('x*e^x'), 'x', ['x'])).toBe('ok');
  });
  it('rechaza primitivas falsas de nerdamer', () => {
    expect(verifyAntiderivative(cas('log(2+cos(x))'), user('1/(2+cos(x))'), 'x', ['x'])).toBe(
      'mismatch',
    );
    expect(verifyAntiderivative(cas('(1/2)*x^2+x'), user('(x+1)*(x-1)'), 'x', ['x'])).toBe(
      'mismatch',
    );
    const asin = '(-x^2+4)^(1/2)*x-8*cos(asin((1/2)*x))*sin(asin((1/2)*x))+8*asin((1/2)*x)';
    expect(verifyAntiderivative(cas(asin), user('sqrt(4-x^2)'), 'x', ['x'])).toBe('mismatch');
  });
  it('exige valor absoluto en los logaritmos cuando el integrando es real', () => {
    expect(verifyAntiderivative(cas('log(sec(x))'), user('tan(x)'), 'x', ['x'])).toBe('mismatch');
    expect(verifyAntiderivative(cas(absoluteLogs('log(sec(x))')), user('tan(x)'), 'x', ['x'])).toBe(
      'ok',
    );
    expect(
      verifyAntiderivative(cas(absoluteLogs('log(log(x))')), user('1/(x*ln(x))'), 'x', ['x']),
    ).toBe('ok');
  });
});

it('agrega valor absoluto solo a los logaritmos naturales de un argumento', () => {
  expect(absoluteLogs('log(sec(x))')).toBe('log(abs(sec(x)))');
  expect(absoluteLogs('2*log(log(x))+1')).toBe('2*log(abs(log(abs(x))))+1');
  expect(absoluteLogs('log(abs(x))')).toBe('log(abs(x))');
  expect(absoluteLogs('log(x,2)+catalog(x)')).toBe('log(x,2)+catalog(x)');
  expect(absoluteLogs('log(abs(x)+1)')).toBe('log(abs(abs(x)+1))');
});
