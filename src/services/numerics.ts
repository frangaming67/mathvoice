// Utilidades numéricas sin dependencias para contrastar los resultados del motor simbólico.

export type RealFunction = (x: number) => number;

export interface Complex {
  re: number;
  im: number;
}

export interface QuadratureResult {
  value: number;
  /** Cota estimada del error absoluto. */
  error: number;
  /** Integral del valor absoluto: escala de referencia para comparar resultados cercanos a 0. */
  absolute: number;
  evaluations: number;
  converged: boolean;
}

// Nodos y pesos de Gauss–Kronrod 7-15 en [-1, 1] (QUADPACK).
const KRONROD_NODES = [
  0.9914553711208126, 0.9491079123427585, 0.8648644233597691, 0.7415311855993945,
  0.5860872354676911, 0.4058451513773972, 0.20778495500789848, 0,
];
const KRONROD_WEIGHTS = [
  0.022935322010529224, 0.06309209262997856, 0.10479001032225019, 0.14065325971552592,
  0.1690047266392679, 0.19035057806478542, 0.20443294007529889, 0.20948214108472782,
];
const GAUSS_WEIGHTS = [
  0.1294849661688697, 0.27970539148927664, 0.3818300505051189, 0.4179591836734694,
];

interface Segment {
  a: number;
  b: number;
  value: number;
  absolute: number;
  error: number;
}

function kronrod(f: RealFunction, a: number, b: number): Segment {
  const center = (a + b) / 2;
  const half = (b - a) / 2;
  let kronrodSum = 0;
  let gaussSum = 0;
  let absolute = 0;
  for (let i = 0; i < KRONROD_NODES.length; i++) {
    const offset = half * KRONROD_NODES[i];
    const values = offset === 0 ? [f(center)] : [f(center - offset), f(center + offset)];
    for (const value of values) {
      if (!Number.isFinite(value)) return { a, b, value: NaN, absolute: NaN, error: Infinity };
      kronrodSum += KRONROD_WEIGHTS[i] * value;
      absolute += KRONROD_WEIGHTS[i] * Math.abs(value);
      // Los nodos impares de Kronrod (1, 3, 5, 7) son los de Gauss de 7 puntos.
      if (i % 2 === 1) gaussSum += GAUSS_WEIGHTS[(i - 1) / 2] * value;
    }
  }
  const value = kronrodSum * half;
  return {
    a,
    b,
    value,
    absolute: absolute * half,
    error: Math.abs((kronrodSum - gaussSum) * half),
  };
}

/** Cuadratura adaptativa global de Gauss–Kronrod 7-15 sobre un intervalo finito. */
export function integrate(
  f: RealFunction,
  a: number,
  b: number,
  { tolerance = 1e-11, maxSegments = 400 }: { tolerance?: number; maxSegments?: number } = {},
): QuadratureResult {
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return { value: NaN, error: Infinity, absolute: NaN, evaluations: 0, converged: false };
  if (a === b) return { value: 0, error: 0, absolute: 0, evaluations: 0, converged: true };
  if (a > b) {
    const reversed = integrate(f, b, a, { tolerance, maxSegments });
    return { ...reversed, value: -reversed.value };
  }
  const segments = [kronrod(f, a, b)];
  let evaluations = 15;
  for (;;) {
    let value = 0;
    let error = 0;
    let absolute = 0;
    let worst = 0;
    for (let i = 0; i < segments.length; i++) {
      value += segments[i].value;
      error += segments[i].error;
      absolute += segments[i].absolute;
      if (segments[i].error > segments[worst].error) worst = i;
    }
    if (!Number.isFinite(value))
      return { value: NaN, error: Infinity, absolute: NaN, evaluations, converged: false };
    const target = Math.max(tolerance * Math.abs(value), tolerance * 1e-3 * absolute, 1e-300);
    const converged = error <= target;
    if (converged || segments.length >= maxSegments)
      return { value, error, absolute, evaluations, converged };
    const { a: left, b: right } = segments[worst];
    const middle = (left + right) / 2;
    if (middle <= left || middle >= right)
      return { value, error, absolute, evaluations, converged: false };
    segments.splice(worst, 1, kronrod(f, left, middle), kronrod(f, middle, right));
    evaluations += 30;
  }
}

