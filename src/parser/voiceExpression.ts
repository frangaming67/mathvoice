import type { AngleMode } from '../types';

export interface VoiceParse {
  /** Expresión para la calculadora. Las palabras no entendidas quedan entre «». */
  expression: string;
  /** Palabras que no se pudieron interpretar, en el orden en que se dijeron. */
  unknown: string[];
  /** Avisos breves sobre interpretaciones dudosas, listos para leer en voz alta. */
  ambiguous: string[];
  /** Unidad de ángulo mencionada en el dictado. */
  angle?: AngleMode;
}

type Token =
  | { t: 'num'; v: string; raw: string }
  | { t: 'word'; v: string; raw: string }
  | { t: 'sym'; v: string; raw: string }
  | { t: 'angle'; v: AngleMode; raw: string };

interface Node {
  s: string;
  p: number;
  num?: boolean;
  name?: string;
  letter?: boolean;
  group?: boolean;
  unknown?: boolean;
  missing?: boolean;
  powNum?: boolean;
  rel?: string[];
  first?: Node;
}

const REL = 0,
  SUM = 1,
  PROD = 2,
  NEG = 3,
  POW = 4,
  POST = 5,
  ATOM = 6;

const units: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};
const teens: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
const tens: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};
const hundreds: Record<string, number> = { cien: 100, ciento: 100 };
'doscient trescient cuatrocient quinient seiscient setecient ochocient novecient'
  .split(' ')
  .forEach((stem, index) => (hundreds[`${stem}os`] = hundreds[`${stem}as`] = (index + 2) * 100));
const ordinals: Record<string, number> = {
  primer: 1,
  primero: 1,
  primera: 1,
  segundo: 2,
  segunda: 2,
  tercer: 3,
  tercero: 3,
  tercera: 3,
  cuarto: 4,
  cuarta: 4,
  quinto: 5,
  quinta: 5,
  sexto: 6,
  sexta: 6,
  septimo: 7,
  septima: 7,
  setimo: 7,
  setima: 7,
  octavo: 8,
  octava: 8,
  noveno: 9,
  novena: 9,
  decimo: 10,
  decima: 10,
};
const denominators: Record<string, number> = {};
(
  [
    ['medio media', 2],
    ['tercio', 3],
    ['cuarto', 4],
    ['quinto', 5],
    ['sexto', 6],
    ['septimo setimo', 7],
    ['octavo', 8],
    ['noveno', 9],
    ['decimo decima', 10],
    ['centesimo centesima', 100],
    ['milesimo milesima', 1000],
  ] as const
).forEach(([words, value]) =>
  words.split(' ').forEach((word) => (denominators[word] = denominators[`${word}s`] = value)),
);
function denominator(word: string | undefined): number | undefined {
  if (!word) return undefined;
  if (denominators[word]) return denominators[word];
  const stem = word.match(/^(\w+?)avos?$/)?.[1];
  return stem ? (teens[stem] ?? tens[stem] ?? tens[`${stem}a`]) : undefined;
}

const variables: Record<string, string> = {
  equis: 'x',
  x: 'x',
  ye: 'y',
  y: 'y',
  zeta: 'z',
  zeda: 'z',
  ceta: 'z',
  z: 'z',
  te: 't',
  t: 't',
  ene: 'n',
  n: 'n',
};
const spokenVariable: Record<string, string> = {
  x: 'equis',
  y: 'ye',
  z: 'zeta',
  t: 'te',
  n: 'ene',
};
const atoms: [string[], string][] = (
  [
    [['numero', 'pi'], 'pi'],
    [['pi'], 'pi'],
    [['numero', 'e'], 'e'],
    [['e'], 'e'],
    [['numero', 'aureo'], 'phi'],
    [['fi'], 'phi'],
    [['phi'], 'phi'],
    [['infinito'], 'Infinity'],
    [['unidad', 'imaginaria'], 'i'],
    [['i', 'griega'], 'y'],
    [['i'], 'i'],
    [['resultado', 'anterior'], 'ans'],
    [['respuesta', 'anterior'], 'ans'],
    [['ultimo', 'resultado'], 'ans'],
    [['ans'], 'ans'],
    ...Object.entries(variables).map(([word, name]): [string[], string] => [[word], name]),
  ] as [string[], string][]
).sort((a, b) => b[0].length - a[0].length);

interface FnSpec {
  out: string;
  spoken: string;
  close: string[];
  max?: number;
  and?: boolean;
}
const fns: Record<string, FnSpec> = {
  sin: { out: 'sin', spoken: 'seno', close: ['seno', 'sen'] },
  cos: { out: 'cos', spoken: 'coseno', close: ['coseno', 'cos'] },
  tan: { out: 'tan', spoken: 'tangente', close: ['tangente', 'tg', 'tan'] },
  asin: { out: 'asin', spoken: 'arco seno', close: ['arco seno', 'arcoseno'] },
  acos: { out: 'acos', spoken: 'arco coseno', close: ['arco coseno', 'arcocoseno'] },
  atan: { out: 'atan', spoken: 'arco tangente', close: ['arco tangente', 'arcotangente'] },
  sinh: { out: 'sinh', spoken: 'seno hiperbólico', close: ['seno hiperbolico', 'seno'] },
  cosh: { out: 'cosh', spoken: 'coseno hiperbólico', close: ['coseno hiperbolico', 'coseno'] },
  tanh: {
    out: 'tanh',
    spoken: 'tangente hiperbólica',
    close: ['tangente hiperbolica', 'tangente'],
  },
  ln: {
    out: 'ln',
    spoken: 'logaritmo natural',
    close: ['logaritmo natural', 'logaritmo neperiano', 'logaritmo', 'ln'],
  },
  log: { out: 'log', spoken: 'logaritmo', close: ['logaritmo', 'log'], max: 2 },
  exp: { out: 'exp', spoken: 'exponencial', close: ['exponencial'] },
  abs: { out: 'abs', spoken: 'valor absoluto', close: ['valor absoluto', 'absoluto'] },
  sqrt: { out: 'sqrt', spoken: 'raíz cuadrada', close: ['raiz cuadrada', 'raiz'] },
  cbrt: { out: 'cbrt', spoken: 'raíz cúbica', close: ['raiz cubica', 'raiz'] },
  root: { out: 'nthRoot', spoken: 'raíz', close: ['raiz'], max: 2 },
  factorial: { out: 'factorial', spoken: 'factorial', close: ['factorial'] },
  mod: { out: 'mod', spoken: 'resto', close: ['resto'] },
  square: { out: '2', spoken: 'cuadrado', close: ['cuadrado'] },
  cube: { out: '3', spoken: 'cubo', close: ['cubo'] },
  floor: {
    out: 'floor',
    spoken: 'redondeo hacia abajo',
    close: ['redondeo hacia abajo', 'parte entera'],
  },
  ceil: { out: 'ceil', spoken: 'redondeo hacia arriba', close: ['redondeo hacia arriba'] },
  round: { out: 'round', spoken: 'redondeo', close: ['redondeo'] },
  sign: { out: 'sign', spoken: 'signo', close: ['signo'] },
  gcd: {
    out: 'gcd',
    spoken: 'máximo común divisor',
    close: ['maximo comun divisor'],
    max: 2,
    and: true,
  },
  lcm: {
    out: 'lcm',
    spoken: 'mínimo común múltiplo',
    close: ['minimo comun multiplo'],
    max: 2,
    and: true,
  },
};
const functionPhrases: [string[], string][] = (
  [
    ['arco seno', 'asin'],
    ['arcoseno', 'asin'],
    ['arcsen', 'asin'],
    ['arcsin', 'asin'],
    ['asin', 'asin'],
    ['arco coseno', 'acos'],
    ['arcocoseno', 'acos'],
    ['arccos', 'acos'],
    ['acos', 'acos'],
    ['arco tangente', 'atan'],
    ['arcotangente', 'atan'],
    ['arctan', 'atan'],
    ['arctg', 'atan'],
    ['atan', 'atan'],
    ['seno hiperbolico', 'sinh'],
    ['senh', 'sinh'],
    ['sinh', 'sinh'],
    ['coseno hiperbolico', 'cosh'],
    ['cosh', 'cosh'],
    ['tangente hiperbolica', 'tanh'],
    ['tanh', 'tanh'],
    ['seno', 'sin'],
    ['sen', 'sin'],
    ['sin', 'sin'],
    ['coseno', 'cos'],
    ['cos', 'cos'],
    ['tangente', 'tan'],
    ['tg', 'tan'],
    ['tan', 'tan'],
    ['logaritmo natural', 'ln'],
    ['logaritmo neperiano', 'ln'],
    ['log natural', 'ln'],
    ['ele ene', 'ln'],
    ['ln', 'ln'],
    ['logaritmo decimal', 'log'],
    ['logaritmo', 'log'],
    ['log', 'log'],
    ['exponencial', 'exp'],
    ['exp', 'exp'],
    ['valor absoluto', 'abs'],
    ['absoluto', 'abs'],
    ['abs', 'abs'],
    ['raiz cuadrada', 'sqrt'],
    ['raiz cubica', 'cbrt'],
    ['raiz', 'sqrt'],
    ['sqrt', 'sqrt'],
    ['cbrt', 'cbrt'],
    ['factorial', 'factorial'],
    ['cuadrado', 'square'],
    ['cubo', 'cube'],
    ['redondeo hacia abajo', 'floor'],
    ['parte entera', 'floor'],
    ['redondeo hacia arriba', 'ceil'],
    ['redondeo', 'round'],
    ['signo', 'sign'],
    ['maximo comun divisor', 'gcd'],
    ['mcd', 'gcd'],
    ['minimo comun multiplo', 'lcm'],
    ['mcm', 'lcm'],
  ] as const
)
  .map(([words, key]): [string[], string] => [words.split(' '), key])
  .sort((a, b) => b[0].length - a[0].length);
