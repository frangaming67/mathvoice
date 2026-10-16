import type { AngleMode, CalculationResult, CalculationStep, HistoryEntry } from '../types';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import { resultSpeech, type ResultSpeechOptions } from '../accessibility/resultSpeech';
import { storage, type StorageService } from './StorageService';
import { validVariables } from './VariableService';

export const HISTORY_LIMIT = 100;
export const HISTORY_PAGE = 20;
/** Caracteres de JSON por entrada; con 100 entradas queda lejos de la cuota de localStorage. */
export const ENTRY_BUDGET = 20_000;
const EXPRESSION_LIMIT = 10_000;
const TEXT_LIMIT = 2_000;
const STEP_TEXT_LIMIT = 1_000;
export const TRIMMED_WARNING =
  'Parte de este cálculo era demasiado larga para el historial. Recalculalo para verlo completo.';

type Data = Record<string, unknown>;
const isObject = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const isStep = (v: unknown) =>
  isObject(v) && isString(v.title) && isString(v.detail) && optional(v.formula, isString);
const isRow = (v: unknown) => isObject(v) && isString(v.label) && isString(v.value);
const isMatrix = (v: unknown) =>
  Array.isArray(v) && v.every((row) => Array.isArray(row) && row.every(isString));
const isAssigned = (v: unknown) =>
  isObject(v) && isString(v.name) && typeof v.value === 'number' && Number.isFinite(v.value);
const angles: unknown[] = ['rad', 'deg', 'grad'] satisfies AngleMode[];
const radixes: unknown[] = [2, 8, 10, 16];
const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
const size = (entry: HistoryEntry) => JSON.stringify(entry).length;

/**
 * Único esquema del historial: se aplica al guardar y al leer, así que todo lo que se guarda
 * se puede volver a leer. Devuelve null si la entrada está dañada; si es demasiado grande,
 * la recorta en vez de descartarla. Es idempotente.
 */
export function toStoredEntry(value: unknown): HistoryEntry | null {
  if (!isObject(value)) return null;
  const v = value;
  if (!isString(v.id) || !v.id || v.id.length > 200 || !isString(v.date) || v.date.length > 100)
    return null;
  if (
    !isString(v.expression) ||
    v.expression.length > EXPRESSION_LIMIT ||
    !isString(v.value) ||
    !isString(v.kind) ||
    !isString(v.explanation) ||
    !angles.includes(v.angleMode)
  )
    return null;
  const valid =
    [v.decimal, v.unit, v.exact, v.description].every((f) => optional(f, isString)) &&
    [v.complex, v.graphable, v.approximate].every((f) => optional(f, isBoolean)) &&
    optional(v.radix, (r) => radixes.includes(r)) &&
    optional(v.separator, (s) => s === 'punto' || s === 'coma') &&
    optional(v.warnings, (w) => Array.isArray(w) && w.every(isString)) &&
    optional(v.variables, validVariables) &&
    optional(v.assigned, isAssigned) &&
    optional(v.steps, (s) => Array.isArray(s) && s.every(isStep)) &&
    optional(v.table, (t) => Array.isArray(t) && t.every(isRow)) &&
    optional(v.matrix, isMatrix) &&
    optional(v.headers, (h) => Array.isArray(h) && h.every(isString));
  if (!valid) return null;
  const entry = {
    id: v.id,
    date: v.date,
    expression: v.expression,
    value: v.value,
    kind: v.kind,
    explanation: v.explanation,
    angleMode: v.angleMode,
  } as HistoryEntry;
  const copy = entry as unknown as Data;
  for (const key of [
    'decimal',
    'unit',
    'exact',
    'description',
    'complex',
    'graphable',
    'approximate',
    'radix',
    'separator',
  ])
    if (v[key] !== undefined) copy[key] = v[key];
  if (v.warnings) entry.warnings = [...(v.warnings as string[])];
  if (v.variables) entry.variables = { ...(v.variables as Record<string, number>) };
  if (v.assigned) {
    const { name, value } = v.assigned as { name: string; value: number };
    entry.assigned = { name, value };
  }
  if (v.steps)
    entry.steps = (v.steps as CalculationStep[]).map(({ title, detail, formula }) =>
      formula === undefined ? { title, detail } : { title, detail, formula },
    );
  if (v.table)
    entry.table = (v.table as { label: string; value: string }[]).map(({ label, value }) => ({
      label,
      value,
    }));
  if (v.matrix) entry.matrix = (v.matrix as string[][]).map((row) => [...row]);
  if (v.matrix && v.headers) entry.headers = [...(v.headers as string[])];
  return fit(entry);
}

