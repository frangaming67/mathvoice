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
