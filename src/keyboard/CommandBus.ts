import type { CommandAction } from './commands';
export type ToolCommand = Extract<CommandAction, { type: 'tool' | 'graph' }>;

/** Delivers a user command to an existing form, including a form still loading lazily. */
export class CommandBus {
  private handlers = new Map<string, (command: ToolCommand) => void>();
  private pending: { target: string; command: ToolCommand } | null = null;
  register(target: string, handler: (command: ToolCommand) => void) {
    this.handlers.set(target, handler);
    const pending = this.pending;
    if (pending?.target === target)
      queueMicrotask(() => {
        if (this.pending === pending && this.handlers.get(target) === handler) {
          this.pending = null;
          handler(pending.command);
        }
      });
    return () => {
      if (this.handlers.get(target) === handler) this.handlers.delete(target);
    };
  }
  send(target: string, command: ToolCommand) {
    this.pending = null;
    const handler = this.handlers.get(target);
    if (handler) handler(command);
    else this.pending = { target, command };
  }
  cancelPending() {
    this.pending = null;
  }
  sendIfMounted(target: string, command: ToolCommand) {
    this.handlers.get(target)?.(command);
  }
}