function fit(entry: HistoryEntry): HistoryEntry {
  if (size(entry) <= ENTRY_BUDGET) return entry;
  // La tabla y la matriz repiten el valor en forma estructurada: el texto del valor se conserva.
  let next: HistoryEntry = { ...entry };
  delete next.matrix;
  delete next.headers;
  delete next.table;
  if (size(next) <= ENTRY_BUDGET) return next;
  const before = JSON.stringify(next);
  const texts = [
    'value',
    'decimal',
    'exact',
    'explanation',
    'description',
    'unit',
    'kind',
  ] as const;
  for (const key of texts) {
    const text = next[key];
    if (text !== undefined) next = { ...next, [key]: cut(text, TEXT_LIMIT) };
  }
  if (next.steps)
    next.steps = next.steps.map((step) => ({
      ...step,
      title: cut(step.title, STEP_TEXT_LIMIT),
      detail: cut(step.detail, STEP_TEXT_LIMIT),
      ...(step.formula === undefined ? {} : { formula: cut(step.formula, STEP_TEXT_LIMIT) }),
    }));
  if (next.warnings) {
    const others = next.warnings
      .filter((w) => w !== TRIMMED_WARNING)
      .slice(0, 4)
      .map((w) => cut(w, 300));
    next.warnings = next.warnings.includes(TRIMMED_WARNING) ? [...others, TRIMMED_WARNING] : others;
  }
  const trimmed = (value: HistoryEntry) =>
    value.warnings?.includes(TRIMMED_WARNING)
      ? value
      : { ...value, warnings: [...(value.warnings ?? []), TRIMMED_WARNING] };
  if (JSON.stringify(next) !== before) next = trimmed(next);
  if (size(next) <= ENTRY_BUDGET || !next.steps) return next;
  const withoutSteps = { ...next };
  delete withoutSteps.steps;
  return trimmed(withoutSteps);
}

export interface SanitizedHistory {
  entries: HistoryEntry[];
  /** Entradas con forma inválida que se descartaron. */
  discarded: number;
  /** Ids presentes en el valor guardado, incluidas las entradas dañadas. */
  ids: Set<string>;
  /** El valor no era una lista: no se pudo recuperar nada. */
  damaged: boolean;
}
/** Valida entrada por entrada: conserva las válidas y cuenta las dañadas. */
export function sanitizeHistory(value: unknown): SanitizedHistory {
  if (!Array.isArray(value)) return { entries: [], discarded: 0, ids: new Set(), damaged: true };
  const ids = new Set<string>();
  const entries: HistoryEntry[] = [];
  let discarded = 0;
  for (const item of value) {
    if (isObject(item) && isString(item.id)) ids.add(item.id);
    const entry = toStoredEntry(item);
    if (!entry) discarded++;
    else if (!entries.some((e) => e.id === entry.id)) entries.push(entry);
  }
  return { entries: entries.slice(0, HISTORY_LIMIT), discarded, ids, damaged: false };
}

const time = (entry: HistoryEntry) => {
  const t = Date.parse(entry.date);
  return Number.isNaN(t) ? -Infinity : t;
};
/** Más recientes primero; el orden previo se mantiene ante fechas iguales. */
export const newestFirst = (entries: HistoryEntry[]) =>
  [...entries].sort((a, b) => (time(a) === time(b) ? 0 : time(b) > time(a) ? 1 : -1));

