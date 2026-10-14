import type { MathNode, OperatorNode, FunctionNode, ParenthesisNode } from 'mathjs';
import { SymbolicError } from './casVerify';
type Interval = [number, number];
const domainError = () =>
  new SymbolicError(
    'No pude confirmar un dominio real continuo en todo el intervalo. Puede haber una singularidad o una función fuera del análisis admitido; dividí el intervalo o revisá la expresión.',
  );
function bounded(values: number[]): Interval {
  if (!values.every(Number.isFinite)) throw domainError();
  return [Math.min(...values), Math.max(...values)];
}
function power(a: Interval, n: number, analytic: boolean): Interval {
  if (!Number.isFinite(n) || Math.abs(n) > 100) throw domainError();
  if (n === 0) return [1, 1];
  if (n < 0) {
    const p = power(a, -n, analytic);
    if (p[0] <= 0 && p[1] >= 0) throw domainError();
    return bounded([1 / p[0], 1 / p[1]]);
  }
  if (!Number.isInteger(n) && (a[0] < 0 || (analytic && a[0] === 0))) throw domainError();
  const values = [a[0] ** n, a[1] ** n];
  if (Number.isInteger(n) && n % 2 === 0 && a[0] <= 0 && a[1] >= 0) values.push(0);
  return bounded(values);
}
// Conservative interval bounds: a rejection may be inconclusive, never a claim of divergence.
// This checks the original AST before the CAS cancels factors or changes its domain.
export function continuousInterval(
  node: MathNode,
  variable: string,
  interval: Interval,
  analytic = false,
): Interval {
  const visit = (child: MathNode) => continuousInterval(child, variable, interval, analytic);
  if (node.type === 'ConstantNode') return bounded([Number(node.toString())]);
  if (node.type === 'SymbolNode') {
    if (node.toString() === variable) return interval;
    const value = (
      { pi: Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2 } as Record<string, number>
    )[node.toString()];
    return bounded([value]);
  }
  if (node.type === 'ParenthesisNode') return visit((node as ParenthesisNode).content);
  if (node.type === 'OperatorNode') {
    const { op, args } = node as OperatorNode;
    const a = visit(args[0]);
    if (args.length === 1) return op === '-' ? [-a[1], -a[0]] : a;
    const b = visit(args[1]);
    if (op === '+') return bounded([a[0] + b[0], a[1] + b[1]]);
    if (op === '-') return bounded([a[0] - b[1], a[1] - b[0]]);
    if (op === '*') return bounded([a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]);
    if (op === '/') {
      if (b[0] <= 0 && b[1] >= 0) throw domainError();
      return bounded([a[0] / b[0], a[0] / b[1], a[1] / b[0], a[1] / b[1]]);
    }
    if (op === '^' && b[0] === b[1]) return power(a, b[0], analytic);
    // Base positiva y exponente variable (e^x, 2^x, x^x en x > 0): a^b = exp(b·ln a).
    if (op === '^' && a[0] > 0) {
      const logarithm = [Math.log(a[0]), Math.log(a[1])];
      const exponent = bounded([
        b[0] * logarithm[0],
        b[0] * logarithm[1],
        b[1] * logarithm[0],
        b[1] * logarithm[1],
      ]);
      return bounded(exponent.map(Math.exp));
    }
    throw domainError();
  }
  if (node.type === 'FunctionNode') {
    const fn = node as FunctionNode,
      a = visit(fn.args[0]);
    switch (fn.fn.name) {
      case 'sin':
      case 'cos':
        return [-1, 1];
      case 'exp':
        return bounded(a.map(Math.exp));
      case 'sinh':
        return bounded(a.map(Math.sinh));
      case 'cosh':
        return bounded([...a.map(Math.cosh), ...(a[0] <= 0 && a[1] >= 0 ? [1] : [])]);
      case 'tanh':
        return bounded(a.map(Math.tanh));
      case 'atan':
        return bounded(a.map(Math.atan));
      case 'sqrt':
        return power(a, 0.5, analytic);
      case 'abs':
        if (analytic && a[0] <= 0 && a[1] >= 0) throw domainError();
        return bounded([...a.map(Math.abs), ...(a[0] <= 0 && a[1] >= 0 ? [0] : [])]);
      case 'ln':
      case 'log': {
        if (a[0] <= 0) throw domainError();
        const b = fn.args[1]
          ? visit(fn.args[1])
          : fn.fn.name === 'ln'
            ? [Math.E, Math.E]
            : [10, 10];
        if (b[0] <= 0 || (b[0] <= 1 && b[1] >= 1)) throw domainError();
        return bounded([
          Math.log(a[0]) / Math.log(b[0]),
          Math.log(a[1]) / Math.log(b[0]),
          Math.log(a[0]) / Math.log(b[1]),
          Math.log(a[1]) / Math.log(b[1]),
        ]);
      }
      case 'asin':
      case 'acos':
        if (a[0] < -1 || a[1] > 1 || (analytic && (a[0] === -1 || a[1] === 1))) throw domainError();
        return bounded(a.map(fn.fn.name === 'asin' ? Math.asin : Math.acos));
      case 'tan':
        if (Math.ceil((a[0] - Math.PI / 2) / Math.PI) <= Math.floor((a[1] - Math.PI / 2) / Math.PI))
          throw domainError();
        return bounded(a.map(Math.tan));
    }
  }
  throw domainError();
}
