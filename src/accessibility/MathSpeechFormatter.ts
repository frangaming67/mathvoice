import {
  parse,
  type MathNode,
  type FunctionNode,
  type OperatorNode,
  type ParenthesisNode,
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
};
const ops: Record<string, string> = {
  '+': 'más',
  '-': 'menos',
  '*': 'por',
  '/': 'dividido por',
  '^': 'elevado a',
  '%': 'por ciento',
  '!': 'factorial',
};
function read(node: MathNode): string {
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
    }
    if (expression.includes('='))
      return expression
        .split('=')
        .map((part) => mathSpeech(part.trim()))
        .join(' igual a ');
    return read(parse(normalizeExpression(expression)));
  } catch {
    return `Expresión incompleta: ${expression.replace(/[+\-*/^()]/g, (char) => ` ${ops[char] ?? (char === '(' ? 'abre paréntesis' : 'cierra paréntesis')} `)}`;
  }
}
