import { describe, expect, it } from 'vitest';
import {
  bestVoiceParse,
  parseVoice,
  voiceBlocked,
  voiceExpression,
  voiceSummaryParts,
} from './voiceExpression';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';

it.each([
  ['dos más dos', '2+2'],
  ['raíz cuadrada de ciento cuarenta y cuatro', 'sqrt(144)'],
  ['seno de treinta grados', 'sin(30)'],
  ['derivada de equis al cuadrado', 'diff(x^2,x)'],
  ['integral de equis al cubo', 'integrate(x^3,x)'],
  ['resolver equis al cuadrado menos cuatro igual a cero', 'solve(x^2-4=0,x)'],
])('interpreta %s sin ejecutar cálculos', (text, expression) =>
  expect(voiceExpression(text).expression).toBe(expression),
);
it('preserva la unidad angular detectada', () =>
  expect(voiceExpression('seno de treinta grados').angle).toBe('deg'));
it.each([
  ['dos coma cero cinco más uno', '2.05+1'],
  ['cero punto cero cero uno', '0.001'],
  ['dos coma veinticinco', '2.25'],
])('preserva cifras decimales: %s', (text, expected) =>
  expect(voiceExpression(text).expression).toBe(expected),
);

describe('no pega palabras ni inventa identificadores (HM-2)', () => {
  it.each([
    ['derivada de seno de equis', 'diff(sin(x),x)'],
    ['integral de seno de equis', 'integrate(sin(x),x)'],
    ['derivada de equis al cuadrado por seno de equis', 'diff(x^2*sin(x),x)'],
    ['integral de equis al cuadrado de cero a uno', 'integrate(x^2,x,0,1)'],
    ['diez por ciento', '10%'],
    ['diez por cien', '10%'],
    ['cien por ciento', '100%'],
    ['dos por ciento veinte', '2*120'],
    ['veinticinco por ciento de doscientos', '25%*200'],
    ['cincuenta por ciento más uno', '(50%)+1'],
    ['tres coma catorce dieciséis', '3.1416'],
    ['5!', '5!'],
    ['¡dos más dos!', '2+2'],
  ])('%s → %s', (text, expected) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expected);
    expect(parsed.unknown).toEqual([]);
  });
  it('marca como dudosa una lista de cifras sueltas', () => {
    const parsed = parseVoice('uno dos tres');
    expect(parsed.expression).toBe('123');
    expect(parsed.ambiguous).toContain('«uno dos tres» se tomó como 123.');
  });
  it('avisa que menos dos al cuadrado eleva solo el dos', () => {
    const parsed = parseVoice('menos dos al cuadrado');
    expect(parsed.expression).toBe('-2^2');
    expect(parsed.ambiguous[0]).toContain('opuesto de la potencia');
  });
  it('avisa el punto de miles de los reconocedores', () => {
    const parsed = parseVoice('2.500 + 1');
    expect(parsed.expression).toBe('2500+1');
    expect(parsed.ambiguous[0]).toContain('punto de miles');
  });
});

describe('palabras no entendidas', () => {
  it.each([
    ['derivada de senodex', 'diff(«senodex»,x)', ['senodex']],
    ['dos más patata', '2+«patata»', ['patata']],
    ['dos por patata frita más tres', '2*«patata frita»+3', ['patata frita']],
    ['hola', '«hola»', ['hola']],
    ['veinte centígrados', '20 «centígrados»', ['centígrados']],
    ['el doble de x', '«doble» «de» x', ['doble', 'de']],
    ['x mayor que 3 y menor que 5', 'inequality(x>3,x) «y menor que» 5', ['y menor que']],
  ])('%s', (text, expression, unknown) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expression);
    expect(parsed.unknown).toEqual(unknown);
    expect(voiceBlocked(parsed.expression)).toBe(true);
  });
  it('el propio aviso de escucha no se convierte en una expresión', () => {
    const parsed = parseVoice('Escuchando. Dictá una expresión matemática.');
    expect(parsed.unknown).toContain('expresión');
    expect(voiceBlocked(parsed.expression)).toBe(true);
  });
  it('centígrados no activa el modo grados', () =>
    expect(parseVoice('veinte centígrados').angle).toBeUndefined());
  it('una transcripción vacía no tiene expresión', () =>
    expect(parseVoice('  ')).toEqual({ expression: '', unknown: [], ambiguous: [] }));
});

