import { describe, expect, it } from 'vitest';
import {
  convertSeparator,
  normalizeExpression,
  normalizeWithMap,
  rewritePercentages,
} from './expression';

describe('alias en español', () => {
  it.each([
    ['sen(30)', 'sin(30)'],
    ['tg(45)', 'tan(45)'],
    ['cotg(1) + ctg(2)', 'cot(1) + cot(2)'],
    ['cosec(1)+sec(1)+csc(1)', 'csc(1)+sec(1)+csc(1)'],
    ['arcsen(1)+arcsin(1)+arccos(0)', 'asin(1)+asin(1)+acos(0)'],
    ['arctg(1)+arctan(1)', 'atan(1)+atan(1)'],
    ['senh(1)+tgh(1)+asinh(1)', 'sinh(1)+tanh(1)+asinh(1)'],
    ['nCr(5,2)+nPr(5,2)', 'combinations(5,2)+permutations(5,2)'],
    ['raíz(9)', 'sqrt(9)'],
    ['derivada(x^2,x)', 'diff(x^2,x)'],
    ['infinito', 'Infinity'],
    ['1/inf', '1/Infinity'],
  ])('%s → %s', (input, expected) => expect(normalizeExpression(input)).toBe(expected));

  it.each([
    ['sen2=5', 'sen2=5'],
    ['x_inf=3', 'x_inf=3'],
    ['derivada=3', 'derivada=3'],
    ['tangente2*2', 'tangente2*2'],
    ['seno', 'seno'],
  ])('no deforma nombres de variables: %s', (input, expected) =>
    expect(normalizeExpression(input)).toBe(expected),
  );
});

describe('símbolos Unicode', () => {
  it.each([
    ['√16', 'sqrt(16)'],
    ['√(x+1)', 'sqrt(x+1)'],
    ['√√16', 'sqrt(sqrt(16))'],
    ['√2√2', 'sqrt(2)sqrt(2)'],
    ['√-4', 'sqrt(-4)'],
    ['√sin(x)', 'sqrt(sin(x))'],
    ['∛27', 'cbrt(27)'],
    ['∜16', 'nthRoot(16,4)'],
    ['5²', '5^2'],
    ['x³+1', 'x^3+1'],
    ['x⁻¹', 'x^-1'],
    ['2·3×4÷6', '2*3*4/6'],
    ['3−1', '3-1'],
    ['|-3|', 'abs(-3)'],
    ['|x|·|y|', 'abs(x)*abs(y)'],
    ['||x|-1|', 'abs(abs(x)-1)'],
    ['2|x-1|', '2abs(x-1)'],
    ['2π', '2 pi'],
    ['π', 'pi'],
    ['x≤3', 'x<=3'],
  ])('%s → %s', (input, expected) => expect(normalizeExpression(input)).toBe(expected));

  it('avisa una barra de valor absoluto sin cerrar', () => {
    const mapped = normalizeWithMap('2+|x');
    expect(mapped.issues[0].code).toBe('parentesis');
    expect(mapped.issues[0].position).toBe(3);
  });
});

describe('coma decimal', () => {
  const coma = { decimalSeparator: 'coma' as const };
  it.each([
    ['2,5+1', '2.5+1'],
    ['3,14', '3.14'],
    ['max(3;5)', 'max(3,5)'],
    ['max(3,5; 2)', 'max(3.5, 2)'],
    ['[[1;2];[3;4]]', '[[1,2],[3,4]]'],
    ['[1,5; 2,5; 3,5]', '[1.5, 2.5, 3.5]'],
    ['log(8;2)', 'log(8,2)'],
    ['convert(1,5;"degC";"K")', 'convert(1.5,"degC","K")'],
    ['2.5+1', '2.5+1'],
  ])('%s → %s', (input, expected) => expect(normalizeExpression(input, coma)).toBe(expected));

  it('con punto deja la coma como separador de argumentos', () => {
    expect(normalizeExpression('max(3,5)')).toBe('max(3,5)');
    expect(normalizeExpression('[1,2;3,4]')).toBe('[1,2;3,4]');
  });
  it('no toca los textos entre comillas', () =>
    expect(normalizeExpression('base("1,2;3";10;2)', coma)).toBe('base("1,2;3",10,2)'));
});

