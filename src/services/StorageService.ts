export class StorageService {
  warning = '';
  read<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
    try {
      const raw = localStorage.getItem(`mathvoice.v1.${key}`);
      if (!raw) return fallback;
      const value: unknown = JSON.parse(raw);
      return valid(value) ? value : fallback;
    } catch {
      this.warning =
        'El almacenamiento local no está disponible o contiene datos dañados. Podés seguir calculando.';
      return fallback;
    }
  }
  write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(`mathvoice.v1.${key}`, JSON.stringify(value));
      return true;
    } catch {
      this.warning =
        'No pude guardar los cambios en este dispositivo. Podés seguir calculando, pero se perderán al cerrar.';
      return false;
    }
  }
}
export const storage = new StorageService();