describe('frases en cualquier posición (HM-6, LP-8)', () => {
  it.each([
    ['raíz cúbica de veintisiete', 'cbrt(27)'],
    ['raíz cúbica de ocho', 'cbrt(8)'],
    ['logaritmo en base dos de ocho', 'log(8,2)'],
    ['logaritmo de ocho en base dos', 'log(8,2)'],
    ['logaritmo de x de base 2', 'log(x,2)'],
    ['logaritmo de cien', 'log(100)'],
    ['logaritmo decimal de mil', 'log(1000)'],
    ['logaritmo natural de equis', 'ln(x)'],
    ['ln de dos', 'ln(2)'],
    ['exponencial de uno', 'exp(1)'],
    ['tres cuartos más un medio', '3/4+1/2'],
    ['un medio más un tercio', '1/2+1/3'],
    ['tres medios más un cuarto', '3/2+1/4'],
    ['siete décimos', '7/10'],
    ['siete octavos más un dieciseisavo', '7/8+1/16'],
    ['cinco onceavos', '5/11'],
    ['tres milésimas', '3/1000'],
    ['dos tercios de nueve', '2/3*9'],
    ['tres cuartos al cuadrado', '(3/4)^2'],
    ['uno sobre dos tercios', '1/(2/3)'],
    ['tres sobre cuatro', '3/4'],
    ['veinte entre cuatro', '20/4'],
    ['seis dividido entre dos', '6/2'],
    ['seis dividido dos', '6/2'],
    ['nueve multiplicado por tres', '9*3'],
    ['cuatro veces cinco', '4*5'],
    ['factorial de cinco', '5!'],
    ['cinco factorial', '5!'],
    ['n factorial', 'n!'],
    ['factorial de n más uno fin de factorial', '(n+1)!'],
    ['valor absoluto de menos tres', 'abs(-3)'],
    ['siete módulo tres', 'mod(7,3)'],
    ['equis módulo dos', 'mod(x,2)'],
    ['resto de siete entre tres', 'mod(7,3)'],
    ['resto de dividir diez entre tres', 'mod(10,3)'],
    ['equis a la quinta', 'x^5'],
    ['equis a la dos', 'x^2'],
    ['equis elevado a la n', 'x^n'],
    ['equis elevado al cuadrado', 'x^2'],
    ['dos elevado a diez', '2^10'],
    ['diez a la menos tres', '10^(-3)'],
    ['equis a la menos uno', 'x^(-1)'],
    ['dos elevado a abre paréntesis n más uno cierra paréntesis', '2^(n+1)'],
    ['equis cuadrado más ye cuadrado', 'x^2+y^2'],
    ['el cuadrado de tres', '3^2'],
    ['seno cuadrado de equis', 'sin(x)^2'],
    ['un millón', '1000000'],
    ['mil millones', '1000000000'],
    ['un millón doscientos mil', '1200000'],
    ['dos coma cinco millones', '2500000'],
    ['mil novecientos ochenta y cuatro', '1984'],
    ['dos mil veinticinco', '2025'],
    ['dos mil tres', '2003'],
    ['seiscientos sesenta y seis', '666'],
    ['quinientos dos', '502'],
    ['2 mil 500', '2500'],
    ['tres punto catorce', '3.14'],
    ['tres coma catorce', '3.14'],
    ['treinta y tres coma tres', '33.3'],
    ['noventa y nueve coma nueve', '99.9'],
    ['dos y medio por cuatro', '2.5*4'],
    ['arco seno de uno', 'asin(1)'],
    ['arcotangente de uno', 'atan(1)'],
    ['seno hiperbólico de cero', 'sinh(0)'],
    ['tangente hiperbólica de uno', 'tanh(1)'],
    ['número e', 'e'],
    ['número áureo', 'phi'],
    ['infinito', 'Infinity'],
    ['unidad imaginaria al cuadrado', 'i^2'],
    ['cos de cero', 'cos(0)'],
    ['tg de x', 'tan(x)'],
    ['dos por seno de treinta grados', '2*sin(30)'],
    ['seno de treinta más coseno de sesenta', 'sin(30)+cos(60)'],
    ['seno de equis por coseno de equis', 'sin(x)*cos(x)'],
    ['seno de equis más uno fin de seno', 'sin(x+1)'],
    ['raíz cuadrada de equis más uno cierra', 'sqrt(x+1)'],
    ['seno de abre paréntesis equis más uno cierra paréntesis', 'sin(x+1)'],
    ['logaritmo de equis más uno fin de logaritmo', 'log(x+1)'],
    ['raíz cúbica de equis al cuadrado fin', 'cbrt(x^2)'],
    ['raíz de dos por raíz de tres', 'sqrt(2)*sqrt(3)'],
    ['seno de pi medios', 'sin(pi/2)'],
    ['pi medios', 'pi/2'],
    ['tres pi cuartos', '3*pi/4'],
    ['dos pi', '2*pi'],
    ['raíz de índice cuatro de dieciséis', 'nthRoot(16,4)'],
    ['raíz cuarta de dieciséis', 'nthRoot(16,4)'],
    ['raíz enésima de equis', 'nthRoot(x,n)'],
    ['máximo común divisor de doce y dieciocho', 'gcd(12,18)'],
    ['mínimo común múltiplo de cuatro y seis', 'lcm(4,6)'],
    ['redondeo de dos coma cinco', 'round(2.5)'],
    ['signo de menos cinco', 'sign(-5)'],
    ['equis sobre dos', 'x/2'],
    ['dos equis más tres', '2x+3'],
    ['tres equis al cuadrado menos dos equis más uno', '3x^2-2x+1'],
    ['equis por ye', 'x*y'],
    ['x por y por z', 'x*y*z'],
    ['t al cuadrado', 't^2'],
    ['menos equis', '-x'],
    ['dos menos menos tres', '2-(-3)'],
    ['diez menos tres más dos', '10-3+2'],
    ['abre paréntesis dos más tres cierra paréntesis por cuatro', '(2+3)*4'],
    ['dos por abre paréntesis tres más cuatro cierra paréntesis', '2*(3+4)'],
    ['resultado anterior por dos', 'ans*2'],
    ['resultado anterior al cuadrado', 'ans^2'],
    ['respuesta anterior dividido dos', 'ans/2'],
    ['uno coma cinco por diez a la seis', '1.5*10^6'],
    ['cuánto es dos más dos', '2+2'],
    ['cuánto da siete por ocho', '7*8'],
    ['siete por ocho cuánto da', '7*8'],
    ['dos más dos igual', '2+2'],
    ['calculá la raíz cuadrada de 81', 'sqrt(81)'],
    ['el seno de equis', 'sin(x)'],
    ['la raíz cuadrada de dos', 'sqrt(2)'],
  ])('%s → %s', (text, expected) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expected);
    expect(parsed.unknown).toEqual([]);
  });
  it('la función toma solo lo inmediato y avisa cómo abarcar más', () => {
    const parsed = parseVoice('seno de equis más uno');
    expect(parsed.expression).toBe('sin(x)+1');
    expect(parsed.ambiguous).toEqual([
      '«seno de equis»: lo que sigue queda fuera. Para incluirlo, terminá con «fin de seno».',
    ]);
    expect(parseVoice('seno de pi sobre dos').expression).toBe('sin(pi)/2');
    expect(parseVoice('valor absoluto de equis menos tres').ambiguous[0]).toContain(
      '«fin de valor absoluto»',
    );
  });
  it('avisa el alcance de un exponente que no es un número', () => {
    const parsed = parseVoice('equis a la n más uno');
    expect(parsed.expression).toBe('x^n+1');
    expect(parsed.ambiguous[0]).toContain('«fin del exponente»');
    expect(parseVoice('equis a la dos más uno').ambiguous).toEqual([]);
  });
  it('más o menos se marca como dudoso', () => {
    const parsed = parseVoice('más o menos dos');
    expect(parsed.expression).toBe('±2');
    expect(parsed.ambiguous[0]).toContain('Más o menos');
  });
  it.each([
    ['dos más', '2+', 'Falta completar después de «más».'],
    ['abre paréntesis dos más tres', '(2+3)', 'Faltaba cerrar un paréntesis; se cerró al final.'],
    ['dos más tres)', '2+3', 'Sobraba un paréntesis de cierre; se quitó.'],
  ])('avisa una expresión incompleta: %s', (text, expression, note) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expression);
    expect(parsed.ambiguous).toContain(note);
  });
});

