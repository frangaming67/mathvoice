import {
  create,
  parseDependencies,
  type ConstantNode,
  type MathNode,
  type OperatorNode,
  type ParenthesisNode,
  type SymbolNode,
} from 'mathjs';

// Solo el parser de mathjs: evita cargar todas sus funciones en el hilo principal.
export const { parse } = create({ parseDependencies });

const LITERAL = /(?<![\w.])(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;
const PLACEHOLDER = /^_n(\d+)_$/;

/**
 * Reemplaza cada número escrito por un símbolo para conservar sus cifras exactas: mathjs
 * guarda los números como double y cambiaría los dígitos de los enteros grandes.
 */
export function protect(text: string, literals: string[]): string {
  return text
    .split(/("[^"]*"|'[^']*')/)
    .map((part, index) =>
      index % 2 ? part : part.replace(LITERAL, (raw) => `(_n${literals.push(raw) - 1}_)`),
    )
    .join('');
}
export function stripParens(node: MathNode): MathNode {
  let current = node;
  while (current.type === 'ParenthesisNode') current = (current as ParenthesisNode).content;
  return current;
}
/** Cifras escritas de un número (con signo si es negativo), o null si el nodo no es un número. */
export function literalOf(node: MathNode, literals: string[]): string | null {
  const inner = stripParens(node);
  if (inner.type === 'SymbolNode') {
    const match = (inner as SymbolNode).name.match(PLACEHOLDER);
    return match ? (literals[Number(match[1])] ?? null) : null;
  }
  if (inner.type === 'ConstantNode' && typeof (inner as ConstantNode).value === 'number')
    return String((inner as ConstantNode).value);
  if (inner.type === 'OperatorNode' && (inner as OperatorNode).fn === 'unaryMinus') {
    const value = literalOf((inner as OperatorNode).args[0], literals);
    return value === null || value.startsWith('-') ? null : `-${value}`;
  }
  return null;
}
/** Divide en el nivel superior (fuera de paréntesis, corchetes y comillas). */
export function splitTop(text: string, at: (text: string, index: number) => boolean): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && at(text, i)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}
export const isEquals = (text: string, i: number) =>
  text[i] === '=' && !'<>=!'.includes(text[i - 1] ?? '') && text[i + 1] !== '=';
