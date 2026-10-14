import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import jStat from 'jstat';
import { math } from './mathRuntime';
import { convertUnits, convertBase, bitOperation } from './ConversionService';
import { formatReal, type FormatOptions } from './ResultFormatter';
import type { AngleMode, DecimalSeparator } from '../types';
import { MathInputError, type MathErrorCode } from './mathErrors';

const fail = (message: string, code: MathErrorCode = 'dominio') =>
  new MathInputError(message, code);

const commaHint =
  ' Si escribiste decimales con coma, usá punto o activá la coma decimal en Configuración.';

export function numericList(input: unknown, decimal: DecimalSeparator = 'punto'): number[] {
  const values: unknown = math.isMatrix(input) ? input.toArray() : input;
  if (Array.isArray(values) && values.length && values.every(Array.isArray))
    throw fail(
      `Ingresá una lista de números; recibí una tabla de ${values.length} filas y ${(values[0] as unknown[]).length} columnas.${decimal === 'punto' ? commaHint : ''}`,
      'argumentos',
    );
  const text = Array.isArray(values) ? values.find((v) => typeof v === 'string') : undefined;
  if (typeof text === 'string')
    throw fail(`La lista tiene un texto, «${text}». Escribí solo números.`, 'texto');
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > 500 ||
    !values.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    throw fail('Ingresá una lista de 1 a 500 números reales finitos.', 'argumentos');
  return values as number[];
}
export function numericMatrix(input: unknown): number[][] {
  const values: unknown = math.isMatrix(input) ? input.toArray() : input;
  if (!Array.isArray(values) || !values.length || values.length > 8)
    throw fail('Usá una matriz de hasta 8 filas y 8 columnas.', 'dimensiones');
  const rows = values.map((row) => numericList(row));
  if (rows[0].length > 8 || rows.some((row) => row.length !== rows[0].length))
    throw fail(
      'Todas las filas deben tener la misma cantidad de columnas, hasta 8.',
      'dimensiones',
    );
  return rows;
}
function real(n: unknown): number {
  if (math.isFraction(n)) return Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw fail('Se necesita un número real finito.');
  return n;
}
function positive(n: unknown) {
  const value = real(n);
  if (value <= 0) throw fail('El parámetro debe ser mayor que cero.');
  return value;
}
function probability(n: unknown) {
  const value = real(n);
  if (value < 0 || value > 1) throw fail('La probabilidad debe estar entre 0 y 1.');
  return value;
}
function integer(n: unknown) {
  const value = real(n);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000)
    throw fail('Usá un entero entre 0 y 100000.');
  return value;
}
function paired(a: unknown, b: unknown, decimal: DecimalSeparator) {
  const x = numericList(a, decimal);
  const y = numericList(b, decimal);
  if (x.length !== y.length || x.length < 2)
    throw fail('Las listas X e Y deben tener igual longitud y al menos dos datos.', 'dimensiones');
  return [x, y];
}

const isTable = (value: unknown) => Array.isArray(value) || math.isMatrix(value);
/** Tamaño de una lista o matriz: [n] o [filas, columnas]. */
export function shapeOf(value: unknown): number[] {
  const size = math.size(value as number[]) as unknown;
  return (math.isMatrix(size) ? size.toArray() : size) as number[];
}
function describeShape(shape: number[]) {
  return shape.length === 1
    ? `${shape[0]} componentes`
    : `${shape[0]} ${shape[0] === 1 ? 'fila' : 'filas'} y ${shape[1]} ${shape[1] === 1 ? 'columna' : 'columnas'}`;
}
const count = (shape: number[]) => shape.reduce((a, b) => a * b, 1);

