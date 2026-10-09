export class EditHistory {
  private past: string[] = [];
  private future: string[] = [];
  record(current: string) {
    if (this.past.at(-1) !== current) this.past = [...this.past, current].slice(-100);
    this.future = [];
  }
  undo(current: string): string | undefined {
    const previous = this.past.pop();
    if (previous !== undefined) this.future.push(current);
    return previous;
  }
  redo(current: string): string | undefined {
    const next = this.future.pop();
    if (next !== undefined) this.past.push(current);
    return next;
  }
}
