import { expect, it } from 'vitest';
import { keySpeech, letterName } from './symbolSpeech';

it('nombra cada tecla suelta sin leerla como una expresión', () => {
  expect(keySpeech('^')).toBe('elevado a');
  expect(keySpeech('(')).toBe('abre paréntesis');
  expect(keySpeech('.')).toBe('punto');
  expect(keySpeech(' ')).toBe('espacio');
  expect(keySpeech('=')).toBe('igual');
  expect(keySpeech('x')).toBe('equis');
  expect(keySpeech('X')).toBe('equis');
  expect(keySpeech('7')).toBe('7');
  expect(keySpeech('π')).toBe('pi');
});

it('nombra letras griegas por símbolo o por nombre', () => {
  expect(letterName('θ')).toBe('theta');
  expect(letterName('lambda')).toBe('lambda');
  expect(letterName('radio')).toBeUndefined();
});