const closeNames = [...new Set(Object.values(fns).flatMap((fn) => fn.close))]
  .map((name) => name.split(' '))
  .sort((a, b) => b.length - a.length);
const genericClosers = new Set(['funcion', 'argumento', 'exponente', 'potencia', 'expresion']);
const structural = new Set([
  'de',
  'del',
  'a',
  'en',
  'cuando',
  'tiende',
  'tendiendo',
  'respecto',
  'desde',
  'hasta',
  'para',
  'argumento',
  'fin',
  'cierra',
  'cerrar',
  'cierro',
  'dx',
  'dy',
  'dz',
  'dt',
  'dn',
  'diferencial',
]);
const leadingFillers = new Set(
  'cuanto cual da vale calcula calcular calcule calculame calculeme computa evalua evaluar dame decime dime hallar halla obtene obtener quiero necesito saber'.split(
    ' ',
  ),
);
const commands: Record<string, string> = {
  derivada: 'diff',
  derivar: 'diff',
  deriva: 'diff',
  derivame: 'diff',
  integral: 'integrate',
  integrar: 'integrate',
  integra: 'integrate',
  limite: 'limit',
  resolver: 'solve',
  resuelve: 'solve',
  resolve: 'solve',
  despejar: 'solve',
  despeja: 'solve',
  simplificar: 'simplify',
  simplifica: 'simplify',
  factorizar: 'factor',
  factoriza: 'factor',
  expandir: 'expand',
  expande: 'expand',
  desarrollar: 'expand',
  desarrolla: 'expand',
};
const vocabulary = new Set([
  ...Object.keys(units),
  ...Object.keys(teens),
  ...Object.keys(tens),
  ...Object.keys(hundreds),
  ...Object.keys(ordinals),
  ...Object.keys(denominators),
  ...Object.keys(commands),
  ...atoms.flatMap(([words]) => words),
  ...functionPhrases.flatMap(([words]) => words),
  ...closeNames.flat(),
  ...genericClosers,
  ...structural,
  ...leadingFillers,
  ...'mil millon millones mas menos o por multiplicado veces dividido sobre entre modulo mod elevado al la cuadrado cubo ciento porciento resto dividir igual que menor mayor distinto diferente abre abrir abro parentesis coma punto base indice enesima enesimo orden definida indefinida izquierda derecha ecuacion inecuacion desigualdad con y d el opuesto fraccion numerador denominador'.split(
    ' ',
  ),
]);

const plain = (word: string) => word.normalize('NFD').replace(/[̀-ͯ]/g, '');
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const symbols: Record<string, string> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '–': '-',
  '—': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '⋅': '*',
  '∗': '*',
  '/': '/',
  '÷': '/',
  '∕': '/',
  '^': '^',
  '(': '(',
  '[': '(',
  '{': '(',
  ')': ')',
  ']': ')',
  '}': ')',
  '=': '=',
  '<': '<',
  '>': '>',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '%': '%',
  '±': '±',
  '√': 'sqrt',
  '∛': 'cbrt',
  '∜': 'root4',
  ',': 'sep',
  ';': 'sep',
};
const wordSymbols: Record<string, string[]> = {
  π: ['pi'],
  '∞': ['infinito'],
  '∫': ['integral'],
  '→': ['tiende', 'a'],
};

function readDigits(text: string, notes: string[]): Token {
  const num = (v: string): Token => ({ t: 'num', v, raw: text });
  const dots = text.split('.').length - 1,
    commas = text.split(',').length - 1;
  if (!dots && !commas) return num(text);
  if (dots && commas) {
    const last = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','));
    return num(`${text.slice(0, last).replace(/[.,]/g, '')}.${text.slice(last + 1)}`);
  }
  const parts = text.split(dots ? '.' : ',');
  const grouped = parts[0].length <= 3 && parts.slice(1).every((part) => part.length === 3);
  if (parts.length > 2) return grouped ? num(parts.join('')) : { t: 'word', v: text, raw: text };
  if (dots && grouped && parts[0] !== '0') {
    notes.push(`«${text}» se tomó con punto de miles. Si era un decimal, corregilo.`);
    return num(parts.join(''));
  }
  return num(`${parts[0]}.${parts[1]}`);
}

