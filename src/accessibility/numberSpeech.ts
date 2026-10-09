// Formato y lectura de números compartidos por toda la app. Sin dependencias para
// que pueda usarse en el hilo principal, en los Workers y en los tests sin cargar mathjs.

export type DecimalSeparator = 'punto' | 'coma';

export interface NumberFormatOptions {
  /** Cifras significativas visibles. Por defecto 12. */
  significant?: number;
  /** Separador decimal visible. Por defecto 'punto' (la sintaxis de entrada). */
  decimal?: DecimalSeparator;
  /** Escala de referencia para limpiar ruido de coma flotante. Por defecto 1. */
  scale?: number;
}

export interface NumberSpeechOptions {
  /** Cifras significativas habladas. Por defecto 6; Infinity lee todas. */
  significant?: number;
  /** Antepone «aproximadamente» si se redondeó. Por defecto true. */
  markApproximate?: boolean;
}

const RELATIVE_NOISE = 1e-12;

/** Lleva a 0 los residuos de coma flotante (p. ej. sin(pi) = 1.22e-16) respecto de una escala. */
export function cleanNumber(value: number, scale = 1): number {
  if (!Number.isFinite(value)) return value;
  const reference = Math.max(1, Math.abs(scale));
  return Math.abs(value) < RELATIVE_NOISE * reference ? 0 : value;
}

function stripZeros(text: string): string {
  if (!text.includes('.')) return text;
  const [mantissa, exponent] = text.split(/e/i);
  const trimmed = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa;
  return exponent === undefined ? trimmed : `${trimmed}e${exponent}`;
}

/** Texto visible de un número: redondeado, sin ruido y con el separador elegido. */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { significant = 12, decimal = 'punto', scale = 1 } = options;
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '-∞';
  const clean = cleanNumber(value, scale);
  if (clean === 0) return '0';
  let text = clean.toPrecision(Math.min(21, Math.max(1, significant)));
  if (/e/i.test(text)) {
    const [m, e] = text.split(/e/i);
    const exponent = Number(e);
    // Notación científica solo para magnitudes muy grandes o muy chicas.
    text = exponent >= -6 && exponent < 21 ? Number(text).toString() : `${m}e${exponent}`;
  }
  text = stripZeros(text);
  return decimal === 'coma' ? text.replace('.', ',') : text;
}

/** Lee una secuencia de cifras una por una: «1415» → «1 4 1 5». */
export function speakDigits(digits: string): string {
  return digits.split('').join(' ');
}

function speakFraction(digits: string): string {
  // «3,14» se dice «tres coma catorce»; con más cifras o un cero inicial, cifra por cifra
  // para que el sintetizador no lo lea como un entero gigante.
  return digits.length <= 2 && !digits.startsWith('0') ? digits : speakDigits(digits);
}

const SPECIAL: Record<string, string> = {
  infinity: 'infinito',
  '∞': 'infinito',
  inf: 'infinito',
  nan: 'no es un número',
};

/**
 * Texto hablado en español de un número escrito con punto o coma decimal, o de un number.
 * Respeta los dígitos de un string (no pierde precisión en enteros grandes).
 */
export function speakNumber(value: number | string, options: NumberSpeechOptions = {}): string {
  const { significant = 6, markApproximate = true } = options;
  let text = typeof value === 'number' ? formatNumber(value, { significant: 17 }) : value.trim();
  let sign = '';
  if (/^[+-]/.test(text)) {
    sign = text.startsWith('-') ? 'menos ' : '';
    text = text.slice(1).trim();
  }
  const special = SPECIAL[text.toLowerCase()];
  if (special) return `${sign}${special}`;
  const match = text.match(/^(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match || (!match[1] && !match[2])) return `${sign}${text}`;
  let [, integer, fraction = '', exponent] = match;
  let approximate = false;
  const significantDigits = `${integer}${fraction}`.replace(/^0+/, '').length;
  if (Number.isFinite(significant) && significantDigits > significant && fraction) {
    const rounded = Number(`${integer || '0'}.${fraction}${exponent ? `e${exponent}` : ''}`);
    const formatted = formatNumber(rounded, { significant });
    const again = formatted.match(/^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/);
    if (again) {
      [, integer, fraction = '', exponent] = again;
      approximate = markApproximate;
    }
  }
  const prefix = approximate ? 'aproximadamente ' : '';
  const body = `${integer || '0'}${fraction ? ` coma ${speakFraction(fraction)}` : ''}`;
  if (exponent !== undefined) {
    const power = Number(exponent);
    return `${prefix}${sign}${body} por diez a la ${power < 0 ? 'menos ' : ''}${Math.abs(power)}`;
  }
  return `${prefix}${sign}${body}`;
}

const HEX_NAMES: Record<string, string> = { A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'efe' };

/** Lee un número en base 2, 8 o 16 dígito por dígito, en grupos de 4, nombrando la base. */
export function speakRadix(text: string, base: number): string {
  const clean = text.trim().toUpperCase().replace(/^0[BXO]/, '');
  const negative = clean.startsWith('-');
  const digits = (negative ? clean.slice(1) : clean).replace(/[\s_]/g, '');
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 4)
    groups.unshift(digits.slice(Math.max(0, end - 4), end));
  const spoken = groups
    .map((group) =>
      group
        .split('')
        .map((d) => HEX_NAMES[d] ?? d)
        .join(' '),
    )
    .join(', ');
  return `${negative ? 'menos ' : ''}${spoken}; base ${base === 2 ? 'dos' : base === 8 ? 'ocho' : base === 16 ? 'dieciséis' : base}`;
}
