import { expect, it } from 'vitest';
import { sampleGraph, type GraphRequest } from './GraphService';
const request: GraphRequest = {
  expressions: ['x^2', 'x+2'],
  minX: -5,
  maxX: 5,
  minY: -5,
  maxY: 10,
  variables: {},
  angle: 'rad',
};
it('encuentra coordenadas, mínimo e intersecciones aproximadas', () => {
  const graph = sampleGraph(request);
  expect(graph.curves[0].points[200]).toEqual({ x: 0, y: 0 });
  expect(graph.events.some((e) => e.type === 'mínimo local' && e.x === 0)).toBe(true);
  expect(graph.events.some((e) => e.type === 'intersección' && Math.abs(e.x - 2) < 0.01)).toBe(
    true,
  );
});
it('no interpreta una discontinuidad como un cero', () => {
  const graph = sampleGraph({ ...request, expressions: ['1/x'] });
  expect(graph.curves[0].points[200].y).toBeNull();
  expect(graph.events.filter((e) => e.type === 'cero')).toHaveLength(0);
  expect(graph.curves[0].breaks).toContain(200);
});
it('rechaza asignaciones y rangos inválidos', () => {
  expect(() => sampleGraph({ ...request, expressions: ['x=2'] })).toThrow();
  expect(() => sampleGraph({ ...request, maxX: -10 })).toThrow();
});
it('refina raíces fuera de la grilla y conserva precisión con valores pequeños', () => {
  for (const expression of ['x^2-2', '1e-12*(x^2-2)']) {
    const graph = sampleGraph({ ...request, expressions: [expression] });
    const roots = graph.events.filter((event) => event.type === 'cero');
    expect(roots).toHaveLength(2);
    expect(roots[0].x).toBeCloseTo(-Math.SQRT2, 10);
    expect(roots[1].x).toBeCloseTo(Math.SQRT2, 10);
  }
});
it('refina extremos fuera de la grilla', () => {
  const graph = sampleGraph({ ...request, expressions: ['(x-0.123456)^2+2'] });
  const minimum = graph.events.find((event) => event.type === 'mínimo local');
  expect(minimum?.x).toBeCloseTo(0.123456, 6);
  expect(minimum?.y).toBeCloseTo(2, 12);
  expect(graph.events.filter((event) => event.type === 'cero')).toHaveLength(0);
});
it('identifica ambas curvas y no duplica intersecciones sobre la grilla', () => {
  const graph = sampleGraph({ ...request, expressions: ['x', '-x'] });
  expect(graph.events.filter((event) => event.type === 'intersección')).toEqual([
    { type: 'intersección', x: 0, y: 0, functionIndex: 0, otherFunctionIndex: 1 },
  ]);
});
it('refina intersecciones entre muestras', () => {
  const graph = sampleGraph({ ...request, expressions: ['x^2', '2'] });
  const intersections = graph.events.filter((event) => event.type === 'intersección');
  expect(intersections).toHaveLength(2);
  expect(intersections[1].x).toBeCloseTo(Math.SQRT2, 10);
});
it('no enumera curvas constantes como cientos de ceros aislados ni polos como raíces', () => {
  for (const expression of ['0', '1e-12', '1/(x-0.123456)']) {
    const graph = sampleGraph({ ...request, expressions: [expression] });
    expect(graph.events.filter((event) => event.type === 'cero')).toHaveLength(0);
  }
});
it('rechaza funciones con argumentos ignorados y rangos que desbordan', () => {
  expect(() => sampleGraph({ ...request, expressions: ['sin(x,2)'] })).toThrow('argumentos');
  expect(() => sampleGraph({ ...request, minX: -1e308, maxX: 1e308 })).toThrow();
  expect(() => sampleGraph({ ...request, minX: 0, maxX: 5e-324 })).toThrow('precisión');
  expect(() => sampleGraph({ ...request, minX: 1e16, maxX: 1e16 + 2 })).toThrow('precisión');
});
const only = (graph: ReturnType<typeof sampleGraph>, type: string) =>
  graph.events.filter((event) => event.type === type);
it('encuentra asíntotas de tan(x) sin extremos falsos, con cualquier rango Y', () => {
  for (const window of [
    { minY: -5, maxY: 10 },
    { minY: -1000, maxY: 1000 },
  ]) {
    const graph = sampleGraph({ ...request, ...window, expressions: ['tan(x)'] });
    const asymptotes = only(graph, 'asíntota vertical').map((event) => event.x);
    expect(asymptotes).toHaveLength(4);
    for (const [found, expected] of asymptotes.map((x, i) => [x, (i - 1.5) * Math.PI]))
      expect(found).toBeCloseTo(expected, 6);
    expect(only(graph, 'máximo local')).toHaveLength(0);
    expect(only(graph, 'mínimo local')).toHaveLength(0);
    expect(graph.curves[0].breaks.length).toBeGreaterThanOrEqual(4);
  }
});
it('marca los saltos de floor(x) y de x%2 sin inventar máximos', () => {
  const floor = sampleGraph({ ...request, expressions: ['floor(x)'] });
  const jumps = only(floor, 'discontinuidad');
  expect(jumps.length).toBeGreaterThanOrEqual(9);
  expect(jumps.find((event) => Math.abs(event.x - 1) < 1e-6)).toMatchObject({
    left: 0,
    right: 1,
  });
  expect(only(floor, 'cero')).toHaveLength(0);
  const saw = sampleGraph({ ...request, expressions: ['x%2'] });
  expect(only(saw, 'discontinuidad').length).toBeGreaterThanOrEqual(4);
  expect(only(saw, 'máximo local')).toHaveLength(0);
});
it('detecta los ceros donde la curva toca el eje y las raíces muy juntas', () => {
  for (const [expression, at] of [
    ['(x-0.123)^2', 0.123],
    ['abs(x-0.05)', 0.05],
  ] as const) {
    const zeros = only(sampleGraph({ ...request, expressions: [expression] }), 'cero');
    expect(zeros).toHaveLength(1);
    expect(zeros[0].x).toBeCloseTo(at, 6);
    expect(zeros[0].tangent).toBe(true);
  }
  const close = only(sampleGraph({ ...request, expressions: ['(x-0.123)^2-1e-9'] }), 'cero');
  expect(close).toHaveLength(2);
  expect(close[0].x).toBeCloseTo(0.123 - Math.sqrt(1e-9), 9);
  expect(close[1].x).toBeCloseTo(0.123 + Math.sqrt(1e-9), 9);
});
it('distingue asíntotas de bordes del dominio', () => {
  for (const [expression, at] of [
    ['1/x', 0],
    ['log(x)', 0],
    ['1/(x-0.123456)', 0.123456],
  ] as const) {
    const asymptotes = only(
      sampleGraph({ ...request, expressions: [expression] }),
      'asíntota vertical',
    );
    expect(asymptotes).toHaveLength(1);
    expect(asymptotes[0].x).toBeCloseTo(at, 6);
    expect(asymptotes[0].y).toBeNull();
  }
  const root = sampleGraph({ ...request, expressions: ['sqrt(x)'] });
  expect(only(root, 'asíntota vertical')).toHaveLength(0);
  expect(root.curves[0].breaks).toContain(200);
});