function lex(text: string, notes: string[]): Token[] {
  const source = text.normalize('NFC').toLowerCase();
  const exclamation = source.includes('¡');
  const tokens: Token[] = [];
  const digits = /\d+(?:[.,]\d+)*/y,
    letters = /\p{L}+/uy;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    digits.lastIndex = letters.lastIndex = i;
    const number = /\d/.test(char) ? digits.exec(source) : null;
    if (/\s/.test(char)) i++;
    else if (number) {
      tokens.push(readDigits(number[0], notes));
      i += number[0].length;
    } else if (superscripts.includes(char) || char === '⁻' || char === '⁺') {
      let j = i,
        value = '';
      tokens.push({ t: 'sym', v: '^', raw: char });
      if (char === '⁻') tokens.push({ t: 'sym', v: '-', raw: char });
      while (j < source.length && /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(source[j])) {
        if (superscripts.includes(source[j])) value += superscripts.indexOf(source[j]);
        j++;
      }
      if (value) tokens.push({ t: 'num', v: value, raw: value });
      i = j;
    } else if (char === '°' || char === 'º') {
      tokens.push({ t: 'angle', v: 'deg', raw: char });
      i++;
    } else if (wordSymbols[char]) {
      wordSymbols[char].forEach((v) => tokens.push({ t: 'word', v, raw: char }));
      i++;
    } else if (/\p{L}/u.test(char)) {
      const word = letters.exec(source)![0];
      tokens.push({ t: 'word', v: plain(word), raw: word });
      i += word.length;
    } else if ('<>!='.includes(char) && source[i + 1] === '=') {
      tokens.push({ t: 'sym', v: char === '=' ? '=' : `${char}=`, raw: `${char}=` });
      i += 2;
    } else if (char === '!') {
      if (!exclamation) tokens.push({ t: 'sym', v: '!', raw: '!' });
      i++;
    } else if (char === ':') {
      if (tokens.at(-1)?.t === 'num' && /^\s*\d/.test(source.slice(i + 1)))
        tokens.push({ t: 'sym', v: '/', raw: ':' });
      i++;
    } else if (symbols[char]) {
      tokens.push({ t: 'sym', v: symbols[char], raw: char });
      i++;
    } else {
      if (!/[.…'"`´¨«»¿?¡_]/.test(char)) tokens.push({ t: 'word', v: char, raw: char });
      i++;
    }
  }
  return tokens;
}

function shift(value: string, zeros: number) {
  const [whole, fraction = ''] = value.split('.');
  const digits = (whole + fraction.padEnd(zeros, '0')).replace(/^0+(?=\d)/, '');
  const point = whole.length + zeros;
  const result = `${digits.slice(0, point)}.${digits.slice(point)}`.replace(/\.?0*$/, '');
  return result || '0';
}

/** Une las palabras numéricas en números, sin sumar números que no forman un numeral válido. */
function numerals(tokens: Token[], notes: string[]): Token[] {
  const word = (k: number) => {
    const token = tokens[k];
    return token?.t === 'word' ? token.v : undefined;
  };
  const scale = (k: number) =>
    word(k) === 'mil' ? 3 : word(k) === 'millon' || word(k) === 'millones' ? 6 : 0;
  function chunk(k: number): { value: number; end: number } | null {
    let value = 0,
      j = k,
      any = false;
    const w = word(j);
    if (w === 'cien') return { value: 100, end: j + 1 };
    if (w && hundreds[w]) {
      value = hundreds[w];
      j++;
      any = true;
    }
    const next = word(j);
    if (next && tens[next]) {
      value += tens[next];
      j++;
      const unit = word(j + 1);
      if (word(j) === 'y' && unit && units[unit] > 0) {
        value += units[unit];
        j += 2;
      }
      return { value, end: j };
    }
    if (next && teens[next]) return { value: value + teens[next], end: j + 1 };
    if (next && units[next] !== undefined && !(any && units[next] === 0))
      return { value: value + units[next], end: j + 1 };
    return any ? { value, end: j } : null;
  }
  function integer(k: number): { text: string; end: number } | null {
    let total = 0,
      current = 0,
      j = k,
      last: 'start' | 'chunk' | 'mil' | 'millon' = 'start';
    const token = tokens[k];
    if (token?.t === 'num') {
      const zeros = scale(k + 1);
      if (!zeros) return { text: token.v, end: k + 1 };
      if (token.v.includes('.')) return { text: shift(token.v, zeros), end: k + 2 };
      current = Number(token.v);
      j = k + 1;
      last = 'chunk';
    }
    while (j < tokens.length) {
      const w = word(j);
      const digits = tokens[j];
      if (
        last !== 'chunk' &&
        last !== 'start' &&
        digits.t === 'num' &&
        /^\d{1,3}$/.test(digits.v)
      ) {
        current += Number(digits.v);
        j++;
        last = 'chunk';
        continue;
      }
      if (w === 'mil') {
        if (last === 'mil' || current >= 1000) break;
        current = (current || 1) * 1000;
        last = 'mil';
        j++;
        continue;
      }
      if (w === 'millon' || w === 'millones') {
        if (last === 'millon') break;
        total += (current || 1) * 1e6;
        current = 0;
        last = 'millon';
        j++;
        continue;
      }
      if (last === 'chunk') break;
      const part = chunk(j);
      if (!part) break;
      current += part.value;
      j = part.end;
      last = 'chunk';
    }
    return last === 'start' ? null : { text: String(total + current), end: j };
  }
  function number(k: number): { text: string; end: number } | null {
    const whole = integer(k);
    if (!whole) return null;
    let { text, end } = whole;
    if (text.includes('.')) return whole;
    const half = word(end + 1);
    if (word(end) === 'y' && (half === 'medio' || half === 'media'))
      return { text: `${text}.5`, end: end + 2 };
    if (word(end) === 'coma' || word(end) === 'punto') {
      let decimals = '',
        j = end + 1;
      for (;;) {
        const token = tokens[j];
        if (token?.t === 'num' && /^\d+$/.test(token.v)) {
          decimals += token.v;
          j++;
          continue;
        }
        const part = chunk(j);
        if (!part) break;
        decimals += part.value;
        j = part.end;
      }
      if (decimals) {
        text = `${text}.${decimals}`;
        end = j;
        const zeros = scale(end);
        if (zeros) {
          text = shift(text, zeros);
          end++;
        }
      }
    }
    return { text, end };
  }
  const result: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const first = number(i);
    const percent =
      (word(i) === 'ciento' || word(i) === 'cien') && word(i - 1) === 'por' && first?.end === i + 1;
    if (!first || percent) {
      result.push(tokens[i++]);
      continue;
    }
    const parts = [first];
    while (!parts.at(-1)!.text.includes('.')) {
      const next = number(parts.at(-1)!.end);
      if (!next) break;
      parts.push(next);
    }
    const end = parts.at(-1)!.end;
    const raw = tokens
      .slice(i, end)
      .map((token) => token.raw)
      .join(' ');
    const text = parts.map((part) => part.text).join('');
    if (parts.length > 1) notes.push(`«${raw}» se tomó como ${text}.`);
    result.push({ t: 'num', v: text, raw });
    i = end;
  }
  return result;
}

function angles(tokens: Token[], notes: string[]): { tokens: Token[]; angle?: AngleMode } {
  const found = new Set<AngleMode>();
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const w = token.t === 'word' ? token.v : '';
    const next = tokens[i + 1]?.t === 'word' ? tokens[i + 1].v : '';
    let angle: AngleMode | undefined;
    if (w === 'grado' || w === 'grados') {
      angle = next === 'centesimales' ? 'grad' : 'deg';
      if (next === 'centesimales' || next === 'sexagesimales') i++;
    } else if (['radian', 'radianes', 'rad'].includes(w)) angle = 'rad';
    else if (['gradian', 'gradianes', 'gon', 'gones'].includes(w)) angle = 'grad';
    else if (token.t === 'angle') angle = token.v;
    if (!angle) {
      result.push(token);
      continue;
    }
    if (result.at(-1)?.t === 'word' && result.at(-1)?.v === 'en') result.pop();
    found.add(angle);
    result.push({ t: 'angle', v: angle, raw: token.raw });
  }
  if (found.size > 1)
    notes.push('Mencionaste más de una unidad de ángulo. Revisá el modo angular.');
  return { tokens: result, angle: found.size === 1 ? [...found][0] : undefined };
}

