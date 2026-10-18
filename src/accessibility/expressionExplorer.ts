// Explorador de expresiones: la fórmula como un árbol de partes que se recorre como en MathCAT.
// Cada parte sabe qué es (una fracción, una potencia, un término…), qué papel cumple en la parte
// que la contiene (numerador, exponente, término 2…), cómo se lee con el mismo formateador que
// el resto de la app y, si se pudo ubicar, dónde está en lo que se escribió.

import type {
  ArrayNode,
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  ParenthesisNode,
  SymbolNode,
} from 'mathjs';
import { normalizeWithMap } from '../parser/expression';
import type { DecimalSeparator } from '../types';
import { functionSpeechName, mathSpeech, type MathSpeechOptions } from './MathSpeechFormatter';
import { isEquals, parse, protect, splitTop } from './mathTree';

export interface ExplorerNode {
  /** Qué es: «fracción», «potencia», «suma», «número»… */
  kind: string;
  article: 'un' | 'una';
  /** La parte en sintaxis lineal, con punto decimal: sirve para mostrarla. */
  text: string;
  /** Cómo se dice, con el mismo formateador que la lectura completa. */
  spoken: string;
  children: { role: string; node: ExplorerNode }[];
  /** Desde dónde hasta dónde está en lo que se escribió; falta si no se pudo ubicar. */
  range?: [number, number];
  /** Mientras se arma el árbol: lo que abarca con los paréntesis que la encierran. */
  outer?: [number, number];
}
type Range = [number, number];

const PLACEHOLDER = /^_n(\d+)_$/;
const CONSTANTS = new Set(['pi', 'e', 'phi', 'tau', 'Infinity']);
const RELATIONS: Record<string, string> = {
  smaller: 'menor que',
  larger: 'mayor que',
  smallerEq: 'menor o igual que',
  largerEq: 'mayor o igual que',
  unequal: 'distinto de',
  equal: 'igual a',
};
/** Papel de cada argumento de las funciones que lo tienen definido. */
const ARGUMENTS: Record<string, string[]> = {
  sqrt: ['radicando'],
  cbrt: ['radicando'],
  nthRoot: ['radicando', 'índice'],
  log: ['argumento', 'base'],
  integrate: ['función', 'variable', 'límite inferior', 'límite superior'],
  diff: ['función', 'variable', 'orden'],
  sum: ['término', 'variable', 'desde', 'hasta'],
  limit: ['función', 'variable', 'punto'],
};
/** Nombre de las funciones que el formateador no nombra como función de un argumento. */
const FUNCTIONS: Record<string, [string, 'un' | 'una']> = {
  sqrt: ['raíz cuadrada', 'una'],
  cbrt: ['raíz cúbica', 'una'],
  nthRoot: ['raíz', 'una'],
  log: ['logaritmo', 'un'],
  ln: ['logaritmo natural', 'un'],
  log10: ['logaritmo decimal', 'un'],
  integrate: ['integral', 'una'],
  diff: ['derivada', 'una'],
  sum: ['sumatoria', 'una'],
  limit: ['límite', 'un'],
  abs: ['valor absoluto', 'un'],
  factorial: ['factorial', 'un'],
  exp: ['exponencial', 'una'],
  tan: ['tangente', 'una'],
  cot: ['cotangente', 'una'],
  sec: ['secante', 'una'],
  csc: ['cosecante', 'una'],
};
/** Papeles femeninos, para decir «la base» y «el exponente». */
const FEMININE = /^(base|función|variable|fila|columna|primera|segunda)/;
export const theRole = (role: string) => `${FEMININE.test(role) ? 'la' : 'el'} ${role}`;

