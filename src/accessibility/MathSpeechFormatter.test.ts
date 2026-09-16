import { expect, it } from 'vitest';
import { mathSpeech } from './MathSpeechFormatter';
it('lee operaciones simbólicas y soluciones sin símbolos ambiguos', () => {
  expect(mathSpeech('integrate(x^2,x)')).toBe('Integral de equis al cuadrado respecto de equis');
  expect(mathSpeech('limit(sin(x)/x,x,0)')).toContain('Límite cuando equis tiende a 0');
  expect(mathSpeech('x = 2; y = -3')).toBe('equis igual a 2. ye igual a menos 3');
  expect(mathSpeech('system(x+y=10,x-y=4)')).toContain('Ecuación 2: equis menos ye igual a 4');
});
it('conserva la agrupación y habla potencias', () => {
  expect(mathSpeech('x^2 + 3*x - 5')).toBe('equis al cuadrado más 3 por equis menos 5');
  expect(mathSpeech('2*(3+4)')).toContain('abre paréntesis, 3 más 4, cierra paréntesis');
});
it('lee funciones y números decimales', () => {
  expect(mathSpeech('raiz(25)')).toContain('raíz cuadrada de 25');
  expect(mathSpeech('2.5')).toBe('2 coma 5');
});
it('tolera entradas incompletas sin calcular', () => {
  expect(mathSpeech('sqrt(')).toContain('Expresión incompleta');
  expect(mathSpeech('')).toContain('vacía');
});
