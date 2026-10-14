import { describe, expect, it } from 'vitest';
import {
  brent,
  derivative,
  integrate,
  limitAtZero,
  nearlyEqual,
  polynomialRoots,
  rational,
  realRoots,
} from './numerics';

describe('integrate (Gauss–Kronrod adaptativo)', () => {
  it.each([
    ['x²  en [0, 5]', (x: number) => x * x, 0, 5, 125 / 3],
    ['sen en [0, π]', Math.sin, 0, Math.PI, 2],
    ['e^(−x²) en [0, 1]', (x: number) => Math.exp(-x * x), 0, 1, 0.7468241328124271],
    ['√(4 − x²) en [0, 2]', (x: number) => Math.sqrt(4 - x * x), 0, 2, Math.PI],
    ['√(1 − x²/16) en [0, 4]', (x: number) => Math.sqrt(1 - (x * x) / 16), 0, 4, Math.PI],
    [
      '1/(2 + cos) en [0, 2π]',
      (x: number) => 1 / (2 + Math.cos(x)),
      0,
      2 * Math.PI,
      (2 * Math.PI) / Math.sqrt(3),
    ],
    [
      '1/(1 + cos²) en [0, π]',
      (x: number) => 1 / (1 + Math.cos(x) ** 2),
      0,
      Math.PI,
      Math.PI / Math.SQRT2,
    ],
    [
      '1/(x² + 2x + 5) en [0, 1]',
      (x: number) => 1 / (x * x + 2 * x + 5),
      0,
      1,
      (Math.atan(1) - Math.atan(0.5)) / 2,
    ],
    ['√x en [0, 4]', Math.sqrt, 0, 4, 16 / 3],
    ['sen(50x) en [0, π]', (x: number) => Math.sin(50 * x), 0, Math.PI, 0],
  ])('%s', (_, f, a, b, expected) => {
    const result = integrate(f, a, b);
    expect(result.converged).toBe(true);
    expect(Math.abs(result.value - expected)).toBeLessThan(1e-9 * Math.max(1, Math.abs(expected)));
  });
  it('respeta el orden de los extremos y detecta valores no finitos', () => {
    expect(integrate((x) => x, 1, 0).value).toBeCloseTo(-0.5, 14);
    expect(integrate(() => 3, 2, 2).value).toBe(0);
    expect(integrate((x) => 1 / x, -1, 1).converged).toBe(false);
  });
  it('estima la integral del valor absoluto como escala', () => {
    expect(integrate(Math.sin, 0, 2 * Math.PI).absolute).toBeCloseTo(4, 0);
  });
});

it('deriva numéricamente con error relativo menor que 10⁻⁹', () => {
  expect(derivative(Math.sin, 1)).toBeCloseTo(Math.cos(1), 10);
  expect(derivative(Math.exp, 3)).toBeCloseTo(Math.exp(3), 9);
  expect(derivative((x) => x ** 5, -2)).toBeCloseTo(80, 8);
});

it('nearlyEqual compara con tolerancia relativa y piso absoluto', () => {
  expect(nearlyEqual(1e10, 1e10 + 1)).toBe(true);
  expect(nearlyEqual(1e-14, 0)).toBe(true);
  expect(nearlyEqual(1, 1.001)).toBe(false);
  expect(nearlyEqual(NaN, NaN)).toBe(false);
});

