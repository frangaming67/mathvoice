import { type MathNode, type FunctionNode, type OperatorNode } from 'mathjs';
import { normalizeExpression } from '../parser/expression';
import type { AngleMode, CalculationResult } from '../types';
import { SymbolicEngine } from './SymbolicEngine';
import { math, exactMath } from './mathRuntime';
import { extensionFunctions } from './ExtensionFunctions';
import { formatMathValue, resultStructure } from './ResultFormatter';
import { physicalConstants, physicalScope } from './PhysicalConstants';

const symbolic = new SymbolicEngine();
const functions = new Set(
  'sin cos tan asin acos atan sinh cosh tanh log ln exp sqrt cbrt nthRoot factorial mod floor ceil round abs sign gcd lcm fraction det inv transpose trace add subtract multiply dot cross norm conj re im arg complex lusolve mean median mode min max variance std sum prod combinations permutations'.split(
    ' ',
  ),
);
Object.keys(extensionFunctions).forEach((name) => functions.add(name));
const symbols = new Set(['pi', 'e', 'phi', 'Infinity', 'i', ...Object.keys(physicalScope)]);
const operators = new Set(['+', '-', '*', '/', '^', '%', '!']);
const permitted = new Set([
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'ParenthesisNode',
  'ArrayNode',
]);
const arities: Record<string, number[]> = {
  sin: [1],
  cos: [1],
  tan: [1],
  asin: [1],
  acos: [1],
  atan: [1],
  ln: [1],
  log: [1, 2],
  mixed: [1],
  mixedNumber: [3],
  nthRoots: [2],
  nthRoot: [2],
  convert: [3],
  base: [3],
  bitop: [4],
  rank: [1],
  eigvals: [1],
  eigvecs: [1],
  normalize: [1],
  distance: [2],
  vectorangle: [2],
  polar: [1],
  rect: [2],
  stats: [1, 2],
  percentile: [2],
  covariance: [2],
  correlation: [2],
  regression: [2],
  normalpdf: [3],
  normalcdf: [3],
  binomialpdf: [3],
  binomialcdf: [3],
  poissonpdf: [2],
  poissoncdf: [2],
};

function validate(node: MathNode, variables: Record<string, number>) {
  node.traverse((child) => {
    if (child.type === 'FunctionNode') {
      const fn = child as FunctionNode;
      if (arities[fn.fn.name ?? ''] && !arities[fn.fn.name ?? ''].includes(fn.args.length))
        throw new Error(
          `La función ${fn.fn.name} necesita ${arities[fn.fn.name ?? ''].join(' o ')} argumentos.`,
        );
    }
    if (!permitted.has(child.type))
      throw new Error(
        'Esa sintaxis no está permitida. Usá operaciones matemáticas o los formularios de herramientas.',
      );
    if (child.type === 'FunctionNode' && !functions.has((child as FunctionNode).fn.name ?? ''))
      throw new Error(
        `La función ${(child as FunctionNode).fn.name} todavía no está disponible. Consultá las herramientas científicas.`,
      );
    if (
      child.type === 'SymbolNode' &&
      !symbols.has(child.toString()) &&
      !functions.has(child.toString()) &&
      !Object.hasOwn(variables, child.toString())
    )
      throw new Error(
        `No reconozco «${child.toString()}». Revisá el nombre de la función o constante.`,
      );
    if (child.type === 'OperatorNode' && !operators.has((child as OperatorNode).op))
      throw new Error('Ese operador no está disponible en esta fase.');
  });
}