/** Derivada numérica por diferencias centrales con extrapolación de Richardson. */
export function derivative(f: RealFunction, x: number, step?: number): number {
  const h = step ?? 1e-3 * Math.max(1, Math.abs(x));
  const central = (s: number) => (f(x + s) - f(x - s)) / (2 * s);
  const d1 = central(h);
  const d2 = central(h / 2);
  const d3 = central(h / 4);
  const r1 = (4 * d2 - d1) / 3;
  const r2 = (4 * d3 - d2) / 3;
  return (16 * r2 - r1) / 15;
}

/**
 * Derivada por el método de Ridders: reduce el paso y extrapola, quedándose con la estimación
 * de menor error. El error informado permite no confundir imprecisión con desacuerdo.
 */
export function derivativeWithError(
  f: RealFunction,
  x: number,
  initial = 0.1 * Math.max(1e-2, Math.abs(x)),
): { value: number; error: number } {
  const shrink = 1.4;
  const table: number[][] = [];
  let h = initial;
  let best = { value: NaN, error: Infinity };
  for (let i = 0; i < 12; i++) {
    const row = [(f(x + h) - f(x - h)) / (2 * h)];
    let factor = shrink * shrink;
    for (let j = 1; j <= i; j++) {
      row.push((row[j - 1] * factor - table[i - 1][j - 1]) / (factor - 1));
      factor *= shrink * shrink;
      if (!Number.isFinite(row[j])) continue;
      const error = Math.max(Math.abs(row[j] - row[j - 1]), Math.abs(row[j] - table[i - 1][j - 1]));
      if (error <= best.error) best = { value: row[j], error };
    }
    table.push(row);
    if (i > 0 && Math.abs(row[i] - table[i - 1][i - 1]) >= 2 * best.error) break;
    h /= shrink;
  }
  return best;
}

/** Iguales dentro de una tolerancia relativa, con un piso absoluto de escala 1. */
export function nearlyEqual(a: number, b: number, tolerance = 1e-9): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Método de Brent para una raíz con cambio de signo en [a, b]. */
export function brent(f: RealFunction, a: number, b: number, tolerance = 1e-15): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (!(fa * fb < 0)) return NaN;
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let i = 0; i < 200; i++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol = 2 * Number.EPSILON * Math.abs(b) + tolerance / 2;
    const m = (c - b) / 2;
    if (Math.abs(m) <= tol || fb === 0) return b;
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const r = fb / fc;
        const t = fa / fc;
        p = s * (2 * m * t * (t - r) - (b - a) * (r - 1));
        q = (t - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = m;
      }
    } else {
      d = m;
      e = m;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol ? d : m > 0 ? tol : -tol;
    fb = f(b);
    if (!Number.isFinite(fb)) return NaN;
  }
  return b;
}

/**
 * Raíces reales de f en [a, b): cambios de signo refinados con Brent y raíces tangentes
 * (mínimos de |f| donde la derivada cambia de signo). Descarta polos.
 */
export function realRoots(f: RealFunction, a: number, b: number, samples = 1440): number[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    xs.push(x);
    ys.push(f(x));
  }
  const finite = ys.filter(Number.isFinite).map(Math.abs);
  const scale = Math.max(1, ...finite.filter((value) => value < 1e6));
  const roots: number[] = [];
  const accept = (root: number) => {
    if (!Number.isFinite(root) || root < a || root >= b) return;
    const value = f(root);
    if (!Number.isFinite(value) || Math.abs(value) > 1e-9 * scale) return;
    if (roots.some((known) => Math.abs(known - root) <= 1e-9 * Math.max(1, Math.abs(root)))) return;
    roots.push(root);
  };
  for (let i = 0; i < samples; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    if (y0 === 0) accept(xs[i]);
    else if (Number.isFinite(y0) && Number.isFinite(y1) && y0 * y1 < 0)
      accept(brent(f, xs[i], xs[i + 1]));
  }
  for (let i = 1; i < samples; i++) {
    const [y0, y1, y2] = [ys[i - 1], ys[i], ys[i + 1]];
    if (![y0, y1, y2].every(Number.isFinite) || y1 === 0 || y0 * y1 <= 0 || y1 * y2 <= 0) continue;
    if (Math.abs(y1) > Math.abs(y0) || Math.abs(y1) > Math.abs(y2) || Math.abs(y1) > 1e-2 * scale)
      continue;
    const slope = (x: number) => derivative(f, x, 1e-6 * Math.max(1, Math.abs(x)));
    accept(brent(slope, xs[i - 1], xs[i + 1], 1e-14));
  }
  return roots.sort((x, y) => x - y);
}

