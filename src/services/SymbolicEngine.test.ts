import { expect, it } from 'vitest';
import { MathEngine } from './MathEngine';
import { evaluate } from 'mathjs';
const engine = new MathEngine();
it.each([
  ['diff(x^2,x)', '2*x'],
  ['derivada(x^2)', '2*x'],
  ['diff(x^5,x,2)', '20*x^3'],
  ['diff(x^2*y,x)', '2*x*y'],
  ['integrate(2*x,x)', 'x^2 + C'],
  ['integral(x^2)', '(1/3)*x^3 + C'],
  ['integrate(x^2,x,0,5)', '125/3'],
  ['limit(sin(x)/x,x,0)', '1'],
  ['limite(sen(x)/x,x,0)', '1'],
  ['simplify((x^2-1)/(x-1))', '1+x'],
])('%s → %s', (expression, expected) => expect(engine.evaluate(expression).value).toBe(expected));
it('resuelve y verifica cada raíz en la ecuación original', () => {
  const result = engine.evaluate('solve(x^2-5*x+6=0,x)').value;
  const roots = result.split('; ').map((s) => Number(s.split(' = ')[1]));
  expect(roots.sort()).toEqual([2, 3]);
  roots.forEach((x) => expect(evaluate('x^2-5*x+6', { x })).toBe(0));
});
it('factoriza y expande sin cambiar los valores', () => {
  for (const expression of ['factor(x^2-9)', 'expand((x+2)^3)']) {
    const result = engine.evaluate(expression).value;
    const original = expression === 'factor(x^2-9)' ? 'x^2-9' : '(x+2)^3';
    for (const x of [-3, -1, 0, 2, 4])
      expect(evaluate(result, { x })).toBeCloseTo(evaluate(original, { x }), 12);
  }
});
it('usa radianes y lo aclara aunque el modo numérico sea grados', () => {
  const result = engine.evaluate('diff(sin(x),x)', 'deg');
  expect(result.value).toBe('cos(x)');
  expect(result.angleMode).toBe('rad');
  expect(result.explanation).toContain('independientemente');
});
it.each([
  'diff(x^2,x,0)',
  'diff(x^2,x,99)',
  'integrate(x^2,x,0)',
  'solve(x=1=2,x)',
  'limit(sin(x)/x,x)',
  'diff(import(2),x)',
  'diff(log(),x)',
  'diff(x[1],x)',
  'diff(x^2,radio)',
  'integrate(1/x,x,-1,1)',
])('rechaza entradas inválidas o no admitidas: %s', (expression) =>
  expect(() => engine.evaluate(expression)).toThrow(),
);
it('mantiene las convenciones de logaritmos', () => {
  expect(engine.evaluate('simplify(log(100))').value).toBe('2');
  expect(engine.evaluate('simplify(ln(e))').value).toBe('1');
});
it('no confunde un polo con un límite bilateral confirmado', () => {
  expect(() => engine.evaluate('limit(1/x,x,0)')).toThrow('bilateral');
  expect(engine.evaluate('limit(1/x^2,x,0)').value).toBe('Infinity');
});
it('resuelve sistemas lineales y rechaza sistemas no únicos y no lineales', () => {
  expect(engine.evaluate('system(x+y=10,x-y=4)').value).toBe('x = 7; y = 3');
  expect(() => engine.evaluate('system(x+y=10,2*x+2*y=20)')).toThrow();
  expect(() => engine.evaluate('system(x*y=10,x-y=4)')).toThrow('lineales');
});
it('sustituye variables respetando las operaciones', () => {
  expect(engine.evaluate('substitute(x^2+3*x,x,2)').value).toBe('10');
});
it.each([
  ['integrate(sin(x),x,0,pi)', 2],
  ['integrate(exp(x),x,0,1)', Math.E - 1],
  ['integrate(1/(x^2+1),x,0,1)', Math.PI / 4],
  ['integrate(sqrt(x),x,0,4)', 16 / 3],
  ['integrate(sin(x),x,pi,0)', -2],
  ['integrate(ln(x),x,1,2)', 2 * Math.log(2) - 1],
])('integra en dominio continuo: %s', (expression, expected) => {
  const result = engine.evaluate(expression);
  expect(Number(result.decimal ?? evaluate(result.value, { ln: Math.log }))).toBeCloseTo(
    expected,
    10,
  );
});
it.each([
  'integrate(1/x^2,x,-1,1)',
  'integrate(ln(x),x,-1,2)',
  'integrate(sqrt(x),x,-1,1)',
  'integrate(tan(x),x,0,pi)',
  'integrate((x-1)/(x-1),x,0,2)',
  'series(abs(x),x,0,3)',
  'series(1/x,x,0,3)',
])('no cancela restricciones del dominio: %s', (expression) =>
  expect(() => engine.evaluate(expression)).toThrow(),
);
it('Taylor concuerda con derivadas conocidas y aclara que es aproximación', () => {
  const sine = engine.evaluate('series(sin(x),x,0,5)');
  for (const x of [-0.2, 0, 0.2])
    expect(evaluate(sine.value, { x })).toBeCloseTo(x - x ** 3 / 6 + x ** 5 / 120, 12);
  expect(sine.explanation).toContain('aproximación local');
  expect(evaluate(engine.evaluate('series(exp(x),x,1,2)').value, { x: 1 })).toBeCloseTo(Math.E);
});
it.each([
  ['inequality(x^2-4<=0,x)', ['Desde -2 incluido hasta 2 incluido']],
  [
    'inequality(x^2>0,x)',
    [
      'Desde menos infinito excluido hasta 0 excluido',
      'Desde 0 excluido hasta más infinito excluido',
    ],
  ],
  ['inequality(x^2<=0,x)', ['x igual a 0']],
  ['inequality(x^2>=0,x)', ['Todos los números reales']],
  ['inequality(x^2+1<0,x)', ['Sin soluciones reales']],
  ['inequality(2*x+4>0,x)', ['Desde -2 excluido hasta más infinito excluido']],
  ['inequality(1<=2,x)', ['Todos los números reales']],
])('resuelve conjuntos e inclusiones: %s', (expression, expected) => {
  expect(engine.evaluate(expression).table?.map((row) => row.value)).toEqual(expected);
});
it.each(['inequality(1/x>0,x)', 'inequality(x^3>0,x)', 'inequality(x+y>0,x)'])(
  'explica el alcance de desigualdades: %s',
  (e) => expect(() => engine.evaluate(e)).toThrow(),
);
it('descarta raíces espurias que anulan el denominador original', () => {
  expect(() => engine.evaluate('solve((x^2-1)/(x-1)=2,x)')).toThrow('verificar');
  expect(engine.evaluate('solve((x^2-1)/(x-1)=3,x)').value).toBe('x = 2');
  expect(engine.evaluate('solve(x^2+1=0,x)').value).toContain('i');
});
it('respeta la base del logaritmo al derivar e integrar', () => {
  const derivative = engine.evaluate('diff(log(x,2),x)');
  expect(evaluate(derivative.value, { x: 3, ln: Math.log })).toBeCloseTo(1 / (3 * Math.log(2)));
  const integral = engine.evaluate('integrate(log(x,2),x,1,2)');
  expect(evaluate(integral.value, { ln: Math.log })).toBeCloseTo(2 - 1 / Math.log(2));
});
it.each([
  'limit(exp(-1/x),x,0)',
  'limit(x/abs(x),x,0)',
  'inequality(x^2-2e16*x+1<0,x)',
  'inequality(x^2-2*x+0.9999999999999<0,x)',
])('rechaza resultados no confirmables: %s', (e) => expect(() => engine.evaluate(e)).toThrow());
