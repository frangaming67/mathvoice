export function toggleSign(expression: string): string {
  if (expression.startsWith('-(') && expression.endsWith(')')) {
    let depth = 0;
    for (let i = 1; i < expression.length; i++) {
      if (expression[i] === '(') depth++;
      if (expression[i] === ')') depth--;
      if (depth === 0)
        return i === expression.length - 1 ? expression.slice(2, -1) : `-(${expression})`;
    }
  }
  return `-(${expression || '0'})`;
}
