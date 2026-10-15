import type { GraphData } from './GraphService';

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Paso de las marcas de los ejes: 1, 2 o 5 por una potencia de diez, unas 8 marcas por eje. */
export function tickStep(span: number): number {
  const rough = span / 8;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1.5 ? 1 : unit <= 3.5 ? 2 : unit <= 7.5 ? 5 : 10) * power;
}
/** Patrones de trazo bien distintos al tacto: continuo, rayas largas, puntos, raya y punto. */
const DASHES = [undefined, '24 12', '4 12', '24 10 4 10'];
const TRACE_NAMES = ['continuo', 'de rayas largas', 'de puntos', 'de raya y punto'];

/**
 * Gráfico para imprimir en relieve (papel microcapsulado u horno de relieve): negro sobre blanco,
 * sin rellenos ni grilla, trazos gruesos que se distinguen por su patrón y no por el color, ejes
 * más finos que las curvas y números grandes para que alguien los transcriba a braille.
 */
export function tactileSvg(data: GraphData, fmt: (value: number) => string, description = '') {
  const width = 1000,
    height = 700,
    margin = 70;
  const { minX, maxX, minY, maxY } = data.request;
  const sx = (x: number) => margin + ((x - minX) / (maxX - minX)) * (width - 2 * margin);
  const sy = (y: number) => height - margin - ((y - minY) / (maxY - minY)) * (height - 2 * margin);
  const clampY = (y: number) => Math.max(-1000, Math.min(height + 1000, sy(y)));
  const axisY = minY <= 0 && 0 <= maxY ? sy(0) : height - margin;
  const axisX = minX <= 0 && 0 <= maxX ? sx(0) : margin;
  const marks: string[] = [];
  const stepX = tickStep(maxX - minX),
    stepY = tickStep(maxY - minY);
  for (let x = Math.ceil(minX / stepX) * stepX; x <= maxX + stepX * 1e-9; x += stepX) {
    const value = Math.abs(x) < stepX * 1e-9 ? 0 : x;
    marks.push(
      `<line x1="${sx(value).toFixed(1)}" x2="${sx(value).toFixed(1)}" y1="${(axisY - 10).toFixed(1)}" y2="${(axisY + 10).toFixed(1)}" stroke-width="3"/>`,
      value === 0
        ? ''
        : `<text x="${sx(value).toFixed(1)}" y="${(axisY + 38).toFixed(1)}" text-anchor="middle">${escape(fmt(value))}</text>`,
    );
  }
  for (let y = Math.ceil(minY / stepY) * stepY; y <= maxY + stepY * 1e-9; y += stepY) {
    const value = Math.abs(y) < stepY * 1e-9 ? 0 : y;
    marks.push(
      `<line x1="${(axisX - 10).toFixed(1)}" x2="${(axisX + 10).toFixed(1)}" y1="${sy(value).toFixed(1)}" y2="${sy(value).toFixed(1)}" stroke-width="3"/>`,
      value === 0
        ? ''
        : `<text x="${(axisX - 16).toFixed(1)}" y="${(sy(value) + 9).toFixed(1)}" text-anchor="end">${escape(fmt(value))}</text>`,
    );
  }
  const curves = data.curves.map((curve, index) => {
    let pen = false;
    const path = curve.points
      .map((p, i) => {
        if (p.y === null) {
          pen = false;
          return '';
        }
        const command = !pen || curve.breaks.includes(i) ? 'M' : 'L';
        pen = true;
        return `${command}${sx(p.x).toFixed(1)},${clampY(p.y).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');
    const dash = DASHES[index % DASHES.length];
    return `<path d="${path}" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  });
  const names = data.curves.map((curve) => curve.expression).join(', ');
  // Leyenda debajo del gráfico: una línea por función, con el nombre de su trazo.
  const legend = data.curves.map(
    (curve, index) =>
      `<text x="${margin}" y="${height + 10 + index * 40}">${escape(`Función ${index + 1}, trazo ${TRACE_NAMES[index % TRACE_NAMES.length]}: ${curve.expression}`)}</text>`,
  );
  const total = height + 30 + data.curves.length * 40;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${total}" width="${width}" height="${total}" role="img" aria-labelledby="titulo descripcion" font-family="Arial, sans-serif" font-size="26" fill="#000" stroke="#000">
<title id="titulo">${escape(`Gráfico de ${names}`)}</title>
<desc id="descripcion">${escape(description)}</desc>
<rect width="${width}" height="${total}" fill="#fff" stroke="none"/>
<g stroke-width="3" fill="none">
<line x1="${margin}" x2="${width - margin}" y1="${axisY.toFixed(1)}" y2="${axisY.toFixed(1)}"/>
<line x1="${axisX.toFixed(1)}" x2="${axisX.toFixed(1)}" y1="${margin}" y2="${height - margin}"/>
</g>
<g fill="#000" stroke="none">${marks.filter((m) => m.startsWith('<text')).join('')}</g>
<g fill="none">${marks.filter((m) => m.startsWith('<line')).join('')}</g>
<defs><clipPath id="ventana"><rect x="${margin}" y="${margin}" width="${width - 2 * margin}" height="${height - 2 * margin}"/></clipPath></defs>
<g clip-path="url(#ventana)">${curves.join('')}</g>
<g stroke="none">${legend.join('')}</g>
</svg>
`;
}
