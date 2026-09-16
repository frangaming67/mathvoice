import type { HistoryEntry } from '../types';
import { storage } from './StorageService';
function valid(value: unknown): value is HistoryEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (v) =>
        v &&
        typeof v === 'object' &&
        ['id', 'date', 'expression', 'value', 'kind', 'explanation'].every(
          (key) => typeof v[key] === 'string',
        ) &&
        ['rad', 'deg', 'grad'].includes(v.angleMode) &&
        (v.decimal === undefined || typeof v.decimal === 'string'),
    )
  );
}
export const historyService = {
  load: () => storage.read('history', [], valid),
  save: (entries: HistoryEntry[]) => storage.write('history', entries.slice(0, 100)),
};
