import type { ToolId } from '../components/toolCatalog';

export type CommandContext = ToolId | 'complex';
export type CommandAction =
  | { type: 'insert'; value: string }
  | { type: 'function'; expression: string; fields: string[] }
  | { type: 'tool'; tool: ToolId; operation?: string; variant?: string }
  | { type: 'graph'; operation: string }
  | { type: 'ui'; operation: string };
export interface MathCommand {
  id: string;
  name: string;
  description: string;
  shortcut: string;
  category: string;
  tool: ToolId | 'general';
  action: CommandAction;
  spokenLabel: string;
  customizable: boolean;
  contexts: CommandContext[] | 'all';
  global?: boolean;
  legacy?: boolean;
  level: 0 | 1 | 2;
}

const arithmetic: CommandContext[] = ['basic', 'scientific', 'advanced'];
const catalog: MathCommand[] = [];
function add(
  id: string,
  name: string,
  shortcut: string,
  category: string,
  contexts: MathCommand['contexts'],
  action: CommandAction,
  extra: Partial<MathCommand> = {},
) {
  catalog.push({
    id,
    name,
    shortcut,
    category,
    contexts,
    action,
    description: name,
    spokenLabel: name,
    tool:
      action.type === 'tool'
        ? action.tool
        : contexts === 'all'
          ? 'general'
          : contexts[0] === 'complex'
            ? 'vectors'
            : contexts[0],
    customizable: true,
    level: 1,
    ...extra,
  });
}
for (const [id, name, shortcut, operation] of [
  ['help', 'Ayuda contextual', 'F1', 'help'],
  ['read-expression', 'Escuchar expresión', 'Ctrl+Enter', 'read-expression'],
  ['basic', 'Ir a la calculadora', 'Alt+Shift+C', 'basic'],
  ['tools', 'Elegir herramienta', '', 'tools'],
  ['result', 'Ir al resultado', 'Alt+Shift+R', 'result'],
  ['history', 'Ir al historial', 'Alt+Shift+H', 'history'],
  ['graphs', 'Ir a gráficos', 'Alt+Shift+G', 'graphs'],
  ['matrices', 'Ir a matrices', 'Alt+Shift+M', 'matrices'],
  ['dictation', 'Iniciar o cancelar dictado', 'Alt+Shift+V', 'dictation'],
  ['diff', 'Abrir derivadas', 'Alt+Shift+D', 'diff'],
  ['integrate', 'Abrir integrales', '', 'integrate'],
  ['limit', 'Abrir límites', 'Alt+Shift+L', 'limit'],
])
  add(
    `global-${id}`,
    name,
    shortcut,
    'General',
    'all',
    { type: 'ui', operation },
    { global: true, legacy: true, customizable: false, level: 0 },
  );
for (const [id, name, shortcut] of [
  ['mode', 'Cambiar modo escritura o matemático', 'F2'],
  ['palette', 'Paleta de comandos', 'Alt+Shift+P'],
  ['keyboard', 'Teclado y atajos', 'Alt+Shift+K'],
  ['where', '¿Dónde estoy?', 'Alt+Shift+E'],
])
  add(
    id,
    name,
    shortcut,
    'General',
    'all',
    { type: 'ui', operation: id },
    { global: true, customizable: false, level: 0 },
  );
for (const [id, name, shortcut] of [
  ['read-result', 'Escuchar resultado', '; R'],
  ['read-error', 'Escuchar error', '; E'],
  ['read-message', 'Repetir último mensaje', '; U'],
  ['read-tool', 'Escuchar herramienta actual', '; H'],
  ['repeat-action', 'Repetir último cálculo', '; A'],
  ['caret-token', 'Leer lo que hay bajo el cursor', '; K'],
  ['caret-rest', 'Leer desde el cursor hasta el final', '; F'],
  ['caret-where', 'Decir dónde está el cursor', '; O'],
  ['caret-pair', 'Ir al paréntesis pareja', '; P'],
  ['caret-balance', 'Revisar paréntesis', '; B'],
  ['explore-expression', 'Explorar la expresión por partes', '; X'],
  ['explore-result', 'Explorar el resultado por partes', '; Z'],
  ['undo', 'Deshacer edición matemática', 'Ctrl+Z'],
  ['redo', 'Rehacer edición matemática', 'Ctrl+Y'],
  ['settings', 'Abrir configuración', ''],
])
  add(id, name, shortcut, 'General', 'all', { type: 'ui', operation: id });