/** Números y nombres del texto normalizado, en orden, con su posición. */
function leafTokens(text: string) {
  return Array.from(
    text.matchAll(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*/g),
    (match) => ({ text: match[0], start: match.index, end: match.index + match[0].length }),
  );
}
/** Posición del paréntesis que cierra el que abre en open. */
function closing(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(' || text[i] === '[') depth++;
    else if (text[i] === ')' || text[i] === ']') depth--;
    if (depth === 0) return i;
  }
  return text.length - 1;
}

interface Context {
  part: string;
  literals: string[];
  tokens: ReturnType<typeof leafTokens>;
  next: number;
  /** Se pierde en cuanto una hoja no coincide con lo escrito: así no se ubica nada mal. */
  aligned: boolean;
  speech: MathSpeechOptions;
}
type Child = ExplorerNode['children'][number];

const restore = (text: string, literals: string[]) =>
  text.replace(/\(_n(\d+)_\)|_n(\d+)_/g, (_m, a, b) => literals[Number(a ?? b)] ?? '0');
const say = (text: string, ctx: Context) =>
  mathSpeech(text, { ...ctx.speech, decimalSeparator: 'punto' });

/** Lo que abarcan las partes: del comienzo de la primera al final de la última. */
function span(children: Child[]): Range | undefined {
  const ranges = children.map((child) => child.node.outer ?? child.node.range);
  if (!ranges.length || ranges.some((range) => !range)) return undefined;
  return [Math.min(...ranges.map((r) => r![0])), Math.max(...ranges.map((r) => r![1]))];
}

/** La hoja siguiente de lo escrito; si no es la esperada, se deja de ubicar. */
function consume(ctx: Context, expected: string | null): Range | undefined {
  const token = ctx.tokens[ctx.next++];
  if (!token || (expected !== null && token.text !== expected)) ctx.aligned = false;
  return token && ctx.aligned ? [token.start, token.end] : undefined;
}

function make(
  ctx: Context,
  node: MathNode,
  kind: string,
  article: 'un' | 'una',
  children: Child[] = [],
  range: Range | undefined = span(children),
): ExplorerNode {
  const text = restore(node.toString(), ctx.literals);
  return { kind, article, text, spoken: say(text, ctx), children, ...(range && { range }) };
}

/** Términos de una suma o resta encadenada, con su signo; un paréntesis es un solo término. */
function terms(node: MathNode, sign = 1): { node: MathNode; sign: number }[] {
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode;
    if (op.fn === 'add' && op.args.length === 2)
      return [...terms(op.args[0], sign), ...terms(op.args[1], sign)];
    if (op.fn === 'subtract' && op.args.length === 2)
      return [...terms(op.args[0], sign), ...terms(op.args[1], -sign)];
  }
  return [{ node, sign }];
}
function factors(node: MathNode): MathNode[] {
  return node.type === 'OperatorNode' && (node as OperatorNode).fn === 'multiply'
    ? (node as OperatorNode).args.flatMap(factors)
    : [node];
}

/** Un término restado: se dice «menos …» y se muestra con su signo. */
function negated(node: ExplorerNode, ctx: Context): ExplorerNode {
  const grouped = node.kind === 'suma' || node.kind === 'resta';
  const text = grouped ? `-(${node.text})` : `-${node.text}`;
  return { ...node, text, spoken: say(text, ctx) };
}

