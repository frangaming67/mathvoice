import { describe, expect, it } from 'vitest';
import { MathEngine } from './MathEngine';
const engine = new MathEngine();
describe('Motor de fase 1', () => {
  it.each([
    ['2+2', '4'],
    ['sqrt(144)', '12'],
    ['sin(pi/2)', '1'],
    ['2^10', '1024'],
    ['factorial(5)', '120'],
    ['1/3 + 1/6', '1/2'],
    ['0.1 + 0.2', '3/10'],
    ['raiz(25)', '5'],
    ['log(100)', '2'],
    ['ln(e)', '1'],
    ['log(8,2)', '3'],
    ['gcd(12,18)', '6'],
    ['lcm(3,4)', '12'],
    ['25%', '0.25'],
    ['2*(3+4)', '14'],
    ['-(-2)', '2'],
  ])('%s → %s', (expression, value) => {
    expect(engine.evaluate(expression).value).toBe(value);
  });
  it('aplica grados y gradianes también a funciones inversas', () => {
    expect(Number(engine.evaluate('sen(30)', 'deg').value)).toBeCloseTo(0.5);
    expect(Number(engine.evaluate('asin(0.5)', 'deg').value)).toBeCloseTo(30);
    expect(Number(engine.evaluate('sin(100)', 'grad').value)).toBeCloseTo(1);
    expect(Number(engine.evaluate('acos(0)', 'grad').value)).toBeCloseTo(100);
  });
  it('no convierte funciones hiperbólicas', () => {
    expect(engine.evaluate('sinh(1)', 'deg').value).toBe(engine.evaluate('sinh(1)', 'rad').value);
  });
  it.each([
    '',
    'sqrt(',
    '1/0',
    'sqrt(-1)',
    'log(-2)',
    'asin(2)',
    'a=3',
    '[1,2]',
    'import("x")',
    'evaluate("2+2")',
    '2;3',
    'det([[1,2],[3,4]])',
    'diff(x^2,x)',
    'factorial(10000)',
  ])('rechaza con error legible: %s', (expression) => {
    expect(() => engine.evaluate(expression)).toThrow();
  });
  it('rechaza entradas extensas', () =>
    expect(() => engine.evaluate('1'.repeat(501))).toThrow('larga'));
});
