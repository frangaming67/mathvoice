import type { GraphData, GraphEvent } from './GraphService';

type Format = (value: number) => string;

/** Lista en castellano: «a», «a y b», «a, b y c». */
const and = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;

/**
 * Descripción general de una función del gráfico, al estilo del resumen de Desmos: dominio,
 * cortes con los ejes, crecimiento, asíntotas y saltos, valores en los bordes y cuánto queda
 * fuera del rango Y. Cada oración se entiende sola, para leerla con voz o en braille.
 */
export function describeCurve(data: GraphData, index: number, fmt: Format): string[] {
  const curve = data.curves[index];
  const { minX, maxX, minY, maxY } = data.request;
  const width = maxX - minX;
  const x = (value: number) => `x ${fmt(value)}`;
  const own = (type: GraphEvent['type']) =>
    data.events
      .filter(
        (e) => e.type === type && e.functionIndex === index && e.otherFunctionIndex === undefined,
      )
      .sort((a, b) => a.x - b.x);
  const sentences: string[] = [];

  // Dominio: los huecos de un solo punto se dicen como «salvo en».
  const runs: { from: number; to: number }[] = [];
  const holes: number[] = [];
  for (const run of curve.domain) {
    const last = runs.at(-1);
    if (last && run.from - last.to <= width * 1e-6) {
      holes.push(last.to / 2 + run.from / 2);
      last.to = run.to;
    } else runs.push({ ...run });
  }
  if (!runs.length) return [`No tiene valores reales entre ${x(minX)} y ${x(maxX)}.`];
  const except = holes.length ? ` salvo en ${and(holes.map(x))}` : '';
  const whole =
    runs.length === 1 && runs[0].from - minX <= width * 1e-9 && maxX - runs[0].to <= width * 1e-9;
  sentences.push(
    whole
      ? `Definida en todo el intervalo, de ${x(minX)} a ${x(maxX)}${except}.`
      : `Definida ${and(runs.map((run) => `desde ${x(run.from)} hasta ${x(run.to)}`))}${except}.`,
  );

  // Tramos entre extremos, saltos, asíntotas y bordes del dominio.
  const cuts = [
    ...own('mínimo local'),
    ...own('máximo local'),
    ...own('asíntota vertical'),
    ...own('discontinuidad'),
  ].map((event) => event.x);
  const segments: { trend: string; from: number; to: number; value: number }[] = [];
  for (const run of runs) {
    const stops = [run.from, ...cuts.filter((c) => c > run.from && c < run.to), run.to].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < stops.length - 1; i++) {
      const inside = curve.points.filter(
        (p) => p.y !== null && p.x > stops[i] && p.x < stops[i + 1],
      );
      if (inside.length < 2) continue;
      const change = inside.at(-1)!.y! - inside[0].y!;
      const flat = Math.abs(change) <= 1e-12 * Math.max(1, ...inside.map((p) => Math.abs(p.y!)));
      const trend = flat ? 'es constante' : change > 0 ? 'crece' : 'decrece';
      // No se unen tramos a través de un salto o una asíntota: 1/x no decrece de -5 a 5.
      segments.push({ trend, from: stops[i], to: stops[i + 1], value: inside[0].y! });
    }
  }

  // Cortes con los ejes.
  const zeros = own('cero');
  const crossing = zeros.filter((zero) => !zero.tangent);
  const touching = zeros.filter((zero) => zero.tangent);
  const onAxis = segments.filter(
    (segment) => segment.trend === 'es constante' && Math.abs(segment.value) <= 1e-12,
  );
  if (onAxis.length)
    sentences.push(
      `Está sobre el eje x ${and(onAxis.map((segment) => `desde ${x(segment.from)} hasta ${x(segment.to)}`))}.`,
    );
  if (!zeros.length && !onAxis.length) sentences.push('No corta el eje x en este intervalo.');
  else if (zeros.length > 5)
    sentences.push(`Corta el eje x ${zeros.length} veces; la primera en ${x(zeros[0].x)}.`);
  else {
    if (crossing.length)
      sentences.push(`Corta el eje x en ${and(crossing.map((zero) => x(zero.x)))}.`);
    if (touching.length)
      sentences.push(`Toca el eje x sin cruzarlo en ${and(touching.map((zero) => x(zero.x)))}.`);
  }
  if (curve.yIntercept === null) sentences.push('No está definida en x 0.');
  else if (curve.yIntercept !== undefined)
    sentences.push(`Corta el eje y en y ${fmt(curve.yIntercept)}.`);

  const trends = new Set(segments.map((segment) => segment.trend));
  if (segments.length > 2 && trends.size === 1)
    sentences.push(
      trends.has('es constante')
        ? `Es constante por tramos: ${segments.length} tramos.`
        : `${trends.has('crece') ? 'Crece' : 'Decrece'} en cada uno de sus ${segments.length} tramos.`,
    );
  else if (segments.length > 6)
    sentences.push(`Sube y baja ${segments.length} veces: oscila en el intervalo.`);
  else if (segments.length) {
    const text = and(
      segments.map((segment) => `${segment.trend} desde ${x(segment.from)} hasta ${x(segment.to)}`),
    );
    sentences.push(`${text[0].toUpperCase()}${text.slice(1)}.`);
  }

  const asymptotes = own('asíntota vertical');
  if (asymptotes.length)
    sentences.push(
      `${asymptotes.length === 1 ? 'Asíntota vertical' : 'Asíntotas verticales'} en ${and(asymptotes.map((a) => x(a.x)))}.`,
    );
  const jumps = own('discontinuidad');
  if (jumps.length > 3)
    sentences.push(`Tiene ${jumps.length} saltos; el primero en ${x(jumps[0].x)}.`);
  else
    for (const jump of jumps)
      sentences.push(
        jump.left != null && jump.right != null
          ? `Salto en ${x(jump.x)}: pasa de y ${fmt(jump.left)} a y ${fmt(jump.right)}.`
          : `Salto en ${x(jump.x)}.`,
      );

  // Bordes de la ventana.
  const first = curve.points[0],
    last = curve.points.at(-1)!;
  const value = (y: number | null) => (y === null ? 'no está definida' : `vale ${fmt(y)}`);
  sentences.push(`En ${x(first.x)} ${value(first.y)} y en ${x(last.x)} ${value(last.y)}.`);

  // Cuánto se sale del rango Y elegido.
  const defined = curve.points.filter((p) => p.y !== null);
  const outside = defined.filter((p) => p.y! < minY || p.y! > maxY).length;
  const percent = defined.length ? Math.round((outside / defined.length) * 100) : 0;
  if (percent >= 1)
    sentences.push(
      `El ${percent} % de la curva queda fuera del rango Y elegido; Ajustar Y la muestra entera.`,
    );
  return sentences;
}

/** Intersecciones entre las funciones del gráfico. */
export function describeIntersections(data: GraphData, fmt: Format): string {
  const crossings = data.events.filter((e) => e.type === 'intersección');
  return crossings.length
    ? `${crossings.length === 1 ? 'Hay 1 intersección' : `Hay ${crossings.length} intersecciones`}: ${and(
        crossings
          .slice(0, 5)
          .map(
            (e) =>
              `funciones ${e.functionIndex + 1} y ${e.otherFunctionIndex! + 1} en x ${fmt(e.x)}`,
          ),
      )}${crossings.length > 5 ? ' y más' : ''}.`
    : 'Las funciones no se cortan en este intervalo.';
}

/** Resumen de todo el gráfico: una entrada por función y las intersecciones. */
export function describeGraph(data: GraphData, fmt: Format): string {
  const parts = data.curves.map(
    (curve, index) =>
      `Función ${index + 1}, ${curve.expression}. ${describeCurve(data, index, fmt).join(' ')}`,
  );
  if (data.curves.length > 1) parts.push(describeIntersections(data, fmt));
  return parts.join(' ');
}
