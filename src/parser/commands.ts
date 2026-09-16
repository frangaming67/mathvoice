export function splitArguments(input: string): string[] {
  let depth = 0;
  let start = 0;
  const args: string[] = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(' || input[i] === '[') depth++;
    if (input[i] === ')' || input[i] === ']') depth--;
    if (depth < 0) throw new Error('Revisá los paréntesis de la operación.');
    if (input[i] === ',' && depth === 0) {
      args.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error('Falta cerrar un paréntesis en la operación.');
  args.push(input.slice(start).trim());
  if (args.some((arg) => !arg)) throw new Error('Falta completar un argumento de la operación.');
  return args;
}
export function parseCommand(input: string) {
  const match = input.match(/^([a-z]+)\s*\(([\s\S]*)\)$/i);
  return match ? { name: match[1], args: splitArguments(match[2]) } : null;
}