/** Revisa que A y B tengan el mismo tamaño antes de sumar o restar. */
export function checkSameShape(a: unknown, b: unknown, verb: 'sumar' | 'restar') {
  if (!isTable(a) || !isTable(b)) return;
  const [x, y] = [shapeOf(a), shapeOf(b)];
  if (x.join() !== y.join())
    throw fail(
      `Para ${verb}, A y B deben tener el mismo tamaño: A tiene ${describeShape(x)} y B tiene ${describeShape(y)}.`,
      'dimensiones',
    );
}
/** Revisa que las columnas de A coincidan con las filas de B antes de multiplicar. */
export function checkProduct(a: unknown, b: unknown) {
  if (!isTable(a) || !isTable(b)) return;
  const [x, y] = [shapeOf(a), shapeOf(b)];
  if (x.length === 2 && y.length === 2 && x[1] !== y[0])
    throw fail(
      `Para multiplicar, las columnas de A (${x[1]}) deben coincidir con las filas de B (${y[0]}).`,
      'dimensiones',
    );
}
function square(input: unknown, operation: string) {
  const shape = shapeOf(input);
  if (shape.length !== 2 || shape[0] !== shape[1])
    throw fail(
      `${operation} necesita una matriz cuadrada; A tiene ${describeShape(shape)}.`,
      'matriz',
    );
  return shape[0];
}
function singular(input: unknown) {
  const rows = (math.isMatrix(input) ? input.toArray() : input) as unknown[][];
  if (!rows.every((row) => row.every((v) => typeof v === 'number'))) return false;
  const scale = (rows as number[][]).reduce(
    (product, row) => product * Math.max(...row.map(Math.abs), Number.MIN_VALUE),
    1,
  );
  return Math.abs(Number(math.det(rows as number[][]))) <= 1e-12 * scale;
}

const FULL: Record<AngleMode, number> = { rad: 2 * Math.PI, deg: 360, grad: 400 };
export const angleUnitName: Record<AngleMode, string> = {
  rad: 'radianes',
  deg: 'grados',
  grad: 'gradianes',
};
/** Redondea a entero lo que difiere de uno solo por ruido de coma flotante (30.000000000000004). */
export function snap(value: number) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= 1e-12 * Math.max(1, Math.abs(value)) ? rounded : value;
}
/** Seno y coseno con valores exactos en cuartos de vuelta y sin ruido cerca de los ceros. */
export function sinCos(x: number, angle: AngleMode): [number, number] {
  if (angle === 'rad') {
    const noise = 1e-15 * Math.abs(x);
    const s = Math.sin(x);
    const c = Math.cos(x);
    return [Math.abs(s) < noise ? 0 : s, Math.abs(c) < noise ? 0 : c];
  }
  const full = FULL[angle];
  let r = ((x % full) + full) % full;
  const quarter = r / (full / 4);
  if (Number.isInteger(quarter)) return [[0, 1, 0, -1][quarter], [1, 0, -1, 0][quarter]];
  if (r > full / 2) r -= full;
  const radians = (r * 2 * Math.PI) / full;
  return [Math.sin(radians), Math.cos(radians)];
}
/** Pasa un ángulo en radianes a la unidad elegida. */
export function fromRadians(value: number, angle: AngleMode) {
  return angle === 'rad' ? value : snap((value * FULL[angle]) / (2 * Math.PI));
}

function modeSummary(values: number[]) {
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const top = Math.max(...counts.values());
  if (top === 1) return null;
  const modes = [...counts].filter(([, n]) => n === top).map(([v]) => v);
  return { mode: modes.length === 1 ? modes[0] : modes, frequency: top };
}
const NO_MODE = 'Sin moda: ningún valor se repite';

export interface ExtensionContext {
  angle?: AngleMode;
  format?: FormatOptions;
}

