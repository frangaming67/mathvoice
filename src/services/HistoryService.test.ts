import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HistoryEntry } from '../types';
import {
  ENTRY_BUDGET,
  TRIMMED_WARNING,
  createHistoryService,
  historyEntryLabel,
  historyEntrySpeech,
  historyKeyAction,
  historyNeighbor,
  historyRemovalMessage,
  mergeHistory,
  sanitizeHistory,
  toStoredEntry,
} from './HistoryService';
import { StorageService, backupKey, storageKey } from './StorageService';

const entry = (id: string, date = '2026-09-17T10:00:00.000Z', extra: object = {}) =>
  ({
    id,
    date,
    expression: '2+2',
    value: '4',
    kind: 'Básico',
    explanation: 'Suma',
    angleMode: 'rad',
    ...extra,
  }) as HistoryEntry;

const store = new Map<string, string>();
const listeners = new Set<(event: Event) => void>();
const fakeStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
};
beforeEach(() => {
  store.clear();
  listeners.clear();
  vi.stubGlobal('localStorage', fakeStorage);
  vi.stubGlobal('window', {
    addEventListener: (_type: string, listener: (event: Event) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: Event) => void) =>
      listeners.delete(listener),
  });
});
afterEach(() => vi.unstubAllGlobals());
/** Otra pestaña escribe el historial y el navegador avisa con un evento «storage». */
function otherTab(entries: unknown) {
  const raw = JSON.stringify(entries);
  store.set(storageKey('history'), raw);
  listeners.forEach((listener) =>
    listener({ key: storageKey('history'), newValue: raw, storageArea: fakeStorage } as never),
  );
}

