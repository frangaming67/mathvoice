import { expect, it } from 'vitest';
import { voiceExpression } from './voiceExpression';
it.each([
  ['dos más dos', '2+2'],
  ['raíz cuadrada de ciento cuarenta y cuatro', 'sqrt(144)'],
  ['seno de treinta grados', 'sin(30)'],
  ['derivada de equis al cuadrado', 'diff(x^2,x)'],
  ['integral de equis al cubo', 'integrate(x^3,x)'],
  ['resolver equis al cuadrado menos cuatro igual a cero', 'solve(x^2-4=0,x)'],
])('interpreta %s sin ejecutar cálculos', (text, expression) =>
  expect(voiceExpression(text).expression).toBe(expression),
);
it('preserva la unidad angular detectada', () =>
  expect(voiceExpression('seno de treinta grados').angle).toBe('deg'));
it.each([
  ['dos coma cero cinco más uno', '2.05+1'],
  ['cero punto cero cero uno', '0.001'],
  ['dos coma veinticinco', '2.25'],
])('preserva cifras decimales: %s', (text, expected) =>
  expect(voiceExpression(text).expression).toBe(expected),
);
