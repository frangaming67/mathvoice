import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commands, commandById } from './commands';
import {
  KeyboardCommandManager,
  eventShortcut,
  type KeyboardEnvironment,
} from './KeyboardCommandManager';
import {
  assignmentError,
  defaultKeyboardSettings,
  normalizeShortcut,
  parseKeyboardSettings,
  reservedReason,
} from './KeyboardSettings';

let manager: KeyboardCommandManager;
let env: KeyboardEnvironment;
beforeEach(() => {
  vi.useFakeTimers();
  manager = new KeyboardCommandManager();
  env = {
    settings: { ...defaultKeyboardSettings, mode: 'math', profile: 'advanced' },
    context: 'basic',
    insideApp: true,
    insideWorkspace: true,
    editing: false,
    nativeActivation: false,
    modal: false,
    practice: null,
    practiceCategory: '',
    execute: vi.fn(),
    legacy: vi.fn(),
    announce: vi.fn(),
    stop: vi.fn(),
    exitPractice: vi.fn(),
  };
});
afterEach(() => {
  manager.dispose();
  vi.useRealTimers();
});
function press(key: string, extra: Partial<KeyboardEvent> = {}) {
  const event = {
    key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...extra,
  };
  manager.handle(event as unknown as KeyboardEvent, env);
  return event;
}
it('catálogo sin identificadores repetidos y mapa predeterminado sin conflictos por contexto', () => {
  expect(commandById.size).toBe(commands.length);
  for (const command of commands.filter((c) => c.customizable && c.shortcut))
    expect(assignmentError(command.id, command.shortcut, env.settings), command.id).toBeNull();
});
it('escritura, campos editables y foco fuera del área nunca activan letras', () => {
  env.settings.mode = 'writing';
  expect(press('d').preventDefault).not.toHaveBeenCalled();
  env.settings.mode = 'math';
  env.editing = true;
  for (const key of ['d', '2', ' ', 'Backspace', 'Delete', 'ArrowLeft', 'Home', 'End'])
    expect(press(key).preventDefault).not.toHaveBeenCalled();
  expect(press('z', { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
  env.editing = false;
  env.insideWorkspace = false;
  expect(press('d').preventDefault).not.toHaveBeenCalled();
  expect(env.execute).not.toHaveBeenCalled();
});
it('la misma tecla cambia entre cálculo y matrices sin calcular todavía', () => {
  press('d');
  expect(env.execute).toHaveBeenLastCalledWith(commandById.get('derivative'));
  env.context = 'matrices';
  press('d');
  expect(env.execute).toHaveBeenLastCalledWith(commandById.get('matrix-det'));
});
it('teclas numéricas y operadores físicos normalizan Shift sin perder el carácter', () => {
  expect(
    eventShortcut({ key: '+', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false }),
  ).toBe('+');
  press('+', { shiftKey: true });
  expect(env.execute).toHaveBeenLastCalledWith(commandById.get('insert-+'));
  press('D', { shiftKey: true });
  expect(env.execute).toHaveBeenLastCalledWith(commandById.get('higher-derivative'));
});
it('respeta lector, AltGr, composición, repetición, pestañas, navegador y teclas de función reservadas', () => {
  for (const key of ['l', 't', 'w', 'r', 'Tab'])
    expect(press(key, { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
  for (const key of ['F3', 'F4', 'F5', 'F6', 'F7', 'F9', 'F10', 'F11', 'F12'])
    expect(press(key).preventDefault).not.toHaveBeenCalled();
  expect(press('F4', { altKey: true }).preventDefault).not.toHaveBeenCalled();
  expect(press('d', { ctrlKey: true, altKey: true }).preventDefault).not.toHaveBeenCalled();
  expect(press('d', { isComposing: true }).preventDefault).not.toHaveBeenCalled();
  expect(press('d', { repeat: true }).preventDefault).not.toHaveBeenCalled();
  press('Insert');
  expect(press('d').preventDefault).not.toHaveBeenCalled();
  manager.release({ key: 'Insert' });
  press('d');
  expect(env.execute).toHaveBeenCalledOnce();
});
it('secuencias se anuncian, completan o cancelan sin ejecutar la segunda tecla aisladamente', () => {
  press('g');
  expect(env.announce).toHaveBeenCalledWith(expect.stringContaining('Ir a'));
  press('i');
  expect(env.execute).toHaveBeenLastCalledWith(commandById.get('goto-integral'));
  vi.mocked(env.execute).mockClear();
  press('g');
  press('s');
  expect(env.execute).not.toHaveBeenCalled();
  press('g');
  vi.advanceTimersByTime(4001);
  expect(env.announce).toHaveBeenLastCalledWith(expect.stringContaining('tiempo'));
  expect(env.execute).not.toHaveBeenCalled();
});
it('entrenamiento identifica sin ejecutar, permite Tab y Escape conserva la salida', () => {
  env.practice = 'training';
  env.practiceCategory = 'Cálculo';
  press('d');
  expect(env.announce).toHaveBeenCalledWith(expect.stringContaining('Derivada'));
  expect(press('Tab').preventDefault).not.toHaveBeenCalled();
  press('F2');
  expect(env.execute).not.toHaveBeenCalled();
  press('Escape');
  expect(env.exitPractice).toHaveBeenCalledOnce();
  expect(env.stop).toHaveBeenCalledOnce();
});
it('diálogos conservan eventos y Escape cancela sin bloquear la cancelación nativa', () => {
  env.modal = true;
  expect(press('F1').preventDefault).not.toHaveBeenCalled();
  expect(press('d').preventDefault).not.toHaveBeenCalled();
  expect(press('Escape').preventDefault).not.toHaveBeenCalled();
  expect(env.stop).toHaveBeenCalledOnce();
});
it('la práctica reconoce secuencias completas sin ejecutar ni interpretar su segunda tecla sola', () => {
  env.practice = 'training';
  press('g');
  expect(env.announce).toHaveBeenLastCalledWith(expect.stringContaining('Inicio de secuencia'));
  press('d');
  expect(env.announce).toHaveBeenLastCalledWith(expect.stringContaining('G D.'));
  press('g');
  press('s');
  expect(env.announce).toHaveBeenLastCalledWith('G S. Sin asignación en esta categoría.');
  press('g');
  vi.advanceTimersByTime(4001);
  expect(env.announce).toHaveBeenLastCalledWith(expect.stringContaining('tiempo de espera'));
  expect(env.execute).not.toHaveBeenCalled();
});
it('perfil simplificado limita comandos y favorito habilita un acceso elegido', () => {
  env.settings.profile = 'simple';
  press('q');
  expect(env.execute).not.toHaveBeenCalled();
  env.settings.favorites = ['square'];
  press('q');
  expect(env.execute).toHaveBeenCalledWith(commandById.get('square'));
});
it('reasignación detecta comandos globales, prefijos y permite contextos separados', () => {
  expect(assignmentError('sqrt', 'D', env.settings)).toContain('Derivada');
  expect(assignmentError('sqrt', 'G', env.settings)).toContain('asignado');
  expect(assignmentError('sqrt', 'F1', env.settings)).toContain('reservan');
  expect(assignmentError('sqrt', 'Ctrl+L', env.settings)).toContain('reservado');
  expect(assignmentError('sqrt', '; Q', env.settings)).toBeNull();
  expect(assignmentError('matrix-det', 'D', env.settings)).toBeNull();
  expect(normalizeShortcut('shift + d')).toBe('Shift+D');
  expect(reservedReason('Alt+D')).toContain('reservado');
});
it('importación valida todo antes de aplicar, sin mutar la configuración anterior', () => {
  const original = JSON.stringify(env.settings);
  expect(() => parseKeyboardSettings({ ...env.settings, overrides: { sqrt: 'D' } })).toThrow(
    'asignado',
  );
  expect(() => parseKeyboardSettings({ ...env.settings, overrides: { sqrt: 'Ctrl+L' } })).toThrow(
    'reservado',
  );
  expect(() => parseKeyboardSettings({ ...env.settings, favorites: ['inventado'] })).toThrow();
  expect(() => parseKeyboardSettings({ ...env.settings, version: 2 })).toThrow();
  expect(JSON.stringify(env.settings)).toBe(original);
  const result = parseKeyboardSettings({
    ...env.settings,
    profile: 'custom',
    overrides: { sqrt: '; Q' },
  });
  expect(result.overrides.sqrt).toBe('; Q');
});
it('rechaza asignaciones con Shift que no pueden llegar desde event.key', () => {
  for (const shortcut of ['Shift+1', 'Shift+.', 'Shift++', 'G Shift+2']) {
    expect(assignmentError('sqrt', shortcut, env.settings)).toContain('carácter');
    expect(() => parseKeyboardSettings({ ...env.settings, overrides: { sqrt: shortcut } })).toThrow(
      'carácter',
    );
  }
  expect(normalizeShortcut('Shift+D')).toBe('Shift+D');
  expect(normalizeShortcut('+')).toBe('+');
});
it('reservas documentadas del navegador y lector no se asignan ni se interceptan', () => {
  for (const key of ['a', 'b', 'i', 'n', 't']) {
    expect(assignmentError('sqrt', `Alt+Shift+${key}`, env.settings)).toContain('reservad');
    expect(press(key, { altKey: true, shiftKey: true }).preventDefault).not.toHaveBeenCalled();
  }
  for (const shortcut of ['F8', 'Shift+Escape'])
    expect(assignmentError('sqrt', shortcut, env.settings)).toContain('reservad');
  expect(press('F8').preventDefault).not.toHaveBeenCalled();
  expect(press('Escape', { shiftKey: true }).preventDefault).not.toHaveBeenCalled();
  expect(env.execute).not.toHaveBeenCalled();
  expect(env.legacy).not.toHaveBeenCalled();
});
it('Ctrl+Enter conserva activación nativa sobre enlaces y controles', () => {
  env.nativeActivation = true;
  expect(press('Enter', { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
  expect(env.legacy).not.toHaveBeenCalled();
  env.nativeActivation = false;
  press('Enter', { ctrlKey: true });
  expect(env.legacy).toHaveBeenCalledOnce();
});
