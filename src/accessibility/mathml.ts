import type {
  ArrayNode,
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  ParenthesisNode,
  RelationalNode,
  SymbolNode,
} from 'mathjs';
import { normalizeExpression } from '../parser/expression';
import { parseCommand } from '../parser/commands';
import type { DecimalSeparator } from '../types';
import { isEquals, literalOf, parse, protect, splitTop, stripParens } from './mathTree';

export interface MathMLOptions {
  display?: 'inline' | 'block';
  decimalSeparator?: DecimalSeparator;
  /** Texto alternativo para lectores sin soporte de MathML. */
  alttext?: string;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const APPLY = '<mo>&#x2061;</mo>';
const TIMES = '<mo>&#x2062;</mo>';
const SYMBOLS: Record<string, string> = {
  pi: 'π',
  Infinity: '∞',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
};
const RELATIONS: Record<string, string> = {
  '<': '<',
  '>': '>',
  '<=': '≤',
  '>=': '≥',
  '==': '=',
  '!=': '≠',
  smaller: '<',
  larger: '>',
  smallerEq: '≤',
  largerEq: '≥',
  equal: '=',
  unequal: '≠',
};
const NAMED = new Set([
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'sinh',
  'cosh',
  'tanh',
  'ln',
  'log',
  'det',
  'max',
  'min',
  'gcd',
  'lcm',
  'arg',
]);
const INVERSES: Record<string, string> = {
  asin: 'sin',
  acos: 'cos',
  atan: 'tan',
  asinh: 'sinh',
  acosh: 'cosh',
  atanh: 'tanh',
};

interface Context {
  literals: string[];
  comma: boolean;
}

const row = (...parts: string[]) =>
  parts.length === 1 ? parts[0] : `<mrow>${parts.join('')}</mrow>`;
const fenced = (inner: string, open = '(', close = ')') =>
  `<mrow><mo>${escape(open)}</mo>${inner}<mo>${escape(close)}</mo></mrow>`;

function number(raw: string, ctx: Context): string {
  const negative = raw.startsWith('-');
  const digits = raw.replace(/^[+-]/, '');
  const exponent = digits.match(/^([\d.]+)[eE]([+-]?\d+)$/);
  const mantissa = (text: string) => `<mn>${ctx.comma ? text.replace('.', ',') : text}</mn>`;
  const body = exponent
    ? row(
        mantissa(exponent[1]),
        '<mo>·</mo>',
        `<msup><mn>10</mn><mn>${Number(exponent[2])}</mn></msup>`,
      )
    : mantissa(digits);
  return negative ? row('<mo>−</mo>', body) : body;
}
/** Átomo que no necesita paréntesis como argumento de una función. */
function atomic(node: MathNode, ctx: Context): boolean {
  const inner = stripParens(node);
  return (
    (literalOf(node, ctx.literals) !== null && !literalOf(node, ctx.literals)!.startsWith('-')) ||
    inner.type === 'SymbolNode'
  );
}
// Una fracción ya se ve agrupada: (1/3)·x³ no necesita paréntesis.
const fraction = (node: MathNode) =>
  node.type === 'OperatorNode' && (node as OperatorNode).op === '/';
function group(node: MathNode, ctx: Context): string {
  return atomic(node, ctx) ? render(node, ctx) : fenced(render(stripParens(node), ctx));
}
function functionCall(node: FunctionNode, ctx: Context): string {
  const name = node.fn.toString();
  const args = node.args;
  const all = () => fenced(args.map((arg) => render(stripParens(arg), ctx)).join('<mo>,</mo>'));
  switch (name) {
    case 'sqrt':
      return `<msqrt>${render(stripParens(args[0]), ctx)}</msqrt>`;
    case 'cbrt':
      return `<mroot>${render(stripParens(args[0]), ctx)}<mn>3</mn></mroot>`;
    case 'nthRoot':
      return args.length > 1
        ? `<mroot>${render(stripParens(args[0]), ctx)}${render(args[1], ctx)}</mroot>`
        : `<msqrt>${render(stripParens(args[0]), ctx)}</msqrt>`;
    case 'abs':
      return fenced(render(stripParens(args[0]), ctx), '|', '|');
    case 'exp':
      return `<msup><mi>e</mi>${render(stripParens(args[0]), ctx)}</msup>`;
    case 'factorial':
      return row(group(args[0], ctx), '<mo>!</mo>');
    case 'fraction':
      if (args.length > 1)
        return `<mfrac>${render(stripParens(args[0]), ctx)}${render(stripParens(args[1]), ctx)}</mfrac>`;
      break;
    case 'log':
      if (args.length > 1)
        return row(`<msub><mi>log</mi>${render(args[1], ctx)}</msub>`, APPLY, group(args[0], ctx));
      break;
    case 'log10':
    case 'log2':
      return row(`<msub><mi>log</mi><mn>${name.slice(3)}</mn></msub>`, APPLY, group(args[0], ctx));
  }
  if (INVERSES[name])
    return row(
      `<msup><mi>${INVERSES[name]}</mi><mrow><mo>−</mo><mn>1</mn></mrow></msup>`,
      APPLY,
      group(args[0], ctx),
    );
  if (NAMED.has(name) && args.length === 1)
    return row(`<mi>${name}</mi>`, APPLY, group(args[0], ctx));
  return row(`<mi>${escape(name)}</mi>`, APPLY, all());
}
function operator(node: OperatorNode, ctx: Context): string {
  const [a, b] = node.args;
  if (node.args.length === 1) {
    if (node.fn === 'unaryMinus') return row('<mo>−</mo>', render(a, ctx));
    if (node.fn === 'unaryPlus') return row('<mo>+</mo>', render(a, ctx));
    if (node.op === '!') return row(group(a, ctx), '<mo>!</mo>');
    if (node.op === '%') return row(render(a, ctx), '<mo>%</mo>');
    return row(`<mo>${escape(node.op)}</mo>`, render(a, ctx));
  }
  switch (node.op) {
    case '/':
      return `<mfrac>${render(stripParens(a), ctx)}${render(stripParens(b), ctx)}</mfrac>`;
    case '^':
      return `<msup>${render(a, ctx)}${render(stripParens(b), ctx)}</msup>`;
    case '*':
      return row(render(a, ctx), node.implicit ? TIMES : '<mo>·</mo>', render(b, ctx));
    case '+':
      return row(render(a, ctx), '<mo>+</mo>', render(b, ctx));
    case '-':
      return row(render(a, ctx), '<mo>−</mo>', render(b, ctx));
    case '%':
    case 'mod':
      return row(render(a, ctx), '<mo>mod</mo>', render(b, ctx));
  }
  const symbol = RELATIONS[node.op] ?? node.op;
  return row(render(a, ctx), `<mo>${escape(symbol)}</mo>`, render(b, ctx));
}
function array(node: ArrayNode, ctx: Context): string {
  if (node.items.length && node.items.every((item) => item.type === 'ArrayNode'))
    return fenced(
      `<mtable>${(node.items as ArrayNode[])
        .map(
          (itemRow) =>
            `<mtr>${itemRow.items.map((item) => `<mtd>${render(item, ctx)}</mtd>`).join('')}</mtr>`,
        )
        .join('')}</mtable>`,
    );
  return fenced(node.items.map((item) => render(item, ctx)).join('<mo>,</mo>'), '[', ']');
}
function render(node: MathNode, ctx: Context): string {
  const raw = literalOf(node, ctx.literals);
  if (raw !== null) return number(raw, ctx);
  switch (node.type) {
    case 'ParenthesisNode': {
      const content = (node as ParenthesisNode).content;
      return atomic(content, ctx) || fraction(content)
        ? render(content, ctx)
        : fenced(render(content, ctx));
    }
    case 'SymbolNode': {
      const name = (node as SymbolNode).name;
      return `<mi>${escape(SYMBOLS[name] ?? name)}</mi>`;
    }
    case 'ConstantNode':
      return `<mtext>${escape(String((node as ConstantNode).value))}</mtext>`;
    case 'ArrayNode':
      return array(node as ArrayNode, ctx);
    case 'FunctionNode':
      return functionCall(node as FunctionNode, ctx);
    case 'OperatorNode':
      return operator(node as OperatorNode, ctx);
    case 'RelationalNode': {
      const relation = node as RelationalNode;
      return row(
        ...relation.params.flatMap((part, i) =>
          i
            ? [
                `<mo>${escape(RELATIONS[relation.conditionals[i - 1]] ?? '?')}</mo>`,
                render(part, ctx),
              ]
            : [render(part, ctx)],
        ),
      );
    }
  }
  throw new Error('Nodo no representable');
}
function command(text: string, ctx: Context): string | null {
  const match = text.match(/^(diff|integrate|limit)\s*\(/);
  if (!match) return null;
  const parsed = parseCommand(text);
  if (!parsed) return null;
  const [f, v = 'x', a, b] = parsed.args;
  const body = statement(f, ctx);
  const variable = statement(v, ctx);
  if (parsed.name === 'diff') {
    const order = a && a !== '1' ? `<msup><mi>d</mi>${statement(a, ctx)}</msup>` : '<mi>d</mi>';
    const below =
      a && a !== '1'
        ? `<msup>${row('<mi>d</mi>', variable)}${statement(a, ctx)}</msup>`
        : row('<mi>d</mi>', variable);
    return row(`<mfrac>${order}${below}</mfrac>`, fenced(body));
  }
  if (parsed.name === 'integrate') {
    const sign =
      a !== undefined
        ? `<msubsup><mo>∫</mo>${statement(a, ctx)}${statement(b, ctx)}</msubsup>`
        : '<mo>∫</mo>';
    return row(sign, body, '<mo>&#x2009;</mo><mi>d</mi>', variable);
  }
  return row(
    `<munder><mo>lim</mo>${row(variable, '<mo>→</mo>', statement(a ?? '0', ctx))}</munder>`,
    body,
  );
}
function statement(text: string, ctx: Context): string {
  const trimmed = text.trim();
  const statements = splitTop(trimmed, (t, i) => t[i] === ';');
  if (statements.length > 1)
    return row(
      ...statements
        .map((part) => statement(part, ctx))
        .flatMap((part, i) =>
          i ? ['<mo separator="true">;</mo><mspace width="1em"/>', part] : [part],
        ),
    );
  const plusMinus = splitTop(trimmed, (t, i) => t[i] === '±');
  if (plusMinus.length > 1)
    return row(
      ...plusMinus
        .map((part) => statement(part, ctx))
        .flatMap((part, i) => (i ? ['<mo>±</mo>', part] : [part])),
    );
  const fromCommand = command(trimmed, ctx);
  if (fromCommand) return fromCommand;
  const sides = splitTop(trimmed, isEquals);
  if (sides.length > 1)
    return row(
      ...sides
        .map((side) => statement(side, ctx))
        .flatMap((part, i) => (i ? ['<mo>=</mo>', part] : [part])),
    );
  return render(parse(protect(trimmed, ctx.literals)), ctx);
}
function prepare(expression: string, options: { decimalSeparator?: DecimalSeparator }): string {
  const text = expression
    .replace(/∞/g, 'Infinity')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=');
  try {
    return normalizeExpression(text, { decimalSeparator: options.decimalSeparator });
  } catch {
    return text;
  }
}

/** MathML presentacional de una expresión o resultado; null si no se puede representar. */
export function toMathML(expression: string, options: MathMLOptions = {}): string | null {
  if (!expression.trim()) return null;
  try {
    const ctx: Context = { literals: [], comma: options.decimalSeparator === 'coma' };
    const body = statement(prepare(expression, options), ctx);
    const alt = options.alttext ? ` alttext="${escape(options.alttext)}"` : '';
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${options.display ?? 'block'}"${alt}>${body}</math>`;
  } catch {
    return null;
  }
}

// LaTeX: mismo recorrido, para pegar en documentos o mandar a un docente.
function latex(node: MathNode, ctx: Context): string {
  const raw = literalOf(node, ctx.literals);
  if (raw !== null) {
    const exponent = raw.match(/^(-?[\d.]+)[eE]([+-]?\d+)$/);
    const text = exponent ? `${exponent[1]} \\cdot 10^{${Number(exponent[2])}}` : raw;
    return ctx.comma ? text.replace('.', '{,}') : text;
  }
  const paren = (inner: MathNode) =>
    atomic(inner, ctx) ? latex(inner, ctx) : `\\left(${latex(stripParens(inner), ctx)}\\right)`;
  switch (node.type) {
    case 'ParenthesisNode': {
      const content = (node as ParenthesisNode).content;
      return atomic(content, ctx) || fraction(content)
        ? latex(content, ctx)
        : `\\left(${latex(content, ctx)}\\right)`;
    }
    case 'SymbolNode': {
      const name = (node as SymbolNode).name;
      if (name === 'Infinity') return '\\infty';
      if (SYMBOLS[name] && name !== 'Infinity') return `\\${name}`;
      return name.length > 1 ? `\\mathrm{${name}}` : name;
    }
    case 'ConstantNode':
      return `\\text{${String((node as ConstantNode).value)}}`;
    case 'ArrayNode': {
      const items = (node as ArrayNode).items;
      if (items.length && items.every((item) => item.type === 'ArrayNode'))
        return `\\begin{pmatrix}${(items as ArrayNode[]).map((r) => r.items.map((item) => latex(item, ctx)).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
      return `\\left[${items.map((item) => latex(item, ctx)).join(', ')}\\right]`;
    }
    case 'FunctionNode': {
      const call = node as FunctionNode;
      const name = call.fn.toString();
      const [a, b] = call.args;
      if (name === 'sqrt') return `\\sqrt{${latex(stripParens(a), ctx)}}`;
      if (name === 'cbrt') return `\\sqrt[3]{${latex(stripParens(a), ctx)}}`;
      if (name === 'nthRoot')
        return `\\sqrt[${b ? latex(b, ctx) : 2}]{${latex(stripParens(a), ctx)}}`;
      if (name === 'abs') return `\\left|${latex(stripParens(a), ctx)}\\right|`;
      if (name === 'exp') return `e^{${latex(stripParens(a), ctx)}}`;
      if (name === 'factorial') return `${paren(a)}!`;
      if (name === 'fraction' && b)
        return `\\frac{${latex(stripParens(a), ctx)}}{${latex(stripParens(b), ctx)}}`;
      if (name === 'log' && b) return `\\log_{${latex(b, ctx)}}${paren(a)}`;
      if (name === 'log10' || name === 'log2') return `\\log_{${name.slice(3)}}${paren(a)}`;
      if (INVERSES[name]) return `\\${INVERSES[name]}^{-1}${paren(a)}`;
      // El espacio separa el comando de una letra: \sin x, no \sinx.
      if (NAMED.has(name) && call.args.length === 1) return `\\${name} ${paren(a)}`;
      return `\\operatorname{${name}}\\left(${call.args.map((arg) => latex(stripParens(arg), ctx)).join(', ')}\\right)`;
    }
    case 'OperatorNode': {
      const op = node as OperatorNode;
      const [a, b] = op.args;
      if (op.args.length === 1) {
        if (op.fn === 'unaryMinus') return `-${latex(a, ctx)}`;
        if (op.op === '!') return `${paren(a)}!`;
        if (op.op === '%') return `${latex(a, ctx)}\\%`;
        return `${op.op}${latex(a, ctx)}`;
      }
      if (op.op === '/')
        return `\\frac{${latex(stripParens(a), ctx)}}{${latex(stripParens(b), ctx)}}`;
      if (op.op === '^') return `{${latex(a, ctx)}}^{${latex(stripParens(b), ctx)}}`;
      if (op.op === '*') return `${latex(a, ctx)}${op.implicit ? '' : ' \\cdot '}${latex(b, ctx)}`;
      const symbol =
        {
          '+': '+',
          '-': '-',
          '<=': '\\le',
          '>=': '\\ge',
          '!=': '\\ne',
          '==': '=',
          '%': '\\bmod',
          mod: '\\bmod',
        }[op.op] ?? op.op;
      return `${latex(a, ctx)} ${symbol} ${latex(b, ctx)}`;
    }
    case 'RelationalNode': {
      const relation = node as RelationalNode;
      const symbols: Record<string, string> = {
        smaller: '<',
        larger: '>',
        smallerEq: '\\le',
        largerEq: '\\ge',
        equal: '=',
        unequal: '\\ne',
      };
      return relation.params
        .map(
          (part, i) => `${i ? `${symbols[relation.conditionals[i - 1]]} ` : ''}${latex(part, ctx)}`,
        )
        .join(' ');
    }
  }
  throw new Error('Nodo no representable');
}
function latexStatement(text: string, ctx: Context): string {
  const trimmed = text.trim();
  const statements = splitTop(trimmed, (t, i) => t[i] === ';');
  if (statements.length > 1)
    return statements.map((part) => latexStatement(part, ctx)).join(';\\quad ');
  const sides = splitTop(trimmed, isEquals);
  if (sides.length > 1) return sides.map((side) => latexStatement(side, ctx)).join(' = ');
  return latex(parse(protect(trimmed, ctx.literals)), ctx);
}

/** LaTeX de una expresión o resultado; null si no se puede representar. */
export function toLatex(
  expression: string,
  options: { decimalSeparator?: DecimalSeparator } = {},
): string | null {
  if (!expression.trim()) return null;
  try {
    return latexStatement(prepare(expression, options), {
      literals: [],
      comma: options.decimalSeparator === 'coma',
    });
  } catch {
    return null;
  }
}