describe('cálculo y álgebra', () => {
  it.each([
    ['límite de seno de equis sobre equis cuando equis tiende a cero', 'limit(sin(x)/x,x,0)'],
    ['límite cuando equis tiende a cero de seno de equis sobre equis', 'limit(sin(x)/x,x,0)'],
    ['límite cuando x tiende a 0 de sen x sobre x', 'limit(sin(x)/x,x,0)'],
    ['límite cuando equis tiende a infinito de uno sobre equis', 'limit(1/x,x,Infinity)'],
    ['límite de uno sobre equis cuando equis tiende a menos infinito', 'limit(1/x,x,-Infinity)'],
    ['límite cuando equis tiende a cero por la derecha de uno sobre equis', 'limit(1/x,x,0,right)'],
    [
      'límite por la izquierda cuando equis tiende a cero de uno sobre equis',
      'limit(1/x,x,0,left)',
    ],
    ['integral desde cero hasta pi de seno de equis', 'integrate(sin(x),x,0,pi)'],
    ['integral definida de cero a pi de seno de equis', 'integrate(sin(x),x,0,pi)'],
    ['integral de cero a uno de equis al cuadrado', 'integrate(x^2,x,0,1)'],
    ['integral de seno de equis de cero a pi', 'integrate(sin(x),x,0,pi)'],
    ['integral de equis al cuadrado desde menos uno hasta uno', 'integrate(x^2,x,-1,1)'],
    ['integral de equis entre cero y uno', 'integrate(x,x,0,1)'],
    ['integral de equis al cuadrado de equis', 'integrate(x^2,x)'],
    ['integral de e a la equis dx', 'integrate(e^x,x)'],
    ['integral de uno sobre equis', 'integrate(1/x,x)'],
    ['integral de equis por e a la equis', 'integrate(x*e^x,x)'],
    ['derivada de ye al cuadrado respecto de ye', 'diff(y^2,y)'],
    ['derivada de equis al cuadrado con respecto a equis', 'diff(x^2,x)'],
    ['derivada de x por ye respecto de ye', 'diff(x*y,y)'],
    ['derivada de equis al cubo más dos equis', 'diff(x^3+2x,x)'],
    ['segunda derivada de equis al cubo', 'diff(x^3,x,2)'],
    ['derivada segunda de seno de equis', 'diff(sin(x),x,2)'],
    ['derivada de orden dos de equis al cubo', 'diff(x^3,x,2)'],
    ['derivada de raíz cúbica de equis', 'diff(x^(1/3),x)'],
    ['resolver dos equis más uno igual a cinco', 'solve(2x+1=5,x)'],
    ['resolver la ecuación equis más dos igual a cinco', 'solve(x+2=5,x)'],
    ['resolver x al cuadrado igual a 9 para x', 'solve(x^2=9,x)'],
    ['resolver equis más ye igual a tres para ye', 'solve(x+y=3,y)'],
    ['resolver equis al cuadrado menor que cuatro', 'inequality(x^2<4,x)'],
    ['simplificar equis más equis', 'simplify(x+x)'],
    ['factorizar equis al cuadrado menos uno', 'factor(x^2-1)'],
  ])('%s → %s', (text, expected) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expected);
    expect(parsed.unknown).toEqual([]);
  });
  it.each([
    ['x igual a dos', 'x=2', 'Se va a guardar equis como variable.'],
    ['ye igual a tres', 'y=3', 'Se va a guardar ye como variable.'],
    [
      'equis al cuadrado igual a cuatro',
      'solve(x^2=4,x)',
      'Se va a resolver la ecuación para equis.',
    ],
    ['tres x más dos igual a ocho', 'solve(3x+2=8,x)', 'Se va a resolver la ecuación'],
    ['equis menor que tres', 'inequality(x<3,x)', 'Se va a resolver la desigualdad para equis.'],
    ['equis mayor o igual que dos', 'inequality(x>=2,x)', 'desigualdad'],
    ['equis menor o igual a cuatro', 'inequality(x<=4,x)', 'desigualdad'],
  ])('un «igual» sin «resolver» se avisa: %s', (text, expression, note) => {
    const parsed = parseVoice(text);
    expect(parsed.expression).toBe(expression);
    expect(parsed.ambiguous.join(' ')).toContain(note);
  });
});