export interface MergeContext {
  /** Ids que había en el almacenamiento la última vez que esta pestaña lo leyó o escribió. */
  stored?: ReadonlySet<string>;
  /** Ids que esta pestaña ya mostró: si faltan en la lista local, se eliminaron acá. */
  seen?: ReadonlySet<string>;
  /** Ids presentes en el valor remoto, incluidas entradas dañadas. */
  present?: ReadonlySet<string>;
}
/**
 * Fusiona por id la lista local con la guardada por otra pestaña: respeta lo que se eliminó
 * en cualquiera de las dos, ordena de más reciente a más antiguo y deja como máximo 100.
 */
export function mergeHistory(
  local: HistoryEntry[],
  remote: HistoryEntry[],
  { stored = new Set(), seen = new Set(), present }: MergeContext = {},
): HistoryEntry[] {
  const remoteIds = present ?? new Set(remote.map((e) => e.id));
  const localIds = new Set(local.map((e) => e.id));
  const kept = local.filter((e) => remoteIds.has(e.id) || !stored.has(e.id));
  const added = remote.filter((e) => !localIds.has(e.id) && !seen.has(e.id));
  return newestFirst([...kept, ...added]).slice(0, HISTORY_LIMIT);
}

export function discardedMessage(count: number, backedUp: boolean) {
  const text =
    count === 1
      ? 'Se descartó 1 cálculo dañado del historial.'
      : `Se descartaron ${count} cálculos dañados del historial.`;
  return backedUp ? `${text} Guardé una copia de respaldo.` : text;
}
const damagedMessage =
  'El historial guardado estaba dañado y no se pudo cargar. Guardé una copia de respaldo; podés seguir calculando.';

const sameOrder = (a: HistoryEntry[], b: HistoryEntry[]) =>
  a.length === b.length && a.every((e, i) => e.id === b[i].id);

export function createHistoryService(store: StorageService = storage) {
  let stored = new Set<string>();
  const seen = new Set<string>();
  let current: HistoryEntry[] = [];
  const listeners = new Set<(entries: HistoryEntry[]) => void>();
  let stop: (() => void) | undefined;
  const remember = (entries: HistoryEntry[]) => entries.forEach((e) => seen.add(e.id));
  const parse = (raw: string | null): SanitizedHistory | null => {
    if (raw === null) return { entries: [], discarded: 0, ids: new Set(), damaged: false };
    try {
      const result = sanitizeHistory(JSON.parse(raw));
      return result.damaged ? null : result;
    } catch {
      return null;
    }
  };
  const notify = (entries: HistoryEntry[]) => {
    remember(entries);
    listeners.forEach((listener) => listener(entries));
  };
  const changed = (raw: string | null) => {
    const remote = parse(raw);
    if (!remote) return;
    const merged = mergeHistory(current, remote.entries, { stored, seen, present: remote.ids });
    stored = remote.ids;
    current = merged;
    notify(merged);
  };
  return {
    load(): HistoryEntry[] {
      const raw = store.readRaw('history');
      const result = parse(raw);
      if (raw !== null && (!result || result.discarded)) {
        const backedUp = store.backup('history', raw);
        store.warning = result ? discardedMessage(result.discarded, backedUp) : damagedMessage;
      }
      current = result?.entries ?? [];
      stored = result?.ids ?? new Set();
      remember(current);
      return current;
    },
    /** Guarda sin pisar lo que otra pestaña agregó; si la fusión cambia la lista, avisa a los suscriptores. */
    save(entries: HistoryEntry[]): boolean {
      const raw = store.readRaw('history');
      const remote = parse(raw);
      if (raw !== null && !remote) store.backup('history', raw);
      const merged = remote
        ? mergeHistory(entries, remote.entries, { stored, seen, present: remote.ids })
        : entries.slice(0, HISTORY_LIMIT);
      const written = merged.map(toStoredEntry).filter((e): e is HistoryEntry => e !== null);
      const saved = store.write('history', written);
      if (saved) stored = new Set(written.map((e) => e.id));
      else if (remote) stored = remote.ids;
      remember(entries);
      current = merged;
      if (!sameOrder(merged, entries) && listeners.size) notify(merged);
      return saved;
    },
    /** Escucha los cambios de otras pestañas. Devuelve la función para dejar de escuchar. */
    subscribe(listener: (entries: HistoryEntry[]) => void): () => void {
      listeners.add(listener);
      stop ??= store.subscribe('history', changed);
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        stop?.();
        stop = undefined;
      };
    },
  };
}
export const historyService = createHistoryService();

