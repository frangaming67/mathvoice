import { describe, expect, it } from 'vitest';
import { mathSpeech } from './MathSpeechFormatter';
it('lee operaciones simbólicas y soluciones sin símbolos ambiguos', () => {
  expect(mathSpeech('limit(1/x,x,0,left)')).toContain('Límite por izquierda');
  expect(mathSpeech('limit(1/x,x,0,right)')).toContain('Límite por derecha');
  expect(mathSpeech('integrate(x^2,x)')).toBe('Integral de equis al cuadrado, respecto de equis');
  expect(mathSpeech('limit(sin(x)/x,x,0)')).toContain('Límite cuando equis tiende a 0');
  expect(mathSpeech('x = 2; y = -3')).toBe('equis igual a 2. ye igual a menos 3');
  expect(mathSpeech('system(x+y=10,x-y=4)')).toContain('Ecuación 2: equis menos ye igual a 4');
});
it('conserva la agrupación y habla potencias', () => {
  expect(mathSpeech('x^2 + 3*x - 5')).toBe('equis al cuadrado más 3 por equis menos 5');
  expect(mathSpeech('2*(3+4)')).toContain('abre paréntesis, 3 más 4, cierra paréntesis');
});
it('lee funciones y números decimales', () => {
  expect(mathSpeech('raiz(25)')).toContain('raíz cuadrada de 25');
  expect(mathSpeech('2.5')).toBe('2 coma 5');
});
it('tolera entradas incompletas sin calcular', () => {
  expect(mathSpeech('sqrt(')).toContain('Expresión incompleta');
  expect(mathSpeech('')).toContain('vacía');
});
it('distingue desigualdades, comparaciones encadenadas y ecuaciones', () => {
  expect(mathSpeech('x>=2')).toBe('equis mayor o igual que 2');
  expect(mathSpeech('x≤2')).toBe('equis menor o igual que 2');
  expect(mathSpeech('-2<=x<3')).toBe('menos 2 menor o igual que equis menor que 3');
  expect(mathSpeech('x!=3')).toBe('equis distinto de 3');
  expect(mathSpeech('x==3')).toBe('equis igual a 3');
  expect(mathSpeech('inequality(x^2-4<=0,x)')).toBe(
    'Resolver la desigualdad equis al cuadrado menos 4 menor o igual que 0 para equis',
  );
});
it('explica Taylor, las raíces complejas y los números mixtos', () => {
  expect(mathSpeech('series(sin(x),x,0,5)')).toContain('Polinomio de Taylor de orden 5');
  expect(mathSpeech('series(sin(x),x,0,5)')).toContain('centrado en 0');
  expect(mathSpeech('nthRoots(3+4i,2)')).toBe('Raíces complejas de índice 2 de 3 más 4 i');
  expect(mathSpeech('mixedNumber(-2,1,3)')).toBe('Número mixto: menos 2 enteros y un tercio');
  expect(mathSpeech('mixed(7/3)')).toContain('forma mixta de 7 tercios');
});
it('lee exponentes científicos con su signo y matrices por filas', () => {
  expect(mathSpeech('1.5e-12')).toBe('1 coma 5 por diez a la menos 12');
  expect(mathSpeech('-6.022e23')).toBe('menos 6 coma 0 2 2 por diez a la 23');
  expect(mathSpeech('2e+4')).toBe('2 por diez a la 4');
  expect(mathSpeech('[[1,2],[3,4]]')).toBe(
    'matriz de 2 por 2. Fila 1: 1 y 2. Fila 2: 3 y 4. Fin de matriz',
  );
});

