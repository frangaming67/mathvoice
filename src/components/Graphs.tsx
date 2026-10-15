import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { buildGraph } from '../services/GraphClient';
import { graphEvaluator, type GraphData, type GraphEvent } from '../services/GraphService';
import { sonification } from '../services/SonificationService';
import { speech } from '../services/SpeechService';
import { formatNumber } from '../accessibility/numberSpeech';
import type { AngleMode, DecimalSeparator } from '../types';
import { GraphFigure } from './GraphFigure';
import { useToolCommands, usePreserveReaderKeys } from '../keyboard/CommandContext';

const STEPS = ['0.01', '0.1', '0.5', '1', '5'];
const EVENT_TYPES = {
  zero: 'cero',
  min: 'mínimo local',
  max: 'máximo local',
  intersection: 'intersección',
} as const;
type EventOperation = keyof typeof EVENT_TYPES;
/** Quién movió el explorador: el deslizador ya se lee solo con el lector, los demás se anuncian. */
type Source = 'slider' | 'button' | 'command';

export function Graphs({
  variables,
  angle,
  announce,
  decimalSeparator = 'punto',
  initialExpression = 'x^2\nx+2',
  active = true,
}: {
  variables: Record<string, number>;
  angle: AngleMode;
  announce: (message: string) => void;
  decimalSeparator?: DecimalSeparator;
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
  // Lo último dicho sobre una posición (eventos cruzados incluidos), mientras siga en ella.
  const [positionText, setPositionText] = useState<{ x: number; text: string } | null>(null);
  const [playStart, setPlayStart] = useState<{ x: number; text: string } | null>(null);
  const audioIndex = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playback = useRef(0);
  const mounted = useRef(false);
  const explorer = useRef<HTMLDivElement>(null);
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
  /** Números redondeados y con el separador elegido: «1,41421», no «1.4142135623730951». */
  const fmt = (value: number, significant = 6) =>
    formatNumber(value, { significant, decimal: decimalSeparator });
  const describePoint = (x: number, y: number | null) =>
    `Equis igual a ${fmt(x)}; ye ${y === null ? 'no definida' : `igual a ${fmt(y)}`}`;
  const point = evaluate ? { x: position, y: evaluate(position) } : null;
  const coordinates = point ? describePoint(point.x, point.y) : 'No hay gráfico.';
  const valueText = positionText && positionText.x === position ? positionText.text : coordinates;
  // Durante el recorrido sonoro el deslizador no cambia: si no, el lector leería cada punto.
  const slider = playing && !paused && playStart ? playStart : { x: position, text: valueText };
  const curveEvents = data
    ? data.events.filter((e) => e.functionIndex === selected || e.otherFunctionIndex === selected)
    : [];
  const eventName = (event: GraphEvent) =>
    event.type === 'intersección'
      ? `una intersección con la función ${(event.functionIndex === selected ? event.otherFunctionIndex! : event.functionIndex) + 1}`
      : `un ${event.type}`;

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
        decimalSeparator,
      });
      setData(next);
      setPosition(next.request.minX);
      setPositionText(null);
      setSelected(0);
      announce(
        `Gráfico listo. ${next.curves.length === 1 ? '1 función' : `${next.curves.length} funciones`}. Usá Explorar gráfico y las flechas izquierda y derecha.`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No pude graficar.';
      setError(message);
      announce(message);
    } finally {
      setBusy(false);
    }
  }
  /** Dice una posición: el deslizador ya la expone al lector; con la guía, la dice la voz. */
  function tell(x: number, text: string, source: Source) {
    setPositionText({ x, text });
    if (source === 'slider') speech.hablarAutomatico(text);
    else announce(text);
  }
  /** Eventos de la curva entre la posición anterior y la nueva, en el sentido del recorrido. */
  function crossed(from: number, to: number) {
    if (!data || from === to) return '';
    const tolerance = (data.request.maxX - data.request.minX) * 1e-9;
    const right = to > from;
    const passed = curveEvents
      .filter((e) =>
        right
          ? e.x > from + tolerance && e.x <= to + tolerance
          : e.x < from - tolerance && e.x >= to - tolerance,
      )
      .sort((a, b) => (right ? a.x - b.x : b.x - a.x));
    if (!passed.length) return '';
    const landing = passed.filter((e) => Math.abs(e.x - to) <= tolerance);
    const between = passed.filter((e) => !landing.includes(e));
    const list = (events: GraphEvent[]) =>
      events
        .slice(0, 3)
        .map((e) => `${eventName(e)} en equis ${fmt(e.x)}`)
        .join(', ') + (events.length > 3 ? ` y ${events.length - 3} más` : '');
    return [
      between.length ? `Pasaste por ${list(between)}.` : '',
      landing.length ? `Estás sobre ${list(landing)}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  function move(next: number, source: Source = 'command') {
    if (!data || !evaluate) return;
    clearInterval(timer.current);
    playback.current++;
    setPlaying(false);
    setPaused(false);
    sonification.stop();
    const x = Number(
      Math.max(data.request.minX, Math.min(data.request.maxX, next)).toPrecision(14),
    );
    const from = position;
    setPosition(x);
    const p = { x, y: evaluate(x) };
    const note = crossed(from, x);
    tell(x, `${describePoint(p.x, p.y)}${note ? `. ${note}` : ''}`, source);
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
    setPlayStart({ x: position, text: valueText });
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
  function changeStep(direction: 1 | -1) {
    const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, STEPS.indexOf(step) + direction))];
    setStep(next);
    announce(`Paso en X: ${fmt(Number(next))}.`);
  }
  /** Va al siguiente evento de ese tipo a la derecha; al llegar al último, vuelve al primero. */
  function jump(operation: EventOperation, source: Source) {
    if (!data) return;
    const type = EVENT_TYPES[operation];
    const list = curveEvents.filter((e) => e.type === type).sort((a, b) => a.x - b.x);
    if (!list.length) {
      announce(
        'No se detectó ese evento en la curva y el intervalo actuales. El muestreo puede omitir eventos.',
      );
      return;
    }
    const tolerance = (data.request.maxX - data.request.minX) * 1e-9;
    const event = list.find((e) => e.x > position + tolerance) ?? list[0];
    stopPlayback();
    setPosition(event.x);
    const y = evaluate?.(event.x) ?? event.y;
    tell(
      event.x,
      `${event.type} aproximado${event.type === 'intersección' ? ` con la función ${(event.functionIndex === selected ? event.otherFunctionIndex! : event.functionIndex) + 1}` : ''}. ${describePoint(event.x, y)}.`,
      source,
    );
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
      changeStep(operation === 'step-up' ? 1 : -1);
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
    if (operation in EVENT_TYPES) jump(operation as EventOperation, 'command');
  }
  useToolCommands('graphs', (command) => {
    if (command.type === 'graph') graphCommand(command.operation);
  });
  function explorerKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!data || preservesReaderKeys(e.nativeEvent) || e.altKey || e.ctrlKey || e.metaKey) return;
    const size = Number(step);
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const actions: Record<string, () => void> = {
      ArrowRight: () => move(position + size, 'slider'),
      ArrowUp: () => move(position + size, 'slider'),
      ArrowLeft: () => move(position - size, 'slider'),
      ArrowDown: () => move(position - size, 'slider'),
      PageUp: () => move(position + size * 10, 'slider'),
      PageDown: () => move(position - size * 10, 'slider'),
      Home: () => move(data.request.minX, 'slider'),
      End: () => move(data.request.maxX, 'slider'),
      '+': () => changeStep(1),
      '-': () => changeStep(-1),
      ' ': () => graphCommand('pause'),
      s: () => graphCommand('play'),
      z: () => jump('zero', 'slider'),
      m: () => jump(e.shiftKey ? 'max' : 'min', 'slider'),
      i: () => jump('intersection', 'slider'),
    };
    // Mayúsculas solo cambia M (máximo); con flechas u otras teclas se deja pasar.
    if (e.shiftKey && !['m', '+'].includes(key)) return;
    const action = actions[key];
    if (!action) return;
    e.preventDefault();
    action();
  }
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
            Rangos dibujados: X de {fmt(data.request.minX)} a {fmt(data.request.maxX)}; Y de{' '}
            {fmt(data.request.minY)} a {fmt(data.request.maxY)}. Las líneas se distinguen por sus
            trazos.
          </p>
          <div className="field-pair">
            <label>
              Función a explorar
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(+e.target.value);
                  setPosition(data.request.minX);
                  setPositionText(null);
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
                {STEPS.map((s) => (
                  <option key={s} value={s}>
                    {fmt(Number(s))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p id="graph-help">
            En Explorar gráfico, las flechas recorren la función con el paso elegido; Re Pág y Av
            Pág avanzan diez pasos; Inicio y Fin van a los extremos. Si pasás por un cero, un
            extremo o una intersección, se avisa. Z va al cero siguiente, M al mínimo, Mayúsculas
            más M al máximo, I a la intersección, más y menos cambian el paso, S suena el recorrido
            y Espacio lo pausa.
          </p>
          <div
            ref={explorer}
            className="graph-explorer"
            role="slider"
            tabIndex={0}
            aria-label="Explorar gráfico"
            aria-describedby="graph-help"
            aria-orientation="horizontal"
            aria-valuemin={data.request.minX}
            aria-valuemax={data.request.maxX}
            aria-valuenow={slider.x}
            aria-valuetext={slider.text}
            onKeyDown={explorerKey}
            onClick={() => move(position, 'button')}
          >
            <span aria-hidden="true">Explorar gráfico</span>
            <span
              className="graph-explorer-track"
              aria-hidden="true"
              style={{
                ['--at' as string]: `${((position - data.request.minX) / (data.request.maxX - data.request.minX)) * 100}%`,
              }}
            />
          </div>
          <p className="coordinates" data-speech={coordinates}>
            {coordinates}
          </p>
          <div className="actions">
            <button onClick={() => move(position - Number(step), 'button')}>Punto anterior</button>
            <button onClick={() => move(position + Number(step), 'button')}>Punto siguiente</button>
            <button onClick={() => announce(valueText)}>Escuchar coordenadas</button>
          </div>
          <div className="actions">
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
                  announce(`Velocidad de sonificación: ${fmt(Number(next))}.`);
                }}
              >
                {['0.5', '1', '1.5', '2'].map((value) => (
                  <option key={value} value={value}>
                    {fmt(Number(value))}×
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
                    ` Valores Y muestreados entre ${fmt(Math.min(...values))} y ${fmt(Math.max(...values))}.`}
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
                  : {event.type}, x ≈ {fmt(event.x)}, y ≈ {fmt(event.y)}.
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
                      tell(
                        event.x,
                        `${event.type}. Función ${event.functionIndex + 1}${event.otherFunctionIndex !== undefined ? ` y función ${event.otherFunctionIndex + 1}` : ''}. ${describePoint(event.x, event.y)}.`,
                        'button',
                      );
                    }}
                    aria-label={`Explorar ${event.type} de función ${event.functionIndex + 1}${event.otherFunctionIndex !== undefined ? ` y función ${event.otherFunctionIndex + 1}` : ''} en x ${fmt(event.x)}`}
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
                      <td>{fmt(p.x, 8)}</td>
                      <td>{p.y === null ? 'No definida' : fmt(p.y, 8)}</td>
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
