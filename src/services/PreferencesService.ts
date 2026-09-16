import { defaultPreferences, type Preferences } from '../types';
import { storage } from './StorageService';
function valid(v: unknown): v is Preferences {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    Object.entries(defaultPreferences).every(([key, value]) => typeof p[key] === typeof value) &&
    ['light', 'dark', 'contrast', 'mono', 'yellow'].includes(String(p.theme)) &&
    ['rad', 'deg', 'grad'].includes(String(p.angle)) &&
    ['es-AR', 'es-ES', 'es-MX', 'en-US'].includes(String(p.language)) &&
    Number(p.rate) >= 0.5 &&
    Number(p.rate) <= 2.5 &&
    Number(p.pitch) >= 0 &&
    Number(p.pitch) <= 2 &&
    Number(p.volume) >= 0 &&
    Number(p.volume) <= 1 &&
    Number(p.fontSize) >= 16 &&
    Number(p.fontSize) <= 28 &&
    Number(p.spacing) >= 1.4 &&
    Number(p.spacing) <= 2.2
  );
}
export const preferencesService = {
  load: () => {
    const stored = storage.read<Record<string, unknown>>(
      'preferences',
      {},
      (v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v),
    );
    const migrated = { ...defaultPreferences, ...stored };
    return valid(migrated) ? migrated : defaultPreferences;
  },
  save: (p: Preferences) => storage.write('preferences', p),
};
