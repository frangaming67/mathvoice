import { describe, expect, it } from 'vitest';
import { MathEngine } from './MathEngine';
import { MathInputError } from './mathErrors';
import { math, userMath } from './mathRuntime';
import type { AngleMode, EvaluateOptions } from '../types';
const engine = new MathEngine();
describe('Motor de fase 1', () => {
  it.each([
    ['2+2', '4'],
    ['sqrt(144)', '12'],
    ['sin(pi/2)', '1'],
    ['2^10', '1024'],
    ['factorial(5)', '120'],
    ['1/3 + 1/6', '1/2'],
    ['0.1 + 0.2', '0.3'],
    ['raiz(25)', '5'],
    ['log(100)', '2'],
    ['ln(e)', '1'],
    ['log(8,2)', '3'],
    ['gcd(12,18)', '6'],
    ['lcm(3,4)', '12'],
    ['25%', '0.25'],
    ['2*(3+4)', '14'],
    ['-(-2)', '2'],
  ])('%s → %s', (expression, value) => {
    expect(engine.evaluate(expression).value).toBe(value);
  });
  it('aplica grados y gradianes también a funciones inversas', () => {
    expect(Number(engine.evaluate('sen(30)', 'deg').value)).toBeCloseTo(0.5);
    expect(Number(engine.evaluate('asin(0.5)', 'deg').value)).toBeCloseTo(30);
    expect(Number(engine.evaluate('sin(100)', 'grad').value)).toBeCloseTo(1);
    expect(Number(engine.evaluate('acos(0)', 'grad').value)).toBeCloseTo(100);
  });
  it('no convierte funciones hiperbólicas', () => {
    expect(engine.evaluate('sinh(1)', 'deg').value).toBe(engine.evaluate('sinh(1)', 'rad').value);
  });
  it.each([
    '',
    'sqrt(',
    '1/0',
    'log(0)',
    'sin(0,1)',
    'ln(1,2)',
    'import("x")',
    'evaluate("2+2")',
    '2;3',
    'factorial(10000)',
  ])('rechaza con error legible: %s', (expression) => {
    expect(() => engine.evaluate(expression)).toThrow();
  });
  it('rechaza entradas extensas', () =>
    expect(() => engine.evaluate('1'.repeat(10001))).toThrow('larga'));
});

const opts = (extra: Partial<EvaluateOptions> = {}): EvaluateOptions => ({
  angle: 'rad',
  ...extra,
});
const fails = (expression: string, options: EvaluateOptions | AngleMode = 'rad') => {
  try {
    engine.evaluate(expression, options);
  } catch (error) {
    return error as MathInputError;
  }
  throw new Error(`«${expression}» no falló`);
};

describe('opciones de evaluación', () => {
  it('acepta la firma vieja y el objeto de opciones', () => {
    expect(engine.evaluate('sin(90)', 'deg').value).toBe('1');
    expect(engine.evaluate('sin(90)', opts({ angle: 'deg' })).value).toBe('1');
    expect(engine.evaluate('2+2', opts(), {}).value).toBe('4');
  });
});

describe('errores de sintaxis con posición sobre el texto original', () => {
  it.each([
    ['sqrt(2', 'Falta cerrar 1 paréntesis abierto en la posición 5.', 5],
    ['2+', 'Falta un número después de «más», al final.', 3],
    ['3*(4+5))', 'Sobra un paréntesis de cierre en la posición 8.', 8],
    [
      '3,5+1',
      '3,5: con separador punto escribí 3.5, o activá la coma decimal en Configuración.',
      2,
    ],
  ])('%s', (expression, message, position) => {
    const error = fails(expression);
    expect(error).toBeInstanceOf(MathInputError);
    expect(error.message).toBe(message);
    expect(error.position).toBe(position);
  });
  it('ubica el nombre desconocido', () => {
    const error = fails('2+foo(3)');
    expect(error.code).toBe('funcion');
    expect(error.position).toBe(3);
  });
});

