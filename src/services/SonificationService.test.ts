import { expect, it } from 'vitest';
import { eventCues, panFor, pitchFor, soundPlan } from './SonificationService';

const window = { minX: -5, maxX: 5, minY: -5, maxY: 10 };

it('la altura sube por semitonos de Do 3 a Do 6 y el paneo sigue a x', () => {
  expect(pitchFor(-5, -5, 10)).toBeCloseTo(130.81, 2);
  expect(pitchFor(10, -5, 10)).toBeCloseTo(1046.5, 1);
  // Escala logarítmica: la mitad del rango es la media geométrica, no la aritmética.
  expect(pitchFor(2.5, -5, 10)).toBeCloseTo(Math.sqrt(130.81 * 1046.5), 0);
  expect(panFor(-5, -5, 5)).toBe(-1);
  expect(panFor(0, -5, 5)).toBe(0);
  expect(panFor(5, -5, 5)).toBe(1);
});
it('sin valor suena un soplido y fuera del rango el tono tiembla en el borde', () => {
  expect(soundPlan({ ...window, x: 0, y: null })).toEqual({ pan: 0, noise: true, cues: [] });
  const above = soundPlan({ ...window, x: 5, y: 40 });
  expect(above.tone).toEqual({ frequency: pitchFor(10, -5, 10), outside: 'arriba' });
  expect(soundPlan({ ...window, x: 5, y: -40 }).tone?.outside).toBe('abajo');
  expect(soundPlan({ ...window, x: 5, y: 3 }).tone?.outside).toBeNull();
});
it('los eventos suman señales cortas sin reemplazar el tono del dato', () => {
  const zero = soundPlan({ ...window, x: 0, y: 0, events: ['cero'], crossedAxis: true });
  expect(zero.tone?.frequency).toBe(pitchFor(0, -5, 10));
  // El cruce del eje no se repite si ya suena el cero.
  expect(zero.cues).toEqual(eventCues.cero);
  expect(soundPlan({ ...window, x: 0, y: 1, crossedAxis: true }).cues).toEqual(eventCues.eje);
  const maximum = soundPlan({ ...window, x: 0, y: 1, events: ['máximo local'] }).cues;
  const minimum = soundPlan({ ...window, x: 0, y: 1, events: ['mínimo local'] }).cues;
  // Máximo: dos notas que suben; mínimo: dos que bajan.
  expect(maximum[1].frequency).toBeGreaterThan(maximum[0].frequency);
  expect(minimum[1].frequency).toBeLessThan(minimum[0].frequency);
  expect(soundPlan({ ...window, x: 0, y: null, events: ['asíntota vertical'] }).cues).toEqual(
    eventCues['asíntota vertical'],
  );
});
