const aliases: Record<string, string> = {
  raiz: 'sqrt',
  raíz: 'sqrt',
  sen: 'sin',
  seno: 'sin',
  coseno: 'cos',
  tangente: 'tan',
  absoluto: 'abs',
  infinito: 'Infinity',
  inf: 'Infinity',
  mcd: 'gcd',
  mcm: 'lcm',
};
export function normalizeExpression(input: string): string {
  return input
    .trim()
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/−/g, '-')
    .replace(/[a-záéíóúñ]+/gi, (word) => aliases[word.toLowerCase()] ?? word);
}