describe('ecuaciones en el campo principal', () => {
  it('resuelve una ecuación con una sola incógnita', () => {
    const result = engine.evaluate('x^2-5x+6=0');
    expect(result.value).toContain('x = 2');
    expect(result.value).toContain('x = 3');
    expect(result.expression).toBe('x^2-5x+6=0');
  });
  it('x=5 sigue siendo una asignación y x=2x-3 es una ecuación', () => {
    expect(engine.evaluate('x=5').assigned).toEqual({ name: 'x', value: 5 });
    expect(engine.evaluate('x=2x-3').value).toContain('x = 3');
  });
  it('usa los valores guardados de las otras letras', () =>
    expect(engine.evaluate('a*x=6', 'rad', { a: 2 }).value).toContain('x = 3'));
  it('explica cuando hay más de una incógnita', () =>
    expect(fails('x+y=3').message).toMatch(/más de una incógnita: x y y/));
  it('compara dos lados numéricos', () => {
    expect(engine.evaluate('2+3=5').value).toBe('Verdadero');
    expect(engine.evaluate('2+3=6').value).toBe('Falso');
  });
});

describe('resultado anterior', () => {
  it('ans y resultado usan el último valor', () => {
    expect(engine.evaluate('ans*2', opts({ ans: '5' })).value).toBe('10');
    expect(engine.evaluate('resultado+1', opts({ ans: '3/10' })).value).toBe('13/10');
  });
  it('sin resultado anterior lo dice', () => {
    const error = fails('ans*2');
    expect(error.message).toMatch(/^Todavía no hay un resultado anterior/);
    expect(error.code).toBe('sin-resultado');
  });
  it('no se puede guardar una variable llamada ans', () =>
    expect(fails('ans=3', opts({ ans: '5' })).message).toMatch(/reservado/));
});

describe('coma decimal', () => {
  const coma = opts({ decimalSeparator: 'coma' });
  it('lee la coma decimal y el punto y coma como separador', () => {
    expect(engine.evaluate('2,5+1', coma).value).toBe('3,5');
    expect(engine.evaluate('max(3;5)', coma).value).toBe('5');
    expect(engine.evaluate('log(8;2)', coma).value).toBe('3');
    expect(engine.evaluate('det([[1;2];[3;4]])', coma).value).toBe('-2');
    expect(engine.evaluate('mean([1,5;2,5;3,5])', coma).value).toBe('2,5');
  });
  it('muestra listas y matrices con coma y punto y coma', () => {
    const inverse = engine.evaluate('inv([[1;2];[3;4]])', coma);
    expect(inverse.value).toBe('[[-2; 1]; [1,5; -0,5]]');
    expect(inverse.matrix).toEqual([
      ['-2', '1'],
      ['1,5', '-0,5'],
    ]);
  });
  it.each(['1/3+0,25', 'sqrt(2)', '[1,5; 2,25]', 'inv([[2;0];[0;4]])', '2,5e-7', '-(3/7)'])(
    'ida y vuelta: %s',
    (expression) => {
      const first = engine.evaluate(expression, coma);
      const again = engine.evaluate(first.value, coma);
      expect(again.value).toBe(first.value);
    },
  );
  it('marca los resultados escritos con coma para poder reutilizarlos', () => {
    expect(engine.evaluate('2,5+1', coma).separator).toBe('coma');
    expect(engine.evaluate('2.5+1', opts()).separator).toBeUndefined();
    expect(engine.evaluate('ans*2', opts({ decimalSeparator: 'coma', ans: '2,5' })).value).toBe(
      '5',
    );
  });
  it('en modo punto la tabla de estadística avisa de la coma', () =>
    expect(fails('mean([1,5;2,5;3,5])').message).toMatch(/tabla de 3 filas y 2 columnas.*coma/));
});