describe('lo que devuelven los reconocedores', () => {
  it.each([
    ['2 x 3', '2*3'],
    ['3²', '3^2'],
    ['√16', 'sqrt(16)'],
    ['√(x+1)', 'sqrt(x+1)'],
    ['x²+2x+1', 'x^2+2x+1'],
    ['Derivada de x³', 'diff(x^3,x)'],
    ['10⁻³', '10^(-3)'],
    ['3,5 + 2', '3.5+2'],
    ['3.5 × 2', '3.5*2'],
    ['10 ÷ 4', '10/4'],
    ['1,5', '1.5'],
    ['1.000.000', '1000000'],
    ['1.234,56', '1234.56'],
    ['3,125', '3.125'],
    ['1/2 + 1/3', '1/2+1/3'],
    ['2^10', '2^10'],
    ['(2+3)*4', '(2+3)*4'],
    ['sen(30) + cos(60)', 'sin(30)+cos(60)'],
    ['sin(30)', 'sin(30)'],
    ['log(8, 2)', 'log(8,2)'],
    ['e^x', 'e^x'],
    ['2x', '2x'],
    ['dos x', '2x'],
    ['seno de x', 'sin(x)'],
    ['x al cubo menos x', 'x^3-x'],
    ['2 + 2 =', '2+2'],
    ['ans más uno', 'ans+1'],
    ['x mayor que 3 y menor que 5', 'inequality(x>3,x) «y menor que» 5'],
  ])('%s → %s', (text, expected) => expect(parseVoice(text).expression).toBe(expected));
  it.each([
    ['seno de 30°', 'deg'],
    ['seno de 45º', 'deg'],
    ['seno de treinta grados sexagesimales', 'deg'],
    ['coseno de pi radianes', 'rad'],
    ['tangente de cuarenta y cinco grados', 'deg'],
  ])('%s detecta la unidad de ángulo', (text, angle) => expect(parseVoice(text).angle).toBe(angle));
  it('dos unidades de ángulo distintas quedan sin modo y se avisan', () => {
    const parsed = parseVoice('seno de treinta grados más coseno de sesenta radianes');
    expect(parsed.angle).toBeUndefined();
    expect(parsed.ambiguous[0]).toContain('más de una unidad de ángulo');
  });
});

