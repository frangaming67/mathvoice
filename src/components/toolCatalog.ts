export const toolGroups = [
  {
    label: 'Cálculos',
    tools: [
      ['basic', 'Calculadora'],
      ['scientific', 'Funciones y constantes'],
      ['advanced', 'Álgebra y cálculo'],
    ],
  },
  {
    label: 'Datos y estructuras',
    tools: [
      ['matrices', 'Matrices'],
      ['vectors', 'Vectores y complejos'],
      ['statistics', 'Estadística'],
      ['probability', 'Probabilidad'],
    ],
  },
  {
    label: 'Otras herramientas',
    tools: [
      ['graphs', 'Gráficos'],
      ['converters', 'Conversores'],
      ['variables', 'Variables'],
    ],
  },
] as const;
export type ToolId = (typeof toolGroups)[number]['tools'][number][0];
export const toolName = (id: ToolId) =>
  toolGroups.flatMap((group) => [...group.tools]).find(([key]) => key === id)![1];
