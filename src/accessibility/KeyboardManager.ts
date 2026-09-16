export function handleKeyboard(
  event: KeyboardEvent,
  actions: { stop: () => void; read: () => void; help: () => void },
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
  if (event.altKey && event.shiftKey && ['r', 'h'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    document
      .getElementById(event.key.toLowerCase() === 'r' ? 'result-title' : 'history-title')
      ?.focus();
  }
}