// ---------- Polinomios ----------

type Pair = [number, number];

function horner(coefficients: number[], [zr, zi]: Pair): Pair {
  let re = 0;
  let im = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const nextRe = re * zr - im * zi + coefficients[i];
    im = re * zi + im * zr;
    re = nextRe;
  }
  return [re, im];
}

function absoluteHorner(coefficients: number[], modulus: number): number {
  let sum = 0;
  for (let i = coefficients.length - 1; i >= 0; i--)
    sum = sum * modulus + Math.abs(coefficients[i]);
  return sum;
}

function differentiate(coefficients: number[]): number[] {
  return coefficients.slice(1).map((value, i) => value * (i + 1));
}

function divide([ar, ai]: Pair, [br, bi]: Pair): Pair {
  const d = br * br + bi * bi;
  return [(ar * br + ai * bi) / d, (ai * br - ar * bi) / d];
}

// Aberth–Ehrlich: todas las raíces complejas a la vez, con convergencia cúbica.
function aberth(coefficients: number[]): Pair[] {
  const n = coefficients.length - 1;
  const lead = coefficients[n];
  const monic = coefficients.map((value) => value / lead);
  const slope = differentiate(monic);
  const radius = Math.abs(monic[0]) ** (1 / n) || 1;
  const z: Pair[] = Array.from({ length: n }, (_, k) => {
    const angle = (2 * Math.PI * k) / n + 0.4;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
  for (let iteration = 0; iteration < 500; iteration++) {
    let moved = 0;
    for (let k = 0; k < n; k++) {
      const p = horner(monic, z[k]);
      if (p[0] === 0 && p[1] === 0) continue;
      const ratio = divide(p, horner(slope, z[k]));
      let sr = 0;
      let si = 0;
      for (let j = 0; j < n; j++) {
        if (j === k) continue;
        const [inverseRe, inverseIm] = divide([1, 0], [z[k][0] - z[j][0], z[k][1] - z[j][1]]);
        sr += inverseRe;
        si += inverseIm;
      }
      const denominator: Pair = [
        1 - (ratio[0] * sr - ratio[1] * si),
        -(ratio[0] * si + ratio[1] * sr),
      ];
      const step = divide(ratio, denominator);
      if (!Number.isFinite(step[0]) || !Number.isFinite(step[1])) continue;
      z[k] = [z[k][0] - step[0], z[k][1] - step[1]];
      moved = Math.max(moved, Math.hypot(...step) / Math.max(1, Math.hypot(...z[k])));
    }
    if (moved < 1e-16) break;
  }
  // Pulido con Newton sobre el polinomio original.
  return z.map((root) => {
    let best = root;
    let bestValue = Math.hypot(...horner(monic, root));
    for (let i = 0; i < 5; i++) {
      const step = divide(horner(monic, best), horner(slope, best));
      const candidate: Pair = [best[0] - step[0], best[1] - step[1]];
      const value = Math.hypot(...horner(monic, candidate));
      if (!(value < bestValue)) break;
      best = candidate;
      bestValue = value;
    }
    return best;
  });
}

export interface PolynomialRoot extends Complex {
  multiplicity: number;
}

// Una raíz múltiple aparece como un racimo de raíces cercanas. Su centro se refina con Newton
// sobre la derivada de orden k − 1 (donde la raíz es simple) y se acepta como raíz de
// multiplicidad k solo si las derivadas anteriores se anulan ahí.
function multipleRoot(coefficients: number[], start: Pair, order: number): Pair | null {
  let derived = coefficients;
  for (let j = 1; j < order; j++) derived = differentiate(derived);
  const slope = differentiate(derived);
  let center = start;
  for (let i = 0; i < 30; i++) {
    const step = divide(horner(derived, center), horner(slope, center));
    if (!Number.isFinite(step[0]) || !Number.isFinite(step[1])) break;
    center = [center[0] - step[0], center[1] - step[1]];
    if (Math.hypot(...step) <= 1e-16 * Math.max(1, Math.hypot(...center))) break;
  }
  let current = coefficients;
  const modulus = Math.hypot(...center);
  for (let j = 0; j < order; j++) {
    const [re, im] = horner(current, center);
    if (Math.hypot(re, im) > 1e-10 * absoluteHorner(current, modulus)) return null;
    current = differentiate(current);
  }
  return center;
}

/**
 * Raíces de c0 + c1·x + … + cn·xⁿ con multiplicidad, ordenadas: reales de menor a mayor,
 * después complejas por parte real e imaginaria. Devuelve null si los coeficientes no son finitos.
 */
export function polynomialRoots(coefficients: number[]): PolynomialRoot[] | null {
  if (!coefficients.every(Number.isFinite)) return null;
  const c = [...coefficients];
  while (c.length > 1 && c.at(-1) === 0) c.pop();
  if (c.length <= 1) return [];
  let zeros = 0;
  while (c[0] === 0) {
    c.shift();
    zeros++;
  }
  const found = c.length > 1 ? aberth(c) : [];
  const roots: PolynomialRoot[] = zeros ? [{ re: 0, im: 0, multiplicity: zeros }] : [];
  const used = new Set<number>();
  // Las raíces más próximas entre sí se agrupan primero.
  for (let i = 0; i < found.length; i++) {
    if (used.has(i)) continue;
    const near = found
      .map((root, j) => ({ j, distance: Math.hypot(root[0] - found[i][0], root[1] - found[i][1]) }))
      .filter(
        ({ j, distance }) =>
          !used.has(j) && distance <= 1e-2 * Math.max(1, Math.hypot(...found[i])),
      )
      .sort((x, y) => x.distance - y.distance);
    let group = [i];
    let center: Pair = found[i];
    for (let size = near.length; size > 1; size--) {
      const members = near.slice(0, size).map(({ j }) => j);
      const mean: Pair = [
        members.reduce((sum, j) => sum + found[j][0], 0) / size,
        members.reduce((sum, j) => sum + found[j][1], 0) / size,
      ];
      const refined = multipleRoot(c, mean, size);
      if (
        refined &&
        Math.hypot(refined[0] - mean[0], refined[1] - mean[1]) <=
          1e-2 * Math.max(1, Math.hypot(...mean))
      ) {
        group = members;
        center = refined;
        break;
      }
    }
    group.forEach((j) => used.add(j));
    roots.push({ re: center[0], im: center[1], multiplicity: group.length });
  }
  for (const root of roots) {
    if (Math.abs(root.im) <= 1e-10 * Math.max(1, Math.abs(root.re))) root.im = 0;
    if (Math.abs(root.re) <= 1e-14 * Math.max(1, Math.abs(root.im))) root.re = 0;
  }
  // Las raíces complejas de un polinomio real vienen en pares conjugados exactos.
  for (const root of roots) {
    if (root.im <= 0) continue;
    const partner = roots.find(
      (other) =>
        other.im < 0 &&
        Math.abs(other.re - root.re) <= 1e-8 * Math.max(1, Math.abs(root.re)) &&
        Math.abs(other.im + root.im) <= 1e-8 * Math.max(1, root.im),
    );
    if (partner) {
      partner.re = root.re;
      partner.im = -root.im;
    }
  }
  return roots.sort((x, y) =>
    x.im === 0 && y.im !== 0 ? -1 : y.im === 0 && x.im !== 0 ? 1 : x.re - y.re || x.im - y.im,
  );
}

// ---------- Límites ----------

export type LimitEstimate =
  | { kind: 'finite'; value: number; error: number }
  | { kind: 'infinite'; sign: 1 | -1 }
  | { kind: 'none' };

/** Pasos de acercamiento: t = 10^(-1), 10^(-1.5), …, 10^(-8). */
export const LIMIT_STEPS = Array.from({ length: 15 }, (_, k) => 10 ** (-1 - k / 2));

function aitken(a: number, b: number, c: number): number {
  const denominator = c - 2 * b + a;
  if (!Number.isFinite(denominator) || denominator === 0) return c;
  const accelerated = c - (c - b) ** 2 / denominator;
  return Number.isFinite(accelerated) ? accelerated : c;
}

/**
 * Estima el límite de g(t) cuando t → 0⁺ a partir de muestras en LIMIT_STEPS.
 * Busca la zona estable antes de que el redondeo domine; si no la hay, no afirma nada.
 */
export function limitAtZero(g: RealFunction): LimitEstimate {
  const values = LIMIT_STEPS.map((t) => {
    const value = g(t);
    return typeof value === 'number' ? value : NaN;
  });
  const valid = values.filter((value) => !Number.isNaN(value));
  if (valid.length < values.length - 2) return { kind: 'none' };
  // Divergencia: la cola crece en módulo con signo constante y sin frenarse.
  const tail = values.slice(-8);
  if (tail.every((value) => !Number.isNaN(value))) {
    const sign = Math.sign(tail.at(-1)!);
    const growing = tail.every(
      (value, i) =>
        Math.sign(value) === sign &&
        (i === 0 || Math.abs(value) > Math.abs(tail[i - 1]) || !Number.isFinite(value)),
    );
    const steps = tail.slice(1).map((value, i) => Math.abs(value - tail[i]));
    const steady = steps.every(
      (step, i) => i === 0 || !Number.isFinite(step) || step >= 0.7 * steps[i - 1],
    );
    if (sign !== 0 && growing && steady) return { kind: 'infinite', sign: sign as 1 | -1 };
    if (sign !== 0 && tail.every((value) => value === sign * Infinity))
      return { kind: 'infinite', sign: sign as 1 | -1 };
  }
  if (!values.every(Number.isFinite)) {
    // Puede haber desborde al final de una sucesión que converge: se usa el tramo finito inicial.
    const prefix: number[] = [];
    for (const value of values) {
      if (!Number.isFinite(value)) break;
      prefix.push(value);
    }
    if (prefix.length < 8) return { kind: 'none' };
    return stable(prefix);
  }
  return stable(values);
}

function stable(values: number[]): LimitEstimate {
  const differences = values.slice(1).map((value, i) => Math.abs(value - values[i]));
  const last = values.at(-1)!;
  // Sucesión constante (por ejemplo |x|/x por un lado).
  if (differences.slice(-6).every((step) => step <= 1e-14 * Math.max(1, Math.abs(last))))
    return { kind: 'finite', value: last, error: 1e-14 * Math.max(1, Math.abs(last)) };
  // Tramo de acercamiento: las diferencias bajan hasta que el redondeo empieza a dominar.
  let end = 0;
  while (
    end + 1 < differences.length &&
    differences[end + 1] > 0 &&
    differences[end + 1] < 0.9 * differences[end]
  )
    end++;
  if (end < 3) return { kind: 'none' };
  let value = values[end + 1];
  const scale = Math.max(1, Math.abs(value));
  let error = Math.max(differences[end], differences[end - 1] * 0.1, Number.EPSILON * scale);
  // Aitken donde el cociente entre diferencias es estable: pares consecutivos que coinciden.
  const accelerated: { at: number; value: number }[] = [];
  for (let i = 2; i <= end; i++) {
    const r1 = differences[i - 1] / differences[i - 2];
    const r2 = differences[i] / differences[i - 1];
    if (Math.abs(Math.log(r2 / r1)) < Math.LN2)
      accelerated.push({ at: i, value: aitken(values[i - 1], values[i], values[i + 1]) });
  }
  for (let k = 1; k < accelerated.length; k++) {
    if (accelerated[k].at !== accelerated[k - 1].at + 1) continue;
    const gap = Math.max(
      Math.abs(accelerated[k].value - accelerated[k - 1].value),
      Number.EPSILON * scale,
    );
    if (gap < error) {
      error = gap;
      value = accelerated[k].value;
    }
  }
  if (error > 1e-4 * scale) return { kind: 'none' };
  return { kind: 'finite', value: Math.abs(value) <= error ? 0 : value, error };
}

// ---------- Reconocimiento de constantes ----------

/** Fracción p/q con q ≤ maxDenominator que aproxima value dentro de tolerance (relativa). */
export function rational(
  value: number,
  maxDenominator = 1000,
  tolerance = 1e-12,
): [number, number] | null {
  if (!Number.isFinite(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let rest = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(rest);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > maxDenominator) return null;
    if (Math.abs(x - h1 / k1) <= tolerance * Math.max(1, x)) return [sign * h1, k1];
    const fraction = rest - a;
    if (fraction < 1e-15) break;
    rest = 1 / fraction;
  }
  return Math.abs(x - h1 / k1) <= tolerance * Math.max(1, x) ? [sign * h1, k1] : null;
}
