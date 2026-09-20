import type { HistoryEntry } from '../types';
export type ExportFormat = 'txt' | 'csv' | 'json';
const procedure = (entry: HistoryEntry) =>
  (entry.steps ?? [])
    .map(
      (step, i) =>
        `Paso ${i + 1}. ${step.title}. ${step.detail}${step.formula ? `\n${step.formula}` : ''}`,
    )
    .join('\n');
export function exportHistory(entries: HistoryEntry[], format: ExportFormat): string {
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
