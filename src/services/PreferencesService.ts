import { defaultPreferences, type Preferences } from '../types';
import { formatNumber } from '../accessibility/numberSpeech';
import { storage } from './StorageService';

type Check = (value: unknown) => boolean;
const oneOf =
  (...options: unknown[]): Check =>
  (value) =>
    options.includes(value);
const between =
  (min: number, max: number): Check =>
  (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const digits: Check = (value) => Number.isInteger(value) && between(0, 15)(value);
const flag: Check = (value) => typeof value === 'boolean';

// Un validador por campo: un valor dañado vuelve a su default sin arrastrar a los demás.
const checks: Record<keyof Preferences, Check> = {
  guided: flag,
  welcomed: flag,
  language: oneOf('es-AR', 'es-ES', 'es-MX', 'en-US'),
  voice: (value) => typeof value === 'string',
  rate: between(0.5, 2.5),
  pitch: between(0, 2),
  volume: between(0, 1),
  autoRead: flag,
  readFocus: flag,
  readHover: flag,
  readTyping: flag,
  readKeys: flag,
  theme: oneOf('light', 'dark', 'contrast', 'mono', 'yellow'),
  fontSize: between(16, 28),
  scale: oneOf(1, 1.25, 1.5, 2),
  spacing: between(1.4, 2.2),
  maximum: flag,
  angle: oneOf('rad', 'deg', 'grad'),
  decimalSeparator: oneOf('punto', 'coma'),
  numberFormat: oneOf('normal', 'fijo', 'cientifico'),
  numberDigits: digits,
  spokenDigits: digits,
  resultForm: oneOf('auto', 'decimal', 'exacto', 'ambos'),
  numberMode: oneOf('real', 'complejo'),
  srMath: oneOf('mathml', 'texto'),
  tutorialSeen: flag,
};

/** Preferencias válidas a partir de cualquier valor guardado, campo por campo. */
export function sanitizePreferences(value: unknown): Preferences {
  const stored =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = { ...defaultPreferences };
  for (const key of Object.keys(checks) as (keyof Preferences)[])
    if (checks[key](stored[key])) result[key] = stored[key];
  const preferences = result as unknown as Preferences;
  // Cero cifras significativas no tiene sentido fuera del formato fijo.
  if (preferences.numberFormat !== 'fijo' && preferences.numberDigits === 0)
    preferences.numberDigits = defaultPreferences.numberDigits;
  return preferences;
}

export type SliderPreference = 'rate' | 'pitch' | 'volume' | 'fontSize' | 'spacing';

/** Valor hablado de un deslizador para aria-valuetext y la voz propia: «1,1 veces». */
export function preferenceValueText(key: SliderPreference, value: number): string {
  const spoken = formatNumber(value, { significant: 3, decimal: 'coma' });
  if (key === 'rate') return value === 1 ? '1 vez, normal' : `${spoken} veces`;
  if (key === 'volume') return `${Math.round(value * 100)} por ciento`;
  if (key === 'pitch') return value === 1 ? '1, normal' : spoken;
  if (key === 'fontSize') return `${spoken} píxeles`;
  return spoken;
}

export const preferencesService = {
  load: (): Preferences =>
    sanitizePreferences(
      storage.read<Record<string, unknown>>(
        'preferences',
        {},
        (v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v),
      ),
    ),
  save: (p: Preferences) => storage.write('preferences', p),
};
