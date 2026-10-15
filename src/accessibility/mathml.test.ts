import { describe, expect, it } from 'vitest';
import { toLatex, toMathML } from './mathml';

// Verificador simple de XML bien formado: etiquetas balanceadas y bien anidadas.
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  for (const [, closing, name, selfClosing] of xml.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
    if (selfClosing) continue;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}
const body = (expression: string) => toMathML(expression)!.replace(/^<math[^>]*>|<\/math>$/g, '');

describe('toMathML', () => {
  it('arma fracciones, potencias, raíces y valor absoluto', () => {
    expect(body('1/3')).toBe('<mfrac><mn>1</mn><mn>3</mn></mfrac>');
    expect(body('(x+1)/(x-1)')).toBe(
      '<mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mrow><mi>x</mi><mo>−</mo><mn>1</mn></mrow></mfrac>',
    );
    expect(body('x^2')).toBe('<msup><mi>x</mi><mn>2</mn></msup>');
    expect(body('sqrt(2)')).toBe('<msqrt><mn>2</mn></msqrt>');
    expect(body('nthRoot(8,3)')).toBe('<mroot><mn>8</mn><mn>3</mn></mroot>');
    expect(body('abs(x)')).toBe('<mrow><mo>|</mo><mi>x</mi><mo>|</mo></mrow>');
  });
  it('usa aplicación de función y multiplicación invisible', () => {
    expect(body('sin(x)')).toBe('<mrow><mi>sin</mi><mo>&#x2061;</mo><mi>x</mi></mrow>');
    expect(body('2x')).toBe('<mrow><mn>2</mn><mo>&#x2062;</mo><mi>x</mi></mrow>');
    expect(body('pi')).toBe('<mi>π</mi>');
  });
  it('representa matrices, soluciones múltiples y resultados del CAS', () => {
    expect(body('[[1,2],[3,4]]')).toContain('<mtable><mtr><mtd><mn>1</mn></mtd>');
    expect(body('x = -2; x = 1')).toContain('<mo separator="true">;</mo>');
    expect(wellFormed(toMathML('(1/3)*x^3 + C')!)).toBe(true);
    expect(wellFormed(toMathML('integrate(sqrt(4-x^2),x,0,2)')!)).toBe(true);
    expect(toMathML('integrate(sqrt(4-x^2),x,0,2)')).toContain('<msubsup><mo>∫</mo>');
    expect(toMathML('diff(x^3,x)')).toContain('<mfrac><mi>d</mi>');
  });
  it('conserva las cifras y respeta la coma decimal', () => {
    expect(body('123456789012345678')).toBe('<mn>123456789012345678</mn>');
    expect(body('2.5')).toBe('<mn>2.5</mn>');
    expect(toMathML('2.5', { decimalSeparator: 'coma' })).toContain('<mn>2,5</mn>');
  });
  it('agrega el texto alternativo escapado y devuelve null si no puede', () => {
    expect(toMathML('x<2', { alttext: 'equis menor que 2 & más' })).toContain(
      'alttext="equis menor que 2 &amp; más"',
    );
    expect(toMathML('sqrt(')).toBeNull();
    expect(toMathML('')).toBeNull();
  });
  it('produce XML bien formado para un corpus variado', () => {
    for (const expression of [
      'sin(x)^2+cos(x)^2',
      'log(8,2)',
      'e^(-x^2)',
      '5!',
      'x >= 2',
      '-2 <= x < 3',
      'x = 2 ± 1',
      'asin(0.5)',
      'limit(sin(x)/x,x,0)',
      '[1,2,3]',
      'mod(7,3)',
      '1.5e-12',
    ])
      expect(wellFormed(toMathML(expression) ?? '<math></math>')).toBe(true);
  });
});

describe('toLatex', () => {
  it.each([
    ['1/3', '\\frac{1}{3}'],
    ['x^2+1', '{x}^{2} + 1'],
    ['sqrt(x+1)', '\\sqrt{x + 1}'],
    ['sin(x)', '\\sin x'],
    ['log(8,2)', '\\log_{2}8'],
    ['2x', '2x'],
    ['3*x', '3 \\cdot x'],
    ['pi/2', '\\frac{\\pi}{2}'],
    ['[[1,2],[3,4]]', '\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}'],
    ['x = -2; x = 1', 'x = -2;\\quad x = 1'],
    ['x <= 2', 'x \\le 2'],
  ])('%s → %s', (expression, expected) => expect(toLatex(expression)).toBe(expected));
  it('respeta la coma decimal y devuelve null si no puede', () => {
    expect(toLatex('2.5', { decimalSeparator: 'coma' })).toBe('2{,}5');
    expect(toLatex('sqrt(')).toBeNull();
  });
});
