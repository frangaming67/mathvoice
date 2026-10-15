import { expect, it } from 'vitest';
import { formatNumber } from '../accessibility/numberSpeech';
import { sampleGraph, type GraphRequest } from './GraphService';
import { tactileSvg, tickStep } from './tactileGraph';

const request: GraphRequest = {
  expressions: ['x^2', 'x+2'],
  minX: -5,
  maxX: 5,
  minY: -5,
  maxY: 10,
  variables: {},
  angle: 'rad',
};
const fmt = (value: number) => formatNumber(value, { significant: 6, decimal: 'coma' });

it('elige marcas de 1, 2 o 5 por una potencia de diez', () => {
  expect(tickStep(10)).toBe(1);
  expect(tickStep(15)).toBe(2);
  expect(tickStep(100)).toBe(10);
  expect(tickStep(0.5)).toBeCloseTo(0.05, 12);
  expect(tickStep(40)).toBe(5);
});
it('arma un SVG negro sobre blanco con trazos gruesos distinguibles y leyenda', () => {
  const svg = tactileSvg(sampleGraph(request), fmt, 'Parábola y recta.');
  expect(svg).toMatch(/^<\?xml/);
  expect(svg).toContain('<title id="titulo">Gráfico de x^2, x+2</title>');
  expect(svg).toContain('<desc id="descripcion">Parábola y recta.</desc>');
  expect(svg.match(/stroke-width="6"/g)).toHaveLength(2);
  expect(svg).toContain('stroke-dasharray="24 12"');
  expect(svg).toContain('Función 1, trazo continuo: x^2');
  expect(svg).toContain('Función 2, trazo de rayas largas: x+2');
  // Números del eje con el separador elegido.
  expect(svg).toContain('>-4<');
  expect(svg).not.toMatch(/fill="(?!#fff|#000|none)/);
});
it('levanta el trazo en las asíntotas', () => {
  const svg = tactileSvg(sampleGraph({ ...request, expressions: ['1/x'] }), fmt);
  const path = svg.match(/<path d="([^"]+)"/)![1];
  expect(path.match(/M/g)!.length).toBeGreaterThanOrEqual(2);
});
