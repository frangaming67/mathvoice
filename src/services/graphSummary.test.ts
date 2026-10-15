import { expect, it } from 'vitest';
import { formatNumber } from '../accessibility/numberSpeech';
import { sampleGraph, type GraphRequest } from './GraphService';
import { describeCurve, describeGraph } from './graphSummary';

const request: GraphRequest = {
  expressions: ['x^2'],
  minX: -5,
  maxX: 5,
  minY: -5,
  maxY: 10,
  variables: {},
  angle: 'rad',
};
const fmt = (value: number) => formatNumber(value, { significant: 6 });
const describe = (expression: string, extra: Partial<GraphRequest> = {}) =>
  describeCurve(sampleGraph({ ...request, ...extra, expressions: [expression] }), 0, fmt);

it('describe dominio, cortes, crecimiento, bordes y lo que queda fuera del rango Y', () => {
  expect(describe('x^2-2')).toEqual([
    'Definida en todo el intervalo, de x -5 a x 5.',
    'Corta el eje x en x -1.41421 y x 1.41421.',
    'Corta el eje y en y -2.',
    'Decrece desde x -5 hasta x 0 y crece desde x 0 hasta x 5.',
    'En x -5 vale 23 y en x 5 vale 23.',
    'El 31 % de la curva queda fuera del rango Y elegido; Ajustar Y la muestra entera.',
  ]);
});
it('dice los huecos, las asíntotas y los ceros en el borde del dominio', () => {
  const inverse = describe('1/x');
  expect(inverse[0]).toBe('Definida en todo el intervalo, de x -5 a x 5 salvo en x 0.');
  expect(inverse).toContain('No corta el eje x en este intervalo.');
  expect(inverse).toContain('No está definida en x 0.');
  expect(inverse).toContain('Decrece desde x -5 hasta x 0 y decrece desde x 0 hasta x 5.');
  expect(inverse).toContain('Asíntota vertical en x 0.');
  const root = describe('sqrt(x)');
  expect(root[0]).toBe('Definida desde x 0 hasta x 5.');
  expect(root).toContain('Corta el eje x en x 0.');
  expect(describe('(x-1)^2')).toContain('Toca el eje x sin cruzarlo en x 1.');
});
it('resume escalones y oscilaciones sin enumerar cada tramo', () => {
  const steps = describe('floor(x)');
  expect(steps).toContain('Es constante por tramos: 10 tramos.');
  expect(steps).toContain('Está sobre el eje x desde x 0 hasta x 1.');
  expect(steps.find((s) => s.startsWith('Tiene'))).toMatch(
    /^Tiene 10 saltos; el primero en x -4\.$/,
  );
  expect(describe('floor(x)', { minX: 0.5, maxX: 2.5 })).toContain(
    'Salto en x 1: pasa de y 0 a y 1.',
  );
  expect(describe('sin(3*x)')).toContain('Sube y baja 11 veces: oscila en el intervalo.');
  expect(describe('tan(x)')).toContain('Crece en cada uno de sus 5 tramos.');
  expect(describe('tan(x)')).toContain(
    'Asíntotas verticales en x -4.71239, x -1.5708, x 1.5708 y x 4.71239.',
  );
});
it('suma las intersecciones cuando hay varias funciones', () => {
  const text = describeGraph(sampleGraph({ ...request, expressions: ['x^2', '2'] }), fmt);
  expect(text).toMatch(/^Función 1, x\^2\. Definida/);
  expect(text).toContain('Función 2, 2.');
  expect(text).toContain(
    'Hay 2 intersecciones: funciones 1 y 2 en x -1.41421 y funciones 1 y 2 en x 1.41421.',
  );
});
