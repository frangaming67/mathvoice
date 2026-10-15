import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGraph } from '../services/GraphClient';
import { graphEvaluator, type GraphData } from '../services/GraphService';
import { sonification } from '../services/SonificationService';
import { speech } from '../services/SpeechService';
import type { AngleMode } from '../types';
import { GraphFigure } from './GraphFigure';
import { useToolCommands, usePreserveReaderKeys } from '../keyboard/CommandContext';
export function Graphs({
  variables,
  angle,
  announce,
  initialExpression = 'x^2\nx+2',
  active = true,
}: {
  variables: Record<string, number>;
  angle: AngleMode;
  announce: (message: string) => void;
  initialExpression?: string;
  active?: boolean;
}) {
  const preservesReaderKeys = usePreserveReaderKeys();
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
  const [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState('1');
  const audioIndex = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playback = useRef(0);
  const mounted = useRef(false);
  const explorer = useRef<HTMLButtonElement>(null);
  // Reset only the playback state when hidden; keep the graph and its draft.
  if (!active && (playing || paused)) {
    setPlaying(false);
    setPaused(false);
  }
  useEffect(() => {
    if (active) return;
    playback.current++;
    clearInterval(timer.current);
    sonification.stop();
  }, [active]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      sonification.stop();
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
    setPaused(false);
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
    setPaused(false);
    sonification.stop();
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
            (e.functionIndex === selected || e.otherFunctionIndex === selected) &&
            Math.abs(e.x - p.x) < (data.request.maxX - data.request.minX) / 400,
        )?.type,
      );
  }
  function stopPlayback() {
    playback.current++;
    clearInterval(timer.current);
    sonification.stop();
    setPlaying(false);
    setPaused(false);
    audioIndex.current = 0;
  }
  function startPlayback(index = 0, rate = Number(speed)) {
    if (!data) return;
    clearInterval(timer.current);
    const run = ++playback.current;
    audioIndex.current = index;
    setPlaying(true);
    setPaused(false);
    void sonification
      .activate()
      .then(() => {
        if (!mounted.current || run !== playback.current) return;
        timer.current = setInterval(() => {
          const i = audioIndex.current;
          const p = data.curves[selected].points[i];
          setPosition(p.x);
          if (p.y !== null)
            sonification.tone(
              p.y,
              data.request.minY,
              data.request.maxY,
              data.events.find(
                (e) =>
                  (e.functionIndex === selected || e.otherFunctionIndex === selected) &&
                  Math.abs(e.x - p.x) < (data.request.maxX - data.request.minX) / 400,
              )?.type,
            );
          audioIndex.current = i + 2;
          if (audioIndex.current > 400) {
            clearInterval(timer.current);
            setPlaying(false);
            setPaused(false);
            audioIndex.current = 0;
            announce('Recorrido sonoro terminado.');
          }
        }, 100 / rate);
      })
      .catch(() => {
        if (run !== playback.current) return;
        stopPlayback();
        announce('El navegador no pudo habilitar el audio.');
      });
  }
  function play() {
    if (playing) stopPlayback();
    else startPlayback();
  }
  function pauseOrResume() {
    if (!playing) {
      announce('Iniciá primero la sonificación.');
      return;
    }
    if (paused) {
      startPlayback(audioIndex.current);
      announce('Sonificación continuada.');
    } else {
      playback.current++;
      clearInterval(timer.current);
      sonification.stop();
      setPaused(true);
      announce('Sonificación pausada.');
    }
  }
  function graphCommand(operation: string) {
    if (operation === 'stop') {
      stopPlayback();
      return;
    }
    if (!active) return;
    if (!data) {
      announce('Primero introducí una función y pulsá Graficar funciones.');
      return;
    }
    if (operation === 'play') {
      if (!playing) startPlayback();
      else if (paused) pauseOrResume();
      return;
    }
    if (operation === 'pause') {
      pauseOrResume();
      return;
    }
    if (['step-up', 'step-down'].includes(operation)) {
      const steps = ['0.01', '0.1', '0.5', '1', '5'];
      const next =
        steps[
          Math.max(
            0,
            Math.min(steps.length - 1, steps.indexOf(step) + (operation === 'step-up' ? 1 : -1)),
          )
        ];
      setStep(next);
      announce(`Paso en X: ${next}.`);
      return;
    }
    if (['left', 'right', 'home', 'end'].includes(operation)) {
      move(
        operation === 'home'
          ? data.request.minX
          : operation === 'end'
            ? data.request.maxX
            : position + (operation === 'left' ? -Number(step) : Number(step)),
      );
      return;
    }
    const type = {
      zero: 'cero',
      min: 'mínimo local',
      max: 'máximo local',
      intersection: 'intersección',
    }[operation];
    const event = data.events
      .filter(
        (event) =>
          event.type === type &&
          (event.functionIndex === selected || event.otherFunctionIndex === selected),
      )
      .sort((a, b) => Math.abs(a.x - position) - Math.abs(b.x - position))[0];
    if (!event) {
      announce(
        'No se detectó ese evento en la curva y el intervalo actuales. El muestreo puede omitir eventos.',
      );
      return;
    }
    stopPlayback();
    setPosition(event.x);
    announce(`${event.type} aproximado. Equis ${event.x}. Ye ${event.y}.`);
  }
  useToolCommands('graphs', (command) => {
    if (command.type === 'graph') graphCommand(command.operation);
  });
  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void draw();
        }}
      >
        <label>
          Funciones de x, una por línea (hasta 4)
          <textarea
            data-expression
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
                  setPaused(false);
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
            extremos. Arriba y abajo cambian el paso. Espacio pausa o continúa el audio. Cada
            posición se calcula con el paso elegido, independientemente de la tabla.
          </p>
          <button
            ref={explorer}
            aria-describedby="graph-help"
            onKeyDown={(e) => {
              if (preservesReaderKeys(e.nativeEvent) || e.altKey || e.ctrlKey || e.shiftKey) return;
              if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                e.preventDefault();
                graphCommand(
                  e.key === ' ' ? 'pause' : e.key === 'ArrowUp' ? 'step-up' : 'step-down',
                );
                return;
              }
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
            <button disabled={!playing} onClick={pauseOrResume}>
              {paused ? 'Continuar sonificación' : 'Pausar sonificación'}
            </button>
            <label>
              Velocidad de sonificación
              <select
                value={speed}
                onChange={(event) => {
                  const next = event.target.value;
                  setSpeed(next);
                  if (playing && !paused) startPlayback(audioIndex.current, Number(next));
                  announce(`Velocidad de sonificación: ${next}.`);
                }}
              >
                {['0.5', '1', '1.5', '2'].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Mayor altura produce un tono más alto. Los eventos usan señales suaves distintas: cero,
            tono medio; máximo, agudo; mínimo, grave; intersección, medio agudo. Escape detiene el
            sonido. Los ceros, extremos e intersecciones se estiman por muestreo y pueden omitirse
            entre puntos. Se refinan las posiciones detectadas con evaluaciones adicionales; esto no
            demuestra que se hayan encontrado todos los eventos.
          </p>
          <details>
            <summary>Puntos importantes y descripción textual</summary>
            {data.curves.map((curve, index) => {
              const finite = curve.points.filter((point) => point.y !== null);
              const values = finite.map((point) => point.y!);
              return (
                <p key={index}>
                  Función {index + 1}, {curve.expression}: {finite.length} de 401 muestras reales
                  finitas.
                  {values.length > 0 &&
                    ` Valores Y muestreados entre ${Number(Math.min(...values).toPrecision(6))} y ${Number(Math.max(...values).toPrecision(6))}.`}
                  {curve.breaks.length > 0 &&
                    ' Hay puntos no definidos o posibles saltos; el trazado se interrumpe en esos lugares.'}
                </p>
              );
            })}
            <p>
              {data.events.length
                ? `${data.events.length} eventos aproximados encontrados.`
                : 'No se detectaron eventos aislados en este rango.'}{' '}
              Se muestran hasta 100 eventos. Los tramos coincidentes o constantes no se enumeran
              como puntos aislados.
            </p>
            <ul>
              {data.events.map((event, i) => (
                <li key={i}>
                  Función {event.functionIndex + 1}
                  {event.otherFunctionIndex !== undefined
                    ? ` y función ${event.otherFunctionIndex + 1}`
                    : ''}
                  : {event.type}, x ≈ {Number(event.x.toPrecision(6))}, y ≈{' '}
                  {Number(event.y.toPrecision(6))}.
                  <button
                    onClick={() => {
                      clearInterval(timer.current);
                      playback.current++;
                      sonification.stop();
                      setPlaying(false);
                      setPaused(false);
                      setSelected(event.functionIndex);
                      setPosition(event.x);
                      explorer.current?.focus();
                      announce(
                        `${event.type}. Función ${event.functionIndex + 1}${event.otherFunctionIndex !== undefined ? ` y función ${event.otherFunctionIndex + 1}` : ''}. Equis igual a ${Number(event.x.toPrecision(6))}; ye igual a ${Number(event.y.toPrecision(6))}.`,
                      );
                    }}
                    aria-label={`Explorar ${event.type} de función ${event.functionIndex + 1}${event.otherFunctionIndex !== undefined ? ` y función ${event.otherFunctionIndex + 1}` : ''} en x ${Number(event.x.toPrecision(6))}`}
                  >
                    Ir a este punto
                  </button>
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
