// Nombres hablados de símbolos y letras sueltas: eco de teclas y lectura de expresiones
// incompletas. Sin dependencias, para usarse en cada pulsación sin costo.

const SYMBOLS: Record<string, string> = {
  '+': 'más',
  '-': 'menos',
  '−': 'menos',
  '*': 'por',
  '×': 'por',
  '·': 'por',
  '/': 'dividido',
  '÷': 'dividido',
  '^': 'elevado a',
  '(': 'abre paréntesis',
  ')': 'cierra paréntesis',
  '[': 'abre corchete',
  ']': 'cierra corchete',
  '{': 'abre llave',
  '}': 'cierra llave',
  '.': 'punto',
  ',': 'coma',
  ';': 'punto y coma',
  ':': 'dos puntos',
  '=': 'igual',
  '<': 'menor',
  '>': 'mayor',
  '≤': 'menor o igual',
  '≥': 'mayor o igual',
  '≠': 'distinto',
  '%': 'por ciento',
  '!': 'factorial',
  '|': 'barra vertical',
  _: 'guion bajo',
  '"': 'comillas',
  "'": 'apóstrofo',
  ' ': 'espacio',
  '√': 'raíz cuadrada',
  '∛': 'raíz cúbica',
  π: 'pi',
  '∞': 'infinito',
  '²': 'al cuadrado',
  '³': 'al cubo',
  '±': 'más o menos',
  '∓': 'menos o más',
  '°': 'grados',
};

const LETTERS: Record<string, string> = {
  a: 'a',
  b: 'be',
  c: 'ce',
  d: 'de',
  e: 'e',
  f: 'efe',
  g: 'ge',
  h: 'hache',
  i: 'i',
  j: 'jota',
  k: 'ka',
  l: 'ele',
  m: 'eme',
  n: 'ene',
  ñ: 'eñe',
  o: 'o',
  p: 'pe',
  q: 'cu',
  r: 'erre',
  s: 'ese',
  t: 'te',
  u: 'u',
  v: 'uve',
  w: 'doble uve',
  x: 'equis',
  y: 'ye',
  z: 'zeta',
};

const GREEK: Record<string, string> = {
  α: 'alfa',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'épsilon',
  θ: 'theta',
  λ: 'lambda',
  μ: 'mu',
  ρ: 'ro',
  σ: 'sigma',
  τ: 'tau',
  φ: 'fi',
  ω: 'omega',
  alpha: 'alfa',
  beta: 'beta',
  delta: 'delta',
  epsilon: 'épsilon',
  theta: 'theta',
  lambda: 'lambda',
  mu: 'mu',
  rho: 'ro',
  sigma: 'sigma',
  tau: 'tau',
  phi: 'fi',
  omega: 'omega',
};

/** Nombre de una letra suelta o de una letra griega escrita por nombre o con su símbolo. */
export function letterName(name: string): string | undefined {
  return GREEK[name] ?? (name.length === 1 ? LETTERS[name.toLowerCase()] : undefined);
}

/** Nombre de un símbolo suelto; undefined si no es un símbolo conocido. */
export function symbolName(symbol: string): string | undefined {
  return SYMBOLS[symbol];
}

/** Texto para el eco de una tecla: cifras tal cual, letras y símbolos por su nombre. */
export function keySpeech(key: string): string {
  if (/^\d$/.test(key)) return key;
  return SYMBOLS[key] ?? letterName(key) ?? key;
}
