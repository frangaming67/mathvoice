import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGraph } from '../services/GraphClient';
import { graphEvaluator, type GraphData } from '../services/GraphService';
import { sonification } from '../services/SonificationService';
import { speech } from '../services/SpeechService';
import type { AngleMode } from '../types';
import { GraphFigure } from './GraphFigure';
export function Graphs({
  variables,
  angle,
  announce,
  initialExpression = 'x^2\nx+2',
}: {
  variables: Record<string, number>;
  angle: AngleMode;
  announce: (message: string) => void;
  initialExpression?: string;
}) {
  const [expressions, setExpressions] = useState(initialExpression),
    [minX, setMinX] = useState('-5'),
    [maxX, setMaxX] = useState('5'),
    [minY, setMinY] = useState('-5'),
    [maxY, setMaxY] = useState('10');
  const [data, setData] = useState<GraphData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(0),
    [position, setPosition] = useState(0),
    [step, setStep] = useState('0.1'),
    [audio, setAudio] = useState(false),
    [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playback = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const stop = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playback.current++;
        clearInterval(timer.current);
        sonification.stop();
        setPlaying(false);
      }
    };
    window.addEventListener('keydown', stop);
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      sonification.stop();
      window.removeEventListener('keydown', stop);
    };
  }, []);
  const evaluate = useMemo(
    () => (data ? graphEvaluator(data.curves[selected].expression, data.request) : null),
    [data, selected],
  );
  const point = evaluate ? { x: position, y: evaluate(position) } : null;
  const coordinates = point
    ? `Equis igual a ${Number(point.x.toPrecision(6))}; ye ${point.y === null ? 'no definida' : `igual a ${Number(point.y.toPrecision(6))}`}`
    : 'No hay gráfico.';
  async function draw() {
    if (busy) return;
    clearInterval(timer.current);
    playback.current++;
    sonification.stop();
    setPlaying(false);
    setBusy(true);
    setError('');
    try {
      const next = await buildGraph({
        expressions: expressions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        minX: +minX,
        maxX: +maxX,
        minY: +minY,
        maxY: +maxY,
        variables,
        angle,
      });
      setData(next);
      setPosition(next.request.minX);
      setSelected(0);
      announce(
        `Gráfico listo. ${next.curves.length} funciones. Usá Explorar gráfico y las flechas izquierda y derecha.`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No pude graficar.';
      setError(message);
      announce(message);
    } finally {
      setBusy(false);
    }
  }
  function move(next: number) {
    if (!data || !evaluate) return;
    clearInterval(timer.current);
    playback.current++;
    setPlaying(false);
    const x = Number(
      Math.max(data.request.minX, Math.min(data.request.maxX, next)).toPrecision(14),
    );
    setPosition(x);
    const p = { x, y: evaluate(x) };
    announce(
      `Equis igual a ${Number(p.x.toPrecision(6))}; ye ${p.y === null ? 'no definida' : `igual a ${Number(p.y.toPrecision(6))}`}`,
    );
    if (audio && p.y !== null)
      sonification.tone(
        p.y,
        data.request.minY,
        data.request.maxY,
        data.events.find(
          (e) =>
            e.functionIndex === selected &&
            Math.abs(e.x - p.x) < (data.request.maxX - data.request.minX) / 400,
        )?.type,
      );
  }
  function play() {
    if (!data) return;
    clearInterval(timer.current);
    const run = ++playback.current;
    if (playing) {
      setPlaying(false);
      sonification.stop();
      return;
    }
    void sonification
      .activate()
      .then(() => {
        if (!mounted.current || run !== playback.current) return;
        setPlaying(true);
        let i = 0;
        timer.current = setInterval(() => {
          const p = data.curves[selected].points[i];
          setPosition(p.x);
          if (p.y !== null)
            sonification.tone(
              p.y,
              data.request.minY,
              data.request.maxY,
              data.events.find(
                (e) =>
                  e.functionIndex === selected &&
                  Math.abs(e.x - p.x) < (data.request.maxX - data.request.minX) / 400,
              )?.type,
            );
          i += 2;
          if (i > 400) {
            clearInterval(timer.current);
            setPlaying(false);
          }
        }, 100);
      })
      .catch(() => announce('El navegador no pudo habilitar el audio.'));
  }
  return (
    <section aria-labelledby="graphs-title">
      <h2 id="graphs-title" tabIndex={-1}>
        Gráficos accesibles
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void draw();
        }}
      >
        <label>
          Funciones de x, una por línea (hasta 4)
          <textarea
            rows={3}
            required
            value={expressions}
            onChange={(e) => setExpressions(e.target.value)}
          />
        </label>
        <div className="field-pair">
          {[
            ['X mínimo', minX, setMinX],
            ['X máximo', maxX, setMaxX],
            ['Y mínimo', minY, setMinY],
            ['Y máximo', maxY, setMaxY],
          ].map(([label, value, set]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                type="number"
                step="any"
                required
                value={String(value)}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
        <button className="primary" aria-disabled={busy}>
          {busy ? 'Graficando…' : 'Graficar funciones'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <GraphFigure data={data} />
          <p className="hint">
            Rangos dibujados: X de {data.request.minX} a {data.request.maxX}; Y de{' '}
            {data.request.minY} a {data.request.maxY}. Las líneas se distinguen por sus trazos.
          </p>
          <div className="field-pair">
            <label>
              Función a explorar
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(+e.target.value);
                  setPosition(data.request.minX);
                  clearInterval(timer.current);
                  playback.current++;
                  sonification.stop();
                  setPlaying(false);
                }}
              >
                {data.curves.map((curve, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {curve.expression}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paso en X
              <select value={step} onChange={(e) => setStep(e.target.value)}>
                {['0.01', '0.1', '0.5', '1', '5'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <p id="graph-help">
            En Explorar gráfico, usá las flechas izquierda y derecha. Inicio y Fin van a los
            extremos. Cada posición se calcula con el paso elegido, independientemente de la tabla.
          </p>
          <button
            aria-describedby="graph-help"
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                move(
                  e.key === 'Home'
                    ? data.request.minX
                    : e.key === 'End'
                      ? data.request.maxX
                      : position + (e.key === 'ArrowLeft' ? -Number(step) : Number(step)),
                );
              }
            }}
            onClick={() => move(position)}
          >
            Explorar gráfico
          </button>
          <p className="coordinates" data-speech={coordinates}>
            {coordinates}
          </p>
          <div className="actions">
            <button onClick={() => speech.hablar(coordinates)}>Escuchar coordenadas</button>
            <button
              onClick={() => {
                if (audio) {
                  setAudio(false);
                  sonification.stop();
                } else
                  void sonification
                    .activate()
                    .then(() => setAudio(true))
                    .catch(() => announce('No pude habilitar audio.'));
              }}
            >
              {audio ? 'Desactivar tonos al explorar' : 'Activar tonos al explorar'}
            </button>
            <button onClick={play}>
              {playing ? 'Detener sonificación' : 'Sonificar recorrido'}
            </button>
          </div>
          <p className="hint">
            Mayor altura produce un tono más alto. Los eventos usan señales suaves distintas: cero,
            tono medio; máximo, agudo; mínimo, grave; intersección, medio agudo. Escape detiene el
            sonido. Los ceros, extremos e intersecciones se estiman por muestreo y pueden omitirse
            entre puntos.
          </p>
          <details>
            <summary>Puntos importantes y descripción textual</summary>
            <p>
              {data.events.length
                ? `${data.events.length} eventos aproximados encontrados.`
                : 'No se detectaron eventos en este rango.'}
            </p>
            <ul>
              {data.events.map((event, i) => (
                <li key={i}>
                  Función {event.functionIndex + 1}: {event.type}, x ≈{' '}
                  {Number(event.x.toPrecision(6))}, y ≈ {Number(event.y.toPrecision(6))}.
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Tabla completa de valores de la función seleccionada</summary>
            <div className="graph-table" tabIndex={0} aria-label="Tabla desplazable de coordenadas">
              <table className="data-table">
                <caption>{data.curves[selected].expression}: 401 puntos muestreados</caption>
                <thead>
                  <tr>
                    <th scope="col">X</th>
                    <th scope="col">Y</th>
                  </tr>
                </thead>
                <tbody>
                  {data.curves[selected].points.map((p, i) => (
                    <tr key={i}>
                      <td>{Number(p.x.toPrecision(8))}</td>
                      <td>{p.y === null ? 'No definida' : Number(p.y.toPrecision(8))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="actions">
            <button
              onClick={() => {
                const middle = (+minX + +maxX) / 2,
                  span = (+maxX - +minX) / 4;
                setMinX(String(middle - span));
                setMaxX(String(middle + span));
                announce('Rango X reducido. Pulsá Graficar funciones para aplicar.');
              }}
            >
              Acercar rango X
            </button>
            <button
              onClick={() => {
                const middle = (+minX + +maxX) / 2,
                  span = +maxX - +minX;
                setMinX(String(middle - span));
                setMaxX(String(middle + span));
                announce('Rango X ampliado. Pulsá Graficar funciones para aplicar.');
              }}
            >
              Alejar rango X
            </button>
          </div>
        </>
      )}
    </section>
  );
}