add(
  'stop',
  'Detener voz y cancelar',
  'Escape',
  'General',
  'all',
  { type: 'ui', operation: 'stop' },
  { global: true, customizable: false, level: 0 },
);
for (const [value, name] of [...'0123456789']
  .map((value) => [value, `Número ${value}`])
  .concat([
    ['.', 'Separador decimal'],
    [',', 'Separador de argumentos'],
    ['+', 'Sumar'],
    ['-', 'Restar'],
    ['*', 'Multiplicar'],
    ['/', 'Dividir'],
    ['%', 'Porcentaje'],
    ['(', 'Abrir paréntesis'],
    [')', 'Cerrar paréntesis'],
  ]))
  add(
    `insert-${value}`,
    name,
    value,
    'Básica',
    arithmetic,
    { type: 'insert', value },
    { level: 0 },
  );
for (const [id, name, shortcut] of [
  ['calculate', 'Calcular expresión', 'Enter'],
  ['erase', 'Borrar último elemento', 'Backspace'],
  ['delete', 'Borrar selección o siguiente carácter', 'Delete'],
])
  add(id, name, shortcut, 'Básica', arithmetic, { type: 'ui', operation: id }, { level: 0 });
add(
  'equals',
  'Calcular expresión',
  '=',
  'Básica',
  ['basic', 'scientific'],
  { type: 'ui', operation: 'calculate' },
  { level: 0 },
);
add('equation-equals', 'Insertar igualdad', '=', 'Álgebra', ['advanced'], {
  type: 'insert',
  value: '=',
});
add('square', 'Elevar al cuadrado', 'Q', 'Científica', arithmetic, { type: 'insert', value: '^2' });
add('cube', 'Elevar al cubo', 'Shift+Q', 'Científica', arithmetic, { type: 'insert', value: '^3' });
for (const [id, name, shortcut, expression, fields] of [
  ['power', 'Potencia', 'P', '$0^$1', ['Base', 'Exponente']],
  ['sqrt', 'Raíz cuadrada', 'R', 'sqrt($0)', ['Radicando']],
  ['cbrt', 'Raíz cúbica', 'Shift+R', 'cbrt($0)', ['Radicando']],
  ['nthroot', 'Raíz de índice n', '; N', 'nthRoot($0,$1)', ['Radicando', 'Índice']],
  ['sin', 'Seno', 'S', 'sin($0)', ['Ángulo']],
  ['cos', 'Coseno', 'C', 'cos($0)', ['Ángulo']],
  ['tan', 'Tangente', 'T', 'tan($0)', ['Ángulo']],
  ['asin', 'Arcoseno', 'Shift+S', 'asin($0)', ['Valor']],
  ['acos', 'Arcocoseno', 'Shift+C', 'acos($0)', ['Valor']],
  ['atan', 'Arcotangente', 'Shift+T', 'atan($0)', ['Valor']],
  ['sinh', 'Seno hiperbólico', '; S', 'sinh($0)', ['Valor']],
  ['cosh', 'Coseno hiperbólico', '; C', 'cosh($0)', ['Valor']],
  ['tanh', 'Tangente hiperbólica', '; T', 'tanh($0)', ['Valor']],
  ['log', 'Logaritmo base diez', 'L', 'log($0)', ['Argumento']],
  ['ln', 'Logaritmo natural', 'Shift+L', 'ln($0)', ['Argumento']],
  ['log-base', 'Logaritmo de base personalizada', '; L', 'log($0,$1)', ['Argumento', 'Base']],
  ['exp', 'Exponencial', 'E', 'exp($0)', ['Exponente']],
  ['fraction', 'Fracción', '', '$0/$1', ['Numerador', 'Denominador']],
] as [string, string, string, string, string[]][])
  add(
    id,
    name,
    shortcut,
    'Científica',
    arithmetic,
    { type: 'function', expression, fields },
    {
      description: `Abrir formulario de ${name.toLowerCase()}. Revisá los datos antes de calcular.`,
      level: shortcut.startsWith(';') ? 2 : 1,
    },
  );
