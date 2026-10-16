import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  arrowKeys,
  controlKeys,
  functionKeys,
  numberKeys,
  resolveFace,
  sideKeys,
  type CalculatorKey,
  type KeyFace,
  type Layer,
} from '../calculator/keys';
import type { DecimalSeparator } from '../types';

/** Dibujo de las teclas con casilleros, como en la calculadora de mano. */
function glyph(key: CalculatorKey): ReactNode {
  switch (key.id) {
    case 'fraction':
      return (
        <span className="glyph-fraction">
          <span>▢</span>
          <span>▢</span>
        </span>
      );
    case 'power':
      return (
        <>
          x<sup>▢</sup>
        </>
      );
    case 'logb':
      return (
        <>
          log<sub>▢</sub>▢
        </>
      );
    case 'integral':
      return (
        <>
          ∫<sub>▢</sub>
          <sup>▢</sup>▢
        </>
      );
    case 'exp10':
      return (
        <>
          ×10<sup>x</sup>
        </>
      );
    default:
      return key.main.label;
  }
}

/** Teclas sobre las que se mueve el foco con las flechas, de arriba a abajo y de izquierda a derecha. */
function neighbor(from: HTMLElement, pad: HTMLElement, direction: string) {
  const keys = Array.from(pad.querySelectorAll<HTMLButtonElement>('button.calc-key'));
  const center = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const origin = center(from);
  let best: HTMLButtonElement | undefined;
  let bestScore = Infinity;
  for (const candidate of keys) {
    if (candidate === from) continue;
    const point = center(candidate);
    const dx = point.x - origin.x,
      dy = point.y - origin.y;
    const forward =
      direction === 'ArrowRight'
        ? dx
        : direction === 'ArrowLeft'
          ? -dx
          : direction === 'ArrowDown'
            ? dy
            : -dy;
    const side = direction === 'ArrowRight' || direction === 'ArrowLeft' ? dy : dx;
    if (forward <= 2) continue;
    const score = forward + Math.abs(side) * 3;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

// Escribir con el teclado físico mientras el foco está en las teclas también funciona.
const TYPED: Record<string, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divide',
  '(': 'lparen',
  ')': 'rparen',
  '^': 'power',
  '.': 'dot',
  ',': 'dot',
  Backspace: 'del',
};

/**
 * Teclado de la calculadora científica. Una sola parada de Tab: las flechas recorren las teclas
 * y Shift o Alpha cambian el nombre de cada una por la función de esa capa.
 */
export function CalculatorKeys({
  layer,
  storing = false,
  decimal = 'punto',
  onPress,
}: {
  layer: Layer;
  storing?: boolean;
  decimal?: DecimalSeparator;
  onPress: (key: CalculatorKey, face: KeyFace) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState('k7');
  const all = [...controlKeys, ...arrowKeys, ...sideKeys, ...functionKeys, ...numberKeys];
  function press(key: CalculatorKey) {
    onPress(key, resolveFace(key, layer, storing));
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (!target.matches('button.calc-key') || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      const next = neighbor(target, pad.current!, event.key);
      event.preventDefault();
      next?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const keys = pad.current!.querySelectorAll<HTMLButtonElement>('button.calc-key');
      keys[event.key === 'Home' ? 0 : keys.length - 1]?.focus();
      return;
    }
    const id = /^\d$/.test(event.key) ? `k${event.key}` : TYPED[event.key];
    const typed = id && all.find((key) => key.id === id);
    if (typed) {
      event.preventDefault();
      press(typed);
    }
  }
  /** Las teclas de arriba se ubican por nombre alrededor de la cruceta. */
  const cell = (key: CalculatorKey, named = false) => {
    const face = resolveFace(key, layer, storing);
    const decimalKey = key.id === 'dot' && face === key.main;
    const name = decimalKey ? (decimal === 'coma' ? 'Coma decimal' : 'Punto decimal') : face.name;
    const pressed =
      key.id === 'shift' ? layer === 'shift' : key.id === 'alpha' ? layer === 'alpha' : undefined;
    return (
      <div
        className={`key-cell key-cell-${key.style}`}
        key={key.id}
        style={named ? { gridArea: key.id } : undefined}
      >
        {key.style === 'round' ? (
          // En las teclas redondas el nombre va impreso encima, como en la calculadora de mano.
          <span className="round-legend" aria-hidden="true">
            <span
              className={
                key.id === 'shift'
                  ? 'round-legend-shift'
                  : key.id === 'alpha'
                    ? 'round-legend-alpha'
                    : undefined
              }
            >
              {key.main.label}
            </span>
            {key.shift && <span className="round-legend-shift"> {key.shift.label}</span>}
          </span>
        ) : (
          (key.shift || key.alpha) && (
            <span className="key-legends" aria-hidden="true">
              <span className="legend-shift">{key.shift?.label}</span>
              <span className="legend-alpha">{key.alpha?.label}</span>
            </span>
          )
        )}
        <button
          type="button"
          className={`calc-key calc-key-${key.style}`}
          data-key={key.id}
          tabIndex={current === key.id ? 0 : -1}
          aria-label={name}
          aria-pressed={pressed}
          // El foco se queda en el campo: las teclas escriben donde está el cursor.
          onMouseDown={(event) => event.preventDefault()}
          onFocus={() => setCurrent(key.id)}
          onClick={() => press(key)}
        >
          {decimalKey ? (decimal === 'coma' ? ',' : '.') : glyph(key)}
        </button>
      </div>
    );
  };
  return (
    <div
      ref={pad}
      className="calc-keys"
      data-layer={layer}
      role="group"
      aria-label="Teclado de la calculadora"
      aria-describedby="calc-keys-help"
      onKeyDown={onKeyDown}
    >
      <p id="calc-keys-help" className="sr-only">
        Una sola parada de Tab: las flechas recorren las teclas. Shift y Alpha cambian la función de
        la tecla siguiente y su nombre. Arriba y abajo de la cruceta traen cálculos anteriores.
      </p>
      <div className="keys-top">
        {controlKeys.map((key) => cell(key, true))}
        <div className="dpad" style={{ gridArea: 'dpad' }}>
          {arrowKeys.map((key) => cell(key, true))}
        </div>
        {sideKeys.map((key) => cell(key, true))}
      </div>
      <div className="keys-functions">{functionKeys.map((key) => cell(key))}</div>
      <div className="keys-numbers">{numberKeys.map((key) => cell(key))}</div>
    </div>
  );
}
