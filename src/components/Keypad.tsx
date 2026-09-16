const keys = [
  ['7', 'Siete'],
  ['8', 'Ocho'],
  ['9', 'Nueve'],
  ['/', 'Dividir'],
  ['4', 'Cuatro'],
  ['5', 'Cinco'],
  ['6', 'Seis'],
  ['*', 'Multiplicar'],
  ['1', 'Uno'],
  ['2', 'Dos'],
  ['3', 'Tres'],
  ['-', 'Restar'],
  ['0', 'Cero'],
  ['.', 'Punto decimal'],
  ['%', 'Porcentaje'],
  ['+', 'Sumar'],
];
const display: Record<string, string> = { '/': '÷', '*': '×', '-': '−' };
export function Keypad({
  insert,
  erase,
  clear,
  sign,
  calculate,
  busy,
  memory,
  onMemory,
}: {
  insert: (value: string) => void;
  erase: () => void;
  clear: () => void;
  sign: () => void;
  calculate: () => void;
  busy: boolean;
  memory: string;
  onMemory: (action: 'clear' | 'recall' | 'add' | 'subtract') => void;
}) {
  return (
    <div className="keypad-area">
      <div className="memory-bar" role="group" aria-label="Memoria de la calculadora">
        <button type="button" aria-label="Borrar memoria" onClick={() => onMemory('clear')}>
          MC
        </button>
        <button type="button" aria-label="Recuperar memoria" onClick={() => onMemory('recall')}>
          MR
        </button>
        <button
          type="button"
          aria-label="Sumar resultado a memoria"
          onClick={() => onMemory('add')}
        >
          M+
        </button>
        <button
          type="button"
          aria-label="Restar resultado de memoria"
          onClick={() => onMemory('subtract')}
        >
          M−
        </button>
        <span data-speech={`Memoria: ${memory}`}>M: {memory}</span>
      </div>
      <div className="keypad" role="group" aria-label="Teclado de la calculadora">
        <button
          type="button"
          className="key-clear"
          aria-label="Borrar toda la expresión"
          onClick={clear}
        >
          AC
        </button>
        <button type="button" aria-label="Abrir paréntesis" onClick={() => insert('(')}>
          (
        </button>
        <button type="button" aria-label="Cerrar paréntesis" onClick={() => insert(')')}>
          )
        </button>
        <button type="button" aria-label="Borrar último carácter" onClick={erase}>
          ⌫
        </button>
        {keys.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={/[0-9.]/.test(value) ? 'key-number' : 'key-operator'}
            aria-label={label}
            onClick={() => insert(value)}
          >
            {display[value] ?? value}
          </button>
        ))}
        <button type="button" aria-label="Cambiar signo de la expresión" onClick={sign}>
          ±
        </button>
        <button type="button" aria-label="Elevar al cuadrado" onClick={() => insert('^2')}>
          x²
        </button>
        <button
          type="button"
          className="key-equals primary"
          aria-label="Igual, calcular"
          aria-disabled={busy}
          onClick={calculate}
        >
          =
        </button>
      </div>
    </div>
  );
}
