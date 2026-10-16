import { expect, it } from 'vitest';
import { MathEngine } from './MathEngine';
const engine = new MathEngine();
it.each([
  ['det([[1,2],[3,4]])', '-2'],
  ['rank([[1,2],[2,4]])', '1'],
  ['trace([[1,2],[3,4]])', '5'],
  ['dot([1,2,3],[4,5,6])', '32'],
  ['norm([3,4])', '5'],
  ['abs(3+4*i)', '5'],
  ['combinations(5,2)', '10'],
  ['normalcdf(0,0,1)', '0.5'],
  ['invnorm(0.975,0,1)', '1.959963985'],
  ['invnorm(0.5,100,15)', '100'],
  ['binomialpdf(2,5,0.5)', '0.3125'],
  ['base("FF",16,10)', '255'],
])('%s → %s', (e, v) => expect(engine.evaluate(e).value).toBe(v));
it('representa matrices y autovectores como tablas accesibles', () => {
  expect(engine.evaluate('inv([[1,2],[3,4]])').matrix).toEqual([
    ['-2', '1'],
    ['1.5', '-0.5'],
  ]);
  expect(engine.evaluate('cross([1,0,0],[0,1,0])').matrix).toEqual([['0', '0', '1']]);
  expect(engine.evaluate('eigvecs([[2,0],[0,3]])').table).toHaveLength(2);
});
it('estadística y regresión coinciden con un conjunto conocido', () => {
  const stats = engine.evaluate('stats([1,2,3,4,5],1)').table!;
  expect(stats.find((row) => row.label === 'Media')?.value).toBe('3');
  expect(stats.find((row) => row.label === 'Varianza muestral')?.value).toBe('2.5');
  expect(
    engine.evaluate('regression([1,2,3],[2,4,6])').table?.find((r) => r.label === 'Pendiente')
      ?.value,
  ).toBe('2');
});
it('guarda variables y usa su contexto sin permitir redefinir funciones', () => {
  expect(engine.evaluate('radio=7').assigned).toEqual({ name: 'radio', value: 7 });
  expect(Number(engine.evaluate('pi*radio^2', 'rad', { radio: 7 }).value)).toBeCloseTo(
    Math.PI * 49,
  );
  expect(() => engine.evaluate('sin=7')).toThrow('reservado');
});
it('convierte unidades afines y enteros grandes sin perder precisión', () => {
  expect(engine.evaluate('convert(25,"degC","degF")').table?.[0].value).toBe('77');
  expect(engine.evaluate('base("9007199254740993",10,16)').value).toBe('20000000000001');
  expect(engine.evaluate('bitop("not","0","0",8)').table?.[0].value).toBe('255');
});
it.each([
  'inv([[1,2],[2,4]])',
  'normalize([0,0])',
  'correlation([1,1],[2,3])',
  'normalcdf(0,0,0)',
  'invnorm(1,0,1)',
  'invnorm(0.5,0,0)',
  'binomialpdf(1,4,2)',
  'stats([1],1)',
  'convert(1,"m","kg")',
  'base("2",2,10)',
  'bitop("left","1","99",8)',
])('rechaza entradas fuera del dominio: %s', (e) => expect(() => engine.evaluate(e)).toThrow());
it('constantes con unidades, fracciones mixtas y raíces completas', () => {
  expect(engine.evaluate('c_luz').unit).toBe('metros por segundo');
  expect(engine.evaluate('h_P').value).toBe('6.62607015e-34');
  expect(engine.evaluate('mixedNumber(-2,1,3)').value).toBe('-7/3');
  expect(engine.evaluate('mixed(fraction(7,3))').table?.[0].value).toBe('2 enteros y 1/3');
  expect(engine.evaluate('nthRoots(1,3)').matrix?.[0]).toHaveLength(3);
  expect(() => engine.evaluate('nthRoots(1,0)')).toThrow();
  expect(() => engine.evaluate('a=[1,2]')).toThrow('reales finitos');
  expect(engine.evaluate('ln(-1)', { angle: 'rad', numberMode: 'complejo' }).kind).toBe(
    'Complejos',
  );
  expect(engine.evaluate('sqrt(-1)', { angle: 'rad', numberMode: 'complejo' }).value).toBe('i');
  expect(() => engine.evaluate('normalize([1e308,1e308])')).toThrow('rango numérico');
  expect(engine.evaluate('binomialpdf(11,10,0.5)').value).toBe('0');
  expect(engine.evaluate('binomialcdf(11,10,0.5)').value).toBe('1');
});