function build(node: MathNode, ctx: Context): ExplorerNode {
  if (node.type === 'ParenthesisNode') {
    const content = (node as ParenthesisNode).content;
    // Los paréntesis que protegen las cifras de cada número no están en lo escrito.
    if (content.type === 'SymbolNode' && PLACEHOLDER.test((content as SymbolNode).name))
      return build(content, ctx);
    // La parte es lo de adentro; la que la contiene abarca también los paréntesis.
    const inner = build(content, ctx);
    const range = inner.outer ?? inner.range;
    if (!range) return inner;
    let open = range[0] - 1;
    while (open > 0 && ctx.part[open] === ' ') open--;
    return ctx.part[open] === '('
      ? { ...inner, outer: [open, closing(ctx.part, open) + 1] }
      : inner;
  }
  if (node.type === 'SymbolNode') {
    const name = (node as SymbolNode).name;
    if (PLACEHOLDER.test(name)) return make(ctx, node, 'número', 'un', [], consume(ctx, null));
    const range = consume(ctx, name);
    if (CONSTANTS.has(name)) return make(ctx, node, 'constante', 'una', [], range);
    if (name === 'i') return make(ctx, node, 'unidad imaginaria', 'una', [], range);
    return make(ctx, node, 'variable', 'una', [], range);
  }
  if (node.type === 'ConstantNode') {
    const text = typeof (node as ConstantNode).value === 'string';
    return make(ctx, node, text ? 'texto' : 'número', 'un', [], consume(ctx, null));
  }
  if (node.type === 'FunctionNode') {
    const fn = node as FunctionNode;
    const name = fn.fn.name ?? fn.fn.toString();
    const nameRange = consume(ctx, name);
    const roles = ARGUMENTS[name];
    const children = fn.args.map((arg, i) => ({
      role: roles?.[i] ?? (fn.args.length === 1 ? 'argumento' : `argumento ${i + 1}`),
      node: build(arg, ctx),
    }));
    const [kind, article] = FUNCTIONS[name] ?? [
      functionSpeechName(name) ?? `función ${name}`,
      'una',
    ];
    // La llamada va del nombre al paréntesis que la cierra.
    const open = nameRange ? ctx.part.indexOf('(', nameRange[1]) : -1;
    const range: Range | undefined =
      nameRange && open >= 0 ? [nameRange[0], closing(ctx.part, open) + 1] : undefined;
    return make(ctx, node, kind, article, children, range);
  }
  if (node.type === 'ArrayNode') {
    const items = (node as ArrayNode).items;
    const matrix = items.length > 0 && items.every((item) => item.type === 'ArrayNode');
    const children = items.map((item, i) => {
      if (!matrix) return { role: `elemento ${i + 1}`, node: build(item, ctx) };
      const cells = (item as ArrayNode).items.map((cell, j) => ({
        role: `columna ${j + 1}`,
        node: build(cell, ctx),
      }));
      return { role: `fila ${i + 1}`, node: make(ctx, item, 'fila', 'una', cells) };
    });
    return make(ctx, node, matrix ? 'matriz' : 'lista', 'una', children);
  }
  if (node.type !== 'OperatorNode') return make(ctx, node, 'parte', 'una');
  const op = node as OperatorNode;
  const pair = (first: string, second: string) => [
    { role: first, node: build(op.args[0], ctx) },
    { role: second, node: build(op.args[1], ctx) },
  ];
  switch (op.fn) {
    case 'add':
    case 'subtract': {
      const parts = terms(op);
      const children = parts.map(({ node: term, sign }, i) => {
        const built = build(term, ctx);
        return { role: `término ${i + 1}`, node: sign < 0 ? negated(built, ctx) : built };
      });
      const kind = parts.length === 2 && parts[1].sign < 0 ? 'resta' : 'suma';
      return make(ctx, node, kind, 'una', children);
    }
    case 'multiply':
      return make(
        ctx,
        node,
        'producto',
        'un',
        factors(op).map((factor, i) => ({ role: `factor ${i + 1}`, node: build(factor, ctx) })),
      );
    case 'divide':
      return make(ctx, node, 'fracción', 'una', pair('numerador', 'denominador'));
    case 'pow':
      return make(ctx, node, 'potencia', 'una', pair('base', 'exponente'));
    case 'unaryPlus':
      return build(op.args[0], ctx);
    case 'unaryMinus': {
      const inner = build(op.args[0], ctx);
      // Un número negativo es una sola parte: «-3», no «el opuesto de 3».
      if (inner.kind === 'número') {
        const start = inner.range && ctx.part.lastIndexOf('-', inner.range[0]);
        return {
          ...inner,
          text: `-${inner.text}`,
          spoken: say(`-${inner.text}`, ctx),
          ...(inner.range &&
            start !== undefined &&
            start >= 0 && { range: [start, inner.range[1]] }),
        };
      }
      return make(ctx, node, 'opuesto', 'un', [{ role: 'valor', node: inner }]);
    }
    case 'factorial': {
      const inner = build(op.args[0], ctx);
      const end = inner.range && ctx.part.indexOf('!', inner.range[1]);
      return make(
        ctx,
        node,
        'factorial',
        'un',
        [{ role: 'valor', node: inner }],
        inner.range && end !== undefined && end >= 0 ? [inner.range[0], end + 1] : undefined,
      );
    }
  }
  if (RELATIONS[op.fn])
    return make(ctx, node, `desigualdad`, 'una', pair('lado izquierdo', 'lado derecho'));
  return make(
    ctx,
    node,
    'operación',
    'una',
    op.args.map((arg, i) => ({ role: `operando ${i + 1}`, node: build(arg, ctx) })),
  );
}