export class MathEngine {
  evaluate(
    input: string,
    angleMode: AngleMode = 'rad',
    variables: Record<string, number> = {},
  ): CalculationResult {
    if (!input.trim()) throw new Error('Escribí una expresión antes de calcular.');
    if (input.length > 10000)
      throw new Error('La expresión es demasiado larga. Usá hasta 10000 caracteres.');
    const expression = normalizeExpression(input);
    if (symbolic.supports(expression)) {
      if (input.length > 500)
        throw new Error('La expresión simbólica es demasiado larga; usá hasta 500 caracteres.');
      return symbolic.evaluate(expression, input, angleMode);
    }
    const assignment = expression.match(/^([a-zA-Z]\w{0,19})\s*=(?!=)\s*(.+)$/);
    if (assignment) {
      const [, name, body] = assignment;
      if (!Object.hasOwn(variables, name) && Object.keys(variables).length >= 100)
        throw new Error('Podés guardar hasta 100 variables. Eliminá una antes de agregar otra.');
      if (
        functions.has(name) ||
        symbols.has(name) ||
        ['constructor', 'prototype', '__proto__'].includes(name)
      )
        throw new Error('Ese nombre está reservado. Elegí otro nombre para la variable.');
      const result = this.evaluate(body, angleMode, variables);
      if (result.assigned) throw new Error('Guardá una variable por operación.');
      if (result.table || result.matrix || result.kind === 'Complejos')
        throw new Error('Las variables almacenadas deben ser números reales finitos.');
      let value: number;
      try {
        const parsed: unknown = math.evaluate(result.value);
        value = typeof parsed === 'number' || math.isFraction(parsed) ? Number(parsed) : NaN;
      } catch {
        throw new Error('Las variables almacenadas deben ser números reales finitos.');
      }
      if (!Number.isFinite(value))
        throw new Error('Las variables almacenadas deben ser números reales finitos.');
      return {
        ...result,
        expression: input,
        assigned: { name, value },
        explanation: `Se guarda ${name} con valor ${result.value}. Podés usar ${name} en los próximos cálculos.`,
      };
    }
    let node: MathNode;
    try {
      node = math.parse(expression);
    } catch {
      throw new Error(
        'No pude interpretar la expresión. Revisá los paréntesis y operadores; usá punto para los decimales.',
      );
    }
    validate(node, variables);
    const factor = angleMode === 'deg' ? Math.PI / 180 : angleMode === 'grad' ? Math.PI / 200 : 1;
    const scope = new Map<string, unknown>([
      ['sin', (x: number) => math.sin(math.multiply(x, factor))],
      ['cos', (x: number) => math.cos(math.multiply(x, factor))],
      ['tan', (x: number) => math.tan(math.multiply(x, factor))],
      ['asin', (x: number) => math.divide(math.asin(x), factor)],
      ['acos', (x: number) => math.divide(math.acos(x), factor)],
      ['atan', (x: number) => math.divide(math.atan(x), factor)],
      ['ln', (x: number) => math.log(x)],
      ['log', (x: number, base = 10) => math.log(x, base)],
      ...Object.entries(extensionFunctions),
      ...Object.entries(physicalScope),
      ...Object.entries(variables).filter(
        ([name, v]) =>
          !functions.has(name) && !symbols.has(name) && typeof v === 'number' && Number.isFinite(v),
      ),
    ]);
    let result: unknown;
    try {
      result = node.compile().evaluate(scope);
    } catch (error) {
      if (
        error instanceof Error &&
        /^(Ingresá|Usá|Todas|El |La |Las |Los |No se|X |Se necesita)/.test(error.message)
      )
        throw error;
      throw new Error(
        'No pude calcular esa operación. Revisá la cantidad de argumentos y los valores de las funciones.',
        { cause: error },
      );
    }
    if (typeof result !== 'number' && !math.isFraction(result))
      return {
        expression: input,
        value: formatMathValue(result),
        ...resultStructure(result),
        kind: math.isComplex(result) ? 'Complejos' : 'Herramientas',
        angleMode,
        variables,
        explanation:
          'Se aplicó la operación con bibliotecas numéricas. Las matrices y listas se presentan también como tablas; sus valores pueden estar redondeados. Los argumentos de números complejos y ángulos entre vectores se expresan en radianes.',
      };
    const numeric = Number(result);
    if (!Number.isFinite(numeric))
      throw new Error(
        'La operación no tiene un resultado real finito. Revisá divisiones por cero y el dominio de las funciones.',
      );
    const decimal = math.format(numeric, { precision: 14 });
    let value = decimal;
    if (/^[\d\s.+\-*/()]+$/.test(expression)) {
      try {
        const exact: unknown = exactMath.evaluate(expression);
        if (exactMath.isFraction(exact)) value = exact.toFraction();
      } catch {
        /* Decimal result remains available. */
      }
    } else if (math.isFraction(result)) value = result.toFraction();
    const kind = /[a-z]/i.test(expression) ? 'Científico' : 'Básico';
    return {
      expression: input,
      value,
      decimal: value !== decimal ? decimal : undefined,
      kind,
      angleMode,
      variables,
      unit: physicalConstants.find((constant) => constant.symbol === expression)?.unit,
      explanation: `Se evaluó la expresión respetando paréntesis y precedencia: primero potencias, después multiplicaciones y divisiones, luego sumas y restas. Modo angular: ${angleMode === 'rad' ? 'radianes' : angleMode === 'deg' ? 'grados' : 'gradianes'}. ${value !== decimal ? 'Se muestra una fracción y su aproximación decimal.' : 'Los resultados científicos se muestran con hasta 14 cifras significativas.'} Esta explicación describe el método general; no es una demostración paso a paso.`,
    };
  }
}
