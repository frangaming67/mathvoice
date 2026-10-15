import { createContext, useContext, useEffect } from 'react';
import { CommandBus, type ToolCommand } from './CommandBus';
import type { KeyboardCommandManager } from './KeyboardCommandManager';
export const CommandContext = createContext<{
  bus: CommandBus;
  keyboard: KeyboardCommandManager;
} | null>(null);
export function usePreserveReaderKeys() {
  const context = useContext(CommandContext);
  return (event: KeyboardEvent) => context?.keyboard.preservesReaderKeys(event) ?? false;
}
export function useToolCommands(target: string, handler: (command: ToolCommand) => void) {
  const bus = useContext(CommandContext)?.bus;
  useEffect(() => bus?.register(target, handler), [bus, target, handler]);
}
export function focusToolField(
  section: HTMLElement | null,
  selector = 'input:not([type=checkbox]), textarea',
) {
  requestAnimationFrame(() => {
    if (!section?.getClientRects().length) return;
    const field = section.querySelector<HTMLElement>(selector);
    field?.focus();
    // El ejemplo queda seleccionado: lo que se escribe lo reemplaza en vez de pegarse al final.
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.select();
  });
}