it('acepta historial anterior y resultados estructurados nuevos', () => {
  expect(toStoredEntry(entry('1'))).toEqual(entry('1'));
  const rich = entry('2', undefined, {
    table: [{ label: 'Media', value: '4' }],
    variables: { a: 2 },
    separator: 'coma',
    warnings: ['Aviso'],
    steps: [{ title: 'Sumar', detail: 'Dos más dos', formula: '2+2=4' }],
  });
  expect(toStoredEntry(rich)).toEqual(rich);
  // Aplicarlo dos veces no cambia nada.
  expect(toStoredEntry(toStoredEntry(rich))).toEqual(rich);
});
it.each([
  { matrix: [null] },
  { table: [4] },
  { variables: { a: 'dos' } },
  { assigned: null },
  { separator: ',' },
  { angleMode: 'turns' },
  { steps: [{ title: 'Título', detail: 4 }] },
])('rechaza una entrada dañada %j', (extra) => {
  expect(toStoredEntry(entry('1', undefined, extra))).toBeNull();
});
it('recorta una entrada demasiado grande en vez de descartarla', () => {
  const huge = entry('1', undefined, {
    explanation: 'x'.repeat(30_000),
    matrix: Array.from({ length: 50 }, () => Array(50).fill('123456789')),
  });
  const stored = toStoredEntry(huge)!;
  expect(JSON.stringify(stored).length).toBeLessThanOrEqual(ENTRY_BUDGET);
  expect(stored.matrix).toBeUndefined();
  expect(stored.value).toBe('4');
  expect(stored.warnings).toContain(TRIMMED_WARNING);
  expect(toStoredEntry(stored)).toEqual(stored);
});
it('conserva las entradas válidas aunque otras estén dañadas', () => {
  const result = sanitizeHistory([entry('1'), { id: 'roto' }, null, entry('1'), entry('2')]);
  expect(result.entries.map((e) => e.id)).toEqual(['1', '2']);
  expect(result.discarded).toBe(2);
  expect(result.ids).toEqual(new Set(['1', 'roto', '2']));
  expect(sanitizeHistory({ no: 'es una lista' }).damaged).toBe(true);
});
it('fusiona pestañas respetando altas y bajas de cada una', () => {
  const a = entry('a', '2026-01-01T00:00:00Z');
  const b = entry('b', '2026-01-02T00:00:00Z');
  const c = entry('c', '2026-01-03T00:00:00Z');
  // Otra pestaña agregó c; esta pestaña borró a, que ya estaba guardada.
  expect(
    mergeHistory([b], [a, b, c], { stored: new Set(['a', 'b']), seen: new Set(['a', 'b']) }).map(
      (e) => e.id,
    ),
  ).toEqual(['c', 'b']);
  // Otra pestaña borró b; esta agregó c sin guardarlo todavía.
  expect(
    mergeHistory([c, a, b], [a], { stored: new Set(['a', 'b']), seen: new Set(['a', 'b']) }).map(
      (e) => e.id,
    ),
  ).toEqual(['c', 'a']);
  const many = Array.from({ length: 120 }, (_, i) =>
    entry(String(i), new Date(2026, 0, 1, 0, i).toISOString()),
  );
  expect(mergeHistory(many, [])).toHaveLength(100);
});
it('al cargar un historial con daños guarda un respaldo y avisa cuántos se descartaron', () => {
  const raw = JSON.stringify([entry('1'), { id: 'x' }]);
  store.set(storageKey('history'), raw);
  const storage = new StorageService();
  const service = createHistoryService(storage);
  expect(service.load().map((e) => e.id)).toEqual(['1']);
  expect(store.get(backupKey('history'))).toBe(raw);
  expect(storage.warning).toBe(
    'Se descartó 1 cálculo dañado del historial. Guardé una copia de respaldo.',
  );
});
it('guardar no pisa lo que agregó otra pestaña y avisa a la vista', () => {
  const service = createHistoryService(new StorageService());
  service.load();
  const seen = vi.fn();
  const stop = service.subscribe(seen);
  const mine = entry('mine', '2026-01-02T00:00:00Z');
  const theirs = entry('theirs', '2026-01-03T00:00:00Z');
  otherTab([theirs]);
  expect(seen).toHaveBeenLastCalledWith([theirs]);
  expect(service.save([mine, theirs])).toBe(true);
  expect(JSON.parse(store.get(storageKey('history'))!).map((e: HistoryEntry) => e.id)).toEqual([
    'theirs',
    'mine',
  ]);
  stop();
  expect(listeners.size).toBe(0);
});
it('nombra cada entrada en palabras y en la notación en que se escribió', () => {
  expect(historyEntryLabel(entry('1'))).toBe('2 más 2, igual a 4');
  expect(
    historyEntryLabel(
      entry('2', undefined, { expression: '2,5+1', value: '3,5', separator: 'coma' }),
    ),
  ).toBe('2 coma 5 más 1, igual a 3 coma 5');
  const matrix = Array.from({ length: 4 }, () => ['1', '2', '3']);
  expect(historyEntryLabel(entry('3', undefined, { expression: 'A', matrix }))).toMatch(
    /igual a una matriz de 4 por 3$/,
  );
  expect(historyEntrySpeech(entry('4', undefined, { warnings: ['Valor aproximado.'] }))).toBe(
    '2 más 2. Resultado: 4. Aviso: Valor aproximado.',
  );
});
it('al eliminar, el foco pasa a la siguiente entrada o a la anterior', () => {
  const list = [entry('a'), entry('b'), entry('c')];
  expect(historyNeighbor(list, 'b')).toBe('c');
  expect(historyNeighbor(list, 'c')).toBe('b');
  expect(historyNeighbor([entry('a')], 'a')).toBeNull();
  expect(historyRemovalMessage(0)).toBe('Cálculo eliminado. El historial quedó vacío.');
  expect(historyRemovalMessage(1)).toBe('Cálculo eliminado. Queda 1.');
  expect(historyRemovalMessage(5)).toBe('Cálculo eliminado. Quedan 5.');
});
it('las teclas de una entrada no capturan combinaciones del navegador', () => {
  const key = (key: string, extra: object = {}) =>
    historyKeyAction({
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...extra,
    });
  expect(key('Enter')).toBe('edit');
  expect(key(' ')).toBe('listen');
  expect(key('C')).toBe('copy');
  expect(key('r')).toBe('recalculate');
  expect(key('Delete')).toBe('remove');
  expect(key('ArrowDown')).toBe('next');
  expect(key('c', { ctrlKey: true })).toBeNull();
  expect(key('Enter', { shiftKey: true })).toBeNull();
  expect(key('x')).toBe('explore');
  expect(key('q')).toBeNull();
});