describe('lectura sin ambigüedad al oído', () => {
  it('no confunde una suma de funciones con una expresión incompleta', () => {
    for (const expression of [
      'sin(x)+cos(x)',
      'sqrt(2)*sqrt(3)',
      'log(x)-log(y)',
      'abs(x)+abs(y)',
      'sin(x)/cos(x)',
      'sqrt(x^2+1)/(x-1)',
    ])
      expect(mathSpeech(expression)).not.toContain('incompleta');
    expect(mathSpeech('sin(x)+cos(x)')).toBe('seno de equis más coseno de equis');
  });
  it('marca dónde termina un exponente compuesto', () => {
    expect(mathSpeech('2^x+1')).toBe('2 a la equis más 1');
    expect(mathSpeech('2^(x+1)')).toBe('2 elevado a equis más 1, fin del exponente');
    expect(mathSpeech('x^(2+1)')).not.toBe(mathSpeech('x^2+1'));
    expect(mathSpeech('x^4')).toBe('equis a la cuarta');
    expect(mathSpeech('x^-1')).toBe('1 sobre equis');
  });
  it('distingue el opuesto de una potencia de la potencia de un negativo', () => {
    expect(mathSpeech('-2^2')).toBe('el opuesto de 2 al cuadrado');
    expect(mathSpeech('(-2)^2')).toBe('abre paréntesis, menos 2, cierra paréntesis al cuadrado');
  });
  it('nombra fracciones simples y delimita las compuestas', () => {
    expect(mathSpeech('3/4')).toBe('3 cuartos');
    expect(mathSpeech('1/2')).toBe('un medio');
    expect(mathSpeech('x/2')).toBe('equis sobre 2');
    expect(mathSpeech('(a+b)/(c+d)')).toBe(
      'fracción con numerador a más be, y denominador ce más de, fin de fracción',
    );
    expect(mathSpeech('a+b/c')).toBe('a más be sobre ce');
    expect(mathSpeech('(1/3)*x^3')).toBe('un tercio por equis al cubo');
  });
  it('lee la multiplicación implícita y las potencias de funciones como en clase', () => {
    expect(mathSpeech('2x+3')).toBe('2 equis más 3');
    expect(mathSpeech('2pi')).toBe('2 pi');
    expect(mathSpeech('sin(x)^2')).toBe('seno al cuadrado de equis');
    expect(mathSpeech('sin(x^2)')).toBe('seno de equis al cuadrado, fin de seno');
  });
});

describe('nombres en español con el papel de cada argumento', () => {
  it.each([
    ['log(8,2)', 'logaritmo en base 2 de 8'],
    ['log(100)', 'logaritmo decimal de 100'],
    ['ln(x)', 'logaritmo natural de equis'],
    ['nthRoot(8,3)', 'raíz cúbica de 8'],
    ['nthRoot(16,4)', 'raíz de índice 4 de 16'],
    ['factorial(5)', '5 factorial'],
    ['max(1,2)', 'máximo entre 1 y 2'],
    ['combinations(5,2)', 'combinaciones de 5 tomados de a 2'],
    ['convert(5,"cm","inch")', 'convertir 5 centímetros a pulgadas'],
    ['base("255",10,16)', 'convertir 255 de base 10 a base 16'],
    ['mean([1,2,3])', 'media de lista de 3 elementos: 1, 2 y 3, fin de lista'],
    ['theta+alpha', 'theta más alfa'],
    ['exp(x)', 'e a la equis'],
    ['50%', '50 por ciento'],
  ])('%s → %s', (expression, expected) => expect(mathSpeech(expression)).toBe(expected));
});

describe('números y valores especiales', () => {
  it('conserva las cifras de los enteros grandes', () => {
    expect(mathSpeech('123456789012345678')).toBe('123456789012345678');
    expect(mathSpeech('12345678901234567890+1')).toBe('12345678901234567890 más 1');
  });
  it('lee los decimales cifra por cifra', () => {
    expect(mathSpeech('3.14159')).toBe('3 coma 1 4 1 5 9');
    expect(mathSpeech('3.14159', { significant: 3 })).toBe('3 coma 14');
  });
  it('lee infinito, NaN y más o menos en español', () => {
    expect(mathSpeech('Infinity')).toBe('infinito');
    expect(mathSpeech('-Infinity')).toBe('menos infinito');
    expect(mathSpeech('NaN')).toBe('no es un número');
    expect(mathSpeech('∞')).toBe('infinito');
    expect(mathSpeech('x = 2 ± 1')).toBe('equis igual a 2 más o menos 1');
    expect(mathSpeech('limit(1/x,x,inf)')).toContain('tiende a infinito');
  });
});

describe('nivel de detalle', () => {
  it('omite las marcas de cierre en el nivel mínimo y las agrega en el detallado', () => {
    expect(mathSpeech('sin(x^2)', { verbosity: 'minimal' })).toBe('seno de equis al cuadrado');
    expect(mathSpeech('sin(x)', { verbosity: 'detailed' })).toBe('seno de equis, fin de seno');
    expect(mathSpeech('sin(x)')).toBe('seno de equis');
  });
});

it('dice grados sexagesimales y sumatorias', () => {
  expect(mathSpeech(`12°30'45"`)).toBe('12 grados 30 minutos 45 segundos');
  expect(mathSpeech('sum(x^2, x, 1, 10)')).toBe(
    'sumatoria para equis desde 1 hasta 10 de equis al cuadrado',
  );
});

it('dice la tabla de valores con sus funciones y su recorrido', () => {
  expect(mathSpeech('table(x^2, -3, 3, 1)')).toBe(
    'tabla de valores de equis al cuadrado, para equis desde menos 3 hasta 3 con paso 1',
  );
  expect(mathSpeech('table(x^2, 2x, 0, 1, 0.5)')).toBe(
    'tabla de valores de equis al cuadrado y de 2 equis, para equis desde 0 hasta 1 con paso 0 coma 5',
  );
});