it('brent encuentra una raíz con cambio de signo', () => {
  expect(brent((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 14);
  expect(brent((x) => x * x + 1, 0, 2)).toBeNaN();
});

describe('polynomialRoots', () => {
  const text = (roots: ReturnType<typeof polynomialRoots>) =>
    roots!.map(({ re, im, multiplicity }) => [
      Number(re.toFixed(9)),
      Number(im.toFixed(9)),
      multiplicity,
    ]);
  it('encuentra raíces reales y complejas con multiplicidad', () => {
    // x³ + x + 1
    expect(text(polynomialRoots([1, 1, 0, 1]))).toEqual([
      [-0.682327804, 0, 1],
      [0.341163902, -1.1615414, 1],
      [0.341163902, 1.1615414, 1],
    ]);
    // x³ − 2
    const cube = polynomialRoots([-2, 0, 0, 1])!;
    expect(cube).toHaveLength(3);
    expect(cube[0].re).toBeCloseTo(2 ** (1 / 3), 14);
    expect(cube[1].im).toBeCloseTo((-Math.sqrt(3) * 2 ** (1 / 3)) / 2, 13);
    expect(cube[2].im).toBe(-cube[1].im);
  });
  it('agrupa raíces múltiples', () => {
    expect(text(polynomialRoots([1, -2, 1]))).toEqual([[1, 0, 2]]);
    expect(text(polynomialRoots([-1, 3, -3, 1]))).toEqual([[1, 0, 3]]);
    // (x − 2)²(x + 1) = x³ − 3x² + 4
    expect(text(polynomialRoots([4, 0, -3, 1]))).toEqual([
      [-1, 0, 1],
      [2, 0, 2],
    ]);
    // x⁵ − x = x(x⁴ − 1)
    expect(text(polynomialRoots([0, -1, 0, 0, 0, 1]))).toEqual([
      [-1, 0, 1],
      [0, 0, 1],
      [1, 0, 1],
      [0, -1, 1],
      [0, 1, 1],
    ]);
    // (x − 1)⁵
    expect(text(polynomialRoots([-1, 5, -10, 10, -5, 1]))).toEqual([[1, 0, 5]]);
  });
  it('no confunde raíces cercanas pero distintas', () => {
    const roots = polynomialRoots([1.001, -2.001, 1])!;
    expect(roots.map((root) => root.re)).toEqual([
      expect.closeTo(1, 12),
      expect.closeTo(1.001, 12),
    ]);
  });
  it('resuelve grados altos y casos degenerados', () => {
    const roots = polynomialRoots([-1, ...Array(29).fill(0), 1])!;
    expect(roots).toHaveLength(30);
    expect(roots.filter((root) => root.im === 0).map((root) => root.re)).toEqual([-1, 1]);
    for (const { re, im } of roots) expect(Math.hypot(re, im)).toBeCloseTo(1, 12);
    expect(polynomialRoots([5])).toEqual([]);
    expect(polynomialRoots([2, 4])).toEqual([{ re: -0.5, im: 0, multiplicity: 1 }]);
    expect(polynomialRoots([1, NaN])).toBeNull();
  });
});

describe('realRoots', () => {
  it('encuentra raíces con cambio de signo y tangentes, sin polos', () => {
    const roots = realRoots((x) => Math.sin(x) - 0.5, 0, 2 * Math.PI);
    expect(roots).toEqual([expect.closeTo(Math.PI / 6, 13), expect.closeTo((5 * Math.PI) / 6, 13)]);
    expect(realRoots((x) => Math.sin(x) - 1, 0, 2 * Math.PI)).toEqual([
      expect.closeTo(Math.PI / 2, 8),
    ]);
    expect(realRoots((x) => Math.tan(x) - 1, 0, 2 * Math.PI)).toEqual([
      expect.closeTo(Math.PI / 4, 13),
      expect.closeTo((5 * Math.PI) / 4, 13),
    ]);
    expect(realRoots((x) => Math.cos(x) + 2, 0, 2 * Math.PI)).toEqual([]);
    expect(realRoots(Math.sin, 0, 2 * Math.PI)).toEqual([0, expect.closeTo(Math.PI, 13)]);
  });
});

describe('limitAtZero', () => {
  const at = (f: (x: number) => number, point: number, side: 1 | -1) => (t: number) =>
    f(point + side * t);
  const infinity = (f: (x: number) => number, sign: 1 | -1) => (t: number) => f(sign / t);
  it.each([
    ['sen(x)/x en 0', at((x) => Math.sin(x) / x, 0, 1), 1],
    ['(sen x − x)/x³ en 0', at((x) => (Math.sin(x) - x) / x ** 3, 0, 1), -1 / 6],
    ['(1 − cos x)/x² en 0', at((x) => (1 - Math.cos(x)) / x ** 2, 0, -1), 0.5],
    ['(1 + x)^(1/x) en 0', at((x) => (1 + x) ** (1 / x), 0, 1), Math.E],
    ['x·ln x en 0⁺', at((x) => x * Math.log(x), 0, 1), 0],
    ['|x|/x por izquierda', at((x) => Math.abs(x) / x, 0, -1), -1],
    ['√(x² + x) − x en ∞', infinity((x) => Math.sqrt(x * x + x) - x, 1), 0.5],
    ['√(x² + 1) − x en ∞', infinity((x) => Math.sqrt(x * x + 1) - x, 1), 0],
    ['x − √(x² − x) en ∞', infinity((x) => x - Math.sqrt(x * x - x), 1), 0.5],
    ['√(4x² + x) − 2x en ∞', infinity((x) => Math.sqrt(4 * x * x + x) - 2 * x, 1), 0.25],
    ['x(√(x² + 1) − x) en ∞', infinity((x) => x * (Math.sqrt(x * x + 1) - x), 1), 0.5],
    ['(1 + 1/x)^x en ∞', infinity((x) => (1 + 1 / x) ** x, 1), Math.E],
    ['e^x en −∞', infinity(Math.exp, -1), 0],
    ['(2x² + 1)/(x² − 3) en ∞', infinity((x) => (2 * x * x + 1) / (x * x - 3), 1), 2],
    ['sen(x)/x en ∞', infinity((x) => Math.sin(x) / x, 1), 0],
  ])('converge: %s', (_, g, expected) => {
    const estimate = limitAtZero(g);
    expect(estimate.kind).toBe('finite');
    if (estimate.kind === 'finite') {
      expect(Math.abs(estimate.value - expected)).toBeLessThan(1e-6);
      expect(estimate.error).toBeLessThan(1e-4);
    }
  });
  it.each([
    ['1/x² en 0', at((x) => 1 / x ** 2, 0, 1), 1],
    ['ln x en 0⁺', at(Math.log, 0, 1), -1],
    ['1/x por izquierda', at((x) => 1 / x, 0, -1), -1],
    ['√x en ∞', infinity(Math.sqrt, 1), 1],
    ['ln x en ∞', infinity(Math.log, 1), 1],
    ['x² en −∞', infinity((x) => x * x, -1), 1],
    ['e^(1/x) en 0⁺', at((x) => Math.exp(1 / x), 0, 1), 1],
  ])('diverge: %s', (_, g, sign) => {
    expect(limitAtZero(g)).toEqual({ kind: 'infinite', sign });
  });
  it.each([
    ['sen(1/x) en 0', at((x) => Math.sin(1 / x), 0, 1)],
    ['sen x en ∞', infinity(Math.sin, 1)],
    ['ln x en 0⁻', at(Math.log, 0, -1)],
  ])('no afirma un límite: %s', (_, g) => {
    expect(limitAtZero(g).kind).toBe('none');
  });
});

it('reconoce fracciones simples', () => {
  expect(rational(0.5)).toEqual([1, 2]);
  expect(rational(-1 / 6)).toEqual([-1, 6]);
  expect(rational(2)).toEqual([2, 1]);
  expect(rational(Math.PI)).toBeNull();
  expect(rational(1 / 120)).toEqual([1, 120]);
  expect(rational(Math.SQRT2, 1000, 1e-12)).toBeNull();
});
