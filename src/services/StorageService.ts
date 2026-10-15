const prefix = 'mathvoice.v1.';
const unavailable =
  'El almacenamiento local no está disponible o contiene datos dañados. Podés seguir calculando.';
const damaged =
  'Algunos datos guardados estaban dañados y no se pudieron cargar. Guardé una copia de respaldo; podés seguir calculando.';
/** Clave completa del valor y de su copia de respaldo. */
export const storageKey = (key: string) => `${prefix}${key}`;
export const backupKey = (key: string) => `${prefix}${key}.respaldo`;
export class StorageService {
  warning = '';
  /** Valor crudo guardado, o null si no hay nada o no se puede leer. */
  readRaw(key: string): string | null {
    try {
      return localStorage.getItem(storageKey(key)) || null;
    } catch {
      this.warning = unavailable;
      return null;
    }
  }
  read<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
    const raw = this.readRaw(key);
    if (raw === null) return fallback;
    try {
      const value: unknown = JSON.parse(raw);
      if (valid(value)) return value;
    } catch {
      // Se trata igual que un valor con forma inválida.
    }
    this.backup(key, raw);
    this.warning = damaged;
    return fallback;
  }
  /** Copia el valor crudo a una clave aparte antes de que se sobrescriba. */
  backup(key: string, raw: string): boolean {
    try {
      localStorage.setItem(backupKey(key), raw);
      return true;
    } catch {
      return false;
    }
  }
  write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value));
      return true;
    } catch {
      this.warning =
        'No pude guardar los cambios en este dispositivo. Podés seguir calculando, pero se perderán al cerrar.';
      return false;
    }
  }
  /** Avisa cuando otra pestaña cambia la clave. Devuelve la función para dejar de escuchar. */
  subscribe(key: string, listener: (raw: string | null) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (event: Event) => {
      const { key: changed, newValue, storageArea } = event as StorageEvent;
      if (changed !== storageKey(key)) return;
      try {
        if (storageArea && storageArea !== localStorage) return;
      } catch {
        return;
      }
      listener(newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}
export const storage = new StorageService();
