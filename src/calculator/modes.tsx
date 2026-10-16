import type { ReactNode } from 'react';
import type { ToolId } from '../components/toolCatalog';

/** Ícono de un modo del menú, dibujado como en la pantalla de la calculadora. */
function icon(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 32 24"
      width="32"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const text = (x: number, y: number, value: string, size = 10) => (
  <text x={x} y={y} fontSize={size} fill="currentColor" stroke="none" fontWeight="700">
    {value}
  </text>
);

export interface CalculatorMode {
  id: string;
  label: string;
  tool: ToolId;
  icon: ReactNode;
}

/** Modos del menú: cada uno abre una herramienta de MathVoice. */
export const calculatorModes: CalculatorMode[] = [
  {
    id: 'calcular',
    label: 'Calcular',
    tool: 'basic',
    icon: icon(
      <>
        {text(3, 10, '×÷')}
        {text(3, 22, '+−')}
      </>,
    ),
  },
  {
    id: 'complejos',
    label: 'Complejos',
    tool: 'vectors',
    icon: icon(
      <>
        {text(4, 17, 'i', 14)}
        <path d="M14 18 L28 18 M14 18 L24 6" />
      </>,
    ),
  },
  {
    id: 'base-n',
    label: 'Base-N',
    tool: 'converters',
    icon: icon(
      <>
        {text(2, 10, '2 8', 9)}
        {text(1, 22, '10 16', 9)}
      </>,
    ),
  },
  {
    id: 'matriz',
    label: 'Matriz',
    tool: 'matrices',
    icon: icon(
      <>
        <path d="M6 3 L3 3 L3 21 L6 21 M26 3 L29 3 L29 21 L26 21" />
        <path d="M10 8h0M16 8h0M22 8h0M10 16h0M16 16h0M22 16h0" strokeWidth="3" />
      </>,
    ),
  },
  {
    id: 'vector',
    label: 'Vector',
    tool: 'vectors',
    icon: icon(<path d="M4 20 L26 6 M26 6 L19 6 M26 6 L24 13 M4 20 L22 20" />),
  },
  {
    id: 'estadistica',
    label: 'Estadística',
    tool: 'statistics',
    icon: icon(<path d="M4 21 H28 M7 21 V13 M12 21 V6 M17 21 V10 M22 21 V15 M27 21 V18" />),
  },
  {
    id: 'distribucion',
    label: 'Distribución',
    tool: 'probability',
    icon: icon(<path d="M2 21 C9 21 11 4 16 4 C21 4 23 21 30 21" />),
  },
  {
    id: 'graficos',
    label: 'Gráficos',
    tool: 'graphs',
    icon: icon(<path d="M4 2 V22 H30 M5 19 C11 19 13 5 19 9 C24 12 25 4 29 3" />),
  },
  {
    id: 'ecuaciones',
    label: 'Ecuaciones y cálculo',
    tool: 'advanced',
    icon: icon(
      <>
        {text(1, 16, 'x=?', 12)}
        <path d="M2 21 H30" strokeWidth="1" />
      </>,
    ),
  },
  {
    id: 'funciones',
    label: 'Funciones y constantes',
    tool: 'scientific',
    icon: icon(text(1, 17, 'f(x)', 12)),
  },
  {
    id: 'variables',
    label: 'Variables',
    tool: 'variables',
    icon: icon(
      <>
        {text(2, 17, 'A', 12)}
        {text(18, 17, 'B', 12)}
      </>,
    ),
  },
  {
    id: 'conversiones',
    label: 'Conversiones',
    tool: 'converters',
    icon: icon(<path d="M5 8 H27 M27 8 L22 4 M27 16 H5 M5 16 L10 20" />),
  },
];
