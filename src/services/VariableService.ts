import { storage } from './StorageService';
export function validVariables(v: unknown): v is Record<string, number> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.entries(v).length <= 100 &&
    Object.entries(v).every(
      ([key, value]) =>
        /^[a-zA-Z]\w{0,19}$/.test(key) &&
        !['constructor', 'prototype'].includes(key) &&
        typeof value === 'number' &&
        Number.isFinite(value),
    )
  );
}
export const variableService = {
  load: () => storage.read<Record<string, number>>('variables', {}, validVariables),
  save: (variables: Record<string, number>) => storage.write('variables', variables),
};
