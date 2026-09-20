import { math } from './mathRuntime';
export const unitCategories: Record<string, [string, string][]> = {
  Longitud: [
    ['m', 'Metros'],
    ['km', 'Kilómetros'],
    ['cm', 'Centímetros'],
    ['mm', 'Milímetros'],
    ['in', 'Pulgadas'],
    ['ft', 'Pies'],
    ['yd', 'Yardas'],
    ['mi', 'Millas'],
  ],
  Área: [
    ['m^2', 'Metros cuadrados'],
    ['km^2', 'Kilómetros cuadrados'],
    ['hectare', 'Hectáreas'],
    ['ft^2', 'Pies cuadrados'],
  ],
  Volumen: [
    ['L', 'Litros'],
    ['mL', 'Mililitros'],
    ['m^3', 'Metros cúbicos'],
    ['gallon', 'Galones estadounidenses'],
  ],
  Masa: [
    ['kg', 'Kilogramos'],
    ['g', 'Gramos'],
    ['mg', 'Miligramos'],
    ['lb', 'Libras'],
    ['oz', 'Onzas'],
  ],
  Tiempo: [
    ['s', 'Segundos'],
    ['min', 'Minutos'],
    ['h', 'Horas'],
    ['day', 'Días'],
  ],
  Velocidad: [
    ['m/s', 'Metros por segundo'],
    ['km/h', 'Kilómetros por hora'],
    ['mi/h', 'Millas por hora'],
  ],
  Temperatura: [
    ['degC', 'Celsius'],
    ['degF', 'Fahrenheit'],
    ['K', 'Kelvin'],
  ],
  Presión: [
    ['Pa', 'Pascales'],
    ['kPa', 'Kilopascales'],
    ['bar', 'Bares'],
    ['atm', 'Atmósferas'],
    ['psi', 'PSI'],
  ],
  Energía: [
    ['J', 'Julios'],
    ['kJ', 'Kilojulios'],
    ['cal', 'Calorías'],
    ['kWh', 'Kilovatios hora'],
  ],
  Potencia: [
    ['W', 'Vatios'],
    ['kW', 'Kilovatios'],
    ['hp', 'Caballos de potencia'],
  ],
  'Datos digitales': [
    ['b', 'Bits'],
    ['B', 'Bytes'],
    ['kB', 'Kilobytes decimales'],
    ['MB', 'Megabytes decimales'],
    ['GB', 'Gigabytes decimales'],
    ['KiB', 'Kibibytes'],
    ['MiB', 'Mebibytes'],
    ['GiB', 'Gibibytes'],
  ],
  Ángulos: [
    ['rad', 'Radianes'],
    ['deg', 'Grados'],
    ['grad', 'Gradianes'],
  ],
};
const units = new Map(Object.values(unitCategories).flat());
export function convertUnits(value: unknown, from: unknown, to: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !units.has(from) ||
    !units.has(to)
  )
    throw new Error('Elegí unidades válidas y un valor numérico finito.');
  try {
    return { Valor: math.unit(value, from).toNumber(to), Unidad: units.get(to)! };
  } catch {
    throw new Error('Las unidades elegidas no son compatibles.');
  }
}
function parseInteger(text: unknown, base: unknown): bigint {
  if (
    typeof text !== 'string' ||
    typeof base !== 'number' ||
    ![2, 8, 10, 16].includes(base) ||
    text.length > 256
  )
    throw new Error('Usá un número entero de hasta 256 dígitos y una base válida.');
  const negative = text.startsWith('-');
  const digits = text.replace(/^[-+]/, '').toLowerCase();
  if (!digits) throw new Error('Escribí un número entero.');
  let result = 0n;
  for (const char of digits) {
    const digit = parseInt(char, 16);
    if (!Number.isInteger(digit) || digit >= base)
      throw new Error('El número contiene dígitos que no pertenecen a la base elegida.');
    result = result * BigInt(base) + BigInt(digit);
  }
  return negative ? -result : result;
}
export function convertBase(text: unknown, from: unknown, to: unknown) {
  if (typeof to !== 'number' || ![2, 8, 10, 16].includes(to))
    throw new Error('Base de destino inválida.');
  return parseInteger(text, from).toString(to).toUpperCase();
}
export function bitOperation(op: unknown, a: unknown, b: unknown, width: unknown) {
  if (typeof width !== 'number' || ![8, 16, 32, 64].includes(width))
    throw new Error('Elegí un ancho de 8, 16, 32 o 64 bits.');
  const x = BigInt.asUintN(width, parseInteger(a, 10)),
    y = parseInteger(b, 10);
  let value: bigint;
  if (op === 'and') value = x & y;
  else if (op === 'or') value = x | y;
  else if (op === 'xor') value = x ^ y;
  else if (op === 'not') value = ~x;
  else if (op === 'left' || op === 'right') {
    if (y < 0n || y > BigInt(width))
      throw new Error('El desplazamiento debe estar entre cero y el ancho de bits.');
    value = op === 'left' ? x << y : x >> y;
  } else throw new Error('Operación binaria desconocida.');
  const unsigned = BigInt.asUintN(width, value);
  return {
    Decimal: unsigned.toString(),
    Binario: unsigned.toString(2).padStart(width, '0'),
    Hexadecimal: unsigned.toString(16).toUpperCase(),
  };
}
