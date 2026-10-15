import { storage } from '../services/StorageService';
import { commandById, commands, contextsOverlap, type MathCommand } from './commands';

export interface KeyboardSettings {
  version: 1;
  mode: 'writing' | 'math';
  profile: 'simple' | 'standard' | 'advanced' | 'custom';
  verbosity: 'minimal' | 'normal' | 'detailed' | 'training';
  sounds: boolean;
  /** Volumen propio de los sonidos de confirmación, de 0 a 1. */
  soundVolume: number;
  overrides: Record<string, string>;
  favorites: string[];
}
export const defaultKeyboardSettings: KeyboardSettings = {
  version: 1,
  mode: 'writing',
  profile: 'standard',
  verbosity: 'normal',
  sounds: false,
  soundVolume: 0.5,
  overrides: {},
  favorites: [],
};
const keys = new Set([
  'Enter',
  'Escape',
  'Space',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

export function normalizeShortcut(value: string): string {
  const parts = value
    .trim()
    .replace(/\s*\+\s*/g, '+')
    .split(/\s+/);
  if (parts.length > 2) throw new Error('Usá una combinación o una secuencia de dos teclas.');
  return parts
    .map((part) => {
      const modifiers = new Set<string>();
      let rest = part.replace(/control/gi, 'Ctrl');
      while (/^(ctrl|alt|shift)\+/i.test(rest)) {
        const match = rest.match(/^(ctrl|alt|shift)\+/i)!;
        const modifier = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
        if (modifiers.has(modifier)) throw new Error('Modificador repetido.');
        modifiers.add(modifier);
        rest = rest.slice(match[0].length);
      }
      let key =
        [...keys].find((key) => key.toLowerCase() === rest.toLowerCase()) ?? rest.toUpperCase();
      if (key === 'ESC') key = 'Escape';
      if (!keys.has(key) && !/^[A-Z0-9.,+\-*/%()=;^]$/.test(key))
        throw new Error('Tecla no admitida.');
      if (modifiers.has('Shift') && key.length === 1 && !/^[A-Z]$/.test(key))
        throw new Error(
          'Escribí el carácter resultante sin Shift, o capturá la combinación con el botón.',
        );
      return [...['Ctrl', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier)), key].join(
        '+',
      );
    })
    .join(' ');
}

export function reservedReason(shortcut: string): string | null {
  for (const chord of shortcut.split(' ')) {
    if (
      [
        'Alt+Shift+A',
        'Alt+Shift+B',
        'Alt+Shift+I',
        'Alt+Shift+N',
        'Alt+Shift+T',
        'Shift+Escape',
      ].includes(chord)
    )
      return 'Combinación reservada para el navegador.';
    if (/Ctrl\+Alt/.test(chord)) return 'Combinación reservada para el lector de pantalla o AltGr.';
    if (
      /^Ctrl\+/.test(chord) &&
      !['Ctrl+Enter', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z'].includes(chord)
    )
      return 'Atajo reservado para el navegador, el sistema o edición.';
    if (/^Alt\+/.test(chord) && !/^Alt\+Shift\+[A-Z]$/.test(chord))
      return 'Alt con esta tecla está reservado para el navegador o el sistema.';
    if (/F\d+$/.test(chord) && !['F1', 'F2'].includes(chord))
      return 'Tecla de función reservada para el navegador, el sistema o el lector de pantalla.';
  }
  return null;
}
export function shortcutFor(command: MathCommand, settings: KeyboardSettings) {
  return settings.overrides[command.id] ?? command.shortcut;
}
export function enabledCommands(settings: KeyboardSettings) {
  const level = settings.profile === 'simple' ? 0 : settings.profile === 'standard' ? 1 : 2;
  return commands.filter(
    (command) =>
      command.level <= level || command.global || settings.favorites.includes(command.id),
  );
}
export function assignmentError(
  id: string,
  shortcut: string,
  settings: KeyboardSettings,
): string | null {
  const command = commandById.get(id);
  if (!command?.customizable) return 'Este comando conserva su atajo de seguridad.';
  if (!shortcut) return null;
  let normalized: string;
  try {
    normalized = normalizeShortcut(shortcut);
  } catch (error) {
    return (error as Error).message;
  }
  const reserved = reservedReason(normalized);
  if (reserved) return reserved;
  if (normalized.split(' ').some((chord) => ['Escape', 'F1', 'F2'].includes(chord)))
    return 'Escape, F1 y F2 se reservan para cancelar, ayuda y cambio de modo.';
  // Validate against every profile, so changing profiles never introduces a collision.
  const conflict = commands.find((other) => {
    if (other.id === id || !contextsOverlap(command, other)) return false;
    const existing = shortcutFor(other, settings);
    return (
      existing &&
      (existing === normalized ||
        existing.startsWith(`${normalized} `) ||
        normalized.startsWith(`${existing} `))
    );
  });
  return conflict
    ? `${normalized} ya está asignado a ${conflict.name}. Elegí otra tecla o quitá primero esa asignación.`
    : null;
}
export function parseKeyboardSettings(value: unknown): KeyboardSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('El archivo no contiene una configuración de teclado.');
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    !['writing', 'math'].includes(String(v.mode)) ||
    !['simple', 'standard', 'advanced', 'custom'].includes(String(v.profile)) ||
    !['minimal', 'normal', 'detailed', 'training'].includes(String(v.verbosity)) ||
    typeof v.sounds !== 'boolean' ||
    (v.soundVolume !== undefined &&
      (typeof v.soundVolume !== 'number' || !(v.soundVolume >= 0 && v.soundVolume <= 1))) ||
    !v.overrides ||
    typeof v.overrides !== 'object' ||
    Array.isArray(v.overrides) ||
    !Array.isArray(v.favorites) ||
    v.favorites.length > commands.length ||
    v.favorites.some((id) => typeof id !== 'string' || !commandById.has(id))
  )
    throw new Error('Configuración de teclado inválida. No se aplicaron cambios.');
  const overrides: Record<string, string> = {};
  if (Object.keys(v.overrides).length > commands.length)
    throw new Error('Demasiadas asignaciones.');
  for (const [id, shortcut] of Object.entries(v.overrides)) {
    if (!commandById.get(id)?.customizable || typeof shortcut !== 'string' || shortcut.length > 60)
      throw new Error('Comando desconocido o no personalizable.');
    overrides[id] = shortcut ? normalizeShortcut(shortcut) : '';
  }
  const settings: KeyboardSettings = {
    version: 1,
    mode: v.mode as KeyboardSettings['mode'],
    profile: v.profile as KeyboardSettings['profile'],
    verbosity: v.verbosity as KeyboardSettings['verbosity'],
    sounds: v.sounds,
    soundVolume:
      typeof v.soundVolume === 'number' ? v.soundVolume : defaultKeyboardSettings.soundVolume,
    overrides,
    favorites: [...new Set(v.favorites as string[])],
  };
  for (const [id, shortcut] of Object.entries(overrides)) {
    const error = assignmentError(id, shortcut, settings);
    if (error) throw new Error(error);
  }
  return settings;
}
export const keyboardSettingsService = {
  load(): KeyboardSettings {
    const value = storage.read<unknown>(
      'keyboard',
      defaultKeyboardSettings,
      (value): value is unknown => value !== undefined,
    );
    try {
      return parseKeyboardSettings(value);
    } catch {
      return { ...defaultKeyboardSettings, overrides: {}, favorites: [] };
    }
  },
  save(settings: KeyboardSettings) {
    return storage.write('keyboard', parseKeyboardSettings(settings));
  },
};
