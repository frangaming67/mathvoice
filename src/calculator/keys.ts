// Teclado de la calculadora científica: cada tecla con su función principal, la de Shift
// (impresa en dorado) y la de Alpha (en rojo). Es solo datos: la acción la resuelve Calculator.

import type { ToolId } from '../components/toolCatalog';

export type Layer = 'main' | 'shift' | 'alpha';

/** Lugar del separador de argumentos en una plantilla: «,» con punto decimal, «;» con coma. */
export const SEP = '{,}';

export type KeyAction =
  | { op: 'layer'; layer: 'shift' | 'alpha' }
  | { op: 'insert'; text: string }
  /** Inserta antes y después del cursor; si hay texto elegido, lo envuelve. */
  | { op: 'wrap'; before: string; after: string }
  | { op: 'variable'; name: string }
  /** (−): signo negativo; después de un resultado empieza una cuenta nueva. */
  | { op: 'negative' }
  | { op: 'decimal' }
  | { op: 'separator' }
  | { op: 'calculate'; form?: 'decimal' }
  | { op: 'delete' }
  | { op: 'clear' }
  | { op: 'undo' }
  | { op: 'overwrite' }
  | { op: 'cursor'; direction: 'left' | 'right' }
  | { op: 'replay'; direction: 'previous' | 'next' }
  | { op: 'memory'; action: 'add' | 'subtract' | 'recall' }
  | { op: 'menu' }
  | { op: 'setup' }
  | { op: 'options' }
  | { op: 'power'; on: boolean }
  | { op: 'store' }
  | { op: 'recall' }
  | { op: 'toggle-form' }
  | { op: 'mixed' }
  | { op: 'engineering'; direction: 1 | -1 }
  | { op: 'dms' }
  | { op: 'factor' }
  | { op: 'solve' }
  | { op: 'calc' }
  | { op: 'prompt'; prompt: 'integral' | 'derivative' | 'sum' | 'random-int' }
  | { op: 'constants' }
  | { op: 'tool'; tool: ToolId }
  | { op: 'reset' }
  | { op: 'copy' }
  | { op: 'random' }
  | { op: 'previous-answer' };

export interface KeyFace {
  /** Lo que se ve impreso en la tecla o encima de ella. */
  label: string;
  /** Nombre accesible de la tecla cuando cumple esta función. */
  name: string;
  action: KeyAction;
}

export type KeyStyle = 'round' | 'arrow' | 'function' | 'number' | 'blue';

export interface CalculatorKey {
  id: string;
  style: KeyStyle;
  main: KeyFace;
  shift?: KeyFace;
  alpha?: KeyFace;
}

const face = (label: string, name: string, action: KeyAction): KeyFace => ({
  label,
  name,
  action,
});
const insert = (text: string): KeyAction => ({ op: 'insert', text });
const wrap = (before: string, after = ')'): KeyAction => ({ op: 'wrap', before, after });
const variable = (name: string): KeyAction => ({ op: 'variable', name });
const key = (
  id: string,
  style: KeyStyle,
  main: KeyFace,
  shift?: KeyFace,
  alpha?: KeyFace,
): CalculatorKey => ({ id, style, main, ...(shift && { shift }), ...(alpha && { alpha }) });
const digit = (value: string, name: string, shift?: KeyFace) =>
  key(`k${value}`, 'number', face(value, name, insert(value)), shift);

/** Fila de arriba: Shift y Alpha a la izquierda, Menú y On a la derecha. */
export const controlKeys: CalculatorKey[] = [
  key('shift', 'round', face('SHIFT', 'Shift', { op: 'layer', layer: 'shift' })),
  key('alpha', 'round', face('ALPHA', 'Alpha', { op: 'layer', layer: 'alpha' })),
  key(
    'menu',
    'round',
    face('MENU', 'Menú de modos', { op: 'menu' }),
    face('CONFIG', 'Configuración', { op: 'setup' }),
  ),
  key('on', 'round', face('ON', 'Encender', { op: 'power', on: true })),
];

/** Cruceta: izquierda y derecha mueven el cursor; arriba y abajo recorren cálculos anteriores. */
export const arrowKeys: CalculatorKey[] = [
  key('up', 'arrow', face('▲', 'Cálculo anterior', { op: 'replay', direction: 'previous' })),
  key('left', 'arrow', face('◀', 'Cursor a la izquierda', { op: 'cursor', direction: 'left' })),
  key('right', 'arrow', face('▶', 'Cursor a la derecha', { op: 'cursor', direction: 'right' })),
  key('down', 'arrow', face('▼', 'Cálculo siguiente', { op: 'replay', direction: 'next' })),
];

