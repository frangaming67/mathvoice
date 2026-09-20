export function handleKeyboard(
  event: KeyboardEvent,
  actions: {
    stop: () => void;
    read: () => void;
    help: () => void;
    symbolic?: (operation: 'diff' | 'integrate' | 'limit') => void;
  },
) {
  if (event.key === 'Escape') actions.stop();
  if (event.key === 'F1') {
    event.preventDefault();
    actions.help();
  }
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    actions.read();
  }
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
  // Do not move focus behind a modal dialog.
  if (document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  const symbolic = { d: 'diff', i: 'integrate', l: 'limit' } as const;
  if (key in symbolic && actions.symbolic) {
    event.preventDefault();
    actions.symbolic(symbolic[key as keyof typeof symbolic]);
    return;
  }
  if (key === 'g' || key === 'm') {
    const panel = document.getElementById(key === 'g' ? 'graphs' : 'matrices');
    if (panel instanceof HTMLDetailsElement) {
      event.preventDefault();
      panel.open = true;
      panel.querySelector('summary')?.focus();
    }
    return;
  }
  if (key === 'v') {
    const button = document.getElementById('dictation-button');
    if (button instanceof HTMLButtonElement && !button.disabled) {
      event.preventDefault();
      button.focus();
      button.click();
    }
    return;
  }
  if (key === 'r' || key === 'h') {
    const target = document.getElementById(key === 'r' ? 'result-title' : 'history-title');
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }
}
