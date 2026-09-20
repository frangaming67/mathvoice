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
it('distingue desigualdades, comparaciones encadenadas y ecuaciones', () => {
  expect(mathSpeech('x>=2')).toBe('equis mayor o igual que 2');
  expect(mathSpeech('x≤2')).toBe('equis menor o igual que 2');
  expect(mathSpeech('-2<=x<3')).toBe('menos 2 menor o igual que equis menor que 3');
  expect(mathSpeech('x!=3')).toBe('equis distinto de 3');
  expect(mathSpeech('x==3')).toBe('equis igual a 3');
  expect(mathSpeech('inequality(x^2-4<=0,x)')).toBe(
    'Resolver la desigualdad equis al cuadrado menos 4 menor o igual que 0 para equis',
  );
});
it('explica Taylor, las raíces complejas y los números mixtos', () => {
  expect(mathSpeech('series(sin(x),x,0,5)')).toContain('Polinomio de Taylor de orden 5');
  expect(mathSpeech('series(sin(x),x,0,5)')).toContain('centrado en 0');
  expect(mathSpeech('nthRoots(3+4i,2)')).toBe(
    'Raíces complejas de índice 2 de 3 más 4 por unidad imaginaria',
  );
  expect(mathSpeech('mixedNumber(-2,1,3)')).toBe(
    'Número mixto: menos 2 enteros y 1 dividido por 3',
  );
  expect(mathSpeech('mixed(7/3)')).toContain('forma mixta de 7 dividido por 3');
});
it('lee exponentes científicos con su signo y matrices por filas', () => {
  expect(mathSpeech('1.5e-12')).toBe('1 coma 5 por diez elevado a menos 12');
  expect(mathSpeech('-6.022e23')).toBe('menos 6 coma 022 por diez elevado a 23');
  expect(mathSpeech('2e+4')).toBe('2 por diez elevado a 4');
  expect(mathSpeech('[[1,2],[3,4]]')).toContain('Matriz de 2 filas. Fila 1:');
  expect(mathSpeech('[[1,2],[3,4]]')).toContain('Fila 2: Lista de 2 elementos: 3; 4');
});