/** Funciones extra del motor; el contexto define la unidad angular y el formato de los textos. */
export function createExtensionFunctions(context: ExtensionContext = {}): Record<string, unknown> {
  const angle = context.angle ?? 'rad';
  const format = context.format ?? {};
  const decimal = format.decimal ?? 'punto';
  const separator = decimal === 'coma' ? ';' : ',';
  const show = (value: number) => formatReal(value, format);
  const list = (input: unknown) => numericList(input, decimal);
  const statistic =
    (name: 'mean' | 'median' | 'variance' | 'std' | 'min' | 'max') =>
    (...args: unknown[]) => {
      if (args.length && isTable(args[0])) {
        const values = math.isMatrix(args[0]) ? args[0].toArray() : (args[0] as unknown[]);
        if (!values.length)
          throw fail('La lista está vacía: escribí al menos un número.', 'argumentos');
        const shape = shapeOf(args[0]);
        if (shape.length === 2 && shape[0] > 1 && shape[1] > 1)
          throw fail(
            `Las funciones estadísticas usan una lista de números; recibí una tabla de ${describeShape(shape)}.${decimal === 'punto' ? commaHint : ''}`,
            'argumentos',
          );
      }
      return (math[name] as (...values: unknown[]) => unknown)(...args);
    };
  const combinatoric = (name: 'combinations' | 'permutations') => (n: unknown, k?: unknown) => {
    const noun = name === 'combinations' ? 'combinaciones' : 'permutaciones';
    const values = k === undefined ? [n] : [n, k];
    if (values.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0))
      throw fail(`Las ${noun} necesitan números enteros no negativos.`);
    if (k !== undefined && (k as number) > (n as number))
      throw fail(`En ${noun}, k (${k}) no puede ser mayor que n (${n}).`);
    return k === undefined ? math.permutations(n as number) : math[name](n as number, k as number);
  };
  const divisor =
    (name: 'gcd' | 'lcm') =>
    (...args: unknown[]) => {
      if (args.some((v) => typeof v === 'number' && !Number.isInteger(v)))
        throw fail(
          name === 'gcd'
            ? 'El máximo común divisor necesita números enteros.'
            : 'El mínimo común múltiplo necesita números enteros.',
        );
      return (math[name] as (...values: unknown[]) => unknown)(...args);
    };
  return {
    mixed: (input: unknown) => {
      const f = math.isFraction(input) ? input : math.fraction(real(input));
      const whole = f.n / f.d,
        remainder = f.n % f.d;
      return {
        'Forma mixta': `${f.s < 0 ? 'menos ' : ''}${whole} enteros${remainder ? ` y ${remainder}/${f.d}` : ''}`,
        'Fracción exacta': f.toFraction(),
        'Decimal aproximado': Number(f),
      };
    },
    mixedNumber: (whole: unknown, numerator: unknown, denominator: unknown) => {
      const w = real(whole),
        n = integer(numerator),
        d = integer(denominator);
      if (!Number.isSafeInteger(w) || d === 0 || n >= d)
        throw fail(
          'Usá un entero y una fracción propia positiva con denominador distinto de cero.',
        );
      return math.multiply(
        w < 0 ? -1 : 1,
        math.add(math.fraction(Math.abs(w)), math.fraction(n, d)),
      );
    },
    nthRoots: (input: unknown, degree: unknown) => {
      const n = integer(degree);
      if (n < 1 || n > 32 || (!math.isComplex(input) && typeof input !== 'number'))
        throw fail('Ingresá un complejo y un índice entero entre 1 y 32.');
      return math.nthRoots(typeof input === 'number' ? math.complex(input, 0) : input, n);
    },
    nthRoot: (x: unknown, n: unknown = 2) => {
      if (typeof x === 'number' && typeof n === 'number') {
        if (n === 0) throw fail('El índice de la raíz no puede ser 0.');
        if (x < 0 && Number.isInteger(n) && n % 2 === 0)
          throw fail(
            `La raíz par de un número negativo no es real. Para ver las raíces complejas usá nthRoots(${show(x)}${separator} ${n}).`,
            'no-real',
          );
      }
      return math.nthRoot(x as number, n as number);
    },
    convert: convertUnits,
    base: convertBase,
    bitop: bitOperation,
    rank: (input: unknown) =>
      new SingularValueDecomposition(new Matrix(numericMatrix(input)), { autoTranspose: true })
        .rank,
    eigvals: (input: unknown) => math.eigs(numericMatrix(input)).values,
    eigvecs: (input: unknown) =>
      Object.fromEntries(
        math
          .eigs(numericMatrix(input))
          .eigenvectors.map((pair, i) => [
            `Autovector ${i + 1}, autovalor ${typeof pair.value === 'number' ? show(pair.value) : math.format(pair.value, 10)}`,
            pair.vector,
          ]),
      ),
    normalize: (input: unknown) => {
      const v = list(input);
      const length = Number(math.norm(v));
      if (!Number.isFinite(length))
        throw fail('La norma excede el rango numérico. Usá coordenadas de menor magnitud.');
      if (!length) throw fail('No se puede normalizar el vector cero.');
      return math.divide(v, length);
    },
    distance: (a: unknown, b: unknown) => {
      const [x, y] = paired(a, b, decimal);
      return math.norm(math.subtract(x, y));
    },
    vectorangle: (a: unknown, b: unknown) => {
      const [x, y] = paired(a, b, decimal);
      const norm = Number(math.norm(x)) * Number(math.norm(y));
      if (!norm) throw fail('El ángulo no está definido para el vector cero.');
      return fromRadians(
        Math.acos(Math.max(-1, Math.min(1, Number(math.dot(x, y)) / norm))),
        angle,
      );
    },
    inv: (input: unknown) => {
      if (isTable(input)) {
        square(input, 'La inversa');
        if (singular(input))
          throw fail('La matriz es singular (su determinante es 0): no tiene inversa.', 'matriz');
      } else if (input === 0)
        throw fail('No se puede dividir por cero: 0 no tiene inverso.', 'division-por-cero');
      return math.inv(input as number[][]);
    },
    det: (input: unknown) => {
      if (isTable(input)) square(input, 'El determinante');
      return math.det(input as number[][]);
    },
    lusolve: (a: unknown, b: unknown) => {
      const n = square(a, 'Resolver el sistema');
      if (singular(a))
        throw fail(
          'La matriz del sistema es singular: el sistema no tiene solución única.',
          'matriz',
        );
      if (isTable(b) && shapeOf(b)[0] !== n)
        throw fail(`El vector b debe tener ${n} valores, uno por cada fila de A.`, 'dimensiones');
      return math.lusolve(a as number[][], b as number[]);
    },
    cross: (a: unknown, b: unknown) => {
      const [x, y] = [count(shapeOf(a)), count(shapeOf(b))];
      if (x !== 3 || y !== 3)
        throw fail(
          `El producto vectorial (cross) necesita dos vectores de 3 componentes; A tiene ${x} y B tiene ${y}.`,
          'dimensiones',
        );
      return math.cross(a as number[], b as number[]);
    },
    dot: (a: unknown, b: unknown) => {
      const [x, y] = [count(shapeOf(a)), count(shapeOf(b))];
      if (x !== y)
        throw fail(
          `El producto escalar (dot) necesita vectores del mismo largo: A tiene ${x} componentes y B tiene ${y}.`,
          'dimensiones',
        );
      return math.dot(a as number[], b as number[]);
    },
    combinations: combinatoric('combinations'),
    permutations: combinatoric('permutations'),
    gcd: divisor('gcd'),
    lcm: divisor('lcm'),
    gamma: (x: unknown) => {
      if (typeof x === 'number' && Number.isInteger(x) && x <= 0)
        throw fail('La función gamma no está definida en 0 ni en los enteros negativos.');
      return math.gamma(x as number);
    },
    mean: statistic('mean'),
    median: statistic('median'),
    variance: statistic('variance'),
    std: statistic('std'),
    min: statistic('min'),
    max: statistic('max'),
    mode: (...args: unknown[]) => {
      if (args.length !== 1 || !isTable(args[0])) return math.mode(...(args as number[]));
      const summary = modeSummary(list(args[0]));
      return summary ? { Moda: summary.mode, Frecuencia: summary.frequency } : NO_MODE;
    },
    arg: (z: unknown) =>
      typeof z === 'number' || math.isComplex(z)
        ? fromRadians(Number(math.arg(z as number)), angle)
        : math.arg(z as number),
    polar: (input: unknown) => {
      if (!math.isComplex(input) && typeof input !== 'number')
        throw fail('Ingresá un número complejo.');
      return {
        Módulo: math.abs(input),
        [`Argumento en ${angleUnitName[angle]}`]: fromRadians(Number(math.arg(input)), angle),
      };
    },
    rect: (r: unknown, theta: unknown) => {
      const radius = real(r);
      if (radius < 0) throw fail('El módulo no puede ser negativo.');
      const [s, c] = sinCos(real(theta), angle);
      return math.complex(radius * c, radius * s);
    },
    stats: (input: unknown, sample = 1) => {
      if (sample !== 0 && sample !== 1) throw fail('Usá 1 para muestra o 0 para población.');
      const a = list(input);
      const s = Number(sample) === 1;
      if (s && a.length < 2)
        throw fail(
          'La varianza muestral necesita al menos dos datos. Elegí población o agregá datos.',
        );
      const summary = modeSummary(a);
      return {
        Cantidad: a.length,
        Media: math.mean(a),
        Mediana: math.median(a),
        Moda: summary ? summary.mode : NO_MODE,
        ...(summary && { 'Frecuencia de la moda': summary.frequency }),
        Mínimo: math.min(a),
        Máximo: math.max(a),
        Rango: math.max(a) - math.min(a),
        [s ? 'Varianza muestral' : 'Varianza poblacional']: math.variance(
          a,
          s ? 'unbiased' : 'uncorrected',
        ),
        'Desviación estándar': math.std(a, s ? 'unbiased' : 'uncorrected'),
        'Cuartil 1': math.quantileSeq(a, 0.25),
        'Cuartil 2': math.quantileSeq(a, 0.5),
        'Cuartil 3': math.quantileSeq(a, 0.75),
      };
    },
    percentile: (input: unknown, p: unknown) =>
      math.quantileSeq(list(input), probability(real(p) / 100)),
    covariance: (a: unknown, b: unknown) => {
      const [x, y] = paired(a, b, decimal);
      return jStat.covariance(x, y);
    },
    correlation: (a: unknown, b: unknown) => {
      const [x, y] = paired(a, b, decimal);
      if (!Number(math.variance(x)) || !Number(math.variance(y)))
        throw fail('La correlación no está definida para una lista constante.');
      return jStat.corrcoeff(x, y);
    },
    regression: (a: unknown, b: unknown) => {
      const [x, y] = paired(a, b, decimal);
      const variance = Number(math.variance(x));
      if (!variance) throw fail('X debe contener al menos dos valores diferentes.');
      const slope = jStat.covariance(x, y) / variance;
      const intercept = Number(math.mean(y)) - slope * Number(math.mean(x));
      return {
        Pendiente: slope,
        'Ordenada al origen': intercept,
        Ecuación: `y = ${show(slope)} * x ${intercept < 0 ? '-' : '+'} ${show(Math.abs(intercept))}`,
      };
    },
    normalpdf: (x: unknown, mu: unknown, sigma: unknown) =>
      jStat.normal.pdf(real(x), real(mu), positive(sigma)),
    normalcdf: (x: unknown, mu: unknown, sigma: unknown) =>
      jStat.normal.cdf(real(x), real(mu), positive(sigma)),
    binomialpdf: (k: unknown, n: unknown, p: unknown) => {
      const events = integer(k),
        trials = integer(n),
        chance = probability(p);
      return events > trials ? 0 : jStat.binomial.pdf(events, trials, chance);
    },
    binomialcdf: (k: unknown, n: unknown, p: unknown) => {
      const events = integer(k),
        trials = integer(n),
        chance = probability(p);
      return events >= trials ? 1 : jStat.binomial.cdf(events, trials, chance);
    },
    poissonpdf: (k: unknown, lambda: unknown) => jStat.poisson.pdf(integer(k), positive(lambda)),
    poissoncdf: (k: unknown, lambda: unknown) => jStat.poisson.cdf(integer(k), positive(lambda)),
  };
}

export const extensionFunctions = createExtensionFunctions();
