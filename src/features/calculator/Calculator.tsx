import { useCallback, useEffect, useRef, useState } from 'react';
import type { AngleMode, CalculationResult, HistoryEntry, Preferences } from '../../types';
import { CalculatorClient } from '../../services/CalculatorClient';
import { preferencesService } from '../../services/PreferencesService';
import { historyService } from '../../services/HistoryService';
import { storage } from '../../services/StorageService';
import { speech } from '../../services/SpeechService';
import { mathSpeech } from '../../accessibility/MathSpeechFormatter';
import { handleKeyboard } from '../../accessibility/KeyboardManager';
import { Settings } from '../../components/Settings';
import { History } from '../../components/History';
import { Tools } from '../../components/Tools';

const client = new CalculatorClient();
const welcome =
  'Bienvenido a MathVoice. Escribí una operación y presioná Enter para calcular. Control más Enter lee la expresión. Escape detiene la voz. Tab recorre los controles. F1 abre la ayuda.';
const angleNames = { rad: 'radianes', deg: 'grados', grad: 'gradianes' };

export function Calculator() {
  const [preferences, setPreferences] = useState(preferencesService.load);
  const [entries, setEntries] = useState(historyService.load);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [storageWarning, setStorageWarning] = useState(storage.warning);
  const [explanation, setExplanation] = useState(false);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const computing = useRef(false);
  const currentEntries = useRef(entries);

  useEffect(() => {
    speech.configure(preferences);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.fontSize = `${preferences.fontSize}px`;
    document.documentElement.style.setProperty('--leading', String(preferences.spacing));
  }, [preferences]);
  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      speech.detener();
    },
    [],
  );

  const announce = useCallback(
    (text: string, voice = true) => {
      setStatus(text);
      if (voice && preferences.guided) speech.hablar(text);
    },
    [preferences.guided],
  );
  const readExpression = useCallback(() => {
    speech.hablar(mathSpeech(input.current?.value ?? ''));
  }, []);
  const openHelp = useCallback(() => {
    setHelp(true);
    if (preferences.guided) speech.hablar(welcome);
    requestAnimationFrame(() => document.getElementById('help-title')?.focus());
  }, [preferences.guided]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) =>
      handleKeyboard(e, {
        stop: () => {
          clearTimeout(typingTimer.current);
          speech.detener();
        },
        read: readExpression,
        help: openHelp,
      });
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readExpression, openHelp]);

  function changePreferences(next: Preferences) {
    setPreferences(next);
    speech.configure(next);
    if (!preferencesService.save(next)) setStorageWarning(storage.warning);
  }
  function saveHistory(next: HistoryEntry[]) {
    currentEntries.current = next;
    setEntries(next);
    if (!historyService.save(next)) setStorageWarning(storage.warning);
  }
  function start(guided: boolean) {
    changePreferences({ ...preferences, welcomed: true, guided });
    if (guided) speech.hablar(welcome);
    input.current?.focus();
  }
  function insert(value: string) {
    const el = input.current;
    const start = el?.selectionStart ?? expression.length;
    const end = el?.selectionEnd ?? start;
    setExpression(expression.slice(0, start) + value + expression.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + value.length, start + value.length);
    });
  }
  async function calculate(value = expression, angle: AngleMode = preferences.angle) {
    if (computing.current) return;
    computing.current = true;
    clearTimeout(typingTimer.current);
    setBusy(true);
    setError('');
    setExplanation(false);
    announce('Calculando.', false);
    try {
      const calculated = await client.evaluate(value, angle);
      setResult(calculated);
      const entry = { ...calculated, id: crypto.randomUUID(), date: new Date().toISOString() };
      saveHistory([entry, ...currentEntries.current].slice(0, 100));
      announce(`Resultado: ${mathSpeech(calculated.value)}.`, preferences.autoRead);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No pude completar el cálculo.';
      setError(message);
      setStatus('');
      if (preferences.guided) speech.hablar(message);
      input.current?.focus();
    } finally {
      computing.current = false;
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      announce('Resultado copiado.');
    } catch {
      announce('No pude copiar automáticamente. Seleccioná el texto del resultado para copiarlo.');
    }
  }
  function edit(entry: HistoryEntry) {
    setExpression(entry.expression);
    changePreferences({ ...preferences, angle: entry.angleMode });
    input.current?.focus();
    announce('Cálculo listo para editar.');
  }

  return (
    <div
      className={preferences.maximum ? 'app maximum' : 'app'}
      onFocusCapture={(e) => {
        if (!preferences.guided || !preferences.readFocus) return;
        const target = e.target as HTMLElement;
        if (!target.matches('button, input, select, summary')) return;
        const label =
          target.getAttribute('aria-label') ||
          (target instanceof HTMLInputElement || target instanceof HTMLSelectElement
            ? Array.from(target.labels ?? [])
                .map((l) => l.textContent)
                .join(' ')
            : target.textContent);
        if (label) speech.hablar(label);
      }}
    >
      <a className="skip-link" href="#expression">
        Saltar a la calculadora
      </a>
      <header className="header">
        <a href="#expression" className="brand" aria-label="MathVoice, ir a la calculadora">
          <span className="brand-icon" aria-hidden="true">
            ∑
          </span>
          <span>
            Math<span className="brand-light">Voice</span>
          </span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#history">Historial</a>
          <button ref={helpButton} onClick={openHelp}>
            Ayuda <kbd>F1</kbd>
          </button>
        </nav>
      </header>
      <main>
        <div className="voice-bar">
          <span>
            {!speech.available
              ? 'Síntesis de voz no disponible en este navegador'
              : preferences.guided
                ? 'Guía por voz activada'
                : 'Guía por voz desactivada'}
          </span>
          <button
            onClick={() => {
              clearTimeout(typingTimer.current);
              speech.detener();
            }}
          >
            Detener voz <kbd>Esc</kbd>
          </button>
        </div>
        {!preferences.welcomed && (
          <section className="welcome" aria-labelledby="welcome-title">
            <div>
              <h1 id="welcome-title">Bienvenido a MathVoice.</h1>
              <p>¿Querés activar la guía por voz?</p>
            </div>
            <div className="actions">
              <button className="primary" disabled={!speech.available} onClick={() => start(true)}>
                Activar guía por voz
              </button>
              <button onClick={() => start(false)}>Continuar sin guía</button>
            </div>
          </section>
        )}
        {help && (
          <section className="panel help" aria-labelledby="help-title">
            <h2 id="help-title" tabIndex={-1}>
              Ayuda accesible
            </h2>
            <p>{welcome}</p>
            <ul>
              <li>Enter en el campo: calcular.</li>
              <li>Ctrl + Enter: escuchar expresión.</li>
              <li>Alt + Shift + R: ir al resultado.</li>
              <li>Alt + Shift + H: ir al historial.</li>
              <li>F1: abrir ayuda. Escape: detener voz.</li>
            </ul>
            <p>
              Usá punto para decimales y coma entre argumentos. Por ejemplo: log(8,2). Las funciones
              inversas respetan el modo angular. El historial conserva el modo original de cada
              cálculo.
            </p>
            <button
              onClick={() => {
                setHelp(false);
                helpButton.current?.focus();
              }}
            >
              Cerrar ayuda
            </button>
          </section>
        )}
        {storageWarning && <p className="warning">{storageWarning}</p>}
        <div className="workspace">
          <section className="calculator panel" aria-labelledby="calculator-title">
            <p className="eyebrow">TU ESPACIO MATEMÁTICO</p>
            <h2 id="calculator-title">Escribí un cálculo.</h2>
            <p className="intro">Con teclado, a tu ritmo. Con voz, si lo preferís.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void calculate();
              }}
            >
              <label className="expression-label" htmlFor="expression">
                Expresión matemática
              </label>
              <input
                ref={input}
                id="expression"
                className="expression"
                value={expression}
                maxLength={500}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={error ? 'expression-hint calculation-error' : 'expression-hint'}
                aria-invalid={!!error}
                placeholder="Ej.: sqrt(25) + sin(pi/2)"
                onChange={(e) => {
                  const value = e.target.value;
                  setExpression(value);
                  setError('');
                  clearTimeout(typingTimer.current);
                  if (preferences.guided && preferences.readTyping)
                    typingTimer.current = setTimeout(() => speech.hablar(mathSpeech(value)), 900);
                }}
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter') e.preventDefault();
                  if (
                    preferences.guided &&
                    preferences.readKeys &&
                    e.key.length === 1 &&
                    !e.ctrlKey &&
                    !e.altKey
                  )
                    speech.hablar(mathSpeech(e.key));
                }}
              />
              <p className="hint" id="expression-hint">
                Enter para calcular · Punto para decimales · Paréntesis para agrupar
              </p>
              <div className="actions main-actions">
                <button type="submit" className="primary" aria-disabled={busy}>
                  {busy ? 'Calculando…' : 'Calcular'} <span aria-hidden="true">↵</span>
                </button>
                <button type="button" disabled={!speech.available} onClick={readExpression}>
                  Escuchar expresión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpression('');
                    setError('');
                    input.current?.focus();
                  }}
                >
                  Limpiar
                </button>
              </div>
              <label className="angle-label">
                Modo angular
                <select
                  value={preferences.angle}
                  onChange={(e) => {
                    const angle = e.target.value as AngleMode;
                    changePreferences({ ...preferences, angle });
                    announce(`Modo angular: ${angleNames[angle]}.`);
                  }}
                >
                  <option value="rad">Radianes</option>
                  <option value="deg">Grados</option>
                  <option value="grad">Gradianes</option>
                </select>
              </label>
            </form>
            <div
              id="calculation-error"
              role="alert"
              aria-atomic="true"
              className={error ? 'error' : 'sr-only'}
            >
              {error}
            </div>
            <div className="examples">
              <span>Probá un ejemplo</span>
              <div className="actions">
                {['1/3 + 1/6', 'sqrt(144)', '2^10'].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setExpression(example);
                      input.current?.focus();
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="result panel" aria-labelledby="result-title">
            <p className="eyebrow">EL RESULTADO, CLARO</p>
            <h2 id="result-title" tabIndex={-1}>
              Resultado
            </h2>
            {result ? (
              <>
                <p className="result-expression">{result.expression}</p>
                <p className="result-value" aria-label={`Resultado: ${result.value}`}>
                  {result.value}
                </p>
                {result.decimal && (
                  <p>
                    Aproximación decimal: <strong>{result.decimal}</strong>
                  </p>
                )}
                <p className="hint">
                  {result.kind} · {angleNames[result.angleMode]}
                  <br />
                  Guardado en tu historial local.
                </p>
                <div className="actions">
                  <button
                    disabled={!speech.available}
                    onClick={() => speech.hablar(`Resultado: ${mathSpeech(result.value)}`)}
                  >
                    Escuchar resultado
                  </button>
                  <button onClick={() => void copy(result.value)}>Copiar resultado</button>
                  <button
                    onClick={() => {
                      setExplanation(!explanation);
                      if (preferences.guided && !explanation) speech.hablar(result.explanation);
                    }}
                    aria-expanded={explanation}
                  >
                    Explicar resultado
                  </button>
                </div>
                {explanation && (
                  <div className="explanation">
                    <h3>Método de cálculo</h3>
                    <p>{result.explanation}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="result-empty">
                <span aria-hidden="true">=</span>
                <p>Todo empieza con una expresión.</p>
                <p className="hint">
                  El resultado aparecerá acá.
                  <br />
                  Podés escucharlo y volver a usarlo.
                </p>
              </div>
            )}
          </section>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
        </div>
        <Tools insert={insert} />
        <Settings preferences={preferences} change={changePreferences} />
        <History
          entries={entries}
          edit={edit}
          recalculate={(entry) => {
            edit(entry);
            void calculate(entry.expression, entry.angleMode);
          }}
          remove={(id) => {
            saveHistory(entries.filter((e) => e.id !== id));
            announce('Cálculo eliminado.');
          }}
          clear={() => {
            saveHistory([]);
            announce('Historial vacío.');
          }}
          speak={(text) => speech.hablar(mathSpeech(text))}
          copy={(text) => void copy(text)}
        />
      </main>
      <footer>
        <span>MathVoice · Primera etapa</span>
        <span>Cálculos locales. Sin cuenta.</span>
      </footer>
    </div>
  );
}