/** Cómo se dice una entrada: con las opciones de voz, pero leída en la notación en que se escribió. */
const entryOptions = (entry: CalculationResult, options: ResultSpeechOptions) => ({
  ...options,
  decimalSeparator: entry.separator ?? 'punto',
});
/** Nombre accesible de una entrada: «2 elevado a 10 dividido por 7, igual a 146 coma 28…». */
export function historyEntryLabel(
  entry: CalculationResult,
  options: ResultSpeechOptions = {},
): string {
  const speech = entryOptions(entry, options);
  const expression = mathSpeech(entry.expression, speech);
  if (entry.assigned) return expression;
  const cells = entry.matrix?.reduce((total, row) => total + row.length, 0) ?? 0;
  const columns = Math.max(0, ...(entry.matrix?.map((row) => row.length) ?? []));
  const summary =
    entry.matrix && entry.headers
      ? `una tabla de valores de ${entry.matrix.length} ${entry.matrix.length === 1 ? 'fila' : 'filas'}`
      : entry.matrix && cells > 9
        ? entry.matrix.length === 1
          ? `una lista de ${columns} elementos`
          : `una matriz de ${entry.matrix.length} por ${columns}`
        : entry.table && entry.table.length > 4
          ? `una tabla de ${entry.table.length} filas`
          : resultSpeech(entry, speech);
  return `${expression}, igual a ${summary}`;
}
/** Lectura completa de una entrada, para la acción Escuchar (resultSpeech ya incluye los avisos). */
export function historyEntrySpeech(
  entry: CalculationResult,
  options: ResultSpeechOptions = {},
): string {
  const speech = entryOptions(entry, options);
  const result = resultSpeech(entry, speech);
  return `${mathSpeech(entry.expression, speech)}. Resultado: ${result}${/[.!?]$/.test(result) ? '' : '.'}`;
}
export function historyRemovalMessage(remaining: number): string {
  if (!remaining) return 'Cálculo eliminado. El historial quedó vacío.';
  return remaining === 1
    ? 'Cálculo eliminado. Queda 1.'
    : `Cálculo eliminado. Quedan ${remaining}.`;
}
/** Entrada que recibe el foco al eliminar otra: la siguiente, o la anterior si era la última. */
export function historyNeighbor(entries: HistoryEntry[], id: string): string | null {
  const index = entries.findIndex((e) => e.id === id);
  if (index < 0) return null;
  return (entries[index + 1] ?? entries[index - 1])?.id ?? null;
}

export type HistoryKeyAction =
  'edit' | 'listen' | 'copy' | 'recalculate' | 'remove' | 'previous' | 'next' | 'first' | 'last';
/** Teclas de una entrada enfocada. Las combinaciones con Ctrl, Alt o Cmd se dejan pasar. */
export function historyKeyAction(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): HistoryKeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const actions: Record<string, HistoryKeyAction> = {
    Enter: 'edit',
    ' ': 'listen',
    c: 'copy',
    r: 'recalculate',
    Delete: 'remove',
    ArrowUp: 'previous',
    ArrowDown: 'next',
    Home: 'first',
    End: 'last',
  };
  if (event.key === 'Enter' && event.shiftKey) return null;
  return actions[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? null;
}
