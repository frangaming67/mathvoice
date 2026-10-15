/** Operando completo: número sin signo (con punto o coma decimal), nombre, llamada o grupo. */
export function isAtomic(value: string): boolean {
  const text = value.trim();
  if (/^(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i.test(text) || /^[a-zA-Z_]\w*$/.test(text))
    return true;
  const open = text.match(/^[a-zA-Z_]\w*\(|^\(/)?.[0];
  if (!open || !text.endsWith(')')) return false;
  let depth = 0;
  for (let index = open.length - 1; index < text.length; index++) {
    if (text[index] === '(') depth++;
    else if (text[index] === ')' && --depth === 0) return index === text.length - 1;
  }
  return false;
}

/**
 * Completa una plantilla como «sqrt($0)» o «$0^$1». Dentro de los paréntesis de una función el
 * argumento va tal cual; junto a un operador, solo se agrupa lo que no es atómico.
 */
export function fillFunctionTemplate(template: string, values: readonly string[]): string {
  return template.replace(/\$(\d+)/g, (_match, index: string, offset: number) => {
    const value = (values[Number(index)] ?? '').trim();
    const before = template[offset - 1];
    const after = template[offset + _match.length];
    // Con coma decimal, los argumentos se separan con «;».
    const argument = /[(,;]/.test(before ?? '') && /[),;]/.test(after ?? '');
    return argument || isAtomic(value) ? value : `(${value})`;
  });
}
