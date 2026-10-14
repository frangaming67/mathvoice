import { useEffect, useRef, useState } from 'react';
import { VoiceRecognitionService } from '../services/VoiceRecognitionService';
import {
  bestVoiceParse,
  voiceBlocked,
  voiceSummaryParts,
  type VoiceParse,
} from '../parser/voiceExpression';
import { speech } from '../services/SpeechService';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import type { AngleMode } from '../types';

// Tono breve al abrir el micrófono: avisa sin hablar, para que el aviso no termine transcripto.
function startTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => void context.close();
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  } catch {
    // Sin audio: el aviso en la región viva y el botón «Cancelar dictado» siguen informando.
  }
}
// Si el lector alcanza a decir el aviso con el micrófono abierto, no se toma como dictado.
const withoutPrompt = (text: string) =>
  text.replace(/^\s*escuchando[.,]?\s*(?:escape cancela[.,]?\s*)?/i, '');
const BLOCKED =
  'Hay palabras que no entendí, marcadas entre comillas angulares. Corregilas o volvé a dictar antes de calcular.';

export function Dictation({
  language,
  confirm,
  announce,
  onListeningChange,
  guided = false,
}: {
  language: string;
  confirm: (expression: string, angle?: AngleMode) => void;
  announce: (text: string, speak?: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  guided?: boolean;
}) {
  const service = useRef(new VoiceRecognitionService()),
    dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null),
    field = useRef<HTMLInputElement>(null);
  const reviewFrame = useRef<number | undefined>(undefined);
  const [supported] = useState(() => new VoiceRecognitionService().supported);
  const [listening, setListening] = useState(false),
    [expression, setExpression] = useState(''),
    [transcript, setTranscript] = useState(''),
    [parsed, setParsed] = useState<VoiceParse | null>(null),
    [status, setStatus] = useState('');
  useEffect(() => {
    const recognition = service.current;
    return () => {
      recognition.cancel();
      if (reviewFrame.current !== undefined) cancelAnimationFrame(reviewFrame.current);
      onListeningChange(false);
    };
  }, [onListeningChange]);
  // Escape corta la escucha aunque el foco esté en otro lado y descarta resultados tardíos.
  useEffect(() => {
    if (!listening) return;
    const stop = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      service.current.cancel();
      setListening(false);
      onListeningChange(false);
      announce('Dictado cancelado.');
    };
    document.addEventListener('keydown', stop, true);
    return () => document.removeEventListener('keydown', stop, true);
  }, [listening, announce, onListeningChange]);
  function listeningChanged(value: boolean) {
    setListening(value);
    onListeningChange(value);
  }
  // Dentro del diálogo modal la región viva global queda inerte: se informa en la propia.
  function tell(text: string) {
    setStatus(text);
    if (guided) speech.hablar(text);
  }
  function cancel() {
    service.current.cancel();
    if (reviewFrame.current !== undefined) cancelAnimationFrame(reviewFrame.current);
    listeningChanged(false);
    dialog.current?.close();
    button.current?.focus();
  }
  function review(text: string, alternatives: string[]) {
    const best = bestVoiceParse(alternatives.map(withoutPrompt));
    setTranscript(best.transcript || text);
    setExpression(best.parsed.expression);
    setParsed(best.parsed);
    listeningChanged(false);
    const summary = voiceSummaryParts(best.parsed, mathSpeech).join(' ');
    setStatus(summary);
    reviewFrame.current = requestAnimationFrame(() => {
      dialog.current?.showModal();
      if (guided) speech.hablar(summary);
    });
  }
  function start() {
    if (listening) {
      cancel();
      announce('Dictado cancelado.');
      return;
    }
    speech.detener();
    if (!supported) {
      announce(
        'Este navegador no ofrece dictado. Probá con Chrome o Edge; podés seguir escribiendo.',
      );
      return;
    }
    listeningChanged(true);
    announce('Escuchando. Escape cancela.', false);
    startTone();
    service.current.start(
      language,
      review,
      (message) => {
        listeningChanged(false);
        announce(message);
      },
      () => listeningChanged(false),
    );
  }
  const current: VoiceParse | null = parsed && {
    ...parsed,
    expression,
    unknown: voiceBlocked(expression) ? parsed.unknown : [],
  };
  const blocked = voiceBlocked(expression);
  return (
    <div className="dictation">
      <button
        id="dictation-button"
        type="button"
        ref={button}
        aria-disabled={!supported || undefined}
        aria-describedby="dictation-hint"
        onClick={start}
      >
        {listening ? 'Cancelar dictado' : 'Dictar expresión'}
      </button>
      <p className="hint" id="dictation-hint">
        {supported
          ? 'El navegador puede procesar tu audio en servidores de su proveedor. Siempre podrás revisar lo entendido antes de calcular.'
          : 'Este navegador no ofrece reconocimiento de voz. La escritura y la lectura por voz siguen disponibles.'}
      </p>
      <dialog
        ref={dialog}
        aria-labelledby="dictation-title"
        aria-describedby="dictation-summary"
        onCancel={cancel}
      >
        <h2 id="dictation-title">Revisar dictado</h2>
        <p>Escuché: {transcript}</p>
        <div id="dictation-summary">
          {current &&
            voiceSummaryParts(current, mathSpeech).map((part) => <p key={part}>{part}</p>)}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (blocked) {
              tell(BLOCKED);
              const input = field.current;
              const start = expression.indexOf('«');
              input?.focus();
              if (input && start >= 0) input.setSelectionRange(start, expression.indexOf('»') + 1);
              return;
            }
            confirm(expression, parsed?.angle);
            dialog.current?.close();
            button.current?.focus();
          }}
        >
          <label>
            Expresión entendida, podés editarla
            <input
              ref={field}
              autoFocus
              required
              maxLength={500}
              aria-invalid={blocked || undefined}
              aria-describedby={blocked ? 'dictation-blocked' : undefined}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
            />
          </label>
          {blocked && (
            <p id="dictation-blocked" className="hint">
              {BLOCKED}
            </p>
          )}
          <div className="actions">
            <button className="primary" aria-disabled={blocked || undefined}>
              Confirmar y calcular
            </button>
            <button type="button" onClick={() => tell(`Expresión: ${mathSpeech(expression)}`)}>
              Escuchar lo entendido
            </button>
            <button type="button" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </form>
        <p className="sr-only" role="status" aria-live={guided ? 'off' : 'polite'}>
          {status}
        </p>
      </dialog>
    </div>
  );
}
