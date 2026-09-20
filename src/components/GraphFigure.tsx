import type { GraphData } from '../services/GraphService';
export function GraphFigure({ data }: { data: GraphData }) {
  const { request: r } = data;
  const sx = (x: number) => ((x - r.minX) * 700) / (r.maxX - r.minX);
  const sy = (y: number) => 350 - ((y - r.minY) * 350) / (r.maxY - r.minY);
  return (
    <svg
      className="graph-svg"
      viewBox="0 0 700 350"
      role="img"
      aria-label={`Gráfico de ${data.curves.map((c) => c.expression).join(', ')}. Hay controles de exploración y tabla de valores debajo.`}
    >
      <defs>
        <clipPath id="graph-clip">
          <rect width="700" height="350" />
        </clipPath>
      </defs>
      <g clipPath="url(#graph-clip)">
        <line x1="0" x2="700" y1={sy(0)} y2={sy(0)} stroke="currentColor" opacity=".4" />
        <line x1={sx(0)} x2={sx(0)} y1="0" y2="350" stroke="currentColor" opacity=".4" />
        {data.curves.map((curve, c) => {
          let pen = false;
          const path = curve.points
            .map((p, i) => {
              if (p.y === null) {
                pen = false;
                return '';
              }
              const command = !pen || curve.breaks.includes(i) ? 'M' : 'L';
              pen = true;
              return `${command}${sx(p.x).toFixed(2)},${Math.max(-100000, Math.min(100000, sy(p.y))).toFixed(2)}`;
            })
            .join(' ');
          return (
            <path
              key={c}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={
                c === 0 ? undefined : c === 1 ? '10 5' : c === 2 ? '3 5' : '12 4 3 4'
              }
            />
          );
        })}
      </g>
    </svg>
  );
}