describe('decimal y fracción exacta', () => {
  it('con decimales responde en decimal y guarda la fracción', () => {
    const result = engine.evaluate('0.1+0.2');
    expect(result.value).toBe('0.3');
    expect(result.exact).toBe('3/10');
    expect(engine.evaluate('-3.75+1').value).toBe('-2.75');
    expect(engine.evaluate('123.456').value).toBe('123.456');
  });
  it('con una división de denominador chico responde en fracción y decimal', () => {
    const result = engine.evaluate('1/3');
    expect(result.value).toBe('1/3');
    expect(result.decimal).toBe('0.3333333333');
  });
  it('el decimal sale de la fracción y no del float', () => {
    expect(engine.evaluate('0.1+0.2-0.3').value).toBe('0');
    expect(engine.evaluate('1/3-0.333333333333333').value).toBe('3.333333333e-16');
    expect(engine.evaluate('3.14159*2.71828').value).toBe('8.539721265');
  });
  it('propaga la división por cero del cálculo exacto', () => {
    const error = fails('1/(0.1+0.2-0.3)');
    expect(error.message).toBe('No se puede dividir por cero.');
    expect(error.code).toBe('division-por-cero');
  });
  it('una fracción enorme no termina en Infinity', () => {
    const harmonic = Array.from({ length: 300 }, (_, i) => `1/${i + 1}`).join('+');
    const result = engine.evaluate(harmonic);
    expect(result.value).toBe('6.28266388');
    expect(result.exact).toBeUndefined();
  });
  it('respeta la forma elegida', () => {
    expect(engine.evaluate('1/4', opts({ resultForm: 'decimal' })).value).toBe('0.25');
    expect(engine.evaluate('1/4', opts({ resultForm: 'decimal' })).exact).toBeUndefined();
    const exact = engine.evaluate('0.25', opts({ resultForm: 'exacto' }));
    expect([exact.value, exact.decimal]).toEqual(['1/4', undefined]);
    const both = engine.evaluate('0.25', opts({ resultForm: 'ambos' }));
    expect([both.value, both.decimal]).toEqual(['1/4', '0.25']);
  });
});

describe('formato numérico', () => {
  it('normal usa 10 cifras significativas por defecto', () =>
    expect(engine.evaluate('sqrt(8)').value).toBe('2.828427125'));
  it('fijo y científico', () => {
    expect(engine.evaluate('sqrt(8)', opts({ numberFormat: 'fijo', numberDigits: 2 })).value).toBe(
      '2.83',
    );
    expect(engine.evaluate('2/4', opts({ numberFormat: 'fijo', numberDigits: 3 })).decimal).toBe(
      '0.500',
    );
    expect(
      engine.evaluate('12345.678', opts({ numberFormat: 'cientifico', numberDigits: 3 })).value,
    ).toBe('1.23e4');
  });
  it('reales y complejos con la misma precisión', () => {
    const complex = engine.evaluate('sqrt(2)+sqrt(2)*i');
    expect(complex.value).toBe('1.414213562 + 1.414213562i');
    expect(complex.complex).toBe(true);
  });
  it('no borra constantes muy chicas', () =>
    expect(engine.evaluate('k_B').value).toBe('1.380649e-23'));
});