describe('resultado anterior', () => {
  it('reemplaza ans y resultado como palabras completas', () => {
    expect(normalizeExpression('ans*2', { ans: '5' })).toBe('(5)*2');
    expect(normalizeExpression('Resultado+1', { ans: '3/10' })).toBe('(3/10)+1');
    expect(normalizeExpression('answer+ans2', { ans: '5' })).toBe('answer+ans2');
  });
  it('normaliza el valor anterior con el mismo separador', () =>
    expect(normalizeExpression('ans*2', { ans: '2,5', decimalSeparator: 'coma' })).toBe('(2.5)*2'));
  it('sin resultado anterior informa con posición', () => {
    const mapped = normalizeWithMap('3+ans', { ans: null });
    expect(mapped.issues[0].message).toMatch(/Todavía no hay un resultado anterior/);
    expect(mapped.issues[0].code).toBe('sin-resultado');
    expect(mapped.issues[0].position).toBe(3);
  });
  it('no reemplaza el nombre en una asignación ni deja de leerlo si no se pide', () => {
    expect(normalizeExpression('ans=3', { ans: '5' })).toBe('ans=3');
    expect(normalizeExpression('ans*2')).toBe('ans*2');
  });
});

describe('mapa de posiciones', () => {
  it('cada carácter normalizado apunta al original', () => {
    const source = '  arcsen(1)+√16 ';
    const mapped = normalizeWithMap(source);
    expect(mapped.text).toBe('asin(1)+sqrt(16)');
    expect(mapped.map[mapped.text.indexOf('+')]).toBe(source.indexOf('+'));
    expect(mapped.map[mapped.text.indexOf('16')]).toBe(source.indexOf('16'));
    expect(mapped.map[mapped.text.length]).toBe(source.trimEnd().length);
  });
});

describe('porcentajes', () => {
  const rewrite = (input: string, separator?: string) =>
    rewritePercentages(normalizeWithMap(input), separator);
  it.each([
    ['50%', '_pct(50)'],
    ['50%+50%', '_pct(50)+_pct(50)'],
    ['50+10%', '50+_pct(10)'],
    ['200*15%', '200*_pct(15)'],
    ['10%*50', '_pct(10)*50'],
    ['2^3%', '_pct(2^3)'],
    ['(2+3)%', '_pct((2+3))'],
    ['sin(30)%', '_pct(sin(30))'],
    ['2x%', '2_pct(x)'],
    ['-50%', '-_pct(50)'],
  ])('%s → %s', (input, expected) => expect(rewrite(input).text).toBe(expected));

  it('el resto entre dos operandos pide usar mod', () => {
    const issue = rewrite('5%3').issues[0];
    expect(issue.message).toBe('El signo % es porcentaje. Para el resto usá mod(5, 3).');
    expect(issue.code).toBe('resto');
    expect(issue.position).toBe(2);
    expect(rewrite('5 % 3', ';').issues[0].message).toContain('mod(5; 3)');
  });
  it('no toca expresiones sin porcentaje', () => expect(rewrite('2+3').text).toBe('2+3'));
});

describe('convertSeparator', () => {
  it.each([
    ['2.5', '2,5'],
    ['-0.25', '-0,25'],
    ['1.5e-7', '1,5e-7'],
    ['1/3', '1/3'],
    ['[1.5, 2]', '[1,5; 2]'],
    ['[[-2, 1], [1.5, -0.5]]', '[[-2; 1]; [1,5; -0,5]]'],
    ['2 + 3.5i', '2 + 3,5i'],
  ])('%s ↔ %s', (punto, coma) => {
    expect(convertSeparator(punto, 'punto', 'coma')).toBe(coma);
    expect(convertSeparator(coma, 'coma', 'punto')).toBe(punto);
  });
  it('no cambia nada si el separador es el mismo', () => {
    expect(convertSeparator('2,5', 'coma', 'coma')).toBe('2,5');
    expect(convertSeparator('[1, 2]', 'punto', 'punto')).toBe('[1, 2]');
  });
});

describe('grados sexagesimales', () => {
  it.each([
    ['30°', 'dms(30,0,0)'],
    [`12°30'45"`, 'dms(12,30,45)'],
    ['sin(45°)', 'sin(dms(45,0,0))'],
    ['12° 30′', 'dms(12,30,0)'],
  ])('%s → %s', (input, expected) => expect(normalizeExpression(input)).toBe(expected));
  it('con coma decimal acepta 12,5°', () =>
    expect(normalizeExpression('12,5°', { decimalSeparator: 'coma' })).toBe('dms(12.5,0,0)'));
});
