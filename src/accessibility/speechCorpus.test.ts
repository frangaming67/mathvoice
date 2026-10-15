import { describe, expect, it } from 'vitest';
import { parse } from 'mathjs';
import { mathSpeech } from './MathSpeechFormatter';
import { fractionName, periodicDecimal, speakPeriodic } from './numberSpeech';

// Corpus de referencia: invariantes que toda lectura debe cumplir.
const functions = [
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'sqrt',
  'cbrt',
  'abs',
  'ln',
  'log',
  'log10',
  'log2',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'gamma',
  'factorial',
];
const arguments_ = ['x', '2', 'x+1', 'x^2', '1/2', '-x'];
const corpus = [
  ...functions.flatMap((name) => arguments_.map((arg) => `${name}(${arg})`)),
  ...functions.slice(0, 12).map((name) => `${name}(x)+${name}(2*x)`),
  ...functions.slice(0, 8).map((name) => `${name}(x)^2`),
  '2^x+1',
  '2^(x+1)',
  'x^(2+1)',
  'e^x/2',
  'e^(x/2)',
  'x^n/2',
  '-2^2',
  '(-2)^2',
  'x^2^3',
  '1/(1+1/(1+1/x))',
  '(a+b)/(c+d)',
  'a+b/c+d',
  '(1/3)*x^3 + C',
  '2x+3y-4z',
  '2(x+1)(x-1)',
  '3*x^2-5*x+6',
  'log(8,2)',
  'nthRoot(27,3)',
  'nthRoot(x+1,5)',
  'max(1,2,3)',
  'min(x,y)',
  'gcd(12,18)',
  'lcm(4,6)',
  'mod(7,3)',
  'combinations(10,3)',
  'permutations(5,2)',
  'mean([1,2,3,4])',
  'median([3,1,2])',
  'std([1,2,3],"uncorrected")',
  'variance([1,2,3])',
  'det([[1,2],[3,4]])',
  'inv([[1,2],[3,4]])',
  'transpose([[1,2,3]])',
  'dot([1,2,3],[4,5,6])',
  'cross([1,0,0],[0,1,0])',
  'norm([3,4])',
  'conj(3+4i)',
  're(2-5i)',
  'im(2-5i)',
  'arg(1+i)',
  'normalcdf(1.96,0,1)',
  'binomialpdf(2,5,0.5)',
  'poissonpdf(3,2.5)',
  'convert(25,"degC","degF")',
  'base("255",10,2)',
  'stats([1,2,3,4,5],1)',
  'fraction(1,3)+fraction(1,6)',
  'mixed(fraction(7,3))',
  'diff(x^5,x,2)',
  'integrate(sin(x),x,0,pi)',
  'limit(sin(x)/x,x,0)',
  'series(exp(x),x,0,4)',
  'solve(x^2-4=0,x)',
  'system(x+y=10,x-y=4)',
  'inequality(x^2-4<=0,x)',
  'x = 2; y = -3',
  '1.5e-12',
  '123456789012345678',
  '0.000001234',
  '3.14159*2.71828',
  '50%',
  '5!',
  'Infinity',
  'x>=2',
  '-2<=x<3',
];

const english =
  /\b(sqrt|sin|cos|tan|cbrt|log|ln|abs|exp|floor|ceil|round|sign|mean|median|std|variance|det|inv|transpose|dot|cross|norm|conj|nthRoot|combinations|permutations|Infinity|NaN|undefined|null|_n\d+_|_pct)\b/;

describe('corpus de lectura matemática', () => {
  it('tiene al menos 150 expresiones', () => expect(corpus.length).toBeGreaterThanOrEqual(150));
  it.each(corpus)('%s se lee completa, en español y con sus cifras', (expression) => {
    const spoken = mathSpeech(expression);
    let parses = true;
    try {
      parse(expression);
    } catch {
      parses = false;
    }
    if (parses) expect(spoken).not.toContain('Expresión incompleta');
    expect(spoken).not.toMatch(english);
    const compact = spoken.replace(/\s+/g, '');
    // Los números cortos pueden decirse con palabras («al cuadrado», «un medio»); los largos
    // deben conservar todas sus cifras.
    const literals = expression.replace(/"[^"]*"/g, '').match(/(?<![\w.])\d+(?:\.\d+)?/g) ?? [];
    for (const literal of literals.filter((text) => text.length >= 3)) {
      const [integer, decimals] = literal.split('.');
      expect(compact).toContain(integer);
      if (decimals) expect(compact).toContain(decimals);
    }
  });
});

describe('fracciones y decimales periódicos', () => {
  it('nombra fracciones simples', () => {
    expect(fractionName('1', '2')).toBe('un medio');
    expect(fractionName('3', '4')).toBe('3 cuartos');
    expect(fractionName('-7', '10')).toBe('menos 7 décimos');
    expect(fractionName('1', '11')).toBeNull();
    expect(fractionName('25', '4')).toBeNull();
  });
  it('encuentra el período exacto con enteros grandes', () => {
    expect(periodicDecimal('1', '3')).toEqual({
      negative: false,
      integer: '0',
      head: '',
      period: '3',
    });
    expect(periodicDecimal('1', '6')).toEqual({
      negative: false,
      integer: '0',
      head: '1',
      period: '6',
    });
    expect(periodicDecimal('-7', '2')).toEqual({
      negative: true,
      integer: '3',
      head: '5',
      period: '',
    });
    expect(periodicDecimal('123456789012345678901', '1')?.integer).toBe('123456789012345678901');
    expect(speakPeriodic(periodicDecimal('1', '7')!)).toBe('0 coma 1 4 2 8 5 7 periódico');
    expect(speakPeriodic(periodicDecimal('1', '17')!)).toBeNull();
  });
});
