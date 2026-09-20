import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import jStat from 'jstat';
import { math } from './mathRuntime';
import { convertUnits, convertBase, bitOperation } from './ConversionService';

export function numericList(input: unknown): number[] {
  const values: unknown = math.isMatrix(input) ? input.toArray() : input;
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > 500 ||
    !values.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    throw new Error('Ingresá una lista de 1 a 500 números reales finitos.');
  return values as number[];
}
export function numericMatrix(input: unknown): number[][] {
  const values: unknown = math.isMatrix(input) ? input.toArray() : input;
  if (!Array.isArray(values) || !values.length || values.length > 8)
    throw new Error('Usá una matriz de hasta 8 filas y 8 columnas.');
  const rows = values.map(numericList);
  if (rows[0].length > 8 || rows.some((row) => row.length !== rows[0].length))
    throw new Error('Todas las filas deben tener la misma cantidad de columnas, hasta 8.');
  return rows;
}
function real(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw new Error('Se necesita un número real finito.');
  return n;
}
function positive(n: unknown) {
  const value = real(n);
  if (value <= 0) throw new Error('El parámetro debe ser mayor que cero.');
  return value;
}
function probability(n: unknown) {
  const value = real(n);
  if (value < 0 || value > 1) throw new Error('La probabilidad debe estar entre 0 y 1.');
  return value;
}
function integer(n: unknown) {
  const value = real(n);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000)
    throw new Error('Usá un entero entre 0 y 100000.');
  return value;
}
function paired(a: unknown, b: unknown) {
  const x = numericList(a);
  const y = numericList(b);
  if (x.length !== y.length || x.length < 2)
    throw new Error('Las listas X e Y deben tener igual longitud y al menos dos datos.');
  return [x, y];
}

export const extensionFunctions: Record<string, unknown> = {
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
      throw new Error(
        'Usá un entero y una fracción propia positiva con denominador distinto de cero.',
      );
    return math.multiply(w < 0 ? -1 : 1, math.add(math.fraction(Math.abs(w)), math.fraction(n, d)));
  },
  nthRoots: (input: unknown, degree: unknown) => {
    const n = integer(degree);
    if (n < 1 || n > 32 || (!math.isComplex(input) && typeof input !== 'number'))
      throw new Error('Ingresá un complejo y un índice entero entre 1 y 32.');
    return math.nthRoots(typeof input === 'number' ? math.complex(input, 0) : input, n);
  },
  convert: convertUnits,
  base: convertBase,
  bitop: bitOperation,
  rank: (input: unknown) =>
    new SingularValueDecomposition(new Matrix(numericMatrix(input)), { autoTranspose: true }).rank,
  eigvals: (input: unknown) => math.eigs(numericMatrix(input)).values,
  eigvecs: (input: unknown) =>
    Object.fromEntries(
      math
        .eigs(numericMatrix(input))
        .eigenvectors.map((pair, i) => [
          `Autovector ${i + 1}, autovalor ${math.format(pair.value)}`,
          pair.vector,
        ]),
    ),
  normalize: (input: unknown) => {
    const v = numericList(input);
    const length = Number(math.norm(v));
    if (!Number.isFinite(length))
      throw new Error('La norma excede el rango numérico. Usá coordenadas de menor magnitud.');
    if (!length) throw new Error('No se puede normalizar el vector cero.');
    return math.divide(v, length);
  },
  distance: (a: unknown, b: unknown) => {
    const [x, y] = paired(a, b);
    return math.norm(math.subtract(x, y));
  },
  vectorangle: (a: unknown, b: unknown) => {
    const [x, y] = paired(a, b);
    const norm = Number(math.norm(x)) * Number(math.norm(y));
    if (!norm) throw new Error('El ángulo no está definido para el vector cero.');
    return Math.acos(Math.max(-1, Math.min(1, Number(math.dot(x, y)) / norm)));
  },
  polar: (input: unknown) => {
    if (!math.isComplex(input) && typeof input !== 'number')
      throw new Error('Ingresá un número complejo.');
    return { Módulo: math.abs(input), 'Argumento en radianes': math.arg(input) };
  },
  rect: (r: unknown, theta: unknown) => {
    const radius = real(r);
    if (radius < 0) throw new Error('El módulo no puede ser negativo.');
    const angle = real(theta);
    return math.complex(radius * Math.cos(angle), radius * Math.sin(angle));
  },
  stats: (input: unknown, sample = 1) => {
    if (sample !== 0 && sample !== 1) throw new Error('Usá 1 para muestra o 0 para población.');
    const a = numericList(input);
    const s = Number(sample) === 1;
    if (s && a.length < 2)
      throw new Error(
        'La varianza muestral necesita al menos dos datos. Elegí población o agregá datos.',
      );
    return {
      Cantidad: a.length,
      Media: math.mean(a),
      Mediana: math.median(a),
      Moda: math.mode(a),
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
    math.quantileSeq(numericList(input), probability(real(p) / 100)),
  covariance: (a: unknown, b: unknown) => {
    const [x, y] = paired(a, b);
    return jStat.covariance(x, y);
  },
  correlation: (a: unknown, b: unknown) => {
    const [x, y] = paired(a, b);
    if (!Number(math.variance(x)) || !Number(math.variance(y)))
      throw new Error('La correlación no está definida para una lista constante.');
    return jStat.corrcoeff(x, y);
  },
  regression: (a: unknown, b: unknown) => {
    const [x, y] = paired(a, b);
    const variance = Number(math.variance(x));
    if (!variance) throw new Error('X debe contener al menos dos valores diferentes.');
    const slope = jStat.covariance(x, y) / variance;
    const intercept = Number(math.mean(y)) - slope * Number(math.mean(x));
    return {
      Pendiente: slope,
      'Ordenada al origen': intercept,
      Ecuación: `y = ${math.format(slope, { precision: 12 })} * x + ${math.format(intercept, { precision: 12 })}`,
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