describe('trigonometría en grados y gradianes', () => {
  it.each([
    ['sin(180)', 'deg', '0'],
    ['cos(90)', 'deg', '0'],
    ['tan(180)', 'deg', '0'],
    ['sin(36000030)', 'deg', '0.5'],
    ['cos(100)', 'grad', '0'],
    ['sin(pi)', 'rad', '0'],
    ['cos(pi/2)', 'rad', '0'],
    ['tg(45)', 'deg', '1'],
    ['cotg(45)', 'deg', '1'],
    ['cosec(90)', 'deg', '1'],
    ['sec(0)', 'rad', '1'],
    ['arcsen(1)', 'deg', '90'],
  ])('%s en %s → %s', (expression, angle, value) =>
    expect(engine.evaluate(expression, angle as AngleMode).value).toBe(value),
  );
  it('la tangente no está definida en los múltiplos impares de 90 grados', () => {
    expect(fails('tan(90)', 'deg').message).toBe('La tangente no está definida en 90 grados.');
    expect(fails('tan(-270)', 'deg').message).toBe('La tangente no está definida en -270 grados.');
    expect(fails('tan(100)', 'grad').message).toBe(
      'La tangente no está definida en 100 gradianes.',
    );
    expect(fails('tan(pi/2)').code).toBe('dominio');
  });
  it('las inversas fuera de [-1, 1] en grados son un error de dominio', () => {
    const error = fails('asin(2)', 'deg');
    expect(error.code).toBe('dominio');
    expect(error.message).toMatch(/entre -1 y 1/);
  });
  it('rect, arg y polar respetan el modo angular', () => {
    expect(engine.evaluate('rect(1,90)', 'deg').value).toBe('i');
    expect(engine.evaluate('arg(i)', 'deg').value).toBe('90');
    expect(engine.evaluate('polar(i)', 'deg').table).toEqual([
      { label: 'Módulo', value: '1' },
      { label: 'Argumento en grados', value: '90' },
    ]);
  });
});

describe('modo real y modo complejo', () => {
  it('las raíces impares de negativos son reales', () => {
    expect(engine.evaluate('(-8)^(1/3)').value).toBe('-2');
    expect(engine.evaluate('(-8)^(2/3)').value).toBe('4');
    expect(engine.evaluate('(-27)^(1/3)').value).toBe('-3');
  });
  it('explica los resultados no reales', () => {
    const error = fails('sqrt(-4)');
    expect(error.message).toBe(
      'La raíz cuadrada de un número negativo no es real. Activá el modo complejo para obtener 2i.',
    );
    expect(error.code).toBe('no-real');
    expect(fails('ln(-1)').message).toMatch(/^El logaritmo de un número negativo no es real/);
    expect(fails('(-4)^(1/2)').code).toBe('no-real');
    expect(fails('acosh(0.5)').code).toBe('no-real');
  });
  it('con i o funciones complejas explícitas acepta el complejo', () => {
    const result = engine.evaluate('sqrt(-4)+i');
    expect(result.value).toBe('3i');
    expect(result.complex).toBe(true);
  });
  it('en modo complejo marca el resultado', () => {
    const result = engine.evaluate('(-8)^(1/3)', opts({ numberMode: 'complejo' }));
    expect(result.value).toBe('1 + 1.732050808i');
    expect(result.complex).toBe(true);
  });
});

describe('seguridad', () => {
  it.each([
    'a="evaluate(\'7*6\')"',
    "a=\"derivative('x^3','x')\"",
    '"abc"',
    'createUnit("foo")',
    'import({})',
  ])('rechaza %s', (expression) => expect(() => engine.evaluate(expression)).toThrow());
  it('guarda el número calculado, sin volver a interpretarlo', () =>
    expect(engine.evaluate('b=sqrt(2)').assigned?.value).toBe(Math.SQRT2));
  it('la instancia de la persona está endurecida y la interna sigue funcionando', () => {
    expect(() => userMath().instance.evaluate('2+2')).toThrow('no está disponible');
    expect(userMath().parse('2+2').compile().evaluate()).toBe(4);
    expect(math.evaluate('2+2')).toBe(4);
    expect(math.unit(1, 'kcal').toNumber('J')).toBe(4184);
  });
  it('acepta textos solo donde corresponden', () => {
    expect(engine.evaluate('std([1,2,3],"uncorrected")').value).toBe('0.8164965809');
    expect(fails('sqrt("4")').code).toBe('texto');
  });
});