for (const [id, name, shortcut, operation, variant] of [
  ['derivative', 'Derivada', 'D', 'diff', 'first'],
  ['higher-derivative', 'Derivada de orden superior', 'Shift+D', 'diff', 'higher'],
  ['partial-derivative', 'Derivada parcial', '; D', 'diff', 'partial'],
  ['integral', 'Integral indefinida', 'I', 'integrate', 'indefinite'],
  ['definite-integral', 'Integral definida', 'Shift+I', 'integrate', 'definite'],
  ['limit', 'Límite bilateral', 'M', 'limit', 'both'],
  ['left-limit', 'Límite por izquierda', 'Shift+M', 'limit', 'left'],
  ['right-limit', 'Límite por derecha', '; M', 'limit', 'right'],
  ['factor', 'Factorizar', 'F', 'factor', ''],
  ['expand', 'Expandir', 'Shift+F', 'expand', ''],
  ['simplify', 'Simplificar', 'A', 'simplify', ''],
  ['substitute', 'Sustituir variable', 'Shift+A', 'substitute', ''],
  ['solve', 'Resolver ecuación', 'O', 'solve', ''],
  ['system', 'Resolver sistema lineal', 'Shift+O', 'system', ''],
  ['inequality', 'Resolver desigualdad', '', 'inequality', ''],
  ['series', 'Polinomio de Taylor', '', 'series', ''],
  ['partfrac', 'Fracciones parciales', '', 'partfrac', ''],
])
  add(
    id,
    name,
    shortcut,
    ['diff', 'integrate', 'limit', 'series'].includes(operation) ? 'Cálculo' : 'Álgebra',
    arithmetic,
    { type: 'tool', tool: 'advanced', operation, variant },
    {
      description: `Abrir ${name.toLowerCase()} y enfocar la función. Enter calcula después de revisar los parámetros.`,
      level: id === 'derivative' || id === 'integral' || id === 'solve' ? 0 : 1,
    },
  );
for (const [id, name, shortcut, operation] of [
  ['new', 'Editar dimensiones de matriz', 'N', 'new'],
  ['add', 'Sumar matrices', 'A', 'add'],
  ['subtract', 'Restar matrices', 'S', 'subtract'],
  ['multiply', 'Multiplicar matrices', 'M', 'multiply'],
  ['transpose', 'Transponer matriz', 'T', 'transpose'],
  ['det', 'Determinante', 'D', 'det'],
  ['inv', 'Inversa', 'I', 'inv'],
  ['rank', 'Rango', 'R', 'rank'],
  ['trace', 'Traza', '', 'trace'],
  ['eigvals', 'Autovalores', 'V', 'eigvals'],
  ['eigvecs', 'Autovectores', 'Shift+V', 'eigvecs'],
  ['lusolve', 'Resolver sistema matricial', '', 'lusolve'],
])
  add(`matrix-${id}`, name, shortcut, 'Matrices', ['matrices'], {
    type: 'tool',
    tool: 'matrices',
    operation,
  });
for (const [operation, name, shortcut] of [
  ['norm', 'Norma de vector', 'N'],
  ['dot', 'Producto punto', 'D'],
  ['cross', 'Producto cruz', 'C'],
  ['vectorangle', 'Ángulo entre vectores', 'A'],
  ['normalize', 'Normalizar vector', 'R'],
  ['distance', 'Distancia entre vectores', ''],
  ['add', 'Sumar vectores', ''],
  ['subtract', 'Restar vectores', ''],
])
  add(`vector-${operation}`, name, shortcut, 'Vectores', ['vectors'], {
    type: 'tool',
    tool: 'vectors',
    operation,
    variant: 'vector',
  });
for (const [operation, name, shortcut] of [
  ['abs', 'Módulo complejo', 'M'],
  ['arg', 'Argumento complejo', 'A'],
  ['conj', 'Conjugado', 'C'],
  ['polar', 'Forma polar', 'P'],
  ['re', 'Parte real', ''],
  ['im', 'Parte imaginaria', ''],
  ['power', 'Potencia compleja', ''],
  ['root', 'Raíz compleja principal', ''],
  ['nthRoots', 'Todas las raíces complejas', ''],
])
  add(`complex-${operation}`, name, shortcut, 'Complejos', ['complex'], {
    type: 'tool',
    tool: 'vectors',
    operation,
    variant: 'complex',
  });
