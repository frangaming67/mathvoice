import { expect, it } from 'vitest';
import { mathSpeech } from './MathSpeechFormatter';
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
