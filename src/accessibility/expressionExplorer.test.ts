import { describe, expect, it } from 'vitest';
import { describeNode, explorerTree, summarize, type ExplorerNode } from './expressionExplorer';

const child = (node: ExplorerNode, ...path: number[]) =>
  path.reduce((current, index) => current.children[index].node, node);
const role = (node: ExplorerNode, ...path: number[]) => {
  const parent = child(node, ...path.slice(0, -1));
  return parent.children[path.at(-1)!].role;
};
/** Lo que se escribió en el lugar de una parte. */
const written = (source: string, node: ExplorerNode) =>
  node.range ? source.slice(node.range[0], node.range[1]) : null;

describe('explorador de expresiones', () => {
  it('una fracción tiene numerador y denominador, y cada uno sus términos', () => {
    const source = '(x^2+1)/(2x-3)';
    const tree = explorerTree(source)!;
    expect(tree.kind).toBe('fracción');
    expect(tree.children.map((c) => c.role)).toEqual(['numerador', 'denominador']);
    expect(child(tree, 0).kind).toBe('suma');
    expect(child(tree, 1).kind).toBe('resta');
    expect(child(tree, 0, 0).kind).toBe('potencia');
    expect(role(tree, 0, 0, 1)).toBe('exponente');
    expect(child(tree, 1, 1).spoken).toBe('menos 3');
    expect(summarize(tree)).toBe(
      'Fracción de 2 partes: el numerador es una suma y el denominador, una resta.',
    );
    expect(describeNode(child(tree, 0), 'numerador')).toBe(
      'Numerador, suma: equis al cuadrado más 1',
    );
    // Cada parte sabe dónde está en lo escrito, para llevar el cursor ahí.
    expect(written(source, tree)).toBe(source);
    expect(written(source, child(tree, 0))).toBe('x^2+1');
    expect(written(source, child(tree, 1))).toBe('2x-3');
    expect(written(source, child(tree, 0, 0, 1))).toBe('2');
  });
  it('una ecuación tiene dos lados; las funciones, sus argumentos con nombre', () => {
    const source = 'sin(x)^2 + cos(x)^2 = 1';
    const tree = explorerTree(source)!;
    expect(tree.kind).toBe('ecuación');
    expect(tree.children.map((c) => c.role)).toEqual(['lado izquierdo', 'lado derecho']);
    expect(child(tree, 0, 0, 0).kind).toBe('seno');
    expect(written(source, child(tree, 0, 1, 0))).toBe('cos(x)');
    const log = explorerTree('log(8, 2)')!;
    expect(log.kind).toBe('logaritmo');
    expect(log.children.map((c) => c.role)).toEqual(['argumento', 'base']);
    expect(explorerTree('nthRoot(27, 3)')!.children.map((c) => c.role)).toEqual([
      'radicando',
      'índice',
    ]);
  });
  it('restas, factoriales, negativos y matrices', () => {
    const source = '-3 + sqrt(16) - 4!';
    const tree = explorerTree(source)!;
    expect(tree.children.map((c) => c.node.kind)).toEqual(['número', 'raíz cuadrada', 'factorial']);
    expect(written(source, child(tree, 0))).toBe('-3');
    expect(written(source, child(tree, 2))).toBe('4!');
    expect(child(tree, 2).spoken).toMatch(/^menos 4 factorial/);
    const matrix = explorerTree('[[1,2],[3,4]]')!;
    expect(matrix.kind).toBe('matriz');
    expect(role(matrix, 1, 0)).toBe('columna 1');
    expect(child(matrix, 1, 0).spoken).toBe('3');
    expect(summarize(child(matrix, 0))).toBe(
      'Fila de 2 partes: la columna 1 es un número y la columna 2, un número.',
    );
  });
  it('con coma decimal ubica los números como se escribieron', () => {
    const source = '2,5x + 1';
    const tree = explorerTree(source, { decimalSeparator: 'coma' })!;
    expect(child(tree, 0).kind).toBe('producto');
    expect(written(source, child(tree, 0, 0))).toBe('2,5');
    expect(child(tree, 0, 0).spoken).toBe('2 coma 5');
  });
  it('una hoja se resume diciendo qué es, y lo que no se entiende da null', () => {
    expect(summarize(explorerTree('x')!)).toBe('Es una variable: equis.');
    expect(explorerTree('2+*')).toBeNull();
    expect(explorerTree('   ')).toBeNull();
  });
});