describe('lo que la app lee en voz alta se puede dictar de vuelta', () => {
  it.each([
    '2+3',
    'sin(x+1)',
    'sin(x)+1',
    'sin(x)^2',
    'log(8,2)',
    'sqrt(x)+1',
    '(x+1)^2',
    '(x+1)/(x-1)',
    '2^(n+1)',
    '10^(-3)',
    'diff(x^2,x)',
    'diff(sin(x),x)',
    'diff(x^3,x,2)',
    'integrate(x^2,x,0,1)',
    'limit(sin(x)/x,x,0)',
    'limit(1/x,x,0,right)',
    'solve(x^2=4,x)',
    '3.5*2',
    '5!',
    'x^4',
    '-x',
    '2/3',
    'abs(-3)',
    'cbrt(8)',
    'ln(x)',
    'asin(1)',
    'e^x',
    'pi/2',
    'x^2+2*x+1',
    'mod(7,3)',
    'tan(x)*2',
    'e^2',
    '-2^2',
    '(-2)^2',
    'x^(2+1)',
    'sin(x)/cos(x)',
  ])('%s', (expression) => expect(parseVoice(mathSpeech(expression)).expression).toBe(expression));
  it('exp(1) se lee «e a la 1» y se dicta de vuelta como su equivalente e^1', () =>
    expect(parseVoice(mathSpeech('exp(1)')).expression).toBe('e^1'));
});

describe('alternativas y resumen', () => {
  it('elige la alternativa que se entiende mejor', () => {
    const best = bestVoiceParse(['seno de x más dos patatas', 'seno de x más dos', '']);
    expect(best.transcript).toBe('seno de x más dos');
    expect(best.parsed.expression).toBe('sin(x)+2');
  });
  it('ante un empate se queda con la primera alternativa', () =>
    expect(bestVoiceParse(['dos más dos', 'dos más tres']).transcript).toBe('dos más dos'));
  it('sin alternativas devuelve una revisión vacía', () =>
    expect(bestVoiceParse(['', ' ']).parsed.expression).toBe(''));
  it('el resumen dice lo entendido, los avisos y el modo angular', () =>
    expect(voiceSummaryParts(parseVoice('seno de treinta grados'), (e) => `<${e}>`)).toEqual([
      'Entendí: <sin(30)>.',
      'Modo angular: grados.',
      'Confirmá, editá o cancelá antes de calcular.',
    ]));
  it('el resumen nombra las palabras que no entendió', () =>
    expect(voiceSummaryParts(parseVoice('derivada de senodex más pepe'), (e) => e)).toEqual([
      'No entendí «senodex» y «pepe». Corregí la expresión o volvé a dictar.',
    ]));
  it('el resumen de un dictado vacío pide volver a dictar', () =>
    expect(voiceSummaryParts(parseVoice(''), (e) => e)).toEqual([
      'No escuché ninguna expresión. Volvé a dictar.',
    ]));
  it.each([
    ['2+3', false],
    ['', true],
    ['  ', true],
    ['2+«patata»', true],
    ['diff(«senodex»,x)', true],
  ])('voiceBlocked(%s) = %s', (expression, blocked) =>
    expect(voiceBlocked(expression)).toBe(blocked),
  );
});
