import { expect, it } from 'vitest';
import { toggleSign } from './toggleSign';
it.each([
  ['2+3', '-(2+3)'],
  ['-(2+3)', '2+3'],
  ['-(2)+(3)', '-(-(2)+(3))'],
  ['', '-(0)'],
])('cambia el signo de toda la expresión %s', (expression, expected) =>
  expect(toggleSign(expression)).toBe(expected),
);
