import { all, create, type MathNode, type FunctionNode, type OperatorNode } from 'mathjs';
import { normalizeExpression } from '../parser/expression';
import type { AngleMode, CalculationResult } from '../types';

const math = create(all);
const exactMath = create(all, { number: 'Fraction' });
const functions = new Set(
  'sin cos tan asin acos atan sinh cosh tanh log ln exp sqrt cbrt factorial mod floor ceil round abs sign gcd lcm fraction'.split(
    ' ',
  ),
);
const symbols = new Set(['pi', 'e', 'phi', 'Infinity']);
const operators = new Set(['+', '-', '*', '/', '^', '%', '!']);
const permitted = new Set([
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'ParenthesisNode',
]);

function validate(node: MathNode) {
  node.traverse((child) => {
    if (!permitted.has(child.type))
      throw new Error(
        'En esta fase usá una expresión numérica, sin asignaciones, matrices ni ecuaciones.',
      );
    if (child.type === 'FunctionNode' && !functions.has((child as FunctionNode).fn.name ?? ''))
      throw new Error(
        `La función ${(child as FunctionNode).fn.name} todavía no está disponible. Consultá las herramientas científicas.`,
      );
    if (
      child.type === 'SymbolNode' &&
      !symbols.has(child.toString()) &&
      !functions.has(child.toString())
    )
      throw new Error(
        `No reconozco «${child.toString()}». Revisá el nombre de la función o constante.`,
      );
    if (child.type === 'OperatorNode' && !operators.has((child as OperatorNode).op))
      throw new Error('Ese operador no está disponible en esta fase.');
  });
}

export class MathEngine {
  evaluate(input: string, angleMode: AngleMode = 'rad'): CalculationResult {
    if (!input.trim()) throw new Error('Escribí una expresión antes de calcular.');
    if (input.length > 500)
      throw new Error('La expresión es demasiado larga. Usá hasta 500 caracteres.');
    const expression = normalizeExpression(input);
    let node: MathNode;
    try {
      node = math.parse(expression);
    } catch {
      throw new Error(
        'No pude interpretar la expresión. Revisá los paréntesis y operadores; usá punto para los decimales.',
      );
    }
    validate(node);
    const factor = angleMode === 'deg' ? Math.PI / 180 : angleMode === 'grad' ? Math.PI / 200 : 1;
    const scope = new Map<string, unknown>([
      ['sin', (x: number) => Math.sin(x * factor)],
      ['cos', (x: number) => Math.cos(x * factor)],
      ['tan', (x: number) => Math.tan(x * factor)],
      ['asin', (x: number) => Math.asin(x) / factor],
      ['acos', (x: number) => Math.acos(x) / factor],
      ['atan', (x: number) => Math.atan(x) / factor],
      ['ln', (x: number) => Math.log(x)],
      ['log', (x: number, base = 10) => Math.log(x) / Math.log(base)],
    ]);
    let result: unknown;
    try {
      result = node.compile().evaluate(scope);
    } catch {
      throw new Error(
        'No pude calcular esa operación. Revisá la cantidad de argumentos y los valores de las funciones.',
      );
    }
    if (typeof result !== 'number' && !math.isFraction(result))
      throw new Error(
        'El resultado no es un número real. Los números complejos se incorporarán en la fase 3.',
      );
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
      explanation: `Se evaluó la expresión respetando paréntesis y precedencia: primero potencias, después multiplicaciones y divisiones, luego sumas y restas. Modo angular: ${angleMode === 'rad' ? 'radianes' : angleMode === 'deg' ? 'grados' : 'gradianes'}. ${value !== decimal ? 'Se muestra una fracción y su aproximación decimal.' : 'Los resultados científicos se muestran con hasta 14 cifras significativas.'} Esta explicación describe el método general; no es una demostración paso a paso.`,
    };
  }
}