describe('mensajes específicos', () => {
  const overflow = 'El resultado es demasiado grande: excede 10 elevado a 308.';
  it.each([
    ['factorial(171)', overflow],
    ['exp(710)', overflow],
    ['2^1024', overflow],
    ['0/0', '0 dividido por 0 no está definido.'],
    ['1/(1-1)', 'No se puede dividir por cero.'],
    ['inv([[1,2],[2,4]])', 'La matriz es singular (su determinante es 0): no tiene inversa.'],
    [
      'lusolve([[1,2],[2,4]],[1,2])',
      'La matriz del sistema es singular: el sistema no tiene solución única.',
    ],
    [
      'multiply([[1,2],[3,4]],[[1,2,3]])',
      'Para multiplicar, las columnas de A (2) deben coincidir con las filas de B (1).',
    ],
    [
      '[[1,2],[3,4]]*[[1,2,3]]',
      'Para multiplicar, las columnas de A (2) deben coincidir con las filas de B (1).',
    ],
    [
      '[[1,2],[3,4]]+[[1,2,3]]',
      'Para sumar, A y B deben tener el mismo tamaño: A tiene 2 filas y 2 columnas y B tiene 1 fila y 3 columnas.',
    ],
    [
      'det([[1,2,3],[4,5,6]])',
      'El determinante necesita una matriz cuadrada; A tiene 2 filas y 3 columnas.',
    ],
    [
      'cross([1,2],[3,4])',
      'El producto vectorial (cross) necesita dos vectores de 3 componentes; A tiene 2 y B tiene 2.',
    ],
    [
      'dot([1,2,3],[1,2])',
      'El producto escalar (dot) necesita vectores del mismo largo: A tiene 3 componentes y B tiene 2.',
    ],
    ['combinations(3,10)', 'En combinaciones, k (10) no puede ser mayor que n (3).'],
    ['factorial(-1)', 'El factorial solo está definido para enteros no negativos.'],
    ['gcd(0.5,1)', 'El máximo común divisor necesita números enteros.'],
    [
      'nthRoot(-16,4)',
      'La raíz par de un número negativo no es real. Para ver las raíces complejas usá nthRoots(-16, 4).',
    ],
    ['median([])', 'La lista está vacía: escribí al menos un número.'],
    ['log(0)', 'El logaritmo de 0 no está definido.'],
  ])('%s', (expression, message) => expect(fails(expression).message).toBe(message));
});

describe('notación habitual', () => {
  it.each([
    ['log10(1000)', '3'],
    ['log2(8)', '3'],
    ['gamma(5)', '24'],
    ['nCr(5,2)', '10'],
    ['nPr(5,2)', '20'],
    ['√16', '4'],
    ['5²', '25'],
    ['∛27', '3'],
    ['2·3', '6'],
    ['6÷4', '3/2'],
    ['|-3|', '3'],
    ['2π', '6.283185307'],
    ['asinh(0)', '0'],
  ])('%s → %s', (expression, value) => expect(engine.evaluate(expression).value).toBe(value));
  it('los alias no cambian nombres de variables', () => {
    expect(engine.evaluate('sen2=5').assigned?.name).toBe('sen2');
    expect(engine.evaluate('x_inf=3').assigned?.name).toBe('x_inf');
    expect(engine.evaluate('sen2*2', 'rad', { sen2: 5 }).value).toBe('10');
  });
});

describe('porcentaje', () => {
  it.each([
    ['50%+50%', '1'],
    ['10%*50', '5'],
    ['200*15%', '30'],
    ['50+10%', '55'],
    ['50-10%', '45'],
    ['25%', '0.25'],
  ])('%s → %s', (expression, value) => expect(engine.evaluate(expression).value).toBe(value));
  it('avisa cómo se calculó a + b%', () =>
    expect(engine.evaluate('50+10%').warnings?.[0]).toMatch(/sobre el valor de la izquierda/));
  it('el resto entre dos números pide mod', () => {
    const error = fails('5%3');
    expect(error.message).toBe('El signo % es porcentaje. Para el resto usá mod(5, 3).');
    expect(error.code).toBe('resto');
  });
});

