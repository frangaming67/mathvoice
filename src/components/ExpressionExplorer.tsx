import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  describeNode,
  summarize,
  theRole,
  type ExplorerNode,
} from '../accessibility/expressionExplorer';
import { toMathML } from '../accessibility/mathml';

export interface ExplorerRequest {
  title: string;
  tree: ExplorerNode;
  /** Lleva el cursor a la parte elegida: solo para la expresión que se está escribiendo. */
  select?: (range: [number, number]) => void;
}

const WHOLE = 'expresión completa';
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Explorador de una expresión por partes, como la navegación de MathCAT: izquierda y derecha
 * van a las partes vecinas, abajo entra en la parte y arriba sale. Cada movimiento se dice con
 * el papel de la parte («Denominador, resta: 2 equis menos 3»). Con lector de pantalla es una
 * aplicación, así las flechas le llegan; con el dedo o el ratón, los botones hacen lo mismo.
 */
export function ExpressionExplorer({
  request,
  announce,
  close,
}: {
  request: ExplorerRequest;
  announce: (text: string) => void;
  close: () => void;
}) {
  const { tree, title, select } = request;
  const [path, setPath] = useState<number[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const nodeAt = (at: number[]) => at.reduce((node, index) => node.children[index].node, tree);
  const roleAt = (at: number[]) =>
    at.length ? nodeAt(at.slice(0, -1)).children[at.at(-1)!].role : WHOLE;
  const current = nodeAt(path);
  const index = path.at(-1) ?? 0;
  const siblings = path.length ? nodeAt(path.slice(0, -1)).children.length : 1;

  useEffect(() => {
    dialog.current?.showModal();
    area.current?.focus();
    announce(
      `${title}. ${describeNode(tree, WHOLE)}.${tree.children.length ? ' Flecha abajo entra en sus partes.' : ''}`,
    );
    // Se presenta una sola vez, al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: number[] | null, otherwise: string) {
    if (!next) return announce(otherwise);
    setPath(next);
    announce(describeNode(nodeAt(next), roleAt(next)));
  }
  const parent = path.slice(0, -1);
  const moves = {
    down: () =>
      go(
        current.children.length ? [...path, 0] : null,
        `${capitalized(roleAt(path))} no tiene partes: es ${current.article} ${current.kind}.`,
      ),
    up: () => go(path.length ? parent : null, 'Ya estás en la expresión completa.'),
    left: () =>
      go(
        path.length && index > 0 ? [...parent, index - 1] : null,
        path.length ? 'Es la primera parte.' : 'Flecha abajo entra en las partes de la expresión.',
      ),
    right: () =>
      go(
        path.length && index < siblings - 1 ? [...parent, index + 1] : null,
        path.length ? 'Es la última parte.' : 'Flecha abajo entra en las partes de la expresión.',
      ),
    first: () => go(path.length ? [...parent, 0] : null, 'Ya estás en la expresión completa.'),
    last: () =>
      go(path.length ? [...parent, siblings - 1] : null, 'Ya estás en la expresión completa.'),
  };
  // «Estás en el término 2, dentro del numerador»: de la parte actual hacia afuera.
  const where = () =>
    announce(
      path.length
        ? `Estás en ${path
            .map((_, i) => theRole(roleAt(path.slice(0, i + 1))))
            .reverse()
            .join(', dentro de ')
            .replace(/ de el /g, ' del ')}.`
        : 'Estás en la expresión completa.',
    );
  function choose() {
    if (!select) return announce(describeNode(current, roleAt(path)));
    if (!current.range) return announce('No pude ubicar esta parte en lo que escribiste.');
    dialog.current?.close();
    select(current.range);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const actions: Record<string, () => void> = {
      ArrowDown: moves.down,
      ArrowUp: moves.up,
      ArrowLeft: moves.left,
      ArrowRight: moves.right,
      Home: moves.first,
      End: moves.last,
      ' ': () => announce(describeNode(current, roleAt(path))),
      Enter: choose,
      r: () => announce(summarize(current)),
      p: where,
    };
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }
  const breadcrumb = [WHOLE, ...path.map((_, i) => roleAt(path.slice(0, i + 1)))]
    .map(capitalized)
    .join(' › ');
  const math = (text: string) => ({ __html: toMathML(text, { display: 'block' }) ?? '' });
  return (
    <dialog ref={dialog} className="explorer" aria-labelledby="explorer-title" onClose={close}>
      <h2 id="explorer-title">{title}</h2>
      <div
        className="explorer-whole"
        aria-hidden="true"
        dangerouslySetInnerHTML={math(tree.text)}
      />
      <div
        ref={area}
        className="explorer-area"
        role="application"
        aria-roledescription="explorador de expresión"
        aria-label={title}
        aria-describedby="explorer-keys"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <p className="explorer-path" aria-hidden="true">
          {breadcrumb}
        </p>
        <div
          className="explorer-part"
          aria-hidden="true"
          dangerouslySetInnerHTML={math(current.text)}
        />
        <p className="explorer-kind" aria-hidden="true">
          {capitalized(current.kind)}
          {current.children.length
            ? ` de ${current.children.length} ${current.children.length === 1 ? 'parte' : 'partes'}`
            : ''}
          {path.length ? ` · ${index + 1} de ${siblings}` : ''}
        </p>
      </div>
      <p id="explorer-keys" className="hint">
        Flechas izquierda y derecha: la parte anterior o la siguiente. Abajo: entrar en la parte.
        Arriba: salir. Inicio y Fin: la primera y la última. Espacio repite, R resume y P dice dónde
        estás.{select ? ' Enter lleva el cursor a esa parte.' : ''} Escape cierra.
      </p>
      <div className="actions">
        <button type="button" onClick={moves.left}>
          Parte anterior
        </button>
        <button type="button" onClick={moves.right}>
          Parte siguiente
        </button>
        <button type="button" onClick={moves.down}>
          Entrar
        </button>
        <button type="button" onClick={moves.up}>
          Salir
        </button>
        <button type="button" onClick={() => announce(summarize(current))}>
          Resumen
        </button>
        {select && (
          <button type="button" onClick={choose}>
            Llevar el cursor acá
          </button>
        )}
        <button type="button" onClick={() => dialog.current?.close()}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
