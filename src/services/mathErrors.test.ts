import { describe, expect, it } from 'vitest';
import { parse } from 'mathjs';
import { normalizeWithMap } from '../parser/expression';
import type { DecimalSeparator } from '../types';
import {
  MathInputError,
  mathErrorFrom,
  serializeMathError,
  translateRuntimeError,
  translateSyntaxError,
} from './mathErrors';

function syntax(input: string, decimal: DecimalSeparator = 'punto') {
  const mapped = normalizeWithMap(input, { decimalSeparator: decimal });
  try {
    parse(mapped.text);
  } catch (error) {
    return translateSyntaxError(error, mapped, decimal);
  }
  throw new Error(`«${input}» no dio error de sintaxis`);
}

describe('errores de sintaxis con causa y posición', () => {
  it.each([
    ['sqrt(2', 'Falta cerrar 1 paréntesis abierto en la posición 5.', 5, 'parentesis'],
    ['2*(3+4', 'Falta cerrar 1 paréntesis abierto en la posición 3.', 3, 'parentesis'],
    ['((1+2', 'Faltan cerrar 2 paréntesis; el último se abrió en la posición 2.', 2, 'parentesis'],
    ['2+', 'Falta un número después de «más», al final.', 3, 'falta-valor'],
    ['5*', 'Falta un número después de «por», al final.', 3, 'falta-valor'],
    ['2+*3', 'Falta un número después de «más», en la posición 3.', 3, 'falta-valor'],
    ['3*(4+5))', 'Sobra un paréntesis de cierre en la posición 8.', 8, 'parentesis'],
    ['[1,2]]', 'Sobra un corchete de cierre en la posición 6.', 6, 'corchete'],
    ['sqrt(', 'Falta un número dentro del paréntesis abierto en la posición 5.', 6, 'falta-valor'],
    ['[1,2', 'Falta cerrar 1 corchete abierto en la posición 1.', 1, 'corchete'],
    ['2 @ 3', 'No reconozco «@» en la posición 3.', 3, 'simbolo'],
    ['2..3', 'Sobra un punto decimal en la posición 3.', 3, 'sintaxis'],
  ])('%s → %s', (input, message, position, code) => {
    const error = syntax(input);
    expect(error).toBeInstanceOf(MathInputError);
    expect(error.message).toBe(message);
    expect(error.position).toBe(position);
    expect(error.code).toBe(code);
  });

  it('sugiere la coma decimal cuando el separador es punto', () => {
    const error = syntax('3,5+1');
    expect(error.message).toBe(
      '3,5: con separador punto escribí 3.5, o activá la coma decimal en Configuración.',
    );
    expect(error.code).toBe('coma-decimal');
    expect(error.position).toBe(2);
  });

  it('cuenta la posición sobre el texto original, no sobre el normalizado', () => {
    expect(syntax('  arcsen(1').position).toBe(9);
    expect(syntax('√16+').message).toBe('Falta un número después de «más», al final.');
    expect(syntax('√16+').position).toBe(5);
  });

  it('con coma decimal habla del punto y coma que sobra', () =>
    expect(syntax('2;', 'coma').message).toMatch(/Sobra un punto y coma|Falta un número/));
});

describe('errores de cálculo traducidos', () => {
  it.each([
    ['Division by zero', 'No se puede dividir por cero.', 'division-por-cero'],
    [
      'Dimension mismatch in multiplication. Matrix A columns (2) must match Matrix B rows (1)',
      'Para multiplicar, las columnas de A (2) deben coincidir con las filas de B (1).',
      'dimensiones',
    ],
    [
      'Cannot calculate inverse, determinant is zero',
      'La matriz es singular (su determinante es 0): no tiene inversa.',
      'matriz',
    ],
    [
      'Vectors with length 3 expected (Size A = [2], B = [2])',
      'El producto vectorial (cross) necesita dos vectores de 3 componentes.',
      'dimensiones',
    ],
    [
      'Root must be odd when a is negative.',
      'La raíz par de un número negativo no es real.',
      'no-real',
    ],
    [
      'Parameters in function gcd must be integer numbers',
      'La función gcd necesita números enteros.',
      'dominio',
    ],
    [
      'Cannot calculate median of an empty array',
      'La lista está vacía: escribí al menos un número.',
      'argumentos',
    ],
  ])('%s', (english, spanish, code) => {
    const error = translateRuntimeError(new Error(english));
    expect(error.message).toBe(spanish);
    expect(error.code).toBe(code);
  });

  it('conserva los mensajes que ya están en español', () =>
    expect(translateRuntimeError(new Error('Usá un entero entre 0 y 100000.')).message).toBe(
      'Usá un entero entre 0 y 100000.',
    ));
  it('nunca deja pasar un mensaje en inglés desconocido', () =>
    expect(translateRuntimeError(new Error('Something odd happened')).message).toMatch(
      /^No pude calcular esa operación/,
    ));
  it('el error cruza el Worker con código y posición', () => {
    const data = serializeMathError(new MathInputError('Falta algo.', 'falta-valor', 4));
    expect(data).toEqual({ message: 'Falta algo.', code: 'falta-valor', position: 4 });
    const rebuilt = mathErrorFrom(structuredClone(data));
    expect(rebuilt).toBeInstanceOf(Error);
    expect(rebuilt.position).toBe(4);
    expect(rebuilt.code).toBe('falta-valor');
    expect(mathErrorFrom('texto viejo').message).toBe('texto viejo');
  });
});