function tidy(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const isWord = (token: Token | undefined, ...words: string[]) =>
    token?.t === 'word' && words.includes(token.v);
  const digits = (token: Token | undefined) => token?.t === 'num' && /^\d/.test(token.raw);
  tokens.forEach((token, i) => {
    if (isWord(token, 'el', 'los', 'las', 'lo', 'es', 'son')) return;
    if (isWord(token, 'la') && !isWord(result.at(-1), 'a')) return;
    if (isWord(token, 'por') && isWord(tokens[i + 1], 'favor')) return;
    if (isWord(token, 'favor') && isWord(tokens[i - 1], 'por')) return;
    if (isWord(token, 'x') && digits(tokens[i - 1]) && digits(tokens[i + 1]))
      result.push({ t: 'sym', v: '*', raw: token.raw });
    else result.push(token);
  });
  for (;;) {
    const last = result.at(-1);
    if (last?.t === 'sym' && (last.v === '=' || last.v === 'sep')) result.pop();
    else if (isWord(last, 'igual', 'cuanto', 'da', 'vale')) result.pop();
    else if (isWord(last, 'a', 'que') && isWord(result.at(-2), 'igual')) result.splice(-2);
    else break;
  }
  return result;
}

const wrap = (node: Node, min: number) => (node.p < min ? `(${node.s})` : node.s);
const inner = (node: Node) => (node.group ? node.s.slice(1, -1) : node.s);
function join(a: Node, op: string, b: Node): Node {
  const prec = op === '*' || op === '/' ? PROD : SUM;
  const left = a.p < prec || (prec === SUM && a.s.endsWith('%')) ? `(${a.s})` : a.s;
  const right =
    b.p < prec || b.p === NEG || (['-', '/', '±'].includes(op) && b.p === prec) ? `(${b.s})` : b.s;
  return { s: `${left}${op}${right}`, p: prec };
}
const powerBase = (node: Node) => (node.p < POST || node.s.endsWith('%') ? `(${node.s})` : node.s);
const exponentText = (node: Node) => (node.p < POW || node.p === NEG ? `(${inner(node)})` : node.s);
const hasVariable = (text: string) => /(?<![a-zA-Z])[xyztn](?![a-zA-Z(])/.test(text);
function pickVariable(text: string) {
  const found: string[] = text.match(/(?<![a-zA-Z])[xyztn](?![a-zA-Z(])/g) ?? [];
  return found.includes('x') ? 'x' : (found[0] ?? 'x');
}

class VoiceParser {
  pos = 0;
  unknown: string[] = [];
  notes: string[] = [];
  private cas = false;
  private budget = 400;
  private stops: ((parser: VoiceParser) => boolean)[] = [];
  constructor(private tokens: Token[]) {}

  private tok(k = 0) {
    return this.tokens[this.pos + k];
  }
  private wordAt(index: number) {
    const token = this.tokens[index];
    return token?.t === 'word' ? token.v : undefined;
  }
  word(k = 0) {
    return this.wordAt(this.pos + k);
  }
  private sym(k = 0) {
    const token = this.tok(k);
    return token?.t === 'sym' ? token.v : undefined;
  }
  at(...words: string[]) {
    return words.every((word, k) => this.word(k) === word);
  }
  private eat(...words: string[]) {
    if (!this.at(...words)) return false;
    this.pos += words.length;
    return true;
  }
  private eatSym(value: string) {
    if (this.sym() !== value) return false;
    this.pos++;
    return true;
  }
  private save() {
    return { pos: this.pos, unknown: this.unknown.length, notes: this.notes.length };
  }
  private restore(state: ReturnType<VoiceParser['save']>) {
    this.pos = state.pos;
    this.unknown.length = state.unknown;
    this.notes.length = state.notes;
  }
  private withStop<T>(stop: (parser: VoiceParser) => boolean, parse: () => T): T {
    this.stops.push(stop);
    try {
      return parse();
    } finally {
      this.stops.pop();
    }
  }
  /** Dentro de un paréntesis no rigen las palabras de corte del contexto exterior. */
  private isolated<T>(parse: () => T): T {
    const outer = this.stops;
    this.stops = [];
    try {
      return parse();
    } finally {
      this.stops = outer;
    }
  }
  private raw(start: number, end = this.pos) {
    return this.tokens
      .slice(start, end)
      .map((token) => token.raw)
      .filter(Boolean)
      .join(' ');
  }
  private note(text: string) {
    if (!this.notes.includes(text)) this.notes.push(text);
  }
  private missing(after: string): Node {
    this.note(`Falta completar después de «${after}».`);
    return { s: '', p: ATOM, missing: true };
  }
  private stopped() {
    const token = this.tok();
    if (!token) return true;
    if (token.t === 'sym' && token.v === ')') return true;
    if (token.t === 'word' && structural.has(token.v)) return true;
    if (this.at('con', 'respecto')) return true;
    if (this.at('y', 'menor') || this.at('y', 'mayor')) return true;
    return this.stops.some((stop) => stop(this));
  }
  private skipNoise() {
    for (;;) {
      const token = this.tok();
      if (token?.t === 'angle') this.pos++;
      else if (token?.t === 'sym' && token.v === 'sep' && !this.stops.some((stop) => stop(this)))
        this.pos++;
      else return;
    }
  }
  private unknownAt(index = this.pos) {
    const token = this.tokens[index];
    return token?.t === 'word' && !vocabulary.has(token.v);
  }
  private readUnknown(): Node {
    const start = this.pos;
    while (this.unknownAt()) this.pos++;
    const raw = this.raw(start);
    this.unknown.push(raw);
    return { s: `«${raw}»`, p: ATOM, unknown: true };
  }
  private phrase<T>(table: [string[], T][], index = this.pos): [number, T] | null {
    for (const [words, value] of table)
      if (words.every((word, k) => this.wordAt(index + k) === word)) return [words.length, value];
    return null;
  }
  private functionAt(index = this.pos) {
    const token = this.tokens[index];
    if (token?.t === 'sym') return ['sqrt', 'cbrt', 'root4'].includes(token.v);
    return (
      !!this.phrase(functionPhrases, index) ||
      (this.wordAt(index) === 'resto' && this.wordAt(index + 1) === 'de')
    );
  }
  private operandAt(index = this.pos) {
    const token = this.tokens[index];
    if (!token) return false;
    if (token.t === 'num') return true;
    if (token.t === 'sym') return ['(', 'sqrt', 'cbrt', 'root4'].includes(token.v);
    if (token.t !== 'word') return false;
    if (!vocabulary.has(token.v)) return true;
    const next = this.wordAt(index + 1);
    if (['abre', 'abrir', 'abro'].includes(token.v)) return next === 'parentesis';
    return !!this.phrase(atoms, index) || this.functionAt(index);
  }
  private commandAt(index = this.pos) {
    const word = this.wordAt(index);
    return (
      (!!word && !!commands[word]) ||
      (!!word && !!ordinals[word] && this.wordAt(index + 1) === 'derivada')
    );
  }
  private closerAt(index = this.pos): { end: number; name?: string } | null {
    const word = this.wordAt(index);
    if (word === 'cierra' || word === 'cerrar' || word === 'cierro')
      return this.wordAt(index + 1) === 'parentesis' ? null : { end: index + 1 };
    if (word !== 'fin') return null;
    // «fin de fracción» cierra la fracción hablada, no la función que la precede.
    const after = [1, 2, 3].map((k) => this.wordAt(index + k));
    if (
      after[0] === 'de' &&
      (after[1] === 'fraccion' || (after[1] === 'la' && after[2] === 'fraccion'))
    )
      return null;
    let j = index + 1;
    if (this.wordAt(j) === 'de' || this.wordAt(j) === 'del') j++;
    const name = closeNames.find((words) => words.every((w, k) => this.wordAt(j + k) === w));
    if (name) {
      j += name.length;
      if (name[0] === 'raiz' && name.length === 1 && ordinals[this.wordAt(j) ?? '']) j++;
      return { end: j, name: name.join(' ') };
    }
    if (genericClosers.has(this.wordAt(j) ?? '')) return { end: j + 1 };
    return { end: index + 1 };
  }

  parse(): string {
    const parts: string[] = [];
    const first = this.statement();
    if (first.s) parts.push(first.s);
    while (this.pos < this.tokens.length) {
      if (this.eatSym(')')) {
        this.note('Sobraba un paréntesis de cierre; se quitó.');
        continue;
      }
      if (this.tok()?.t === 'angle' || this.sym() === 'sep') {
        this.pos++;
        continue;
      }
      const start = this.pos;
      const resumes = () =>
        this.operandAt() || this.commandAt() || this.at('menos') || this.sym() === '-';
      do this.pos++;
      while (
        this.pos < this.tokens.length &&
        !resumes() &&
        this.sym() !== ')' &&
        this.tok()?.t !== 'angle'
      );
      const raw = this.raw(start);
      this.unknown.push(raw);
      parts.push(`«${raw}»`);
      if (resumes()) {
        const next = this.statement();
        if (next.s) parts.push(next.s);
      }
    }
    return parts.join(' ');
  }

  private statement(): Node {
    while (this.word() && leadingFillers.has(this.word()!)) this.pos++;
    if (this.at('resultado', 'de')) this.pos += 2;
    const command = this.command();
    if (command) return command;
    const relation = this.relation();
    return relation ? this.implied(relation) : { s: '', p: ATOM };
  }

  private implied(node: Node): Node {
    const ops = node.rel ?? [];
    if (!ops.length || !hasVariable(node.s)) return node;
    const v = pickVariable(node.s);
    if (ops.length === 1 && ops[0] === '=') {
      if (node.first?.name && !hasVariable(node.s.slice(node.first.s.length + 1))) {
        this.note(
          `Se va a guardar ${spokenVariable[node.first.name] ?? node.first.name} como variable. Para resolver una ecuación, empezá con «resolver».`,
        );
        return node;
      }
      this.note(`Se va a resolver la ecuación para ${spokenVariable[v]}.`);
      return { s: `solve(${node.s},${v})`, p: ATOM };
    }
    if (ops.includes('=') || ops.includes('!=')) return node;
    this.note(`Se va a resolver la desigualdad para ${spokenVariable[v]}.`);
    return { s: `inequality(${node.s},${v})`, p: ATOM };
  }

  private command(): Node | null {
    let order = '';
    const ordinal = this.word();
    if (ordinal && ordinals[ordinal] && this.word(1) === 'derivada') {
      order = String(ordinals[ordinal]);
      this.pos++;
    }
    const name = commands[this.word() ?? ''];
    if (!name) return null;
    this.pos++;
    this.cas = true;
    try {
      if (name === 'diff') return this.derivative(order);
      if (name === 'integrate') return this.integral();
      if (name === 'limit') return this.limit();
      if (name === 'solve') return this.solve();
      while (this.eat('de')) continue;
      const body = this.relation() ?? this.missing(this.raw(this.pos - 1));
      return { s: `${name}(${inner(body)})`, p: ATOM };
    } finally {
      this.cas = false;
    }
  }

  private variable(): string {
    const found = this.phrase(atoms);
    if (found && /^[xyztn]$/.test(found[1])) {
      this.pos += found[0];
      return found[1];
    }
    this.note('Falta la variable; se usó equis.');
    return 'x';
  }
  private respecto() {
    return (
      this.eat('con', 'respecto', 'a') ||
      this.eat('con', 'respecto', 'de') ||
      this.eat('con', 'respecto', 'al') ||
      this.eat('respecto', 'de') ||
      this.eat('respecto', 'a') ||
      this.eat('respecto', 'al') ||
      this.eat('respecto')
    );
  }

  private derivative(order: string): Node {
    const ordinal = this.word();
    if (!order && ordinal && ordinals[ordinal]) {
      order = String(ordinals[ordinal]);
      this.pos++;
    }
    if (this.eat('de', 'orden')) {
      const level = this.word();
      if (level && ordinals[level]) {
        order = String(ordinals[level]);
        this.pos++;
      } else order = this.postfix()?.s ?? order;
    }
    if (!this.eat('de')) this.eat('del');
    const body = this.sum() ?? this.missing('derivada');
    const v = this.respecto() ? this.variable() : pickVariable(body.s);
    return {
      s: `diff(${inner(body)},${v}${order && order !== '1' ? `,${order}` : ''})`,
      p: ATOM,
    };
  }

  private bounds(first: boolean): [Node, Node] | null {
    const state = this.save();
    const until = (stop: (parser: VoiceParser) => boolean) => this.withStop(stop, () => this.sum());
    let lower: Node | null = null;
    if (this.eat('desde')) {
      lower = until((p) => p.at('hasta'));
      if (!this.eat('hasta')) lower = null;
    } else if (this.eat('entre')) {
      lower = until((p) => p.at('y'));
      if (!this.eat('y')) lower = null;
    } else if (this.eat('de')) {
      lower = until((p) => p.at('a') && !p.at('a', 'la'));
      if (!this.eat('a') && !this.eat('hasta')) lower = null;
    }
    const upper = lower && this.sum();
    if (!lower || !upper || (first && !this.at('de') && !this.at('del'))) {
      this.restore(state);
      return null;
    }
    return [lower, upper];
  }

  private integral(): Node {
    if (!this.eat('definida')) this.eat('indefinida');
    let limits = this.bounds(true);
    if (!this.eat('de')) this.eat('del');
    const following = (p: VoiceParser) =>
      p.at('entre') && p.tokens.slice(p.pos + 1).some((t) => t.t === 'word' && t.v === 'y');
    const body = this.withStop(following, () => this.sum()) ?? this.missing('integral');
    let v = '';
    const variableAt = (index: number) => /^[xyztn]$/.test(this.phrase(atoms, index)?.[1] ?? '');
    for (let round = 0; round < 4; round++) {
      this.skipNoise();
      const differential = this.word()?.match(/^d([xyztn])$/)?.[1];
      const later = limits ? null : this.bounds(false);
      if (later) limits = later;
      else if (differential) {
        this.pos++;
        v = differential;
      } else if (this.at('d') && variableAt(this.pos + 1)) {
        this.pos++;
        v = this.variable();
      } else if (this.eat('diferencial', 'de') || this.eat('diferencial')) v = this.variable();
      else if (this.respecto()) v = this.variable();
      else if ((this.at('de') || this.at('del')) && variableAt(this.pos + 1)) {
        this.pos++;
        v = this.variable();
      } else break;
    }
    v ||= pickVariable(body.s);
    return {
      s: `integrate(${inner(body)},${v}${limits ? `,${inner(limits[0])},${inner(limits[1])}` : ''})`,
      p: ATOM,
    };
  }

  private side(): string {
    if (this.eat('por', 'izquierda') || this.eat('desde', 'izquierda')) return 'left';
    if (this.eat('por', 'derecha') || this.eat('desde', 'derecha')) return 'right';
    return '';
  }
  private limit(): Node {
    let side = this.side();
    let v = '',
      point: Node | null = null;
    const approach = () => {
      v = this.variable();
      if (!this.eat('tiende', 'a') && !this.eat('tendiendo', 'a')) this.eat('tiende');
      point = this.sum() ?? this.missing('tiende a');
      side ||= this.side();
    };
    if (this.eat('cuando') || this.eat('con')) approach();
    if (!this.eat('de')) this.eat('del');
    const body = this.sum() ?? this.missing('límite');
    if (!point && (this.eat('cuando') || this.eat('con'))) approach();
    if (!point) {
      this.note('Falta decir a qué tiende la variable, por ejemplo «cuando equis tiende a cero».');
      point = { s: '', p: ATOM, missing: true };
    }
    v ||= pickVariable(body.s);
    return {
      s: `limit(${inner(body)},${v},${inner(point)}${side ? `,${side}` : ''})`,
      p: ATOM,
    };
  }

  private solve(): Node {
    while (this.eat('ecuacion') || this.eat('inecuacion') || this.eat('desigualdad')) continue;
    const relation = this.relation() ?? this.missing('resolver');
    const v =
      this.eat('para') || this.respecto() || this.eat('en')
        ? this.variable()
        : pickVariable(relation.s);
    const inequality = (relation.rel ?? []).some((op) => op !== '=');
    return { s: `${inequality ? 'inequality' : 'solve'}(${relation.s},${v})`, p: ATOM };
  }

  private relationOp(): string | null {
    const orEqual = (a: string) =>
      this.eat(a, 'o', 'igual', 'que') ||
      this.eat(a, 'o', 'igual', 'a') ||
      this.eat(a, 'o', 'igual');
    if (orEqual('menor')) return '<=';
    if (orEqual('mayor')) return '>=';
    if (this.eat('menor', 'que') || this.eat('menor', 'a') || this.eat('menor')) return '<';
    if (this.eat('mayor', 'que') || this.eat('mayor', 'a') || this.eat('mayor')) return '>';
    for (const word of ['distinto', 'diferente'])
      if (this.eat(word, 'de') || this.eat(word, 'a') || this.eat(word)) return '!=';
    if (this.eat('igual', 'a') || this.eat('igual', 'que') || this.eat('igual')) return '=';
    const symbol = this.sym();
    if (symbol && ['=', '<', '>', '<=', '>=', '!='].includes(symbol)) {
      this.pos++;
      return symbol;
    }
    return null;
  }
  private relation(): Node | null {
    const left = this.sum();
    if (!left) return null;
    const ops: string[] = [];
    let node = left;
    for (;;) {
      this.skipNoise();
      if (this.stops.some((stop) => stop(this))) break;
      const start = this.pos;
      const op = this.relationOp();
      if (!op) break;
      const right = this.sum() ?? this.missing(this.raw(start));
      node = { s: `${node.s}${op}${right.s}`, p: REL };
      ops.push(op);
    }
    return ops.length ? { ...node, rel: ops, first: left } : node;
  }

  private sumOp(): string | null {
    if (this.eatSym('±') || this.eat('mas', 'o', 'menos')) return '±';
    if (this.eatSym('+') || this.eat('mas')) return '+';
    if (this.eatSym('-') || this.eat('menos')) return '-';
    return null;
  }
  sum(): Node | null {
    let left = this.product(false);
    if (!left) return null;
    for (;;) {
      this.skipNoise();
      if (this.stopped()) break;
      const start = this.pos;
      const op = this.sumOp();
      if (!op) break;
      if (op === '±') this.plusMinus();
      const right = this.product(false) ?? this.missing(this.raw(start));
      left = join(left, op, right);
    }
    return left;
  }
  private plusMinus() {
    this.note(
      '«Más o menos» no se calcula directamente: calculá por separado con más y con menos.',
    );
  }

  private productOp(): { op: string; length: number } | null {
    const word = this.word(),
      next = this.word(1);
    const symbol = this.sym();
    if (symbol === '*' || symbol === '/') return { op: symbol, length: 1 };
    if (word === 'por')
      return next && ['ciento', 'cien', 'izquierda', 'derecha'].includes(next)
        ? null
        : { op: '*', length: 1 };
    if (word === 'multiplicado') return { op: '*', length: next === 'por' ? 2 : 1 };
    if (word === 'veces') return { op: '*', length: 1 };
    if (word === 'dividido')
      return {
        op: '/',
        length: next && ['por', 'entre', 'en', 'para'].includes(next) ? 2 : 1,
      };
    if (word === 'sobre' || word === 'entre') return { op: '/', length: 1 };
    if (word === 'modulo' || word === 'mod') return { op: 'mod', length: 1 };
    return null;
  }
  private product(tight: boolean): Node | null {
    let left = this.unary();
    if (!left) return null;
    for (;;) {
      const token = this.tok();
      if (token?.t === 'angle') {
        this.pos++;
        if (tight) break;
        continue;
      }
      this.skipNoise();
      if (this.stopped()) break;
      const den = denominator(this.word());
      if (den) {
        this.pos++;
        left = { s: `${wrap(left, PROD)}/${den}`, p: PROD };
        continue;
      }
      const op = this.productOp();
      if (op) {
        if (tight) break;
        const start = this.pos;
        this.pos += op.length;
        const right = this.unary() ?? this.missing(this.raw(start));
        left =
          op.op === 'mod' ? { s: `mod(${left.s},${right.s})`, p: ATOM } : join(left, op.op, right);
        continue;
      }
      if (this.unknownAt()) {
        if (tight) break;
        left = { s: `${left.s} ${this.readUnknown().s}`, p: PROD };
        continue;
      }
      if (!this.operandAt() || (tight && this.functionAt())) break;
      const right = this.unary();
      if (!right) break;
      left = right.unknown
        ? { s: `${left.s} ${right.s}`, p: PROD }
        : left.num && right.letter
          ? { s: `${left.s}${right.s}`, p: PROD }
          : join(left, '*', right);
    }
    return left;
  }

  private unary(): Node | null {
    this.skipNoise();
    if (this.stopped()) return null;
    const start = this.pos;
    if (this.eatSym('±') || this.eat('mas', 'o', 'menos')) {
      this.plusMinus();
      const operand = this.unary() ?? this.missing(this.raw(start));
      return {
        s: `±${operand.p <= SUM || operand.p === NEG ? `(${operand.s})` : operand.s}`,
        p: NEG,
      };
    }
    if (this.eatSym('-') || this.eat('menos')) {
      const operand = this.unary() ?? this.missing(this.raw(start));
      if (operand.powNum)
        this.note(
          `«${this.raw(start)}» se toma como el opuesto de la potencia. Para elevar el número negativo, usá paréntesis.`,
        );
      return {
        s: `-${operand.p <= SUM || operand.p === NEG ? `(${operand.s})` : operand.s}`,
        p: NEG,
      };
    }
    // «el opuesto de 2 al cuadrado» es −(2²): así lo lee la app para no confundirlo con (−2)².
    if (this.eat('el', 'opuesto', 'de') || this.eat('opuesto', 'de')) {
      const operand = this.unary() ?? this.missing(this.raw(start));
      return {
        s: `-${operand.p <= SUM || operand.p === NEG ? `(${operand.s})` : operand.s}`,
        p: NEG,
      };
    }
    if (this.eatSym('+') || this.eat('mas')) return this.unary();
    return this.power();
  }
  // «fracción con numerador A, y denominador B, fin de fracción»: la forma en que la app lee
  // las fracciones compuestas.
  private spokenFraction(start: number): Node {
    const beforeDenominator = (parser: VoiceParser) =>
      parser.at('denominador') || parser.at('y', 'denominador');
    const numerator =
      this.isolated(() => this.withStop(beforeDenominator, () => this.sum())) ??
      this.missing(this.raw(start));
    this.skipNoise();
    this.eat('y');
    if (!this.eat('denominador')) return numerator;
    const closesFraction = (parser: VoiceParser) =>
      parser.at('fin', 'de', 'fraccion') || parser.at('fin', 'de', 'la', 'fraccion');
    const denominator =
      this.isolated(() => this.withStop(closesFraction, () => this.sum())) ??
      this.missing('denominador');
    this.skipNoise();
    if (!this.eat('fin', 'de', 'fraccion')) this.eat('fin', 'de', 'la', 'fraccion');
    return join(numerator, '/', denominator);
  }

  private power(): Node | null {
    let base = this.postfix();
    if (!base) return null;
    for (;;) {
      const start = this.pos;
      let exponent: Node | null;
      if (
        this.eat('al', 'cuadrado') ||
        this.eat('elevado', 'al', 'cuadrado') ||
        this.eat('cuadrado')
      )
        exponent = { s: '2', p: ATOM, num: true };
      else if (this.eat('al', 'cubo') || this.eat('elevado', 'al', 'cubo') || this.eat('cubo'))
        exponent = { s: '3', p: ATOM, num: true };
      else if (
        this.eatSym('^') ||
        this.eat('elevado', 'a', 'la') ||
        this.eat('elevado', 'a') ||
        this.eat('elevado') ||
        this.eat('a', 'la')
      )
        exponent = this.exponent(start) ?? this.missing(this.raw(start));
      else break;
      base = {
        s: `${powerBase(base)}^${exponentText(exponent)}`,
        p: POW,
        powNum: !!base.num,
        letter: !!base.name,
      };
    }
    return base;
  }
  private exponent(start: number): Node | null {
    const word = this.word();
    if (word && ordinals[word] && word !== 'primer') {
      this.pos++;
      return { s: String(ordinals[word]), p: ATOM, num: true };
    }
    if (word === 'enesima' || word === 'enesimo') {
      this.pos++;
      return { s: 'n', p: ATOM, name: 'n' };
    }
    const state = this.save();
    if (this.budget-- > 0) {
      const greedy = this.sum();
      const closer = this.closerAt();
      if (greedy && closer && !closer.name) {
        this.pos = closer.end;
        return greedy.p < POW ? { s: `(${greedy.s})`, p: ATOM, group: true } : greedy;
      }
      this.restore(state);
    }
    const tight = this.unary();
    if (tight && !tight.num && !tight.group && this.sumAhead())
      this.note(
        `«${this.raw(start)}»: lo que sigue queda fuera del exponente. Para incluirlo, terminá con «fin del exponente».`,
      );
    return tight;
  }
  private sumAhead() {
    const state = this.pos;
    this.skipNoise();
    const word = this.word();
    const op =
      ['+', '-'].includes(this.sym() ?? '') ||
      ((word === 'mas' || word === 'menos') && !this.at('mas', 'o', 'menos'));
    const index = this.pos + 1;
    this.pos = state;
    return op && !this.functionAt(index);
  }

  private postfix(): Node | null {
    let base = this.primary();
    if (!base) return null;
    for (;;) {
      if (this.eatSym('!') || this.eat('factorial')) base = { s: `${wrap(base, ATOM)}!`, p: POST };
      else if (
        this.eatSym('%') ||
        this.eat('por', 'ciento') ||
        this.eat('por', 'cien') ||
        this.eat('porciento')
      ) {
        base = { s: `${wrap(base, ATOM)}%`, p: POST };
        if ((this.at('de') || this.at('del')) && this.operandAt(this.pos + 1)) {
          this.pos++;
          base = join(base, '*', this.unary() ?? this.missing('de'));
        }
      } else return base;
    }
  }

  private primary(): Node | null {
    this.skipNoise();
    if (this.stopped()) return null;
    const token = this.tok()!;
    const start = this.pos;
    if (token.t === 'num') {
      this.pos++;
      const den = denominator(this.word());
      if (!den) return { s: token.v, p: ATOM, num: true };
      this.pos++;
      const fraction: Node = { s: `${token.v}/${den}`, p: PROD };
      if ((this.at('de') || this.at('del')) && this.operandAt(this.pos + 1)) {
        this.pos++;
        return join(fraction, '*', this.unary() ?? this.missing('de'));
      }
      return fraction;
    }
    if (token.t === 'sym') {
      if (token.v === '(') {
        this.pos++;
        return this.group();
      }
      if (token.v === 'sqrt' || token.v === 'cbrt') {
        this.pos++;
        return this.call(token.v, this.args(fns[token.v], start));
      }
      if (token.v === 'root4') {
        this.pos++;
        return this.call('root', this.args(fns.root, start), { s: '4', p: ATOM, num: true });
      }
      return null;
    }
    if (token.t !== 'word') return null;
    if (
      this.eat('abre', 'parentesis') ||
      this.eat('abrir', 'parentesis') ||
      this.eat('abro', 'parentesis')
    )
      return this.group();
    if (this.at('resto', 'de')) return this.remainder();
    if (this.eat('fraccion', 'con', 'numerador')) return this.spokenFraction(start);
    const fn = this.phrase(functionPhrases);
    if (fn) {
      this.pos += fn[0];
      return this.functionCall(fn[1], start);
    }
    const atom = this.phrase(atoms);
    if (atom) {
      this.pos += atom[0];
      const letter = /^[xyztn]$/.test(atom[1]);
      return { s: atom[1], p: ATOM, name: letter ? atom[1] : undefined, letter };
    }
    if (this.unknownAt()) return this.readUnknown();
    return null;
  }

  private closeGroup() {
    if (
      this.eatSym(')') ||
      this.eat('cierra', 'parentesis') ||
      this.eat('cerrar', 'parentesis') ||
      this.eat('cierro', 'parentesis')
    )
      return;
    const closer = this.closerAt();
    if (closer && !closer.name && this.word() !== 'fin') this.pos = closer.end;
    else this.note('Faltaba cerrar un paréntesis; se cerró al final.');
  }
  private group(): Node {
    const content = this.isolated(() => this.relation());
    this.closeGroup();
    return { s: `(${content?.s ?? ''})`, p: ATOM, group: true, missing: !content };
  }

  private remainder(): Node {
    const start = this.pos;
    this.pos += 2;
    this.eat('dividir');
    const dividend = this.product(true) ?? this.missing('resto de');
    this.skipNoise();
    const separator = this.productOp();
    if (separator?.op === '/') this.pos += separator.length;
    else this.eat('argumento');
    const divisor = this.product(true) ?? this.missing(this.raw(start));
    const state = this.pos;
    this.skipNoise();
    const closer = this.closerAt();
    if (!closer) this.pos = state;
    if (closer && (!closer.name || closer.name === 'resto')) this.pos = closer.end;
    return { s: `mod(${dividend.s},${divisor.s})`, p: ATOM };
  }

  private functionCall(key: string, start: number): Node {
    let extra: Node | undefined;
    const ordinal = ordinals[this.word() ?? ''];
    if (key === 'sqrt' && this.pos === start + 1 && this.wordAt(start) === 'raiz') {
      if (this.eat('de', 'indice') || this.eat('indice')) {
        key = 'root';
        extra = this.postfix() ?? this.missing('índice');
      } else if (this.eat('enesima') || this.eat('enesimo')) {
        key = 'root';
        extra = { s: 'n', p: ATOM, name: 'n' };
      } else if (ordinal >= 2) {
        this.pos++;
        key = ordinal === 2 ? 'sqrt' : ordinal === 3 ? 'cbrt' : 'root';
        extra = { s: String(ordinal), p: ATOM, num: true };
      }
    }
    const squared =
      this.eat('al', 'cuadrado') || this.eat('cuadrado')
        ? '2'
        : this.eat('al', 'cubo') || this.eat('cubo')
          ? '3'
          : '';
    if (key === 'log') extra = this.logBase();
    if (!this.eat('de')) this.eat('del');
    if (key === 'log') extra ??= this.logBase();
    const args = this.args(fns[key], start);
    if (key === 'log') extra ??= this.logBase();
    const result = this.call(key, args, extra);
    return squared ? { s: `${powerBase(result)}^${squared}`, p: POW } : result;
  }
  private logBase(): Node | undefined {
    if (this.eat('en', 'base') || this.eat('de', 'base') || this.eat('base'))
      return this.postfix() ?? this.missing('base');
    return undefined;
  }

  private args(fn: FnSpec, start: number): Node[] {
    const separator = (p: VoiceParser) =>
      p.sym() === 'sep' || p.at('argumento') || (!!fn.and && p.at('y'));
    const sequence = (tight: boolean) =>
      this.withStop(fn.and ? (p) => p.at('y') : () => false, () => {
        const first = tight ? this.product(true) : this.sum();
        if (!first) return null;
        const list = [first];
        while (list.length < (fn.max ?? 1)) {
          const state = this.pos;
          this.skipNoise();
          if (!(this.eatSym('sep') || this.eat('argumento') || (fn.and && this.eat('y')))) {
            this.pos = state;
            break;
          }
          this.eat('argumento');
          list.push((tight ? this.product(true) : this.sum()) ?? this.missing(fn.spoken));
        }
        return list;
      });
    if (this.sym() === '(') {
      this.pos++;
      const list: Node[] = [];
      this.isolated(() =>
        this.withStop(separator, () => {
          do list.push(this.sum() ?? this.missing(fn.spoken));
          while (
            list.length < (fn.max ?? 1) &&
            (this.eatSym('sep') || this.eat('argumento') || (!!fn.and && this.eat('y')))
          );
        }),
      );
      this.closeGroup();
      return list;
    }
    const state = this.save();
    if (this.budget-- > 0) {
      const greedy = sequence(false);
      const closer = this.closerAt();
      if (greedy && closer && (!closer.name || fn.close.includes(closer.name))) {
        this.pos = closer.end;
        return greedy;
      }
      this.restore(state);
    }
    const tight = sequence(true);
    if (!tight) return [this.missing(this.raw(start))];
    const spoken = this.tokens[start]?.t === 'word';
    if (spoken && !tight[0].group && (this.sumAhead() || this.productAhead()))
      this.note(
        `«${this.raw(start)}»: lo que sigue queda fuera. Para incluirlo, terminá con «fin de ${fn.spoken}».`,
      );
    return tight;
  }
  private productAhead() {
    const state = this.pos;
    this.skipNoise();
    const op = this.productOp();
    const next = op ? this.tokens[this.pos + op.length] : undefined;
    this.pos = state;
    return !!op && op.op !== 'mod' && next?.t === 'num';
  }

  private call(key: string, args: Node[], extra?: Node): Node {
    const values = args.map(inner);
    const root = (index: string): Node => ({ s: `${powerBase(args[0])}^(1/${index})`, p: POW });
    switch (key) {
      case 'factorial':
        return { s: `${wrap(args[0], ATOM)}!`, p: POST };
      case 'square':
      case 'cube':
        return { s: `${powerBase(args[0])}^${fns[key].out}`, p: POW, letter: !!args[0].name };
      case 'cbrt':
        return this.cas ? root('3') : { s: `cbrt(${values[0]})`, p: ATOM };
      case 'root': {
        const index = extra ?? args[1] ?? { s: '2', p: ATOM };
        return this.cas
          ? root(wrap(index, POST))
          : { s: `nthRoot(${values[0]},${inner(index)})`, p: ATOM };
      }
      case 'log': {
        const base = extra ?? args[1];
        return { s: `log(${values[0]}${base ? `,${inner(base)}` : ''})`, p: ATOM };
      }
      default:
        return { s: `${fns[key].out}(${values.join(',')})`, p: ATOM };
    }
  }
}

/** Interpreta un dictado en español sin pegar palabras: lo que no entiende queda marcado. */
export function parseVoice(transcript: string): VoiceParse {
  const notes: string[] = [];
  try {
    const { tokens, angle } = angles(numerals(lex(transcript, notes), notes), notes);
    const parser = new VoiceParser(tidy(tokens));
    const expression = parser.parse();
    return {
      expression,
      unknown: parser.unknown,
      ambiguous: [...new Set([...notes, ...parser.notes])],
      angle,
    };
  } catch {
    const text = transcript.trim();
    return { expression: text ? `«${text}»` : '', unknown: text ? [text] : [], ambiguous: notes };
  }
}

/** Compatibilidad: solo la expresión y la unidad de ángulo. */
export function voiceExpression(transcript: string): { expression: string; angle?: AngleMode } {
  const { expression, angle } = parseVoice(transcript);
  return { expression, angle };
}

/** Elige, entre las alternativas del reconocedor, la que se entiende mejor. */
export function bestVoiceParse(transcripts: string[]): { transcript: string; parsed: VoiceParse } {
  const options = transcripts.filter((text) => text.trim());
  if (!options.length) return { transcript: '', parsed: parseVoice('') };
  const score = (parsed: VoiceParse) =>
    (parsed.expression ? 0 : 1000) + parsed.unknown.length * 100 + parsed.ambiguous.length;
  return options
    .map((transcript) => ({ transcript, parsed: parseVoice(transcript) }))
    .reduce((best, option) => (score(option.parsed) < score(best.parsed) ? option : best));
}

/** La expresión todavía tiene palabras no entendidas (entre «») o está vacía. */
export function voiceBlocked(expression: string): boolean {
  return !expression.trim() || /[«»]/.test(expression);
}

const angleNames: Record<AngleMode, string> = {
  deg: 'grados',
  rad: 'radianes',
  grad: 'gradianes',
};
function list(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0];
}

/** Frases de la revisión del dictado, en el orden en que se muestran y se leen. */
export function voiceSummaryParts(
  parsed: VoiceParse,
  read: (expression: string) => string,
): string[] {
  if (!parsed.expression.trim()) return ['No escuché ninguna expresión. Volvé a dictar.'];
  const parts = parsed.unknown.length
    ? [
        `No entendí ${list(parsed.unknown.map((word) => `«${word}»`))}. Corregí la expresión o volvé a dictar.`,
      ]
    : [`Entendí: ${read(parsed.expression)}.`];
  parts.push(...parsed.ambiguous);
  if (parsed.angle) parts.push(`Modo angular: ${angleNames[parsed.angle]}.`);
  if (!parsed.unknown.length) parts.push('Confirmá, editá o cancelá antes de calcular.');
  return parts;
}
