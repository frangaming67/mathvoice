import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultPreferences } from '../types';
import { preferencesService, preferenceValueText, sanitizePreferences } from './PreferencesService';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
const saveRaw = (value: unknown) => store.set('mathvoice.v1.preferences', JSON.stringify(value));

it('sin datos guardados usa los valores por defecto', () => {
  expect(preferencesService.load()).toEqual(defaultPreferences);
});

it('un campo inválido vuelve a su valor por defecto sin perder los demás', () => {
  saveRaw({ ...defaultPreferences, theme: 'neon', rate: 1.8, guided: true, welcomed: true });
  expect(preferencesService.load()).toEqual({
    ...defaultPreferences,
    rate: 1.8,
    guided: true,
    welcomed: true,
  });
});

it('migra preferencias de versiones anteriores sin los campos numéricos nuevos', () => {
  const old: Record<string, unknown> = { ...defaultPreferences, fontSize: 24, theme: 'yellow' };
  for (const key of [
    'decimalSeparator',
    'numberFormat',
    'numberDigits',
    'spokenDigits',
    'resultForm',
    'numberMode',
    'srMath',
    'tutorialSeen',
  ])
    delete old[key];
  saveRaw(old);
  expect(preferencesService.load()).toEqual({
    ...defaultPreferences,
    fontSize: 24,
    theme: 'yellow',
  });
});

it('valida cada campo nuevo por separado', () => {
  expect(
    sanitizePreferences({
      decimalSeparator: 'coma',
      numberFormat: 'fijo',
      numberDigits: 0,
      spokenDigits: 0,
      resultForm: 'ambos',
      numberMode: 'complejo',
      srMath: 'texto',
      tutorialSeen: true,
    }),
  ).toEqual({
    ...defaultPreferences,
    decimalSeparator: 'coma',
    numberFormat: 'fijo',
    numberDigits: 0,
    spokenDigits: 0,
    resultForm: 'ambos',
    numberMode: 'complejo',
    srMath: 'texto',
    tutorialSeen: true,
  });
  expect(
    sanitizePreferences({
      decimalSeparator: ',',
      numberFormat: 'sci',
      numberDigits: 16,
      spokenDigits: 2.5,
      resultForm: 'fraccion',
      numberMode: true,
      srMath: 'latex',
      tutorialSeen: 'si',
    }),
  ).toEqual(defaultPreferences);
  expect(sanitizePreferences({ numberDigits: 15, spokenDigits: 15 })).toMatchObject({
    numberDigits: 15,
    spokenDigits: 15,
  });
  expect(sanitizePreferences({ numberDigits: -1, spokenDigits: '6' })).toMatchObject({
    numberDigits: defaultPreferences.numberDigits,
    spokenDigits: defaultPreferences.spokenDigits,
  });
});

it('cero cifras solo vale con formato fijo', () => {
  expect(sanitizePreferences({ numberFormat: 'cientifico', numberDigits: 0 })).toMatchObject({
    numberFormat: 'cientifico',
    numberDigits: defaultPreferences.numberDigits,
  });
  expect(sanitizePreferences({ numberFormat: 'normal', numberDigits: 4 })).toMatchObject({
    numberDigits: 4,
  });
});

it('rechaza rangos, tipos y números no finitos en los campos existentes', () => {
  expect(
    sanitizePreferences({
      rate: 3,
      pitch: -1,
      volume: Number.NaN,
      fontSize: '20',
      scale: 1.3,
      spacing: 1.5,
      angle: 'deg',
      language: 'fr-FR',
      voice: 42,
      autoRead: 'false',
    }),
  ).toEqual({ ...defaultPreferences, spacing: 1.5, angle: 'deg' });
});

it('ignora claves desconocidas y datos que no son un objeto', () => {
  expect(sanitizePreferences({ ...defaultPreferences, extra: 1 })).toEqual(defaultPreferences);
  expect(sanitizePreferences(null)).toEqual(defaultPreferences);
  expect(sanitizePreferences([1, 2])).toEqual(defaultPreferences);
  saveRaw('texto');
  expect(preferencesService.load()).toEqual(defaultPreferences);
});

it('guarda y vuelve a cargar las preferencias numéricas', () => {
  const next = {
    ...defaultPreferences,
    decimalSeparator: 'coma' as const,
    numberFormat: 'fijo' as const,
    numberDigits: 3,
  };
  expect(preferencesService.save(next)).toBe(true);
  expect(preferencesService.load()).toEqual(next);
});

it('describe los deslizadores con un valor hablado estable', () => {
  expect(preferenceValueText('rate', 1.1)).toBe('1,1 veces');
  expect(preferenceValueText('rate', 1)).toBe('1 vez, normal');
  expect(preferenceValueText('rate', 0.30000000000000004 + 0.2)).toBe('0,5 veces');
  expect(preferenceValueText('volume', 0.5)).toBe('50 por ciento');
  expect(preferenceValueText('volume', 0.7000000000000001)).toBe('70 por ciento');
  expect(preferenceValueText('pitch', 1)).toBe('1, normal');
  expect(preferenceValueText('pitch', 1.2)).toBe('1,2');
  expect(preferenceValueText('fontSize', 18)).toBe('18 píxeles');
  expect(preferenceValueText('spacing', 1.6)).toBe('1,6');
});
