import type { HistoryEntry } from '../types';
import { toMathML } from '../accessibility/mathml';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
export type ExportFormat = 'txt' | 'csv' | 'json' | 'html';
const procedure = (entry: HistoryEntry) =>
  (entry.steps ?? [])
    .map(
      (step, i) =>
        `Paso ${i + 1}. ${step.title}. ${step.detail}${step.formula ? `\n${step.formula}` : ''}`,
    )
    .join('\n');
const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const angles = { rad: 'radianes', deg: 'grados', grad: 'gradianes' };
/** Fórmula en MathML con su lectura en español; si no se puede armar, el texto lineal. */
function formula(text: string, separator: HistoryEntry['separator']) {
  const decimalSeparator = separator ?? 'punto';
  const mathml = toMathML(text, {
    decimalSeparator,
    alttext: mathSpeech(text, { decimalSeparator }),
    display: 'inline',
  });
  return mathml ? `${mathml} <code>${escape(text)}</code>` : `<code>${escape(text)}</code>`;
}
/** Informe para imprimir o entregar: se lee con lector de pantalla y muestra las fórmulas. */
function report(entries: HistoryEntry[]) {
  const items = entries
    .map((e, i) => {
      const steps = e.steps?.length
        ? `<h3>Procedimiento</h3><ol>${e.steps
            .map(
              (step) =>
                `<li><p><strong>${escape(step.title)}.</strong> ${escape(step.detail)}</p>${step.formula ? `<p>${escape(step.formula)}</p>` : ''}</li>`,
            )
            .join('')}</ol>`
        : '';
      const warnings = e.warnings?.length ? `<p>Aviso: ${escape(e.warnings.join(' '))}</p>` : '';
      return `<article><h2>Cálculo ${i + 1}</h2><p class="meta">${escape(new Date(e.date).toLocaleString('es-AR'))} · ${escape(e.kind)} · ${angles[e.angleMode]}</p><p>Expresión: ${formula(e.expression, e.separator)}</p><p>Resultado: ${formula(e.value, e.separator)}${e.unit ? ` ${escape(e.unit)}` : ''}</p>${warnings}${steps}</article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cálculos de MathVoice</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
article { border-top: 1px solid #888; padding: 0.5rem 0; }
.meta { color: #444; }
math { font-size: 1.25em; }
code { margin-left: 0.5rem; color: #444; }
</style>
</head>
<body>
<h1>Cálculos de MathVoice</h1>
<p>${entries.length === 1 ? '1 cálculo' : `${entries.length} cálculos`}, exportados el ${escape(new Date().toLocaleString('es-AR'))}.</p>
${items}
</body>
</html>
`;
}
export function exportHistory(entries: HistoryEntry[], format: ExportFormat): string {
  if (format === 'html') return report(entries);
  if (format === 'json')
    return JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), calculations: entries },
      null,
      2,
    );
  if (format === 'txt')
    return entries
      .map(
        (e) =>
          `${e.date} | ${e.kind} | ${e.angleMode}\n${e.expression}\n= ${e.value}${e.unit ? ` ${e.unit}` : ''}\n${e.explanation}${e.steps?.length ? `\n\n${procedure(e)}` : ''}`,
      )
      .join('\n\n');
  const field = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      ['Fecha', 'Tipo', 'Modo angular', 'Expresión', 'Resultado', 'Unidad', 'Procedimiento'],
      ...entries.map((e) => [
        e.date,
        e.kind,
        e.angleMode,
        e.expression,
        e.value,
        e.unit ?? '',
        procedure(e),
      ]),
    ]
      .map((row) => row.map(field).join(','))
      .join('\r\n')
  );
}
export function downloadHistory(entries: HistoryEntry[], format: ExportFormat) {
  const blob = new Blob([exportHistory(entries, format)], {
    type:
      format === 'json'
        ? 'application/json;charset=utf-8'
        : format === 'html'
          ? 'text/html;charset=utf-8'
          : format === 'csv'
            ? 'text/csv;charset=utf-8'
            : 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mathvoice-historial.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