add('complex-rect', 'Forma rectangular desde polar', 'R', 'Complejos', ['complex'], {
  type: 'function',
  expression: 'rect($0,$1)',
  fields: ['Módulo', 'Argumento en radianes'],
});
for (const [operation, name, shortcut] of [
  ['mean', 'Media', 'M'],
  ['median', 'Mediana', 'E'],
  ['mode', 'Moda', 'O'],
  ['std', 'Desviación estándar', 'D'],
  ['variance', 'Varianza', 'V'],
  ['quartiles', 'Cuartiles', 'Q'],
  ['percentile', 'Percentil', 'P'],
  ['correlation', 'Correlación', 'C'],
  ['regression', 'Regresión lineal', 'R'],
  ['stats', 'Resumen estadístico completo', ''],
  ['covariance', 'Covarianza', ''],
])
  add(`stats-${operation}`, name, shortcut, 'Estadística', ['statistics'], {
    type: 'tool',
    tool: 'statistics',
    operation,
  });
for (const [operation, name, shortcut] of [
  ['factorial', 'Factorial', 'F'],
  ['combinations', 'Combinaciones', 'C'],
  ['permutations', 'Permutaciones', 'P'],
  ['binomialpdf', 'Probabilidad binomial puntual', 'B'],
  ['binomialcdf', 'Probabilidad binomial acumulada', ''],
  ['normalcdf', 'Probabilidad normal acumulada', 'N'],
  ['normalpdf', 'Densidad normal', ''],
  ['invnorm', 'Normal inversa', ''],
  ['poissonpdf', 'Probabilidad de Poisson puntual', 'O'],
  ['poissoncdf', 'Probabilidad de Poisson acumulada', ''],
])
  add(`probability-${operation}`, name, shortcut, 'Probabilidad', ['probability'], {
    type: 'tool',
    tool: 'probability',
    operation,
  });
for (const [operation, shortcut] of [
  ['Longitud', 'L'],
  ['Masa', 'M'],
  ['Temperatura', 'T'],
  ['Velocidad', 'V'],
  ['Energía', 'E'],
  ['Presión', 'P'],
  ['Datos digitales', 'D'],
  ['Ángulos', 'A'],
  ['Área', ''],
  ['Volumen', ''],
  ['Potencia', ''],
  ['Tiempo', ''],
])
  add(
    `convert-${operation}`,
    `Convertir ${operation.toLowerCase()}`,
    shortcut,
    'Conversores',
    ['converters'],
    { type: 'tool', tool: 'converters', operation },
  );
for (const [operation, name, shortcut] of [
  ['left', 'Reducir coordenada X', 'ArrowLeft'],
  ['right', 'Aumentar coordenada X', 'ArrowRight'],
  ['step-up', 'Aumentar paso del gráfico', 'ArrowUp'],
  ['step-down', 'Reducir paso del gráfico', 'ArrowDown'],
  ['home', 'Inicio del intervalo', 'Home'],
  ['end', 'Final del intervalo', 'End'],
  ['zero', 'Cero más cercano', 'Z'],
  ['min', 'Mínimo cercano', 'M'],
  ['max', 'Máximo cercano', 'Shift+M'],
  ['intersection', 'Intersección cercana', 'I'],
  ['play', 'Iniciar sonificación', 'S'],
  ['pause', 'Pausar o continuar sonificación', 'Space'],
])
  add(`graph-${operation}`, name, shortcut, 'Gráficos', ['graphs'], { type: 'graph', operation });
for (const [id, name, shortcut, tool, operation] of [
  ['goto-derivative', 'Ir a derivada', 'G D', 'advanced', 'diff'],
  ['goto-integral', 'Ir a integral', 'G I', 'advanced', 'integrate'],
  ['goto-matrix', 'Ir a matrices', 'G M', 'matrices', ''],
  ['goto-graph', 'Ir a gráficos', 'G G', 'graphs', ''],
  ['goto-table', 'Ir a la tabla de valores', 'G T', 'table', ''],
  ['goto-ratio', 'Ir a proporciones', 'G P', 'ratio', ''],
  ['goto-sheet', 'Ir a la hoja de cálculo', 'G H', 'sheet', ''],
] as [string, string, string, ToolId, string][])
  add(id, name, shortcut, 'General', 'all', { type: 'tool', tool, operation });

export const commands: readonly MathCommand[] = catalog;
export const commandById = new Map(commands.map((command) => [command.id, command]));
export const categories = [...new Set(commands.map((command) => command.category))];
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\+\s*/g, '+')
    .trim();
export function contextsOverlap(a: MathCommand, b: MathCommand) {
  return (
    a.contexts === 'all' ||
    b.contexts === 'all' ||
    a.contexts.some((context) => b.contexts.includes(context))
  );
}
