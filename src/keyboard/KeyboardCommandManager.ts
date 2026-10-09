import { commands, type CommandContext, type MathCommand } from './commands';
import {
  enabledCommands,
  normalizeShortcut,
  reservedReason,
  shortcutFor,
  type KeyboardSettings,
} from './KeyboardSettings';

export interface KeyboardEnvironment {
  settings: KeyboardSettings;
  context: CommandContext;
  insideApp: boolean;
  insideWorkspace: boolean;
  editing: boolean;
  nativeActivation: boolean;
  modal: boolean;
  practice: 'identify' | 'training' | null;
  practiceCategory: string;
  execute: (command: MathCommand) => void;
  legacy: (event: KeyboardEvent) => void;
  announce: (text: string) => void;
  stop: () => void;
  exitPractice: () => void;
}

export function eventShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
) {
  if (
    event.metaKey ||
    [
      'Control',
      'Shift',
      'Alt',
      'Meta',
      'Insert',
      'CapsLock',
      'AltGraph',
      'Dead',
      'Process',
      'Unidentified',
    ].includes(event.key)
  )
    return '';
  const key = event.key === ' ' ? 'Space' : event.key;
  // Shift is already represented in punctuation such as +, *, (, and ).
  const shift = event.shiftKey && (key.length > 1 || /^[a-z]$/i.test(key));
  try {
    return normalizeShortcut(
      [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', shift ? 'Shift' : '', key]
        .filter(Boolean)
        .join('+'),
    );
  } catch {
    return '';
  }
}

export class KeyboardCommandManager {
  private prefix = '';
  private prefixContext: CommandContext | null = null;
  private sequenceTimer: ReturnType<typeof setTimeout> | undefined;
  private readerModifiers = new Set<string>();
  observe(event: Pick<KeyboardEvent, 'key'>) {
    if (['Insert', 'CapsLock'].includes(event.key)) {
      this.readerModifiers.add(event.key);
      this.cancelSequence();
    }
  }
  preservesReaderKeys(event: KeyboardEvent) {
    return !!(
      this.readerModifiers.size ||
      event.isComposing ||
      event.metaKey ||
      event.getModifierState?.('AltGraph') ||
      (event.ctrlKey && event.altKey)
    );
  }
  cancelSequence() {
    clearTimeout(this.sequenceTimer);
    this.prefix = '';
    this.prefixContext = null;
  }
  release(event: Pick<KeyboardEvent, 'key'>) {
    this.readerModifiers.delete(event.key);
  }
  reset() {
    this.cancelSequence();
    this.readerModifiers.clear();
  }
  dispose() {
    this.reset();
  }
  handle(event: KeyboardEvent, env: KeyboardEnvironment): boolean {
    if (['Insert', 'CapsLock'].includes(event.key)) {
      this.observe(event);
      return false;
    }
    if (event.defaultPrevented || event.repeat || this.preservesReaderKeys(event) || !env.insideApp)
      return false;
    const chord = eventShortcut(event);
    if (['Shift', 'Control', 'Alt'].includes(event.key)) return false;
    if (!chord || reservedReason(chord)) {
      this.cancelSequence();
      return false;
    }
    if (chord === 'Escape') {
      this.cancelSequence();
      env.stop();
      if (env.practice) {
        event.preventDefault();
        env.exitPractice();
      }
      // Preserve native dialog cancellation and reader Escape behavior.
      return true;
    }
    if (env.modal) return false;
    if (env.nativeActivation && chord === 'Ctrl+Enter') return false;
    if (env.practice) {
      if (!env.insideWorkspace || env.editing) return false;
      const key = this.prefix ? `${this.prefix} ${chord}` : chord;
      const available = commands.filter(
        (command) => !env.practiceCategory || command.category === env.practiceCategory,
      );
      const matches = commands.filter(
        (command) =>
          shortcutFor(command, env.settings) === key &&
          (!env.practiceCategory || command.category === env.practiceCategory),
      );
      event.preventDefault();
      if (
        !this.prefix &&
        available.some((command) => shortcutFor(command, env.settings).startsWith(`${chord} `))
      ) {
        this.prefix = chord;
        env.announce(
          `${chord}. Inicio de secuencia. Presioná la segunda tecla para escuchar su función. Escape sale de la práctica.`,
        );
        this.sequenceTimer = setTimeout(() => {
          this.cancelSequence();
          env.announce('Secuencia de práctica cancelada por tiempo de espera.');
        }, 4000);
        return true;
      }
      this.cancelSequence();
      env.announce(
        matches.length
          ? matches
              .map(
                (command) =>
                  `${key}. ${command.name}. Contexto ${command.category}. ${command.description}`,
              )
              .join(' ')
          : `${key}. Sin asignación en esta categoría.`,
      );
      return true;
    }
    const global = commands.find(
      (command) => command.global && shortcutFor(command, env.settings) === chord,
    );
    if (global) {
      this.cancelSequence();
      if (global.legacy) env.legacy(event);
      else {
        event.preventDefault();
        env.execute(global);
      }
      return true;
    }
    if (env.settings.mode !== 'math' || env.editing || !env.insideWorkspace) {
      this.cancelSequence();
      return false;
    }
    if (
      env.nativeActivation &&
      ['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
        chord,
      )
    )
      return false;
    const available = enabledCommands(env.settings).filter(
      (command) =>
        !command.global && (command.contexts === 'all' || command.contexts.includes(env.context)),
    );
    if (this.prefix && this.prefixContext !== env.context) this.cancelSequence();
    const key = this.prefix ? `${this.prefix} ${chord}` : chord;
    const command = available.find((command) => shortcutFor(command, env.settings) === key);
    if (command) {
      this.cancelSequence();
      event.preventDefault();
      env.execute(command);
      return true;
    }
    if (this.prefix) {
      event.preventDefault();
      this.cancelSequence();
      env.announce('Secuencia cancelada. No se ejecutó ningún comando.');
      return true;
    }
    if (available.some((command) => shortcutFor(command, env.settings).startsWith(`${chord} `))) {
      event.preventDefault();
      this.prefix = chord;
      this.prefixContext = env.context;
      env.announce(
        chord === 'G'
          ? 'Comando Ir a. Presioná la herramienta: D derivada, I integral, M matrices, G gráficos.'
          : 'Comando secundario. Presioná la segunda tecla o Escape para cancelar.',
      );
      this.sequenceTimer = setTimeout(() => {
        this.cancelSequence();
        env.announce('Secuencia cancelada por tiempo de espera.');
      }, 4000);
      return true;
    }
    return false;
  }
}
