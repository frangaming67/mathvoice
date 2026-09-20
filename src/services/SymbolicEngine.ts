import nerdamer from 'nerdamer/all.js';
import { parse, type MathNode, type FunctionNode, type OperatorNode } from 'mathjs';
import { parseCommand } from '../parser/commands';
import type { AngleMode, CalculationResult } from '../types';
import { continuousInterval } from './DomainService';
import { math } from './mathRuntime';

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
  'inequality',
  'series',
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
      if (fn.fn.name === 'log') {
        const argument = toCas(fn.args[0].toString());
        const base = fn.args[1] ? toCas(fn.args[1].toString()) : '10';
        if (!nerdamer(argument).variables().length && !nerdamer(base).variables().length)
          return nerdamer(`log(${argument},${base})`).toString();
        return `(log(${argument})/log(${base}))`;
      }
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
    if (name === 'inequality') return this.inequality(args, original);
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
      series: [4],
    };
    if (!counts[name].includes(args.length))
      throw new Error(
        'Faltan argumentos o hay demasiados. Usá el formulario de álgebra y cálculo para completar la operación.',
      );
    const v = ['diff', 'integrate', 'limit', 'solve', 'partfrac', 'substitute', 'series'].includes(
      name,
    )
      ? variable(args[1])
      : 'x';
    let request: string;
    let explanation = '';
    let value: string;
    let integral = false;
    if (name === 'solve') {
      const sides = args[0].split('=');
      if (sides.length > 2) throw new Error('Introducí una ecuación con un solo signo igual.');
      const residual = nerdamer(
        `simplify((${toCas(sides[0])})-(${sides[1] ? toCas(sides[1]) : '0'}))`,
      ).toString();
      if (residual === '0')
        throw new Error(
          'La ecuación se simplifica a una identidad. Puede tener infinitas soluciones dentro de su dominio original; no hay una lista finita de raíces.',
        );
      request = `solve(${residual}=0,${v})`;
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
          const lower = realNumber(args[2]);
          const upper = realNumber(args[3]);
          continuousInterval(safeExpression(args[0]), v, [
            Math.min(lower, upper),
            Math.max(lower, upper),
          ]);
          const primitive = nerdamer(`integrate(${body},${v})`);
          if (/\bintegrate\(/.test(primitive.toString()))
            throw new Error(
              'El motor no encontró una primitiva cerrada para esta integral definida.',
            );
          request = `(${primitive.sub(v, toCas(args[3])).toString()})-(${primitive.sub(v, toCas(args[2])).toString()})`;
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
      if (name === 'series') {
        const center = realNumber(args[2]);
        if (!/^\d$|^10$/.test(args[3]))
          throw new Error('El orden de Taylor debe estar entre 0 y 10.');
        const radius = Math.max(1, Math.abs(center)) * 1e-6;
        continuousInterval(safeExpression(args[0]), v, [center - radius, center + radius], true);
        let derivative = nerdamer(body);
        const terms: string[] = [];
        for (let i = 0; i <= Number(args[3]); i++) {
          const coefficient = derivative.sub(v, toCas(args[2]));
          if (!Number.isFinite(Number(coefficient.evaluate().text('decimals'))))
            throw new Error('No pude confirmar derivadas reales finitas en el centro de la serie.');
          terms.push(
            `(${coefficient.toString()})*((${v})-(${toCas(args[2])}))^${i}/factorial(${i})`,
          );
          if (i < Number(args[3])) derivative = nerdamer(`diff(${derivative.toString()},${v})`);
        }
        request = `expand(${terms.join('+')})`;
        explanation = `Polinomio de Taylor de orden ${args[3]} alrededor de ${v} = ${args[2]}, calculado con las derivadas en ese punto divididas por sus factoriales. Es una aproximación local; no se ha calculado una cota del error ni el radio de convergencia.`;
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
    if (name === 'limit' && raw.startsWith('['))
      throw new Error(
        'Los límites laterales difieren o el motor devolvió un rango. No pude confirmar un límite único.',
      );
    if (name === 'limit' && !args[2].includes('Infinity') && !raw.includes('limit(')) {
      const point = realNumber(args[2]);
      const numeric = safeExpression(args[0]).compile();
      const target = Number(result.evaluate().text('decimals'));
      for (const direction of [-1, 1]) {
        const values = [1e-3, 1e-4, 1e-5, 1e-6].map((scale) => {
          const value: unknown = numeric.evaluate({
            [v]: point + direction * Math.max(1, Math.abs(point)) * scale,
            ln: Math.log,
            log: (x: number, base = 10) => Math.log(x) / Math.log(base),
          });
          return typeof value === 'number' ? value : NaN;
        });
        const last = values.at(-1)!;
        const consistent = Number.isFinite(target)
          ? values.every(Number.isFinite) &&
            Math.abs(last - target) <= 1e-3 * Math.max(1, Math.abs(target))
          : !Number.isNaN(target) &&
            values.every(
              (value) => !Number.isNaN(value) && Math.sign(value) === Math.sign(target),
            ) &&
            (!Number.isFinite(last) || Math.abs(last) > Math.abs(values[0]));
        if (!consistent)
          throw new Error(
            'No pude confirmar un límite bilateral: revisá los límites por izquierda y por derecha.',
          );
      }
      explanation +=
        ' Se comprobaron aproximaciones por ambos lados como control de coherencia, no como demostración de convergencia.';
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
      const candidates = parseCommand(`roots(${raw.replace(/^\[|\]$/g, '')})`)?.args ?? [];
      const sides = args[0].split('=');
      const left = safeExpression(sides[0]).compile(),
        right = safeExpression(sides[1] || '0').compile();
      const finite = (value: unknown): value is number | import('mathjs').Complex =>
        typeof value === 'number'
          ? Number.isFinite(value)
          : math.isComplex(value) && Number.isFinite(value.re) && Number.isFinite(value.im);
      const roots = candidates.filter((root) => {
        try {
          if (nerdamer(root).variables().length) return false;
          const candidate: unknown = math.evaluate(root.replace(/\blog\(/g, 'ln('), {
            ln: math.log,
          });
          if (!finite(candidate)) return false;
          const scope = new Map<string, unknown>([
            [v, candidate],
            ['ln', math.log],
            ['log', (n: number, base = 10) => math.log(n, base)],
          ]);
          const a: unknown = left.evaluate(scope),
            b: unknown = right.evaluate(scope);
          if (!finite(a) || !finite(b)) return false;
          return (
            Number(math.abs(math.subtract(a, b))) <=
            1e-8 * Math.max(1, Number(math.abs(a)), Number(math.abs(b)))
          );
        } catch {
          return false;
        }
      });
      if (!roots.length)
        throw new Error(
          'No pude verificar soluciones en la ecuación original. Revisá su dominio; las ecuaciones con parámetros necesitan valores definidos.',
        );
      explanation = `Cada solución mostrada se verificó por sustitución numérica en ambos lados de la ecuación original, con tolerancia relativa de 10 elevado a menos 8. Se descartaron candidatos no verificables o fuera del dominio. El motor puede no encontrar todas las raíces de ecuaciones trascendentes.`;
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
      kind: ['diff', 'integrate', 'limit', 'series'].includes(name) ? 'Cálculo' : 'Álgebra',
      explanation: `${explanation} El cálculo simbólico usa radianes${angleMode !== 'rad' ? ', independientemente del modo numérico seleccionado' : ''}.`,
    };
  }

  private inequality(args: string[], original: string): CalculationResult {
    if (args.length !== 2) throw new Error('Usá inequality(desigualdad,x).');
    const v = variable(args[1]);
    const parts = args[0].match(/^(.+?)(<=|>=|<|>)([^<>=]+)$/);
    if (!parts) throw new Error('Usá una desigualdad con <, <=, > o >=.');
    const [, left, operator, right] = parts;
    if (!polynomial(safeExpression(left)) || !polynomial(safeExpression(right)))
      throw new Error('Las desigualdades admiten polinomios de una variable, hasta grado 2.');
    const body = nerdamer(`expand((${toCas(left)})-(${toCas(right)}))`);
    if (body.variables().some((name) => name !== v))
      throw new Error('La desigualdad debe tener una sola variable.');
    const raw = nerdamer(`coeffs(${body.toString()},${v})`).toString();
    const coefficientExpressions = parseCommand(`coefficients(${raw.slice(1, -1)})`)?.args ?? [];
    const coefficients = coefficientExpressions.map((value) =>
      Number(nerdamer(value).evaluate().text('decimals')),
    );
    while (coefficients.length > 1 && coefficients.at(-1) === 0) coefficients.pop();
    if (!coefficients.length || coefficients.length > 3 || !coefficients.every(Number.isFinite))
      throw new Error('Las desigualdades admiten coeficientes reales finitos y grado máximo 2.');
    const roots =
      coefficients.length === 1
        ? []
        : [
            ...new Set(
              math
                .polynomialRoot(coefficients[0], coefficients[1], coefficients[2] ?? 0)
                .filter(
                  (root): root is number => typeof root === 'number' && Number.isFinite(root),
                ),
            ),
          ].sort((a, b) => a - b);
    const strict = !operator.includes('=');
    const positive = operator.startsWith('>');
    const compiled = safeExpression(body.toString()).compile();
    if (coefficients.length === 3) {
      const discriminant = Number(
        nerdamer(
          `(${coefficientExpressions[1]})^2-4*(${coefficientExpressions[0]})*(${coefficientExpressions[2]})`,
        )
          .evaluate()
          .text('decimals'),
      );
      const expected = discriminant < 0 ? 0 : discriminant === 0 ? 1 : 2;
      if (!Number.isFinite(discriminant) || roots.length !== expected)
        throw new Error(
          'No pude separar las raíces con precisión suficiente. Revisá la escala de los coeficientes.',
        );
    }
    for (const root of roots) {
      const residual = Number(compiled.evaluate({ [v]: root }));
      const scale = coefficients.reduce(
        (sum, coefficient, i) => sum + Math.abs(coefficient * root ** i),
        0,
      );
      if (
        !Number.isFinite(scale) ||
        !Number.isFinite(residual) ||
        Math.abs(residual) > scale * 1e-10
      )
        throw new Error(
          'No pude verificar las raíces con precisión suficiente. Revisá la escala de los coeficientes.',
        );
    }
    const bounds = [-Infinity, ...roots, Infinity];
    const intervals: { low: number; high: number }[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const low = bounds[i],
        high = bounds[i + 1];
      const point =
        low === -Infinity
          ? high === Infinity
            ? 0
            : high - Math.max(1, Math.abs(high))
          : high === Infinity
            ? low + Math.max(1, Math.abs(low))
            : low / 2 + high / 2;
      const value: unknown = compiled.evaluate({ [v]: point });
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new Error('No pude verificar el signo entre las raíces.');
      if (positive ? (strict ? value > 0 : value >= 0) : strict ? value < 0 : value <= 0) {
        const previous = intervals.at(-1);
        if (!strict && previous?.high === low) previous.high = high;
        else intervals.push({ low, high });
      }
    }
    const text = (n: number) =>
      n === -Infinity
        ? 'menos infinito'
        : n === Infinity
          ? 'más infinito'
          : math.format(n, { precision: 14 });
    const solutions = intervals.map(({ low, high }) =>
      low === -Infinity && high === Infinity
        ? 'Todos los números reales'
        : `Desde ${text(low)} ${Number.isFinite(low) && !strict ? 'incluido' : 'excluido'} hasta ${text(high)} ${Number.isFinite(high) && !strict ? 'incluido' : 'excluido'}`,
    );
    if (!strict)
      for (const root of roots) {
        if (!intervals.some(({ low, high }) => root >= low && root <= high))
          solutions.push(`${v} igual a ${text(root)}`);
      }
    if (!solutions.length) solutions.push('Sin soluciones reales');
    return {
      expression: original,
      value: solutions.join('; '),
      table: solutions.map((value, i) => ({ label: `Conjunto ${i + 1}`, value })),
      kind: 'Álgebra',
      angleMode: 'rad',
      explanation:
        'Se pasa todo al lado izquierdo, se calculan las raíces del polinomio y se comprueba su signo en cada intervalo. Los extremos numéricos pueden ser aproximados. Se incluyen las raíces únicamente cuando la desigualdad permite igualdad.',
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
