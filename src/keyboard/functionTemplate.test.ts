import { expect, it } from 'vitest';
import { fillFunctionTemplate, isAtomic } from './functionTemplate';

it('no duplica paréntesis al completar funciones', () => {
  expect(fillFunctionTemplate('sqrt($0)', ['25'])).toBe('sqrt(25)');
  expect(fillFunctionTemplate('sin($0)', ['30'])).toBe('sin(30)');
  expect(fillFunctionTemplate('nthRoot($0,$1)', ['27', '3'])).toBe('nthRoot(27,3)');
  expect(fillFunctionTemplate('sqrt($0)', ['x+1'])).toBe('sqrt(x+1)');
});
it('agrupa solo lo que no es atómico junto a un operador', () => {
  expect(fillFunctionTemplate('$0^$1', ['2', '10'])).toBe('2^10');
  expect(fillFunctionTemplate('$0^$1', ['x+1', '2'])).toBe('(x+1)^2');
  expect(fillFunctionTemplate('$0^$1', ['-2', '2'])).toBe('(-2)^2');
  expect(fillFunctionTemplate('$0^$1', ['sin(x)', '2'])).toBe('sin(x)^2');
});
it('con coma decimal separa argumentos con punto y coma sin agregar paréntesis', () => {
  expect(fillFunctionTemplate('nthRoot($0;$1)', ['2,5', '3'])).toBe('nthRoot(2,5;3)');
  expect(fillFunctionTemplate('log($0;$1)', ['x+1', '2'])).toBe('log(x+1;2)');
  expect(fillFunctionTemplate('$0^$1', ['2,5', '2'])).toBe('2,5^2');
});
it('reconoce operandos completos', () => {
  expect(isAtomic('3.5')).toBe(true);
  expect(isAtomic('radio')).toBe(true);
  expect(isAtomic('sqrt(2)')).toBe(true);
  expect(isAtomic('(x+1)')).toBe(true);
  expect(isAtomic('(x+1)*(x-1)')).toBe(false);
  expect(isAtomic('x+1')).toBe(false);
});
