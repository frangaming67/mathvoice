const numbers: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};
export function voiceExpression(transcript: string): { expression: string; angle?: 'deg' | 'rad' } {
  let text = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!]/g, '')
    .replace(/[.]$/, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim();
  const angle = text.includes('grados') ? 'deg' : text.includes('radianes') ? 'rad' : undefined;
  text = text.replace(/\b(grados|radianes)\b/g, '');
  const words = text.split(/\s+/);
  const normalized: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'coma' || words[i] === 'punto') {
      normalized.push('.');
      // Preserve leading zeroes when decimal digits are dictated individually.
      while (
        i + 1 < words.length &&
        numbers[words[i + 1]] !== undefined &&
        numbers[words[i + 1]] < 10
      ) {
        normalized.push(String(numbers[words[++i]]));
      }
      continue;
    }
    if (numbers[words[i]] !== undefined || words[i] === 'mil') {
      let sum = 0,
        part = 0;
      while (
        i < words.length &&
        (numbers[words[i]] !== undefined ||
          words[i] === 'mil' ||
          (words[i] === 'y' && numbers[words[i + 1]] !== undefined))
      ) {
        if (words[i] === 'mil') {
          sum += (part || 1) * 1000;
          part = 0;
        } else if (words[i] !== 'y') part += numbers[words[i]];
        i++;
      }
      normalized.push(String(sum + part));
      i--;
    } else normalized.push(words[i]);
  }
  text = normalized
    .join(' ')
    .replace(/\bequis\b/g, 'x')
    .replace(/\bye\b/g, 'y')
    .replace(/\bal cuadrado\b/g, '^2')
    .replace(/\bal cubo\b/g, '^3')
    .replace(/\belevado a\b/g, '^')
    .replace(/\bmas\b/g, '+')
    .replace(/\bmenos\b/g, '-')
    .replace(/\bdividido (por|entre)\b/g, '/')
    .replace(/\bpor\b/g, '*')
    .replace(/\bigual a?\b/g, '=')
    .replace(/\bcoma\b/g, '.')
    .replace(/\b(abre|abrir) parentesis\b/g, '(')
    .replace(/\b(cierra|cerrar) parentesis\b/g, ')');
  const prefixes: [RegExp, string, string][] = [
    [/^derivada de\s*/, 'diff(', ',x)'],
    [/^integral de\s*/, 'integrate(', ',x)'],
    [/^resolver\s*/, 'solve(', ',x)'],
    [/^raiz cuadrada de\s*/, 'sqrt(', ')'],
    [/^seno de\s*/, 'sin(', ')'],
    [/^coseno de\s*/, 'cos(', ')'],
    [/^tangente de\s*/, 'tan(', ')'],
  ];
  for (const [pattern, start, end] of prefixes)
    if (pattern.test(text)) {
      text = start + text.replace(pattern, '') + end;
      break;
    }
  return { expression: text.replace(/\s+/g, ''), angle };
}
