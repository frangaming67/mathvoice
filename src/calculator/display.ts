// Formas de mostrar un resultado en la pantalla de la calculadora científica (ENG, °′″, FACT,
// a b/c) y ayudas de CALC. Puras: no tocan el DOM ni el motor.

import { tokenizeExpression } from '../accessibility/editingAids';
import { formatNumber } from '../accessibility/numberSpeech';
import { physicalConstants } from '../services/PhysicalConstants';
import type { DecimalSeparator } from '../types';
import { SEP } from './keys';

/** Reemplaza el lugar del separador de argumentos según el separador decimal elegido. */
export function fillSeparators(text: string, decimal: DecimalSeparator) {
  return text.split(SEP).join(decimal === 'coma' ? '; ' : ', ');
}

/** Lee un resultado real escrito con punto o coma; null si no es un número suelto. */
export function readNumber(value: string, decimal: DecimalSeparator = 'punto'): number | null {
  const text = (decimal === 'coma' ? value.replace(',', '.') : value).trim();
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Exponente de ingeniería: múltiplo de 3 con mantisa entre 1 y 1000. */
export function engineeringStart(value: number) {
  return value === 0 ? 0 : 3 * Math.floor(Math.log10(Math.abs(value)) / 3);
}

/** «1234» con exponente 3 → mantisa «1.234» y la expresión «1.234*10^3». */
export function engineering(value: number, exponent: number, decimal: DecimalSeparator) {
  const mantissa = formatNumber(value / 10 ** exponent, { significant: 10, decimal });
  return { mantissa, exponent, expression: `${mantissa}*10^${exponent}` };
}

/** Grados decimales a grados, minutos y segundos: 12.5125 → 12°30′45″. */
export function toDms(value: number, decimal: DecimalSeparator = 'punto') {
  const sign = value < 0 ? '-' : '';
  let total = Math.round(Math.abs(value) * 360000) / 100; // segundos con dos decimales
  const degrees = Math.floor(total / 3600);
  total -= degrees * 3600;
  const minutes = Math.floor(total / 60);
  const seconds = Number((total - minutes * 60).toFixed(2));
  const shown = formatNumber(seconds, { significant: 6, decimal });
  return {
    text: `${sign}${degrees}°${minutes}′${shown}″`,
    // La misma forma que entiende el motor, para mostrarla y leerla.
    expression: `${sign}${degrees}°${minutes}'${shown}"`,
  };
}

/** Factores primos de un entero entre 2 y 10^12: 360 → [[2, 3], [3, 2], [5, 1]]. */
export function primeFactors(n: number): [number, number][] | null {
  if (!Number.isSafeInteger(n) || Math.abs(n) < 2 || Math.abs(n) > 1e12) return null;
  let rest = Math.abs(n);
  const factors: [number, number][] = [];
  for (let p = 2; p * p <= rest; p += p === 2 ? 1 : 2) {
    let count = 0;
    while (rest % p === 0) {
      rest /= p;
      count++;
    }
    if (count) factors.push([p, count]);
  }
  if (rest > 1) factors.push([rest, 1]);
  return factors;
}

/** Factorización como expresión: «2^3*3^2*5»; negativa con el signo adelante. */
export function factorExpression(n: number): string | null {
  const factors = primeFactors(n);
  if (!factors) return null;
  const product = factors.map(([p, k]) => (k > 1 ? `${p}^${k}` : String(p))).join('*');
  return n < 0 ? `-${product}` : product;
}

/** «7/3» → 2 y 1/3; null si el resultado no es una fracción impropia. */
export function mixedFraction(value: string) {
  const match = value.trim().match(/^(-?)(\d+)\/(\d+)$/);
  if (!match) return null;
  const numerator = Number(match[2]),
    denominator = Number(match[3]);
  if (!denominator || numerator < denominator) return null;
  const whole = Math.floor(numerator / denominator);
  const rest = numerator % denominator;
  return {
    negative: match[1] === '-',
    whole,
    numerator: rest,
    denominator,
    expression: rest ? `${match[1]}(${whole}+${rest}/${denominator})` : `${match[1]}${whole}`,
  };
}

const KNOWN = new Set([
  'pi',
  'e',
  'i',
  'phi',
  'ans',
  'resultado',
  'Infinity',
  'mod',
  'to',
  'in',
  ...physicalConstants.map((constant) => constant.symbol),
]);

/** Variables de una expresión que CALC tiene que preguntar: nombres que no son funciones. */
export function freeVariables(expression: string): string[] {
  const tokens = tokenizeExpression(expression).filter((token) => token.kind !== 'espacio');
  const names: string[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'nombre' || KNOWN.has(token.text)) return;
    if (tokens[index + 1]?.text === '(') return;
    if (!names.includes(token.text)) names.push(token.text);
  });
  return names;
}