/** Árbol de una parte del texto normalizado que empieza en offset. */
function buildPart(
  part: string,
  offset: number,
  map: number[],
  speech: MathSpeechOptions,
): ExplorerNode | null {
  const literals: string[] = [];
  let node: MathNode;
  try {
    node = parse(protect(part, literals));
  } catch {
    return null;
  }
  const ctx: Context = { part, literals, tokens: leafTokens(part), next: 0, aligned: true, speech };
  const tree = build(node, ctx);
  // Si alguna hoja no coincidió o sobraron nombres, no se ubica nada: mejor que ubicar mal.
  const located = ctx.aligned && ctx.next === ctx.tokens.length;
  const relocate = ({
    kind,
    article,
    text,
    spoken,
    children,
    range,
  }: ExplorerNode): ExplorerNode => ({
    kind,
    article,
    text,
    spoken,
    children: children.map((child) => ({ ...child, node: relocate(child.node) })),
    ...(located &&
      range && { range: [map[offset + range[0]], map[offset + range[1] - 1] + 1] as Range }),
  });
  return relocate(tree);
}

/**
 * La expresión como árbol de partes; una ecuación se divide en sus dos lados. Devuelve null si
 * no se puede interpretar.
 */
export function explorerTree(
  expression: string,
  options: { decimalSeparator?: DecimalSeparator; speech?: MathSpeechOptions } = {},
): ExplorerNode | null {
  if (!expression.trim()) return null;
  const mapped = normalizeWithMap(expression, { decimalSeparator: options.decimalSeparator });
  const speech = options.speech ?? {};
  const sides = splitTop(mapped.text, isEquals);
  if (sides.length !== 2) return buildPart(mapped.text, 0, mapped.map, speech);
  const left = buildPart(sides[0], 0, mapped.map, speech);
  const right = buildPart(sides[1], sides[0].length + 1, mapped.map, speech);
  if (!left || !right) return null;
  const children = [
    { role: 'lado izquierdo', node: left },
    { role: 'lado derecho', node: right },
  ];
  const range = span(children);
  return {
    kind: 'ecuación',
    article: 'una',
    text: mapped.text,
    spoken: mathSpeech(mapped.text, { ...speech, decimalSeparator: 'punto' }),
    children,
    ...(range && { range }),
  };
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Lo que se dice al llegar a una parte: su papel y, si tiene partes, qué es. */
export function describeNode(node: ExplorerNode, role: string): string {
  return node.children.length
    ? `${capitalized(role)}, ${node.kind}: ${node.spoken}`
    : `${capitalized(role)}: ${node.spoken}`;
}

/** «Fracción de 2 partes: el numerador es una suma y el denominador, una resta». */
export function summarize(node: ExplorerNode): string {
  if (!node.children.length) return `Es ${node.article} ${node.kind}: ${node.spoken}.`;
  const parts = node.children.map(({ role, node: child }, i) =>
    i === 0
      ? `${theRole(role)} es ${child.article} ${child.kind}`
      : `${theRole(role)}, ${child.article} ${child.kind}`,
  );
  const list = parts.length > 1 ? `${parts.slice(0, -1).join('; ')} y ${parts.at(-1)}` : parts[0];
  const count = node.children.length;
  return `${capitalized(node.kind)} de ${count} ${count === 1 ? 'parte' : 'partes'}: ${list}.`;
}
