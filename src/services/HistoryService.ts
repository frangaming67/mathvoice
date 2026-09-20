import type { HistoryEntry } from '../types';
import { storage } from './StorageService';
import { validVariables } from './VariableService';
export function validHistory(value: unknown): value is HistoryEntry[] {
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
        (v.decimal === undefined || typeof v.decimal === 'string') &&
        (v.unit === undefined || typeof v.unit === 'string') &&
        (v.variables === undefined || validVariables(v.variables)) &&
        (v.steps === undefined ||
          (Array.isArray(v.steps) &&
            v.steps.length <= 100 &&
            v.steps.every(
              (step: unknown) =>
                !!step &&
                typeof step === 'object' &&
                'title' in step &&
                typeof step.title === 'string' &&
                'detail' in step &&
                typeof step.detail === 'string' &&
                (!('formula' in step) ||
                  step.formula === undefined ||
                  typeof step.formula === 'string'),
            ))) &&
        (v.assigned === undefined ||
          (v.assigned &&
            typeof v.assigned.name === 'string' &&
            typeof v.assigned.value === 'number' &&
            Number.isFinite(v.assigned.value))) &&
        (v.table === undefined ||
          (Array.isArray(v.table) &&
            v.table.length <= 500 &&
            v.table.every(
              (row: unknown) =>
                !!row &&
                typeof row === 'object' &&
                'label' in row &&
                typeof row.label === 'string' &&
                'value' in row &&
                typeof row.value === 'string',
            ))) &&
        (v.matrix === undefined ||
          (Array.isArray(v.matrix) &&
            v.matrix.length <= 500 &&
            v.matrix.every(
              (row: unknown) =>
                Array.isArray(row) &&
                row.length <= 500 &&
                row.every((cell: unknown) => typeof cell === 'string'),
            ))),
    )
  );
}
export const historyService = {
  load: () => storage.read('history', [], validHistory),
  save: (entries: HistoryEntry[]) => storage.write('history', entries.slice(0, 100)),
};
