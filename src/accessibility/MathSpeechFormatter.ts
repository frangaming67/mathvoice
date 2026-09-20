import {
  parse,
  type MathNode,
  type FunctionNode,
  type OperatorNode,
  type ParenthesisNode,
  type ArrayNode,
  type ConstantNode,
  type RelationalNode,
} from 'mathjs';
import { normalizeExpression } from '../parser/expression';
import { parseCommand } from '../parser/commands';
const names: Record<string, string> = {
  sqrt: 'raíz cuadrada',
  cbrt: 'raíz cúbica',
  sin: 'seno',
  cos: 'coseno',
  tan: 'tangente',
  asin: 'arco seno',
  acos: 'arco coseno',
  atan: 'arco tangente',
  sinh: 'seno hiperbólico',
  cosh: 'coseno hiperbólico',
  tanh: 'tangente hiperbólica',
  log: 'logaritmo',
  ln: 'logaritmo natural',
  exp: 'exponencial',
  factorial: 'factorial',
  abs: 'valor absoluto',
  floor: 'redondeo hacia abajo',
  ceil: 'redondeo hacia arriba',
  round: 'redondeo',
  sign: 'signo',
  gcd: 'máximo común divisor',
  lcm: 'mínimo común múltiplo',
  mod: 'resto',
  fraction: 'fracción',
  x: 'equis',
  y: 'ye',
  pi: 'pi',
  phi: 'fi',
  Infinity: 'infinito',
  simplify: 'simplificación',
  factor: 'factorización',
  expand: 'expansión',
  partfrac: 'descomposición en fracciones parciales',
  C: 'constante de integración',
  i: 'unidad imaginaria',
  det: 'determinante',
  inv: 'inversa',
  transpose: 'transpuesta',
  trace: 'traza',
  rank: 'rango',
  eigvals: 'autovalores',
  eigvecs: 'autovectores',
  dot: 'producto punto',
  cross: 'producto cruz',
  norm: 'norma',
  normalize: 'normalización',
  distance: 'distancia',
  vectorangle: 'ángulo entre vectores',
  conj: 'conjugado',
  re: 'parte real',
  im: 'parte imaginaria',
  arg: 'argumento',
  polar: 'forma polar',
  rect: 'forma rectangular',
  stats: 'resumen estadístico',
  percentile: 'percentil',
  covariance: 'covarianza',
  correlation: 'correlación',
  regression: 'regresión lineal',
  normalpdf: 'densidad normal',
  normalcdf: 'probabilidad normal acumulada',
  binomialpdf: 'probabilidad binomial',
  binomialcdf: 'probabilidad binomial acumulada',
  poissonpdf: 'probabilidad de Poisson',
  poissoncdf: 'probabilidad de Poisson acumulada',
  combinations: 'combinaciones',
  permutations: 'permutaciones',
  convert: 'conversión de unidades',
  base: 'conversión de base',
  bitop: 'operación binaria',
  nthRoots: 'raíces complejas',
  mixed: 'forma mixta',
  mixedNumber: 'número mixto',
  series: 'polinomio de Taylor',
  inequality: 'desigualdad',
};
const ops: Record<string, string> = {
  '+': 'más',
  '-': 'menos',
  '*': 'por',
  '/': 'dividido por',
  '^': 'elevado a',
  '%': 'por ciento',
  '!': 'factorial',
  '<': 'menor que',
  '>': 'mayor que',
  '<=': 'menor o igual que',
  '>=': 'mayor o igual que',
  '==': 'igual a',
  '!=': 'distinto de',
};
const comparisons: Record<string, string> = {
  smaller: ops['<'],
  larger: ops['>'],
  smallerEq: ops['<='],
  largerEq: ops['>='],
  equal: ops['=='],
  unequal: ops['!='],
};
function numberSpeech(value: string): string {
  const scientific = value.match(/^([\d.]+)[eE]([+-]?\d+)$/);
  if (scientific)
    return `${numberSpeech(scientific[1])} por diez elevado a ${scientific[2].startsWith('-') ? 'menos ' : ''}${scientific[2].replace(/^[+-]/, '')}`;
  return value.replace(/\./g, ' coma ');
}
function read(node: MathNode): string {
  if (node.type === 'ConstantNode') {
    const value = (node as ConstantNode).value;
    return typeof value === 'string' ? value : numberSpeech(String(value));
  }
  if (node.type === 'RelationalNode') {
    const relation = node as RelationalNode;
    return relation.params
      .map(
        (part, index) =>
          `${index ? `${comparisons[relation.conditionals[index - 1]] ?? relation.conditionals[index - 1]} ` : ''}${read(part)}`,
      )
      .join(' ');
  }
  if (node.type === 'ArrayNode') {
    const items = (node as ArrayNode).items;
    return items.some((item) => item.type === 'ArrayNode')
      ? `Matriz de ${items.length} filas. ${items.map((row, i) => `Fila ${i + 1}: ${read(row)}`).join('. ')}`
      : `Lista de ${items.length} elementos: ${items.map(read).join('; ')}; fin de lista`;
  }
  if (node.type === 'ParenthesisNode')
    return `abre paréntesis, ${read((node as ParenthesisNode).content)}, cierra paréntesis`;
  if (node.type === 'FunctionNode') {
    const n = node as FunctionNode;
    return `${names[n.fn.name ?? ''] ?? n.fn.name} de ${n.args.map(read).join(', argumento ')}; fin de ${names[n.fn.name ?? ''] ?? n.fn.name}`;
  }
  if (node.type === 'OperatorNode') {
    const n = node as OperatorNode;
    if (n.op === '^' && ['2', '3'].includes(n.args[1].toString()))
      return `${read(n.args[0])} al ${n.args[1].toString() === '2' ? 'cuadrado' : 'cubo'}`;
    if (n.args.length === 1)
      return n.op === '!'
        ? `${read(n.args[0])} factorial`
        : `${ops[n.op] ?? n.op} ${read(n.args[0])}`;
    return n.args.map(read).join(` ${ops[n.op] ?? n.op} `);
  }
  return names[node.toString()] ?? node.toString().replace(/\./g, ' coma ');
}
export function mathSpeech(expression: string): string {
  if (!expression.trim()) return 'La expresión está vacía.';
  expression = normalizeExpression(expression)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(expression))
    return `${expression.startsWith('-') ? 'menos ' : ''}${numberSpeech(expression.replace(/^[+-]/, ''))}`;
  try {
    if (expression.includes(';'))
      return expression
        .split(';')
        .map((part) => mathSpeech(part.trim()))
        .join('. ');
    const command = parseCommand(normalizeExpression(expression));
    if (command) {
      const a = command.args;
      if (command.name === 'system')
        return `Sistema de ecuaciones. ${a.map((equation, i) => `Ecuación ${i + 1}: ${mathSpeech(equation)}`).join('. ')}`;
      if (command.name === 'substitute')
        return `Sustituir ${mathSpeech(a[1])} por ${mathSpeech(a[2])} en ${mathSpeech(a[0])}`;
      if (command.name === 'diff')
        return `Derivada${a[2] ? ` de orden ${a[2]}` : ''} de ${mathSpeech(a[0])} respecto de ${mathSpeech(a[1] ?? 'x')}`;
      if (command.name === 'integrate')
        return `Integral de ${mathSpeech(a[0])} respecto de ${mathSpeech(a[1] ?? 'x')}${a[2] ? `, desde ${mathSpeech(a[2])} hasta ${mathSpeech(a[3])}` : ''}`;
      if (command.name === 'limit')
        return `Límite cuando ${mathSpeech(a[1])} tiende a ${mathSpeech(a[2])} de ${mathSpeech(a[0])}`;
      if (command.name === 'solve')
        return `Resolver ${mathSpeech(a[0])} para ${mathSpeech(a[1] ?? 'x')}`;
      if (command.name === 'inequality')
        return `Resolver la desigualdad ${mathSpeech(a[0])} para ${mathSpeech(a[1] ?? 'x')}`;
      if (command.name === 'series')
        return `Polinomio de Taylor${a[3] ? ` de orden ${mathSpeech(a[3])}` : ''} de ${mathSpeech(a[0])} respecto de ${mathSpeech(a[1] ?? 'x')}, centrado en ${mathSpeech(a[2] ?? '0')}`;
      if (command.name === 'nthRoots' && a.length === 2)
        return `Raíces complejas de índice ${mathSpeech(a[1])} de ${mathSpeech(a[0])}`;
      if (command.name === 'mixedNumber' && a.length === 3)
        return `Número mixto: ${mathSpeech(a[0])} enteros y ${mathSpeech(a[1])} dividido por ${mathSpeech(a[2])}`;
    }
    if (/(?<![<>=!])=(?!=)/.test(expression))
      return expression
        .split(/(?<![<>=!])=(?!=)/)
        .map((part) => mathSpeech(part.trim()))
        .join(' igual a ');
    return read(parse(expression));
  } catch {
    return `Expresión incompleta: ${expression.replace(/[+\-*/^()]/g, (char) => ` ${ops[char] ?? (char === '(' ? 'abre paréntesis' : 'cierra paréntesis')} `)}`;
  }
}
