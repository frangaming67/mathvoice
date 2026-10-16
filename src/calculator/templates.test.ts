import { describe, expect, it } from 'vitest';
import { allKeys, SEP, type KeyFace, type Layer } from './keys';
import { MathEngine } from '../services/MathEngine';

const engine = new MathEngine();

/**
 * Cómo se completa cada tecla que escribe: lo que ya había antes, lo que se escribe en el
 * cursor y en cada hueco de la plantilla, y lo que tiene que dar en grados.
 */
const examples: Record<
  string,
  { before?: string; args?: string[]; value: string; exact?: string }
> = {
  'k0 main': { args: ['5'], value: '5' },
  'k0 shift': { args: ['2.567'], value: '3' },
  'k1 main': { value: '1' },
  'k2 main': { value: '2' },
  'k3 main': { value: '3' },
  'k4 main': { value: '4' },
  'k5 main': { value: '5' },
  'k6 main': { value: '6' },
  'k7 main': { value: '7' },
  'k8 main': { value: '8' },
  'k9 main': { value: '9' },
  'calc alpha': { before: '2*3', args: ['6'], value: 'Verdadero' },
  'fraction main': { args: ['1', '4'], value: '1/4' },
  'fraction shift': { args: ['2', '1', '4'], value: '9/4' },
  'sqrt main': { args: ['16'], value: '4' },
  'sqrt shift': { args: ['27'], value: '3' },
  'square main': { before: '3', value: '9' },
  'square shift': { before: '3', value: '27' },
  'power main': { before: '2', args: ['10'], value: '1024' },
  'power shift': { args: ['27', '3'], value: '3' },
  'logb main': { args: ['8', '2'], value: '3' },
  'logb shift': { args: ['2'], value: '100' },
  'ln main': { args: ['e'], value: '1' },
  'ln shift': { args: ['0'], value: '1' },
  'neg shift': { args: ['1000'], value: '3' },
  'inverse main': { before: '4', value: '0.25', exact: '1/4' },
  'inverse shift': { before: '5', value: '120' },
  'sin main': { args: ['30'], value: '0.5' },
  'sin shift': { args: ['1'], value: '90' },
  'cos main': { args: ['60'], value: '0.5' },
  'cos shift': { args: ['0'], value: '90' },
  'tan main': { args: ['45'], value: '1' },
  'tan shift': { args: ['1'], value: '45' },
  'eng alpha': { before: '2+3*', value: '2 + 3i' },
  'lparen main': { args: ['1+2)*3'], value: '9' },
  'lparen shift': { args: ['-3'], value: '3' },
  'lparen alpha': { args: ['2x+3x'], value: '5*x' },
  'rparen main': { before: '(1+2', args: ['*3'], value: '9' },
  'times main': { before: '2', args: ['3'], value: '6' },
  'times shift': { args: ['5', '2'], value: '20' },
  'times alpha': { args: ['12', '18'], value: '6' },
  'divide main': { before: '6', args: ['4'], value: '3/2' },
  'divide shift': { args: ['5', '2'], value: '10' },
  'divide alpha': { args: ['4', '6'], value: '12' },
  'plus main': { before: '1', args: ['2'], value: '3' },
  'plus shift': { args: ['3', '4'], value: '' },
  'plus alpha': { args: ['-2.5'], value: '-2' },
  'minus main': { before: '5', args: ['2'], value: '3' },
  'minus shift': { args: ['2', '90'], value: '2i' },
  'minus alpha': { args: ['-2.5'], value: '-3' },
  'exp10 main': { before: '2', args: ['3'], value: '2000' },
  'exp10 shift': { before: '2*', value: '6.283185307' },
  'exp10 alpha': { before: 'ln(', args: [')'], value: '1' },
  'ans main': { before: '2*', value: '84' },
  'ans shift': { before: '50', value: '0.5' },
};

/** Escribe la tecla en el cursor y completa los huecos de la plantilla, en orden. */
function complete(face: KeyFace, before = '', args: string[] = []) {
  const action = face.action;
  const pending = [...args];
  let text =
    action.op === 'insert'
      ? `${before}${action.text}${pending.shift() ?? ''}`
      : action.op === 'wrap'
        ? `${before}${action.before}${pending.shift() ?? ''}${action.after}`
        : '';
  text = text.replace(SEP, () => `, ${pending.shift() ?? ''}`);
  return text.replace(/\(\)/g, () => `(${pending.shift() ?? ''})`);
}

const writing = allKeys.flatMap((key) =>
  (['main', 'shift', 'alpha'] as Layer[]).flatMap((layer) => {
    const face = key[layer];
    return face && (face.action.op === 'insert' || face.action.op === 'wrap')
      ? [{ id: `${key.id} ${layer}`, face }]
      : [];
  }),
);

describe('cada tecla que escribe, completada, se calcula', () => {
  it('no queda ninguna sin ejemplo', () => {
    expect(writing.map(({ id }) => id).filter((id) => !examples[id])).toEqual([]);
  });
  it.each(writing)('$id', ({ id, face }) => {
    const { before, args, value, exact } = examples[id];
    const expression = complete(face, before, args);
    const result = engine.evaluate(expression, { angle: 'deg', ans: '42' });
    if (value) expect(result.value, expression).toBe(value);
    else expect(result.table?.length, expression).toBeGreaterThan(0);
    // S⇔D muestra la forma exacta que el motor deja aparte.
    if (exact) expect(result.exact, expression).toBe(exact);
  });
});
