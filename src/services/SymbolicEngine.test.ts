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
it.each([
  ['limit(1/x,x,0,left)', '-Infinity'],
  ['limit(1/x,x,0,right)', 'Infinity'],
  ['limit(abs(x)/x,x,0,left)', '-1'],
  ['limit(abs(x)/x,x,0,right)', '1'],
  ['limit(1/(x-2),x,2,left)', '-Infinity'],
  ['limit(sqrt(x),x,0,right)', '0'],
  ['limit(ln(x),x,0,right)', '-Infinity'],
])('límite lateral %s → %s', (expression, expected) => {
  const result = engine.evaluate(expression);
  expect(result.value).toBe(expected);
  expect(result.explanation).toContain(expression.includes('left') ? 'izquierda' : 'derecha');
});
it.each([
  'limit(sqrt(x),x,0,left)',
  'limit(ln(x),x,0,left)',
  'limit(sin(1/x),x,0,right)',
  'limit(x,x,Infinity,left)',
  'limit(x,x,0,invalid)',
])('no afirma un límite lateral inválido: %s', (expression) => {
  expect(() => engine.evaluate(expression)).toThrow();
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

it('expone coeficientes, discriminante y comprobaciones de una cuadrática', () => {
  const result = engine.evaluate('solve(2*x^2-10*x+12=0,x)');
  expect(result.steps?.find((step) => step.title === 'Identificar los coeficientes')?.formula).toBe(
    'a = 2; b = -10; c = 12',
  );
  expect(
    result.steps?.find((step) => step.title === 'Calcular el discriminante')?.formula,
  ).toContain('= 4');
  const checks = result.steps?.filter((step) => step.title.startsWith('Verificar'));
  expect(checks).toHaveLength(2);
  expect(checks?.every((step) => step.formula === '0 = 0')).toBe(true);
});
it('el procedimiento de una integral respeta los extremos invertidos y la primitiva', () => {
  const result = engine.evaluate('integrate(x^2,x,3,1)');
  expect(result.steps?.find((step) => step.title === 'Evaluar el extremo superior')?.formula).toBe(
    'F(1) = 1/3',
  );
  expect(result.steps?.find((step) => step.title === 'Evaluar el extremo inferior')?.formula).toBe(
    'F(3) = 9',
  );
  expect(result.steps?.at(-1)?.formula).toBe('F(1) - F(3) = -26/3');
});
it('las derivadas sucesivas y los términos de Taylor corresponden al cálculo', () => {
  const derivative = engine.evaluate('diff(x^4,x,3)');
  expect(derivative.steps?.map((step) => step.formula?.replace(/\s/g, ''))).toEqual([
    'x^4',
    'diff(x^4,x)=4*x^3',
    'diff(4*x^3,x)=12*x^2',
    'diff(12*x^2,x)=24*x',
  ]);
  const series = engine.evaluate('series(exp(x),x,1,3)');
  const terms = series.steps!.slice(0, -1);
  for (const x of [0.9, 1, 1.1]) {
    const sum = terms.reduce((total, step) => total + Number(evaluate(step.formula!, { x })), 0);
    expect(sum).toBeCloseTo(evaluate(series.value, { x }), 10);
  }
});
it('registra el análisis de signos y la inclusión de extremos', () => {
  const result = engine.evaluate('inequality(x^2-4<=0,x)');
  expect(result.steps?.filter((step) => step.title.startsWith('Comprobar'))).toHaveLength(3);
  expect(result.steps?.at(-1)?.detail).toContain('Desde -2 incluido hasta 2 incluido');
});

// Regresiones de la revisión de octubre: resultados falsos del CAS que no deben volver.
const near = (expression: string, x: number) => Number(evaluate(expression, { x, e: Math.E }));
it('conserva la multiplicación implícita entre paréntesis en todo el CAS', () => {
  const expanded = engine.evaluate('expand((x-2)(x+3))').value;
  for (const x of [-2, 0.5, 3]) expect(near(expanded, x)).toBeCloseTo((x - 2) * (x + 3), 10);
  expect(engine.evaluate('solve((x-1)(x+2)=0,x)').value).toBe('x = -2; x = 1');
  expect(engine.evaluate('integrate((x+1)(x-1),x,0,1)').value).toBe('-2/3');
  const derivative = engine.evaluate('diff((x+1)(x-1),x)').value;
  for (const x of [-1, 2]) expect(near(derivative, x)).toBeCloseTo(2 * x, 10);
});
it.each([
  ['integrate(sqrt(4-x^2),x,0,2)', Math.PI],
  ['integrate(sqrt(1-x^2/16),x,0,4)', Math.PI],
  ['integrate(1/(2+cos(x)),x,0,2*pi)', (2 * Math.PI) / Math.sqrt(3)],
  ['integrate(1/(1+cos(x)^2),x,0,pi)', Math.PI / Math.SQRT2],
  ['integrate(1/(x^2+2x+5),x,0,1)', (Math.atan(1) - Math.atan(0.5)) / 2],
  ['integrate(e^(-x^2),x,0,1)', 0.746824132812427],
  ['integrate(e^x,x,0,1)', Math.E - 1],
  ['integrate(2^x,x,0,1)', 1 / Math.LN2],
])('la integral definida %s coincide con la cuadratura numérica', (expression, expected) => {
  const result = engine.evaluate(expression);
  expect(Number(result.decimal ?? result.value)).toBeCloseTo(expected, 8);
});
it('avisa cuando reemplaza una primitiva inválida por el valor numérico', () => {
  const result = engine.evaluate('integrate(sqrt(4-x^2),x,0,2)');
  expect(result.approximate).toBe(true);
  expect(result.warnings?.join(' ')).toContain('valor numérico');
});
it('no muestra factorizaciones que el motor no pudo verificar', () => {
  for (const expression of ['factor(x^12-1)', 'factor(x^8-16)']) {
    let value: string | undefined;
    try {
      value = engine.evaluate(expression).value;
    } catch (error) {
      expect((error as Error).message).toContain('No pude verificar');
      continue;
    }
    const original = expression.slice(7, -1);
    for (const x of [0.37, 1.3, -0.8]) expect(near(value, x)).toBeCloseTo(near(original, x), 9);
  }
});
it.each([
  ['limit(sqrt(x^2+x)-x,x,Infinity)', '0.5'],
  ['limit(x-sqrt(x^2-x),x,Infinity)', '0.5'],
  ['limit(sqrt(x^2+1)-x,x,Infinity)', '0'],
  ['limit(e^x,x,-Infinity)', '0'],
  ['limit(sin(x)/x,x,0)', '1'],
])('el límite %s vale %s', (expression, expected) =>
  expect(engine.evaluate(expression).value).toBe(expected),
);
it('explica rápido los límites que no existen en lugar de colgarse', () => {
  const start = performance.now();
  expect(() => engine.evaluate('limit(abs(x)/x,x,0)')).toThrow(/no existe.*-1.*1/);
  expect(() => engine.evaluate('limit(1/x,x,0)')).toThrow(/no existe/);
  expect(performance.now() - start).toBeLessThan(2000);
});
it('encuentra todas las raíces de un polinomio, ordenadas y sin mezclar formatos', () => {
  const cubic = engine.evaluate('solve(x^3+x+1=0,x)').value;
  expect(cubic.split('; ')).toHaveLength(3);
  expect(cubic).toContain('x = -0.6823278038');
  const roots = engine.evaluate('solve(x^3-2=0,x)').value.split('; ');
  expect(roots).toHaveLength(3);
  expect(roots.filter((root) => root.includes('i')).every((root) => !root.includes('^'))).toBe(
    true,
  );
});
it('da las soluciones principales de ecuaciones trigonométricas según el modo angular', () => {
  const degrees = engine.evaluate('solve(sin(x)=0.5,x)', 'deg');
  expect(degrees.value).toBe('x = 30; x = 150');
  expect(degrees.warnings?.join(' ')).toContain('360');
  expect(engine.evaluate('solve(ln(x)=2,x)').value.split('; ')).toHaveLength(1);
});
it.each([
  ['series(sin(x),x,0,5)', 'x - x^3/6 + x^5/120'],
  ['series(tan(x),x,0,5)', 'x + x^3/3 + 2*x^5/15'],
  ['series(e^x,x,0,4)', '1 + x + x^2/2 + x^3/6 + x^4/24'],
  ['series(1/(1-x),x,0,4)', '1 + x + x^2 + x^3 + x^4'],
])('Taylor de %s queda simplificado: %s', (expression, expected) =>
  expect(engine.evaluate(expression).value).toBe(expected),
);
it('traduce los errores internos del motor simbólico', () => {
  expect(() => engine.evaluate('diff(1/0,x)')).toThrow(/divide por cero/);
  expect(() => engine.evaluate('diff(1/0,x)')).not.toThrow(/not allowed|Division/);
});
it('simplifica cocientes de grado alto sin agotar el tiempo del Worker', () => {
  const start = performance.now();
  const result = engine.evaluate('simplify((x^30-1)/(x-1))').value;
  expect(performance.now() - start).toBeLessThan(1500);
  expect(near(result, 1.1)).toBeCloseTo((1.1 ** 30 - 1) / 0.1, 6);
});
