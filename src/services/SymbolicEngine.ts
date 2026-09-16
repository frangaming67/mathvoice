import nerdamer from 'nerdamer/all.js';
import { parse, type MathNode, type FunctionNode, type OperatorNode } from 'mathjs';
import { parseCommand } from '../parser/commands';
import type { AngleMode, CalculationResult } from '../types';

const commands = new Set([
  'diff',
  'integrate',
  'limit',
  'solve',
  'simplify',
  'expand',
  'factor',
  'partfrac',
  'substitute',
  'system',
]);
const functions = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'exp',
  'ln',
  'log',
  'abs',
]);
const nodeTypes = new Set([
  'ConstantNode',
  'SymbolNode',
  'ParenthesisNode',
  'FunctionNode',
  'OperatorNode',
]);
function safeExpression(expression: string): MathNode {
  let node: MathNode;
  try {
    node = parse(expression);
  } catch {
    throw new Error(
      'No pude interpretar la expresión simbólica. Revisá los paréntesis y operadores.',
    );
  }
  node.traverse((child) => {
    if (!nodeTypes.has(child.type))
      throw new Error(
        'Usá números, variables, funciones y operadores matemáticos en esta operación.',
      );
    if (child.type === 'ConstantNode' && !/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(child.toString()))
      throw new Error('Solo se admiten constantes numéricas.');
    if (child.type === 'SymbolNode' && !/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/.test(child.toString()))
      throw new Error('Usá nombres de variables de hasta 20 caracteres.');
    if (child.type === 'FunctionNode' && !functions.has((child as FunctionNode).fn.name ?? ''))
      throw new Error('Esa función no está disponible dentro del cálculo simbólico.');
    if (child.type === 'FunctionNode') {
      const fn = child as FunctionNode;
      if (fn.args.length !== 1 && !(fn.fn.name === 'log' && fn.args.length === 2))
        throw new Error('Revisá la cantidad de argumentos de la función.');
    }
    if (
      child.type === 'OperatorNode' &&
      !['+', '-', '*', '/', '^'].includes((child as OperatorNode).op)
    )
      throw new Error('Ese operador no está disponible en el cálculo simbólico.');
  });
  return node;
}
function toCas(expression: string): string {
  const node = safeExpression(expression);
  return node.toString({
    handler: (child: MathNode) => {
      if (child.type !== 'FunctionNode') return undefined;
      const fn = child as FunctionNode;
      if (fn.fn.name === 'ln') return `log(${toCas(fn.args[0].toString())})`;
      if (fn.fn.name === 'log')
        return `log(${toCas(fn.args[0].toString())},${fn.args[1] ? toCas(fn.args[1].toString()) : '10'})`;
      return undefined;
    },
  });
}
function variable(value = 'x') {
  if (!/^[a-zA-Z]$/.test(value) || ['e', 'i'].includes(value))
    throw new Error('Elegí una variable de una letra, por ejemplo x, y o t; e e i son constantes.');
  return value;
}
function realNumber(value: string): number {
  const expression = nerdamer(toCas(value));
  if (expression.variables().length)
    throw new Error('El extremo debe ser un número real, sin variables.');
  const n = Number(expression.evaluate().text('decimals'));
  if (!Number.isFinite(n)) throw new Error('El extremo debe ser un número real finito.');
  return n;
}
function polynomial(node: MathNode): boolean {
  if (node.type === 'FunctionNode') return false;
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode;
    if (op.op === '/' && op.args[1].filter((child) => child.type === 'SymbolNode').length)
      return false;
    if (op.op === '^' && !/^\d+$/.test(op.args[1].toString())) return false;
  }
  let valid = true;
  node.forEach((child) => {
    if (!polynomial(child)) valid = false;
  });
  return valid;
}
export class SymbolicEngine {
  supports(expression: string) {
    return commands.has(expression.match(/^([a-z]+)\s*\(/)?.[1] ?? '');
  }
  evaluate(expression: string, original: string, angleMode: AngleMode): CalculationResult {
    const command = parseCommand(expression);
    if (!command || !commands.has(command.name))
      throw new Error('Revisá el formato de la operación simbólica.');
    const { name, args } = command;
    if (name === 'system') return this.system(args, original);
    const counts: Record<string, number[]> = {
      diff: [1, 2, 3],
      integrate: [1, 2, 4],
      limit: [3],
      solve: [1, 2],
      simplify: [1],
      expand: [1],
      factor: [1],
      partfrac: [2],
      substitute: [3],
    };
    if (!counts[name].includes(args.length))
      throw new Error(
        'Faltan argumentos o hay demasiados. Usá el formulario de álgebra y cálculo para completar la operación.',
      );
    const v = ['diff', 'integrate', 'limit', 'solve', 'partfrac', 'substitute'].includes(name)
      ? variable(args[1])
      : 'x';
    let request: string;
    let explanation = '';
    let value: string;
    let integral = false;
    if (name === 'solve') {
      const sides = args[0].split('=');
      if (sides.length > 2) throw new Error('Introducí una ecuación con un solo signo igual.');
      const equation = `${toCas(sides[0])}=${sides[1] ? toCas(sides[1]) : '0'}`;
      request = `solve(${equation},${v})`;
      explanation = `Se buscan valores de ${v} que hacen iguales ambos lados de la ecuación. Las soluciones del motor pueden no agotar todas las raíces de ecuaciones trascendentes. Verificá el dominio de la ecuación original.`;
    } else {
      const body = toCas(args[0]);
      request = `${name}(${body})`;
      if (name === 'diff') {
        const order = args[2] ?? '1';
        if (!/^[1-9]$|^10$/.test(order))
          throw new Error('El orden de la derivada debe ser un entero entre 1 y 10.');
        request = `diff(${body},${v},${order})`;
        explanation = `Derivada de orden ${order} respecto de ${v}. Las demás variables se consideran constantes. El resultado describe la tasa de cambio de la función.`;
      }
      if (name === 'integrate') {
        if (args.length === 4) {
          if (!polynomial(safeExpression(args[0])))
            throw new Error(
              'Por ahora las integrales definidas admiten polinomios. Para otras funciones usá la integral indefinida y revisá su dominio.',
            );
          const lower = realNumber(args[2]);
          const upper = realNumber(args[3]);
          request = `defint(${body},${lower},${upper},${v})`;
          explanation = `Se obtiene una primitiva F respecto de ${v} y se calcula F(${args[3]}) menos F(${args[2]}), por el teorema fundamental del cálculo.`;
        } else {
          request = `integrate(${body},${v})`;
          integral = true;
          explanation = `Se busca una primitiva cuya derivada respecto de ${v} sea la expresión original. C es una constante de integración arbitraria. Revisá los intervalos de validez de la primitiva.`;
        }
      }
      if (name === 'limit') {
        const point =
          args[2] === 'Infinity' || args[2] === '-Infinity' ? args[2] : String(realNumber(args[2]));
        request = `limit(${body},${v},${point})`;
        explanation = `Se estudia el valor al que se acerca la expresión cuando ${v} tiende a ${args[2]}. El punto no necesita pertenecer al dominio de la función. El motor puede dejar límites sin resolver.`;
      }
      if (name === 'partfrac') request = `partfrac(${body},${v})`;
      if (name === 'substitute') {
        request = nerdamer(body).sub(v, toCas(args[2])).toString();
        explanation = `Se reemplaza ${v} por ${args[2]} en la expresión y se simplifica el resultado.`;
      }
      if (['simplify', 'factor', 'expand', 'partfrac'].includes(name))
        explanation = `Se transforma la expresión mediante ${{ simplify: 'simplificación', factor: 'factorización', expand: 'la propiedad distributiva', partfrac: 'fracciones parciales' }[name]}. Se mantienen las restricciones de dominio de la expresión original, incluso cuando se cancelan factores.`;
    }
    let result;
    try {
      result = nerdamer(request);
    } catch {
      throw new Error(
        'El motor simbólico no pudo resolver esta operación. Revisá la expresión, su dominio y la variable.',
      );
    }
    const raw = result.toString();
    if (name === 'limit' && raw.includes('Infinity') && !args[2].includes('Infinity')) {
      const point = realNumber(args[2]);
      const delta = Math.max(1, Math.abs(point)) * 1e-6;
      const numeric = safeExpression(args[0]).compile();
      const left: unknown = numeric.evaluate({
        [v]: point - delta,
        ln: Math.log,
        log: (x: number, base = 10) => Math.log(x) / Math.log(base),
      });
      const right: unknown = numeric.evaluate({
        [v]: point + delta,
        ln: Math.log,
        log: (x: number, base = 10) => Math.log(x) / Math.log(base),
      });
      if (
        typeof left !== 'number' ||
        typeof right !== 'number' ||
        Math.sign(left) !== Math.sign(right)
      )
        throw new Error(
          'No pude confirmar un límite bilateral: revisá los límites por izquierda y por derecha.',
        );
    }
    if (/\b(integrate|defint|limit|solve|diff)\(/.test(raw))
      throw new Error(
        'El motor no encontró una solución cerrada para esta expresión. No se muestra una operación sin resolver como resultado.',
      );
    if (raw.includes('NaN') || raw.includes('undefined'))
      throw new Error('La operación no tiene un resultado definido en ese dominio.');
    if (name === 'solve') {
      if (raw === '[]')
        throw new Error(
          'No se encontraron soluciones. Esto no demuestra que la ecuación no tenga solución.',
        );
      const roots = raw.replace(/^\[|\]$/g, '').split(',');
      value = roots.map((root) => `${v} = ${root.replace(/\blog\(/g, 'ln(')}`).join('; ');
    } else value = `${raw.replace(/\blog\(/g, 'ln(')}${integral ? ' + C' : ''}`;
    let decimal: string | undefined;
    if (!integral && name !== 'solve' && !result.variables().length) {
      const approximation = result.evaluate().text('decimals');
      if (Number.isFinite(Number(approximation)) && approximation !== raw)
        decimal = String(Number(Number(approximation).toPrecision(12)));
    }
    return {
      expression: original,
      value,
      decimal,
      angleMode: 'rad',
      kind: ['diff', 'integrate', 'limit'].includes(name) ? 'Cálculo' : 'Álgebra',
      explanation: `${explanation} El cálculo simbólico usa radianes${angleMode !== 'rad' ? ', independientemente del modo numérico seleccionado' : ''}.`,
    };
  }

  private system(equations: string[], original: string): CalculationResult {
    if (equations.length < 2 || equations.length > 5)
      throw new Error('Introducí entre 2 y 5 ecuaciones lineales.');
    const residuals = equations.map((equation) => {
      const sides = equation.split('=');
      if (sides.length !== 2 || !sides[0] || !sides[1])
        throw new Error('Cada ecuación del sistema necesita dos lados separados por igual.');
      return nerdamer(`(${toCas(sides[0])})-(${toCas(sides[1])})`);
    });
    const variables = [
      ...new Set(residuals.flatMap((expression) => expression.variables())),
    ].sort();
    if (variables.length !== equations.length)
      throw new Error('Para este método, usá tantas ecuaciones independientes como incógnitas.');
    for (const residual of residuals)
      for (const v of variables) {
        if (
          nerdamer(`diff(${residual.toString()},${v})`)
            .variables()
            .some((name) => variables.includes(name))
        )
          throw new Error('El solucionador de sistemas admite ecuaciones lineales.');
      }
    const linear = nerdamer as typeof nerdamer & {
      solveEquations: (equations: string[]) => Array<[string, number | string]>;
    };
    let solutions: Array<[string, number | string]>;
    try {
      solutions = linear.solveEquations(
        residuals.map((expression) => `${expression.toString()}=0`),
      );
    } catch {
      throw new Error(
        'No pude obtener una solución única. Revisá si las ecuaciones son independientes y compatibles.',
      );
    }
    if (
      solutions.length !== variables.length ||
      solutions.some(([, value]) => !Number.isFinite(Number(value)))
    )
      throw new Error('El sistema no tiene una solución real única confirmada.');
    for (const residual of residuals) {
      let check = residual;
      for (const [name, value] of solutions) check = check.sub(name, String(value));
      const remainder = Number(check.evaluate().text('decimals'));
      if (!Number.isFinite(remainder) || Math.abs(remainder) > 1e-7)
        throw new Error('No pude verificar las soluciones del sistema. Revisá los coeficientes.');
    }
    return {
      expression: original,
      value: solutions.map(([v, value]) => `${v} = ${value}`).join('; '),
      kind: 'Álgebra',
      angleMode: 'rad',
      explanation:
        'Se resolvió el sistema lineal y se sustituyeron las soluciones en cada ecuación para comprobar que ambos lados coinciden. Los resultados pueden incluir aproximaciones numéricas.',
    };
  }
}
