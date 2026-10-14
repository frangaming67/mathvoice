export const toolGroups = [
  {
    label: 'Cálculos',
    tools: [
      ['basic', 'Calculadora', 'Escribí o dictá una operación y escuchá el resultado.'],
      [
        'scientific',
        'Funciones y constantes',
        'Trigonometría, logaritmos, raíces y constantes para insertar en la expresión.',
      ],
      [
        'advanced',
        'Álgebra y cálculo',
        'Ecuaciones, sistemas, derivadas, integrales, límites y Taylor, con procedimiento.',
      ],
    ],
  },
  {
    label: 'Datos y estructuras',
    tools: [
      ['matrices', 'Matrices', 'Matrices de hasta 6 por 6: determinante, inversa y autovalores.'],
      [
        'vectors',
        'Vectores y complejos',
        'Módulo, productos punto y cruz, ángulos y números complejos.',
      ],
      [
        'statistics',
        'Estadística',
        'Media, mediana, desvío, cuartiles, correlación y regresión de tus datos.',
      ],
      [
        'probability',
        'Probabilidad',
        'Distribuciones normal, binomial y de Poisson; combinaciones y permutaciones.',
      ],
    ],
  },
  {
    label: 'Otras herramientas',
    tools: [
      ['graphs', 'Gráficos', 'Hasta 4 funciones para explorar con flechas, voz y sonido.'],
      [
        'converters',
        'Conversores',
        'Unidades de 12 categorías, bases numéricas y operaciones binarias.',
      ],
      ['variables', 'Variables', 'Valores con nombre para usar en otros cálculos.'],
    ],
  },
] as const;
export type ToolId = (typeof toolGroups)[number]['tools'][number][0];
export const toolName = (id: ToolId) =>
  toolGroups.flatMap((group) => [...group.tools]).find(([key]) => key === id)![1];