/** Las cuatro teclas negras que rodean la cruceta. */
export const sideKeys: CalculatorKey[] = [
  key(
    'optn',
    'function',
    face('OPTN', 'Opciones: buscar una función', { op: 'options' }),
    face('QR', 'Copiar el cálculo', { op: 'copy' }),
  ),
  key(
    'calc',
    'function',
    face('CALC', 'Calcular con valores para las variables', { op: 'calc' }),
    face('SOLVE', 'Resolver la ecuación', { op: 'solve' }),
    face('=', 'Signo igual', insert('=')),
  ),
  key(
    'integral',
    'function',
    face('∫▢', 'Integral definida', { op: 'prompt', prompt: 'integral' }),
    face('d/dx', 'Derivada en un punto', { op: 'prompt', prompt: 'derivative' }),
  ),
  key(
    'x',
    'function',
    face('x', 'Variable equis', variable('x')),
    face('Σ', 'Sumatoria', { op: 'prompt', prompt: 'sum' }),
  ),
];

/** Tres filas de funciones científicas, de seis teclas cada una. */
export const functionKeys: CalculatorKey[] = [
  key(
    'fraction',
    'function',
    face('▢/▢', 'Fracción', wrap('(', ')/()')),
    face('▢▢/▢', 'Número mixto', wrap('(', '+()/())')),
  ),
  key(
    'sqrt',
    'function',
    face('√▢', 'Raíz cuadrada', wrap('sqrt(')),
    face('∛▢', 'Raíz cúbica', wrap('cbrt(')),
  ),
  key(
    'square',
    'function',
    face('x²', 'Elevar al cuadrado', insert('^2')),
    face('x³', 'Elevar al cubo', insert('^3')),
  ),
  key(
    'power',
    'function',
    face('x▢', 'Potencia', wrap('^(')),
    face('ⁿ√▢', 'Raíz de índice n', wrap('nthRoot(', `${SEP})`)),
  ),
  key(
    'logb',
    'function',
    face('log▢▢', 'Logaritmo en base', wrap('log(', `${SEP})`)),
    face('10▢', 'Diez elevado a', wrap('10^(')),
  ),
  key(
    'ln',
    'function',
    face('ln', 'Logaritmo natural', wrap('ln(')),
    face('e▢', 'e elevado a', wrap('e^(')),
  ),
  key(
    'neg',
    'function',
    face('(−)', 'Signo negativo', { op: 'negative' }),
    face('log', 'Logaritmo decimal', wrap('log10(')),
    face('A', 'Variable A', variable('A')),
  ),
  key(
    'dms',
    'function',
    face('°′″', 'Grados, minutos y segundos', { op: 'dms' }),
    face('FACT', 'Descomponer en factores primos', { op: 'factor' }),
    face('B', 'Variable B', variable('B')),
  ),
  key(
    'inverse',
    'function',
    face('x⁻¹', 'Inverso', insert('^(-1)')),
    face('x!', 'Factorial', insert('!')),
    face('C', 'Variable C', variable('C')),
  ),
  key(
    'sin',
    'function',
    face('sen', 'Seno', wrap('sin(')),
    face('Arcsen', 'Arco seno', wrap('asin(')),
    face('D', 'Variable D', variable('D')),
  ),
  key(
    'cos',
    'function',
    face('cos', 'Coseno', wrap('cos(')),
    face('Arccos', 'Arco coseno', wrap('acos(')),
    face('E', 'Variable E', variable('E')),
  ),
  key(
    'tan',
    'function',
    face('tan', 'Tangente', wrap('tan(')),
    face('Arctan', 'Arco tangente', wrap('atan(')),
    face('F', 'Variable F', variable('F')),
  ),
  key(
    'sto',
    'function',
    face('STO', 'Guardar el resultado en una variable', { op: 'store' }),
    face('RECALL', 'Ver las variables guardadas', { op: 'recall' }),
  ),
  key(
    'eng',
    'function',
    face('ENG', 'Notación de ingeniería', { op: 'engineering', direction: 1 }),
    face('←', 'Notación de ingeniería hacia atrás', { op: 'engineering', direction: -1 }),
    face('i', 'Unidad imaginaria', insert('i')),
  ),
  key(
    'lparen',
    'function',
    face('(', 'Abrir paréntesis', insert('(')),
    face('Abs', 'Valor absoluto', wrap('abs(')),
    face('Simp', 'Simplificar', wrap('simplify(')),
  ),
  key(
    'rparen',
    'function',
    face(')', 'Cerrar paréntesis', insert(')')),
    face(',', 'Separador de argumentos', { op: 'separator' }),
    face('X', 'Variable equis', variable('x')),
  ),
  key(
    'sd',
    'function',
    face('S⇔D', 'Cambiar entre fracción y decimal', { op: 'toggle-form' }),
    face('a b/c', 'Fracción mixta', { op: 'mixed' }),
    face('Y', 'Variable ye', variable('y')),
  ),
  key(
    'mplus',
    'function',
    face('M+', 'Sumar resultado a memoria', { op: 'memory', action: 'add' }),
    face('M−', 'Restar resultado de memoria', { op: 'memory', action: 'subtract' }),
    face('M', 'Recuperar memoria', { op: 'memory', action: 'recall' }),
  ),
];

