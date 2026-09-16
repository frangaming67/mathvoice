import { afterEach, expect, it, vi } from 'vitest';
import { StorageService } from './StorageService';
afterEach(() => vi.unstubAllGlobals());
it('recupera JSON corrupto', () => {
  vi.stubGlobal('localStorage', { getItem: () => '{broken' });
  const storage = new StorageService();
  expect(storage.read('test', [], Array.isArray)).toEqual([]);
  expect(storage.warning).toBeTruthy();
});
it('informa almacenamiento bloqueado', () => {
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('Quota');
    },
  });
  const storage = new StorageService();
  expect(storage.write('test', 1)).toBe(false);
  expect(storage.warning).toContain('No pude guardar');
});
it('no carga estructuras inválidas', () => {
  vi.stubGlobal('localStorage', { getItem: () => '"not an array"' });
  expect(new StorageService().read('test', [], Array.isArray)).toEqual([]);
});