describe('unidades, estadística y marcas del resultado', () => {
  const valueOf = (expression: string) => engine.evaluate(expression).table?.[0].value;
  it('convierte calorías y kilocalorías', () => {
    expect(valueOf('convert(1,"kcal","J")')).toBe('4184');
    expect(valueOf('convert(1000,"J","cal")')).toBe('239.0057361');
    expect(valueOf('convert(1,"kWh","kcal")')).toBe('860.4206501');
  });
  it('rechaza temperaturas bajo el cero absoluto', () => {
    expect(fails('convert(-500,"K","degC")').message).toMatch(
      /^No existe una temperatura menor a -273,15 °C/,
    );
    expect(fails('convert(-300,"degC","K")').message).toMatch(/cero absoluto/);
  });
  it('la moda dice si ningún valor se repite y si no, su frecuencia', () => {
    const none = engine.evaluate('stats([1,2,3,4,5],1)').table!;
    expect(none.find((row) => row.label === 'Moda')?.value).toBe(
      'Sin moda: ningún valor se repite',
    );
    const some = engine.evaluate('stats([1,2,2,3],1)').table!;
    expect(some.find((row) => row.label === 'Moda')?.value).toBe('2');
    expect(some.find((row) => row.label === 'Frecuencia de la moda')?.value).toBe('2');
    expect(engine.evaluate('mode([1,2,3])').value).toBe('Sin moda: ningún valor se repite');
    expect(engine.evaluate('mode([4,4,1])').table).toEqual([
      { label: 'Moda', value: '4' },
      { label: 'Frecuencia', value: '2' },
    ]);
  });
  it('marca la base del resultado', () => {
    expect(engine.evaluate('base("FF",16,2)').radix).toBe(2);
    expect(engine.evaluate('base("FF",16,10)').radix).toBe(10);
    expect(engine.evaluate('bitop("and","12","10",8)').radix).toBe(2);
    expect(engine.evaluate('2+2').radix).toBeUndefined();
  });
  it('marca como graficable una expresión en x', () => {
    expect(engine.evaluate('diff(x^3,x)').graphable).toBe(true);
    expect(engine.evaluate('solve(x^2=4,x)').graphable).toBeUndefined();
  });
});

describe('teclas de la calculadora científica', () => {
  it('lee grados sexagesimales en cualquier modo angular', () => {
    expect(engine.evaluate('sin(30°)', opts({ angle: 'rad' })).value).toBe('0.5');
    expect(engine.evaluate('sin(30°)', opts({ angle: 'deg' })).value).toBe('0.5');
    expect(engine.evaluate(`12°30'45"`, opts({ angle: 'deg' })).value).toBe('12.5125');
    expect(engine.evaluate('90°', opts({ angle: 'grad' })).value).toBe('100');
  });
  it('suma una serie, deriva en un punto y toma la parte entera', () => {
    expect(engine.evaluate('sum(x^2, x, 1, 10)', opts()).value).toBe('385');
    expect(engine.evaluate('sum([1, 2, 3])', opts()).value).toBe('6');
    expect(() => engine.evaluate('sum(x, x, 1, 2.5)', opts())).toThrow('enteros');
    expect(engine.evaluate('substitute(diff(x^3, x), x, 2)', opts()).value).toBe('12');
    expect(engine.evaluate('fix(-2.7)', opts()).value).toBe('-2');
  });
});