/** Cuatro filas de cinco: números, borrar y operaciones. */
export const numberKeys: CalculatorKey[] = [
  digit('7', 'Siete', face('CONST', 'Constantes físicas', { op: 'constants' })),
  digit('8', 'Ocho', face('CONV', 'Conversiones de unidades', { op: 'tool', tool: 'converters' })),
  digit('9', 'Nueve', face('RESET', 'Reiniciar la calculadora', { op: 'reset' })),
  key(
    'del',
    'blue',
    face('DEL', 'Borrar último carácter', { op: 'delete' }),
    face('INS', 'Modo sobrescribir', { op: 'overwrite' }),
    face('UNDO', 'Deshacer', { op: 'undo' }),
  ),
  key(
    'ac',
    'blue',
    face('AC', 'Borrar toda la expresión', { op: 'clear' }),
    face('OFF', 'Apagar la pantalla', { op: 'power', on: false }),
  ),
  digit('4', 'Cuatro'),
  digit('5', 'Cinco'),
  digit('6', 'Seis'),
  key(
    'times',
    'number',
    face('×', 'Multiplicar', insert('*')),
    face('nPr', 'Permutaciones', wrap('permutations(', `${SEP})`)),
    face('MCD', 'Máximo común divisor', wrap('gcd(', `${SEP})`)),
  ),
  key(
    'divide',
    'number',
    face('÷', 'Dividir', insert('/')),
    face('nCr', 'Combinaciones', wrap('combinations(', `${SEP})`)),
    face('MCM', 'Mínimo común múltiplo', wrap('lcm(', `${SEP})`)),
  ),
  digit('1', 'Uno'),
  digit('2', 'Dos'),
  digit('3', 'Tres'),
  key(
    'plus',
    'number',
    face('+', 'Sumar', insert('+')),
    face('Pol', 'De rectangulares a polares', wrap('polar(complex(', `${SEP}))`)),
    face('Int', 'Parte entera', wrap('fix(')),
  ),
  key(
    'minus',
    'number',
    face('−', 'Restar', insert('-')),
    face('Rec', 'De polares a rectangulares', wrap('rect(', `${SEP})`)),
    face('Intg', 'Mayor entero menor o igual', wrap('floor(')),
  ),
  digit('0', 'Cero', face('Rnd', 'Redondear', wrap('round('))),
  key(
    'dot',
    'number',
    face('.', 'Punto decimal', { op: 'decimal' }),
    face('Ran#', 'Número al azar', { op: 'random' }),
    face('RanInt', 'Entero al azar', { op: 'prompt', prompt: 'random-int' }),
  ),
  key(
    'exp10',
    'number',
    face('×10ˣ', 'Por diez a la', wrap('*10^(')),
    face('π', 'Pi', insert('pi')),
    face('e', 'Número e', insert('e')),
  ),
  key(
    'ans',
    'number',
    face('Ans', 'Resultado anterior', insert('ans')),
    face('%', 'Porcentaje', insert('%')),
    face('PreAns', 'Resultado previo al anterior', { op: 'previous-answer' }),
  ),
  key(
    'equals',
    'number',
    face('=', 'Igual, calcular', { op: 'calculate' }),
    face('≈', 'Calcular en decimal', { op: 'calculate', form: 'decimal' }),
  ),
];

export const allKeys = [...controlKeys, ...arrowKeys, ...sideKeys, ...functionKeys, ...numberKeys];

/**
 * Qué hace una tecla con la capa activa. Con STO pendiente, las teclas de variable guardan sin
 * necesidad de Alpha, como en la calculadora de mano.
 */
export function resolveFace(key: CalculatorKey, layer: Layer, storing = false): KeyFace {
  if (storing && key.alpha?.action.op === 'variable') return key.alpha;
  if (storing && key.id === 'x') return key.main;
  if (storing && key.id === 'mplus') return face('M', 'Memoria M', variable('M'));
  if (layer === 'shift' && key.shift) return key.shift;
  if (layer === 'alpha' && key.alpha) return key.alpha;
  return key.main;
}
