import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export interface LcdItem {
  id: string;
  label: string;
  /** Segunda línea: valor de una variable, descripción de una constante. */
  detail?: string;
  icon?: ReactNode;
}

export interface LcdPanelHandle {
  move: (direction: 'left' | 'right' | 'up' | 'down') => void;
  choose: (index?: number) => void;
}

/** Atajo de cada opción: 1 a 9 y después A, B, C…, como en el menú de la calculadora. */
const itemHotkey = (index: number) =>
  index < 9 ? String(index + 1) : String.fromCharCode(65 + index - 9);

/**
 * Menú o lista dentro de la pantalla. Es un menú accesible: el foco entra en la opción elegida,
 * las flechas (o la cruceta) se mueven, Enter o «=» eligen y Escape o AC cierran.
 */
export const LcdPanel = forwardRef<
  LcdPanelHandle,
  {
    title: string;
    items: LcdItem[];
    columns?: number;
    onChoose: (item: LcdItem) => void;
    onClose: () => void;
  }
>(function LcdPanel({ title, items, columns = 1, onChoose, onClose }, handle) {
  const [selected, setSelected] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const focus = (index: number) => {
    setSelected(index);
    list.current?.querySelectorAll<HTMLElement>('[role=menuitem]')[index]?.focus();
  };
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  }, []);
  function move(direction: 'left' | 'right' | 'up' | 'down') {
    const step =
      direction === 'left'
        ? -1
        : direction === 'right'
          ? 1
          : direction === 'up'
            ? -columns
            : columns;
    focus(Math.max(0, Math.min(items.length - 1, selected + step)));
  }
  function choose(index = selected) {
    if (items[index]) onChoose(items[index]);
  }
  useImperativeHandle(handle, () => ({ move, choose }));
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    if (arrows[event.key]) {
      event.preventDefault();
      move(arrows[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focus(event.key === 'Home' ? 0 : items.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key.length === 1) {
      const index = items.findIndex((_, i) => itemHotkey(i) === event.key.toUpperCase());
      if (index >= 0) {
        event.preventDefault();
        choose(index);
      }
    }
  }
  return (
    <div className="lcd-panel" data-columns={columns}>
      <p className="lcd-panel-title" id="lcd-panel-title">
        {title}
      </p>
      <div
        ref={list}
        role="menu"
        aria-labelledby="lcd-panel-title"
        className="lcd-panel-items"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => (
          <button
            type="button"
            role="menuitem"
            key={item.id}
            className="lcd-panel-item"
            tabIndex={index === selected ? 0 : -1}
            aria-label={`${itemHotkey(index)}: ${item.label}${item.detail ? `, ${item.detail}` : ''}`}
            onFocus={() => setSelected(index)}
            onClick={() => choose(index)}
          >
            {item.icon && (
              <span className="lcd-panel-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="lcd-panel-hotkey" aria-hidden="true">
              {itemHotkey(index)}
            </span>
            {columns === 1 && (
              <span className="lcd-panel-text" aria-hidden="true">
                {item.label}
                {item.detail && <small>{item.detail}</small>}
              </span>
            )}
          </button>
        ))}
      </div>
      {columns > 1 && (
        <p className="lcd-panel-caption" aria-hidden="true">
          {itemHotkey(selected)}:{items[selected]?.label}
        </p>
      )}
    </div>
  );
});
