import { useEffect, useRef, useState } from 'react';
import { VoiceRecognitionService } from '../services/VoiceRecognitionService';
import { voiceExpression } from '../parser/voiceExpression';
import { speech } from '../services/SpeechService';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
export function Dictation({
  language,
  confirm,
  announce,
  onListeningChange,
}: {
  language: string;
  confirm: (expression: string, angle?: 'deg' | 'rad') => void;
  announce: (text: string, speak?: boolean) => void;
  onListeningChange: (listening: boolean) => void;
}) {
  const service = useRef(new VoiceRecognitionService()),
    dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const [supported] = useState(() => new VoiceRecognitionService().supported);
  const [listening, setListening] = useState(false),
    [expression, setExpression] = useState(''),
    [transcript, setTranscript] = useState(''),
    [angle, setAngle] = useState<'deg' | 'rad' | undefined>(undefined);
  useEffect(() => {
    const recognition = service.current;
    return () => recognition.cancel();
  }, []);
  function listeningChanged(value: boolean) {
    setListening(value);
    onListeningChange(value);
  }
  function cancel() {
    service.current.cancel();
    listeningChanged(false);
    dialog.current?.close();
    button.current?.focus();
  }
  function start() {
    if (listening) {
      cancel();
      return;
    }
    speech.detener();
    listeningChanged(true);
    announce('Escuchando. Dictá una expresión matemática.', false);
    service.current.start(
      language,
      (text) => {
        const parsed = voiceExpression(text);
        setTranscript(text);
        setExpression(parsed.expression);
        setAngle(parsed.angle);
        listeningChanged(false);
        requestAnimationFrame(() => {
          dialog.current?.showModal();
          speech.hablar(
            `Entendí: ${mathSpeech(parsed.expression)}. Confirmá, editá o cancelá antes de calcular.`,
          );
        });
      },
      (message) => {
        listeningChanged(false);
        announce(message);
      },
      () => listeningChanged(false),
    );
  }
  return (
    <div className="dictation">
      <button
        id="dictation-button"
        type="button"
        ref={button}
        disabled={!supported}
        onClick={start}
      >
        {listening ? 'Cancelar dictado' : 'Dictar expresión'}
      </button>
      <p className="hint">
        {supported
          ? 'El navegador puede procesar tu audio en servidores de su proveedor. Siempre podrás revisar lo entendido antes de calcular.'
          : 'Este navegador no ofrece reconocimiento de voz. La escritura y la lectura por voz siguen disponibles.'}
      </p>
      <dialog ref={dialog} aria-labelledby="dictation-title" onCancel={cancel}>
        <h2 id="dictation-title">Revisar dictado</h2>
        <p>Escuché: {transcript}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm(expression, angle);
            dialog.current?.close();
            button.current?.focus();
          }}
        >
          <label>
            Expresión entendida, podés editarla
            <input
              autoFocus
              required
              maxLength={500}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
            />
          </label>
          {angle && <p>Modo angular detectado: {angle === 'deg' ? 'grados' : 'radianes'}.</p>}
          <div className="actions">
            <button className="primary">Confirmar y calcular</button>
            <button type="button" onClick={() => speech.hablar(mathSpeech(expression))}>
              Escuchar lo entendido
            </button>
            <button type="button" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