describe('tabla de valores', () => {
  it('calcula f(x) y g(x) fila por fila, como el modo Tabla', () => {
    const result = engine.evaluate('tabla(x^2, x+1, -2, 2, 1)');
    expect(result.kind).toBe('Tabla');
    expect(result.headers).toEqual(['x', 'f(x)', 'g(x)']);
    expect(result.matrix).toEqual([
      ['-2', '4', '-1'],
      ['-1', '1', '0'],
      ['0', '0', '1'],
      ['1', '1', '2'],
      ['2', '4', '3'],
    ]);
    expect(result.value).toBe('[[-2, 4, -1], [-1, 1, 0], [0, 0, 1], [1, 1, 2], [2, 4, 3]]');
  });
  it('pasos decimales sin ruido, grados exactos y celdas no definidas', () => {
    const steps = engine.evaluate('table(x, 0, 0.3, 0.1)').matrix!.map((row) => row[0]);
    expect(steps).toEqual(['0', '0.1', '0.2', '0.3']);
    const trig = engine.evaluate('table(tan(x), 0, 180, 45)', 'deg');
    expect(trig.matrix!.map((row) => row[1])).toEqual(['0', '1', 'No definida', '-1', '0']);
    expect(trig.explanation).toMatch(/En una celda la función no está definida/);
    expect(engine.evaluate('table(1/x, -1, 1, 1)').matrix![1]).toEqual(['0', 'No definida']);
    expect(engine.evaluate('table(sqrt(x), -1, 0, 1)').matrix![0][1]).toBe('No definida');
  });
  it('coma decimal, paso negativo, variables guardadas y límites', () => {
    const coma = engine.evaluate('tabla(x/2; 1; 0; -0,5)', {
      angle: 'rad',
      decimalSeparator: 'coma',
    });
    expect(coma.matrix).toEqual([
      ['1', '0,5'],
      ['0,5', '0,25'],
      ['0', '0'],
    ]);
    expect(coma.value).toBe('[[1; 0,5]; [0,5; 0,25]; [0; 0]]');
    expect(engine.evaluate('table(a*x, 0, 2, 1)', 'rad', { a: 3 }).matrix).toEqual([
      ['0', '0'],
      ['1', '3'],
      ['2', '6'],
    ]);
    expect(() => engine.evaluate('table(x, 0, 100, 1)')).toThrow(/hasta 50 filas/);
    expect(() => engine.evaluate('table(x, 0, 5, 0)')).toThrow(/no puede ser cero/);
    expect(() => engine.evaluate('table(x, 5, 0, 1)')).toThrow(/paso negativo/);
    expect(() => engine.evaluate('table(x, 1)')).toThrow(/table\(f, desde, hasta, paso\)/);
    expect(() => engine.evaluate('table(y, 0, 1, 1)')).toThrow(/No reconozco «y»/);
  });
});

describe('desigualdades sueltas', () => {
  it('con una incógnita se resuelven por intervalos, como el modo Inecuación', () => {
    expect(engine.evaluate('x^2-4>0').value).toBe(
      'Desde menos infinito excluido hasta -2 excluido; Desde 2 excluido hasta más infinito excluido',
    );
    expect(engine.evaluate('x^4 - 5x^2 + 4 < 0').table?.map((row) => row.value)).toEqual([
      'Desde -2 excluido hasta -1 excluido',
      'Desde 1 excluido hasta 2 excluido',
    ]);
    expect(engine.evaluate('a*x > 6', 'rad', { a: 2 }).value).toBe(
      'Desde 3 excluido hasta más infinito excluido',
    );
    expect(
      engine.evaluate('x^2 - 2,25 < 0', { angle: 'rad', decimalSeparator: 'coma' }).value,
    ).toBe('Desde -1,5 excluido hasta 1,5 excluido');
  });
  it('sin letras, o con todas guardadas, se verifican', () => {
    expect(engine.evaluate('sqrt(2) > 1.4').value).toBe('Verdadero');
    expect(engine.evaluate('pi < 3').value).toBe('Falso');
    expect(engine.evaluate('0.1+0.2 <= 0.3').value).toBe('Verdadero');
    expect(engine.evaluate('2 >= 3').value).toBe('Falso');
    expect(engine.evaluate('a + b > 2', 'rad', { a: 1, b: 2 }).value).toBe('Verdadero');
    expect(engine.evaluate('pi < 3').explanation).toMatch(/lados de la desigualdad/);
  });
  it('explica lo que falta o sobra', () => {
    expect(() => engine.evaluate('x + y > 0')).toThrow(/más de una incógnita: x y y/);
    expect(() => engine.evaluate('1 < x < 3')).toThrow(/una sola desigualdad/);
    expect(() => engine.evaluate('> 2')).toThrow(/lado izquierdo/);
    expect(() => engine.evaluate('x^5 > 1')).toThrow(/grado máximo 4/);
  });
});
