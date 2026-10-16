import { describe, expect, it } from 'vitest';
import {
  describeBalance,
  describeCaret,
  describeClosing,
  describeDeletion,
  functionName,
  matchingParen,
  parenDepth,
  readFromCaret,
  speakChar,
  speakCharAt,
  tokenAt,
  tokenizeExpression,
} from './editingAids';

describe('eco del cursor', () => {
  it('nombra caracteres sueltos', () => {
    expect(speakChar('x')).toBe('equis');
    expect(speakChar('X')).toBe('equis mayúscula');
    expect(speakChar('+')).toBe('más');
    expect(speakChar('3')).toBe('3');
    expect(speakChar(' ')).toBe('espacio');
    expect(speakChar('α')).toBe('alfa');
  });
  it('dice el carácter a la derecha del cursor y los bordes', () => {
    expect(speakCharAt('2+3', 1)).toBe('más');
    expect(speakCharAt('2+3', 3)).toBe('Final de la expresión.');
    expect(speakCharAt('', 0)).toBe('La expresión está vacía.');
  });
});

describe('lectura por partes', () => {
  it('separa números, nombres, operadores y paréntesis', () => {
    expect(tokenizeExpression('2.5*sin(x)').map((t) => [t.text, t.kind])).toEqual([
      ['2.5', 'numero'],
      ['*', 'operador'],
      ['sin', 'nombre'],
      ['(', 'abre'],
      ['x', 'nombre'],
      [')', 'cierra'],
    ]);
  });
  it('nombra funciones en castellano', () => {
    expect(functionName('sin')).toBe('seno');
    expect(functionName('sqrt')).toBe('raíz cuadrada');
    expect(functionName('diff')).toBe('derivada');
    expect(functionName('x')).toBe('equis');
    expect(tokenAt('sqrt(25)', 2)?.speech).toBe('raíz cuadrada');
  });
  it('lee desde el cursor hasta el final', () => {
    expect(readFromCaret('2+sqrt(25)', 2)).toBe(
      'raíz cuadrada abre paréntesis 25 cierra paréntesis',
    );
    expect(readFromCaret('2+3', 3)).toBe('Final de la expresión.');
  });
});

describe('estructura y paréntesis', () => {
  it('describe dónde está el cursor', () => {
    expect(describeCaret('sin(x)', 4)).toBe(
      'Después de seno de, dentro de paréntesis, nivel 1, antes de equis.',
    );
    expect(describeCaret('sin(x+1)', 6)).toBe(
      'Después de más, dentro de seno, nivel 1, antes de 1.',
    );
    expect(describeCaret('2+3', 0)).toBe('Al principio, antes de 2.');
    expect(describeCaret('234', 1)).toBe('En medio de 234.');
  });
  it('encuentra la pareja de un paréntesis', () => {
    expect(matchingParen('2*(3+4)', 2)).toEqual({
      at: 2,
      match: 6,
      open: true,
      speech: 'Pareja: cierra paréntesis, en la posición 7.',
    });
    expect(matchingParen('sqrt(9)', 7)?.speech).toBe(
      'Pareja: abre raíz cuadrada, en la posición 5.',
    );
    expect(matchingParen('sqrt(9', 4)?.speech).toBe('Este paréntesis no tiene pareja.');
    expect(matchingParen('2+3', 1)).toBeNull();
    expect(parenDepth('((1+2', 5)).toBe(2);
  });
  it('anuncia qué cierra cada paréntesis y cuántos quedan', () => {
    expect(describeClosing('sqrt(9)', 7)).toBe('Cierra raíz cuadrada.');
    expect(describeClosing('(2*(3+4)', 8)).toBe('Cierra nivel 2; queda 1 abierto.');
    expect(describeClosing(')', 1)).toBe('Paréntesis de cierre sin pareja.');
    expect(describeClosing('2+3', 3)).toBe('');
  });
  it('explica un desbalance y dónde se abrió', () => {
    expect(describeBalance('sqrt(2+3*(4-1)')).toBe(
      'Falta cerrar 1 paréntesis, abierto después de raíz cuadrada.',
    );
    expect(describeBalance('2+3)')).toBe('Sobra un cierre de paréntesis en la posición 4.');
    expect(describeBalance('2*((1')).toBe(
      'Faltan cerrar 2 paréntesis; el último se abrió después de abre paréntesis.',
    );
    expect(describeBalance('(1+2)')).toBe('');
  });
});

it('dice qué se borró', () => {
  expect(describeDeletion('2+33', '2+3')).toBe('Borraste 3.');
  expect(describeDeletion('x', '')).toBe('Borraste equis. La expresión quedó vacía.');
  expect(describeDeletion('2+sqrt(9)', '2+')).toBe(
    'Borraste raíz cuadrada abre paréntesis 9 cierra paréntesis.',
  );
  expect(describeDeletion('2+3', '2+34')).toBe('');
});
