import { create, all, type MathJsInstance } from 'mathjs';
export const math = create(all);
math.createUnit({ cal: '4.184 J', kcal: '4184 J' });
export const exactMath = create(all, { number: 'Fraction' });

// Funciones que no pueden ejecutarse desde una expresión de la persona (guía de seguridad de mathjs).
const blocked = [
  'import',
  'createUnit',
  'reviver',
  'evaluate',
  'parse',
  'parser',
  'compile',
  'simplify',
  'simplifyConstant',
  'simplifyCore',
  'rationalize',
  'derivative',
  'resolve',
  'chain',
  'help',
  'leafCount',
  'symbolicEqual',
];

let hardened: { instance: MathJsInstance; parse: MathJsInstance['parse'] } | undefined;

/** Instancia separada y endurecida para interpretar y calcular lo que escribe la persona. */
export function userMath() {
  if (!hardened) {
    const instance = create(all);
    const parse = instance.parse;
    instance.import(
      Object.fromEntries(
        blocked.map((name) => [
          name,
          () => {
            throw new Error(`La función ${name} no está disponible.`);
          },
        ]),
      ),
      { override: true },
    );
    hardened = { instance, parse };
  }
  return hardened;
}
