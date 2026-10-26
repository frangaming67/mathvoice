import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AngleMode,
  CalculationResult,
  DecimalSeparator,
  EvaluateOptions,
  HistoryEntry,
  Preferences,
} from '../../types';
import { CalculatorClient } from '../../services/CalculatorClient';
import { preferencesService } from '../../services/PreferencesService';
import { historyRemovalMessage, historyService } from '../../services/HistoryService';
import { storage } from '../../services/StorageService';
import { pointerHint, speech } from '../../services/SpeechService';
import { mathSpeech } from '../../accessibility/MathSpeechFormatter';
import { handleKeyboard } from '../../accessibility/KeyboardManager';
import { Settings } from '../../components/Settings';
import { History } from '../../components/History';
import { Tools } from '../../components/Tools';
import { CalculatorKeys } from '../../components/CalculatorKeys';
import { ValueTable } from '../../components/ValueTable';
import { LcdPanel, type LcdItem, type LcdPanelHandle } from '../../components/LcdPanel';
import { KeyPrompt, type PromptRequest } from '../../components/KeyPrompt';
import { ExpressionExplorer, type ExplorerRequest } from '../../components/ExpressionExplorer';
import { Tutorial } from '../../components/Tutorial';
import { tutorialSteps } from '../tutorial/steps';
import { explorerTree } from '../../accessibility/expressionExplorer';
import type { CalculatorKey, KeyFace, Layer } from '../../calculator/keys';
import {
  engineering,
  engineeringStart,
  factorExpression,
  fillSeparators,
  freeVariables,
  mixedFraction,
  readNumber,
  toDms,
} from '../../calculator/display';
import { calculatorModes } from '../../calculator/modes';
import { physicalConstants } from '../../services/PhysicalConstants';
import { formatNumber, fractionName } from '../../accessibility/numberSpeech';
import { AdvancedCalculator, type AdvancedHandle } from '../../components/AdvancedCalculator';
import { describeElement, useAutomaticSpeech } from '../../accessibility/useAutomaticSpeech';
import { FeatureHub } from '../../components/FeatureHub';
import { variableService } from '../../services/VariableService';
import { resultSpeech } from '../../accessibility/resultSpeech';
import { keySpeech } from '../../accessibility/symbolSpeech';
import {
  describeBalance,
  describeCaret,
  describeClosing,
  describeDeletion,
  matchingParen,
  readFromCaret,
  speakCharAt,
  tokenAt,
} from '../../accessibility/editingAids';
import { toLatex, toMathML } from '../../accessibility/mathml';
import { MathView } from '../../components/MathView';
import { captureFocus, restoreFocus, type FocusSnapshot } from '../../keyboard/focusSnapshot';
import { Dictation } from '../../components/Dictation';
import { OfflineStatus } from '../../components/OfflineStatus';
import { convertSeparator } from '../../parser/expression';
import { downloadHistory } from '../../services/ExportService';
import { CalculationSteps } from '../../components/CalculationSteps';
import { ToolsPage } from '../../components/ToolsPage';
import { toolName, type ToolId } from '../../components/toolCatalog';
import { KeyboardCommandManager } from '../../keyboard/KeyboardCommandManager';
import { keyboardSettingsService, type KeyboardSettings } from '../../keyboard/KeyboardSettings';
import { commandById, type MathCommand } from '../../keyboard/commands';
import { CommandBus } from '../../keyboard/CommandBus';
import { CommandContext } from '../../keyboard/CommandContext';
import { EditHistory } from '../../keyboard/EditHistory';
import { KeyboardPanel } from '../../components/KeyboardPanel';
import { CommandPalette } from '../../components/CommandPalette';
import { FunctionPrompt } from '../../components/FunctionPrompt';
import { feedbackSound } from '../../services/FeedbackSoundService';

const client = new CalculatorClient();
const welcome =
  'Bienvenido a MathVoice. Escribí una operación y presioná Enter para calcular. Control más Enter lee la expresión. Escape detiene la voz. Tab recorre los controles. F1 abre la ayuda.';
const angleNames = { rad: 'radianes', deg: 'grados', grad: 'gradianes' };
type ToolCalculationState = {
  result: CalculationResult | null;
  error: string;
  explanation: boolean;
};
const emptyCalculation: ToolCalculationState = { result: null, error: '', explanation: false };

export function Calculator() {
  const [preferences, setPreferences] = useState(preferencesService.load);
  const [keyboard, setKeyboard] = useState(keyboardSettingsService.load);
  // Cómo se dicen los resultados: nivel de detalle y cifras habladas.
  const speechOptions = useMemo(
    () => ({
      verbosity: keyboard.verbosity,
      spokenDigits: preferences.spokenDigits,
      decimalSeparator: preferences.decimalSeparator,
    }),
    [keyboard.verbosity, preferences.spokenDigits, preferences.decimalSeparator],
  );
  // Preferencias numéricas que viajan a cada cálculo.
  const numberOptions = useMemo(
    () => ({
      decimalSeparator: preferences.decimalSeparator,
      numberMode: preferences.numberMode,
      resultForm: preferences.resultForm,
      numberFormat: preferences.numberFormat,
      numberDigits: preferences.numberDigits,
    }),
    [
      preferences.decimalSeparator,
      preferences.numberMode,
      preferences.resultForm,
      preferences.numberFormat,
      preferences.numberDigits,
    ],
  );
  // Último resultado numérico, para «ans» o «resultado» dentro de una expresión.
  const lastAnswer = useRef<{ value: string; separator: DecimalSeparator } | null>(null);
  // El resultado anterior a Ans, para PreAns.
  const previousAnswer = useRef<{ value: string; separator: DecimalSeparator } | null>(null);
  // Calculadora de mano: capa Shift o Alpha, STO pendiente, sobrescritura, pantalla apagada,
  // otra forma del resultado (S⇔D, ENG, °′″, FACT, a b/c) y panel dentro de la pantalla.
  const [layer, setLayer] = useState<Layer>('main');
  const [storing, setStoring] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [off, setOff] = useState(false);
  const [alternate, setAlternate] = useState<{
    kind: 'sd' | 'eng' | 'dms' | 'fact' | 'mixed';
    expression?: string;
    mathml?: string;
    spoken: string;
    exponent?: number;
  } | null>(null);
  const [lcdPanel, setLcdPanel] = useState<null | 'menu' | 'constants' | 'variables' | 'reset'>(
    null,
  );
  const [keyPrompt, setKeyPrompt] = useState<PromptRequest | null>(null);
  const [explorer, setExplorer] = useState<ExplorerRequest | null>(null);
  // Primeros pasos: el paso en curso, o null si el recorrido no está activo.
  const [tutorial, setTutorial] = useState<number | null>(null);
  const [withTutorial, setWithTutorial] = useState(false);
  const explorerOrigin = useRef<HTMLElement | null>(null);
  const explorerSelected = useRef(false);
  const panelRef = useRef<LcdPanelHandle>(null);
  // Posición al recorrer cálculos anteriores con la cruceta: -1 es la expresión propia.
  const replay = useRef(-1);
  /** Un valor calculado antes, escrito con el separador que se usa ahora. */
  const reusable = (value: string, separator: DecimalSeparator = 'punto') =>
    convertSeparator(value, separator, preferences.decimalSeparator);
  const [keyboardManager] = useState(() => new KeyboardCommandManager());
  const [commandBus] = useState(() => new CommandBus());
  const [editHistory] = useState(() => new EditHistory());
  const [palette, setPalette] = useState(false);
  const [functionPrompt, setFunctionPrompt] = useState<MathCommand | null>(null);
  const [practice, setPractice] = useState<{
    mode: 'identify' | 'training';
    category: string;
  } | null>(null);
  const [vectorContext, setVectorContext] = useState<'vectors' | 'complex'>('vectors');
  const dialogOrigin = useRef<HTMLElement | null>(null);
  // Campo y cursor antes de abrir la paleta o un diálogo de función: al cerrarse un <dialog>,
  // Chrome deja el cursor en 0 y la función terminaba al principio de la expresión.
  const dialogSelection = useRef<FocusSnapshot | null>(null);
  const guidedVoice = useRef(false);
  const lastCalculation = useRef<
    Partial<
      Record<
        ToolId,
        {
          value: string;
          angle: AngleMode;
          scope: Record<string, number>;
        }
      >
    >
  >({});
  const [entries, setEntries] = useState(historyService.load);
  const [historySaved, setHistorySaved] = useState(true);
  const [variables, setVariables] = useState(variableService.load);
  const [expression, setExpression] = useState('');
  const [calculations, setCalculations] = useState<Partial<Record<ToolId, ToolCalculationState>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [announcementId, setAnnouncementId] = useState(0);
  const [storageWarning, setStorageWarning] = useState(storage.warning);
  const pendingStorageWarning = useRef('');
  const [help, setHelp] = useState(false);
  const [view, setView] = useState<'work' | 'tools' | 'history' | 'settings' | 'keyboard'>('work');
  const [activeTool, setActiveTool] = useState<ToolId>('basic');
  // Cada vista dice dónde estás: es el h1 y el título de la pestaña.
  const viewTitle = help
    ? 'Ayuda'
    : view === 'tools'
      ? 'Herramientas'
      : view === 'history'
        ? 'Historial'
        : view === 'settings'
          ? 'Configuración'
          : view === 'keyboard'
            ? 'Teclado y atajos'
            : toolName(activeTool);
  // Basic and scientific are two views of the same expression form.
  const calculationKey = activeTool === 'scientific' ? 'basic' : activeTool;
  // Calcular (y Funciones) usa la pantalla LCD; los demás modos muestran su herramienta.
  const inCalculator = activeTool === 'basic' || activeTool === 'scientific';
  const { result, error, explanation } = calculations[calculationKey] ?? emptyCalculation;
  function updateCalculation(patch: Partial<ToolCalculationState>, tool = calculationKey) {
    setCalculations((previous) => ({
      ...previous,
      [tool]: { ...emptyCalculation, ...previous[tool], ...patch },
    }));
  }
  const setError = (error: string) => updateCalculation({ error });
  // Lo que se dice y se copia del resultado: se calcula una vez por resultado, no en cada tecla.
  const resultView = useMemo(() => {
    if (!result) return null;
    const structured = !!(result.table || result.matrix);
    return {
      spoken: resultSpeech(result, speechOptions),
      expressionSpoken: mathSpeech(result.expression, speechOptions),
      latex: structured ? null : toLatex(result.value, speechOptions),
      mathml: structured ? null : toMathML(result.value, speechOptions),
    };
  }, [result, speechOptions]);
  const [visited, setVisited] = useState<ToolId[]>(['basic']);
  const focusFrame = useRef<number | undefined>(undefined);
  const helpOrigin = useRef<HTMLElement | null>(null);
  const lastField = useRef<HTMLElement | null>(null);
  const calculationOrigin = useRef<
    Partial<Record<ToolId, { tool: ToolId; field: HTMLElement | null }>>
  >({});
  const [listening, setListening] = useState(false);
  const advanced = useRef<AdvancedHandle>(null);
  const [graphRequest, setGraphRequest] = useState<{ id: number; expression: string }>();
  const [memory, setMemory] = useState(() =>
    storage.read(
      'memory',
      '0',
      (v): v is string => typeof v === 'string' && /^[-\d.e+/* ()]+$/.test(v),
    ),
  );
  const memoryBusy = useRef(false);
  const justCalculated = useRef(false);
  const automatic = useAutomaticSpeech(preferences, listening || !!practice);
  const cancelAutomatic = automatic.cancel;
  const input = useRef<HTMLInputElement>(null);
  /** La parte de la pantalla donde se muestra la herramienta del modo elegido. */
  const appArea = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLAnchorElement>(null);
  const welcomeDialog = useRef<HTMLDialogElement>(null);
  const welcomeSpoken = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const computing = useRef(false);
  const currentEntries = useRef(entries);
  const focusTarget = useCallback((id: string) => {
    if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, []);
  useLayoutEffect(() => {
    if (practice && view === 'keyboard' && !help) document.getElementById('practice-area')?.focus();
  }, [practice, view, help]);
  const openTool = useCallback(
    (tool: ToolId, target = 'view-title') => {
      keyboardManager.cancelSequence();
      commandBus.cancelPending();
      cancelAutomatic();
      speech.detener();
      setHelp(false);
      setView('work');
      setActiveTool(tool);
      setVisited((previous) => (previous.includes(tool) ? previous : [...previous, tool]));
      focusTarget(target);
    },
    [cancelAutomatic, focusTarget, keyboardManager, commandBus],
  );
  const navigate = useCallback(
    (
      target:
        'basic' | 'tools' | 'result' | 'history' | 'graphs' | 'matrices' | 'dictation' | 'settings',
    ) => {
      cancelAutomatic();
      keyboardManager.cancelSequence();
      commandBus.cancelPending();
      speech.detener();
      setHelp(false);
      if (target === 'history' || target === 'settings') {
        setView(target);
        focusTarget('view-title');
      } else if (target === 'tools') {
        setView('tools');
        focusTarget(`tool-item-${activeTool}`);
      } else if (target === 'result') {
        setView('work');
        focusTarget('result-title');
      } else if (target === 'dictation') {
        openTool('basic', 'dictation-button');
        requestAnimationFrame(() => document.getElementById('dictation-button')?.click());
      } else openTool(target, target === 'basic' ? 'expression' : 'view-title');
    },
    [cancelAutomatic, focusTarget, openTool, keyboardManager, commandBus, activeTool],
  );

  useEffect(() => {
    speech.configure(preferences);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.fontSize = `${preferences.fontSize}px`;
    document.documentElement.style.setProperty('--leading', String(preferences.spacing));
    document.documentElement.style.setProperty('--ui-scale', String(preferences.scale));
    document.documentElement.dataset.enlarged = String(preferences.scale > 1);
  }, [preferences]);
  useEffect(() => {
    document.title = `${viewTitle} — MathVoice`;
  }, [viewTitle]);
  useEffect(() => {
    guidedVoice.current = preferences.guided;
  }, [preferences.guided]);
  // Otra pestaña guardó cálculos: se suman a esta sin pisar lo que se hizo acá.
  useEffect(
    () =>
      historyService.subscribe((next) => {
        currentEntries.current = next;
        setEntries(next);
      }),
    [],
  );
  useEffect(() => {
    feedbackSound.configure({ enabled: keyboard.sounds, volume: keyboard.soundVolume });
  }, [keyboard.sounds, keyboard.soundVolume]);
  // El cursor guardado vale solo mientras la paleta o el diálogo de función siguen abiertos:
  // si se elige otro comando, no debe mover una inserción posterior.
  useEffect(() => {
    if (!palette && !functionPrompt) dialogSelection.current = null;
  }, [palette, functionPrompt]);
  // Primera visita: diálogo de bienvenida con el foco adentro. Después, directo al campo.
  const firstVisit = useRef(!preferences.welcomed);
  useEffect(() => {
    const dialog = welcomeDialog.current;
    if (!firstVisit.current) focusTarget('expression');
    else if (dialog && !dialog.open) dialog.showModal();
  }, [focusTarget]);
  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      speech.detener();
      keyboardManager.dispose();
      commandBus.cancelPending();
      feedbackSound.stop();
      if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    },
    [keyboardManager, commandBus],
  );

  const announce = useCallback(
    // live: false deja el mensaje solo para la guía por voz (el lector ya lo obtiene del foco).
    (text: string, voice = true, live = true) => {
      const warning = pendingStorageWarning.current;
      pendingStorageWarning.current = '';
      const message = [text, warning].filter(Boolean).join(' ');
      setStatus(message);
      setAnnouncementId((previous) => previous + 1);
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (dialog && live && !guidedVoice.current) {
        let region = dialog.querySelector<HTMLElement>(':scope > .dialog-status');
        if (!region) {
          region = document.createElement('p');
          region.className = 'sr-only dialog-status';
          region.setAttribute('role', 'status');
          dialog.append(region);
        }
        region.textContent = '';
        requestAnimationFrame(() => {
          if (region) region.textContent = message;
        });
      }
      if (voice || warning) {
        cancelAutomatic();
        speech.hablarAutomatico(message);
      }
    },
    [cancelAutomatic],
  );
  // Lectura pedida (Ctrl+Enter, «Escuchar…», «; R»): con la guía la dice la voz de MathVoice;
  // con lector de pantalla va a la región viva, así la lee el lector y llega a la línea braille.
  const explicitRead = useCallback(
    (message: string) => {
      cancelAutomatic();
      announce(message);
    },
    [cancelAutomatic, announce],
  );
  function reportStorageFailure() {
    setStorageWarning(storage.warning);
    pendingStorageWarning.current = storage.warning;
    // Merge with the action's announcement, or announce alone when it has none.
    queueMicrotask(() => {
      if (pendingStorageWarning.current) announce('');
    });
  }
  const readExpression = useCallback(() => {
    const draft = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '[data-expression], #expression',
      ),
    ).find((element) => element.getClientRects().length)?.value;
    const balance = draft ? describeBalance(draft) : '';
    explicitRead(
      draft
        ? `${mathSpeech(draft, { decimalSeparator: preferences.decimalSeparator })}${balance ? `. ${balance}` : ''}`
        : 'No hay expresión visible en esta sección.',
    );
  }, [explicitRead, preferences.decimalSeparator]);
  const openHelp = useCallback(() => {
    if (help) return;
    helpOrigin.current = document.activeElement as HTMLElement;
    setHelp(true);
    focusTarget('view-title');
  }, [focusTarget, help]);
  function closeHelp() {
    setHelp(false);
    requestAnimationFrame(() =>
      (helpOrigin.current?.isConnected && helpOrigin.current.getClientRects().length
        ? helpOrigin.current
        : helpButton.current
      )?.focus(),
    );
  }
  // El contenido de la vista: el campo en la calculadora, el título en las demás.
  function skipToContent() {
    if (!help && view === 'work' && ['basic', 'scientific'].includes(activeTool))
      input.current?.focus();
    else document.getElementById('view-title')?.focus();
  }
  // La síntesis necesita un gesto: la primera tecla en la bienvenida explica las opciones.
  function welcomeKey() {
    if (welcomeSpoken.current || !speech.available) return;
    welcomeSpoken.current = true;
    speech.hablar(
      'Bienvenido a MathVoice. Enter activa la guía por voz. Tab pasa a Usar mi lector de pantalla.',
    );
  }
  function changePreferences(next: Preferences) {
    cancelAutomatic();
    clearTimeout(typingTimer.current);
    setPreferences(next);
    speech.configure(next);
    const saved = preferencesService.save(next);
    if (!saved) reportStorageFailure();
    return saved;
  }
  function saveHistory(next: HistoryEntry[]) {
    currentEntries.current = next;
    setEntries(next);
    const saved = historyService.save(next);
    setHistorySaved(saved);
    if (!saved) reportStorageFailure();
  }
  function start(guided: boolean) {
    const saved = changePreferences({
      ...preferences,
      welcomed: true,
      guided,
      readFocus: true,
      readHover: true,
    });
    const warning = saved ? '' : ` ${storage.warning}`;
    firstVisit.current = false;
    welcomeDialog.current?.close();
    input.current?.focus();
    openTool('basic', 'expression');
    // iOS solo habilita la voz si la primera locución ocurre dentro de este clic.
    if (guided) speech.unlock();
    if (withTutorial) {
      spokenStep.current = 0;
      setTutorial(0);
    }
    requestAnimationFrame(() => {
      automatic.cancel();
      const intro = withTutorial ? tutorialIntro(0) : '';
      if (guided)
        speech.hablarLista(
          [`${welcome} ${pointerHint()}${warning}`, intro].filter(Boolean),
          () => {},
        );
      else if (intro) announce(intro);
    });
  }
  // ---------- Primeros pasos ----------
  function tutorialIntro(step: number) {
    const current = tutorialSteps[step];
    return `Primeros pasos, paso ${step + 1} de ${tutorialSteps.length}: ${current.title}. ${current.text}`;
  }
  function startTutorial() {
    setHelp(false);
    openTool('basic', 'expression');
    setTutorial(0);
  }
  function skipTutorialStep() {
    if (tutorial === null) return;
    const next = Math.min(tutorial + 1, tutorialSteps.length - 1);
    setTutorial(next);
  }
  function finishTutorial() {
    setTutorial(null);
    announce('Recorrido terminado. F1 abre la ayuda, y desde ahí podés volver a hacerlo.');
    focusEntry();
  }
  function insert(value: string, focus = true) {
    justCalculated.current = false;
    const el = input.current;
    const saved = dialogSelection.current?.element === el ? dialogSelection.current : null;
    dialogSelection.current = null;
    const start = saved?.start ?? el?.selectionStart ?? expression.length;
    const end = saved?.end ?? el?.selectionEnd ?? start;
    setExpression(expression.slice(0, start) + value + expression.slice(end));
    requestAnimationFrame(() => {
      if (focus) {
        openTool('basic', 'expression');
      }
      el?.setSelectionRange(start + value.length, start + value.length);
    });
  }
  function keypadInsert(value: string) {
    automatic.cancel();
    setError('');
    if (justCalculated.current) {
      const previous =
        result && ['Básico', 'Científico'].includes(result.kind)
          ? `(${reusable(result.value, result.separator)})`
          : '';
      const next = /^[+*/^%-]/.test(value) ? previous + value : value;
      setExpression(next);
      requestAnimationFrame(() => input.current?.setSelectionRange(next.length, next.length));
    } else insert(value, false);
    justCalculated.current = false;
    if (preferences.guided)
      speech.hablarAutomatico(
        (
          {
            '+': 'Más',
            '-': 'Menos',
            '*': 'Por',
            '/': 'Dividido por',
            '.': 'Punto decimal',
            ',': preferences.decimalSeparator === 'coma' ? 'Coma decimal' : 'Coma',
            '%': 'Por ciento',
            '(': 'Abre paréntesis',
            ')': 'Cierra paréntesis',
            '^2': 'Al cuadrado',
          } as Record<string, string>
        )[value] ?? mathSpeech(value),
      );
  }
  function erase() {
    const start = input.current?.selectionStart ?? expression.length;
    const end = input.current?.selectionEnd ?? start;
    const from = start === end ? Math.max(0, start - 1) : start;
    setExpression(expression.slice(0, from) + expression.slice(end));
    setError('');
    justCalculated.current = false;
    requestAnimationFrame(() => input.current?.setSelectionRange(from, from));
  }
  function clear() {
    setExpression('');
    updateCalculation({ result: null, error: '', explanation: false });
    justCalculated.current = false;
  }
  async function memoryAction(action: 'clear' | 'recall' | 'add' | 'subtract') {
    automatic.cancel();
    if (action === 'recall') {
      if (inCalculator) keypadInsert(`(${reusable(memory)})`);
      else fieldInsert(`(${reusable(memory)})`);
      return;
    }
    if (memoryBusy.current) return;
    let next = '0';
    if (action !== 'clear') {
      if (!result || !['Básico', 'Científico'].includes(result.kind)) {
        announce('Calculá un resultado numérico antes de usar M más o M menos.');
        return;
      }
      memoryBusy.current = true;
      // La memoria se guarda con punto: así sirve aunque después cambie el separador.
      const added = convertSeparator(result.value, result.separator ?? 'punto', 'punto');
      try {
        next = (
          await client.evaluate(`(${memory})${action === 'add' ? '+' : '-'}(${added})`, {
            ...numberOptions,
            decimalSeparator: 'punto',
            angle: preferences.angle,
          })
        ).value;
      } catch {
        announce('No pude guardar este resultado en memoria. Usá un número real finito.');
        return;
      } finally {
        memoryBusy.current = false;
      }
    }
    setMemory(next);
    if (!storage.write('memory', next)) reportStorageFailure();
    announce(`Memoria: ${mathSpeech(next)}.`);
  }
  async function calculate(
    value = expression,
    angle: AngleMode = preferences.angle,
    scope = variables,
    options: Partial<EvaluateOptions> = {},
  ) {
    if (computing.current) return;
    computing.current = true;
    setAlternate(null);
    replay.current = -1;
    const targetTool = view === 'history' ? 'basic' : calculationKey;
    lastCalculation.current[targetTool] = { value, angle, scope: { ...scope } };
    const focused = document.activeElement as HTMLElement | null;
    const origin =
      (focused?.matches('input, textarea')
        ? focused
        : focused?.closest('form')?.querySelector<HTMLElement>('input, textarea')) ??
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.workspace input:not([type=checkbox]), .workspace textarea',
        ),
      ).find((field) => field.getClientRects().length) ??
      input.current;
    calculationOrigin.current[targetTool] = {
      tool: view === 'history' ? 'basic' : activeTool,
      field: view === 'history' ? input.current : origin,
    };
    automatic.cancel();
    clearTimeout(typingTimer.current);
    setBusy(true);
    updateCalculation({ error: '', explanation: false }, targetTool);
    announce('Calculando.', false);
    try {
      const answer = lastAnswer.current;
      const calculated = await client.evaluate(
        value,
        {
          ...numberOptions,
          angle,
          ans: answer ? reusable(answer.value, answer.separator) : undefined,
          ...options,
        },
        scope,
      );
      if (['Básico', 'Científico'].includes(calculated.kind) && !calculated.table) {
        previousAnswer.current = lastAnswer.current;
        lastAnswer.current = {
          value: calculated.value,
          separator: calculated.separator ?? 'punto',
        };
      }
      if (calculated.assigned) {
        const next = { ...variables, [calculated.assigned.name]: calculated.assigned.value };
        setVariables(next);
        if (!variableService.save(next)) reportStorageFailure();
      }
      updateCalculation({ result: calculated }, targetTool);
      if (targetTool === 'basic') justCalculated.current = true;
      const entry = { ...calculated, id: crypto.randomUUID(), date: new Date().toISOString() };
      saveHistory([entry, ...currentEntries.current].slice(0, 100));
      announce(`Resultado: ${resultSpeech(calculated, speechOptions)}.`, preferences.autoRead);
      void feedbackSound.play('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No pude completar el cálculo.';
      updateCalculation({ error: message }, targetTool);
      setStatus('');
      if (document.activeElement === focused) origin?.focus();
      automatic.cancel();
      if (preferences.guided) speech.hablarAutomatico(message);
      void feedbackSound.play('error');
    } finally {
      computing.current = false;
      setBusy(false);
    }
  }
  /** Una celda de la hoja de cálculo: con 15 cifras, para encadenar fórmulas sin perder precisión. */
  const evaluateCell = useCallback(
    (value: string, scope: Record<string, number>) =>
      client.evaluate(
        value,
        {
          ...numberOptions,
          angle: preferences.angle,
          resultForm: 'decimal',
          numberFormat: 'normal',
          numberDigits: 15,
        },
        { ...variables, ...scope },
      ),
    [numberOptions, preferences.angle, variables],
  );
  // Un paso cumplido pasa al siguiente en el mismo render; el efecto solo lo dice.
  const tutorialState = {
    expression,
    result: calculations.basic?.result?.value ?? null,
    tool: activeTool,
    explored: explorer !== null,
  };
  if (
    tutorial !== null &&
    tutorial < tutorialSteps.length - 1 &&
    tutorialSteps[tutorial].done(tutorialState)
  )
    setTutorial(tutorial + 1);
  const spokenStep = useRef<number | null>(null);
  useEffect(() => {
    const previous = spokenStep.current;
    spokenStep.current = tutorial;
    if (tutorial === null || tutorial === previous) return;
    // Si se llegó cumpliendo el paso anterior, primero se dice lo que se logró.
    const success =
      previous !== null && tutorial === previous + 1 && tutorialSteps[previous].done(tutorialState)
        ? `${tutorialSteps[previous].success} `
        : '';
    announce(`${success}${tutorialIntro(tutorial)}`);
    // Se dice una vez por paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial]);
  // ---------- Calculadora de mano ----------
  const argumentSeparator = preferences.decimalSeparator === 'coma' ? ';' : ',';
  /**
   * Escribe desde una tecla. Después de un resultado, un operador sigue con Ans (como la
   * calculadora de mano) y cualquier otra tecla empieza una cuenta nueva. «after» queda a la
   * derecha del cursor: si hay texto elegido, lo envuelve.
   */
  function deviceInsert(text: string, after = '', continues = true) {
    if (!inCalculator) return fieldInsert(text, after);
    automatic.cancel();
    setError('');
    setAlternate(null);
    replay.current = -1;
    const el = input.current;
    editHistory.record(expression);
    if (justCalculated.current) {
      justCalculated.current = false;
      const base = continues && !after && /^[+*/^%!-]/.test(text) ? 'ans' : '';
      const next = base + text + after;
      setExpression(next);
      const caret = base.length + text.length;
      requestAnimationFrame(() => el?.setSelectionRange(caret, caret));
      return;
    }
    const start = el?.selectionStart ?? expression.length;
    let end = el?.selectionEnd ?? start;
    // INS: la tecla escribe encima de lo que sigue en vez de correrlo.
    if (overwrite && end === start && !after)
      end = Math.min(expression.length, start + text.length);
    const selected = after ? expression.slice(start, end) : '';
    const next = expression.slice(0, start) + text + selected + after + expression.slice(end);
    setExpression(next);
    const caret = start + text.length + selected.length;
    requestAnimationFrame(() => el?.setSelectionRange(caret, caret));
  }
  function moveCaret(direction: 'left' | 'right') {
    const el = input.current;
    if (!el) return;
    const caret = el.selectionStart ?? expression.length;
    const next = Math.max(0, Math.min(expression.length, caret + (direction === 'left' ? -1 : 1)));
    el.setSelectionRange(next, next);
    justCalculated.current = false;
    announce(speakCharAt(expression, next));
  }
  // ---------- Los demás modos: el teclado escribe en la herramienta de la pantalla ----------
  const isTextField = (
    element: Element | null | undefined,
  ): element is HTMLInputElement | HTMLTextAreaElement =>
    (element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement &&
        ['text', 'search', 'number'].includes(element.type))) &&
    !element.disabled &&
    !element.readOnly &&
    !!element.getClientRects().length;
  const toolFields = () =>
    Array.from(appArea.current?.querySelectorAll('input, textarea') ?? []).filter(isTextField);
  /** Donde escribe el teclado: el último campo usado de la herramienta, o el primero. */
  function toolField() {
    const last = lastField.current;
    return last && appArea.current?.contains(last) && isTextField(last)
      ? last
      : (toolFields()[0] ?? null);
  }
  /** Cambia el valor como si se hubiera tecleado, así la herramienta se entera del cambio. */
  function typeInto(field: HTMLInputElement | HTMLTextAreaElement, value: string, caret?: number) {
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    if (caret !== undefined && field.type !== 'number') field.setSelectionRange(caret, caret);
  }
  // Un campo numérico borra «1.» mientras se escribe 1.5: lo pendiente se guarda aparte.
  const numberDraft = useRef(new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>());
  function fieldInsert(text: string, after = '') {
    const field = toolField();
    if (!field) return announce('Este modo no tiene un campo para escribir.');
    lastField.current = field;
    if (field.type === 'number') {
      const next =
        (numberDraft.current.get(field) ?? field.value) + (text + after).replace(',', '.');
      if (/^-?\d*\.?\d+(e-?\d+)?$/i.test(next)) {
        numberDraft.current.delete(field);
        typeInto(field, next);
      } else numberDraft.current.set(field, next);
      return;
    }
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const selected = after ? field.value.slice(start, end) : '';
    typeInto(
      field,
      field.value.slice(0, start) + text + selected + after + field.value.slice(end),
      start + text.length + selected.length,
    );
  }
  function fieldErase(all = false) {
    const field = toolField();
    if (!field) return announce('Este modo no tiene un campo para borrar.');
    numberDraft.current.delete(field);
    if (all || field.type === 'number') {
      typeInto(field, all ? '' : field.value.slice(0, -1), 0);
      if (all) announce('Campo vacío.');
      return;
    }
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const from = start === end ? Math.max(0, start - 1) : start;
    typeInto(field, field.value.slice(0, from) + field.value.slice(end), from);
  }
  function fieldCaret(direction: 'left' | 'right') {
    const field = toolField();
    if (!field || field.type === 'number') return;
    const caret = field.selectionStart ?? field.value.length;
    const next = Math.max(0, Math.min(field.value.length, caret + (direction === 'left' ? -1 : 1)));
    field.setSelectionRange(next, next);
    announce(speakCharAt(field.value, next));
  }
  /** ▲ y ▼ en una herramienta: el campo anterior o el siguiente. */
  function fieldStep(step: number) {
    const fields = toolFields();
    if (!fields.length) return announce('Este modo no tiene campos para recorrer.');
    const current = toolField();
    const index = Math.max(
      0,
      Math.min(fields.length - 1, (current ? fields.indexOf(current) : -1) + step),
    );
    lastField.current = fields[index];
    if (appArea.current?.contains(document.activeElement)) fields[index].focus();
    announce(describeElement(fields[index]));
  }
  /** «=» en una herramienta: lo mismo que su botón para calcular. */
  function submitTool() {
    const form =
      toolField()?.form ??
      Array.from(appArea.current?.querySelectorAll('form') ?? []).find(
        (candidate) => candidate.getClientRects().length,
      );
    if (!form) return announce('En este modo no hay nada para calcular con igual.');
    form.requestSubmit();
  }
  /** Después de un menú o un diálogo, el foco vuelve a donde se escribe en el modo actual. */
  function focusEntry() {
    requestAnimationFrame(() => (inCalculator ? input.current : toolField())?.focus());
  }
  /** Arriba y abajo de la cruceta traen los cálculos del historial a la pantalla. */
  function replayHistory(direction: 'previous' | 'next') {
    const list = currentEntries.current;
    const index = replay.current + (direction === 'previous' ? 1 : -1);
    if (index < 0) {
      replay.current = -1;
      setExpression('');
      justCalculated.current = false;
      announce('Expresión nueva.');
      return;
    }
    if (index >= list.length) {
      announce(
        list.length ? 'No hay cálculos más antiguos.' : 'Todavía no hay cálculos guardados.',
      );
      return;
    }
    replay.current = index;
    const entry = list[index];
    setExpression(entryExpression(entry));
    justCalculated.current = false;
    announce(
      `Cálculo ${index + 1} de ${list.length}: ${mathSpeech(entry.expression, {
        decimalSeparator: entry.separator ?? 'punto',
      })}, igual a ${resultSpeech(entry, { ...speechOptions, decimalSeparator: entry.separator ?? 'punto' })}.`,
    );
  }
  /** Número real del resultado actual (su forma decimal si es una fracción). */
  function resultNumber() {
    if (!result) return null;
    return readNumber(result.decimal ?? result.value, result.separator ?? 'punto');
  }
  function showAlternate(next: NonNullable<typeof alternate>, title: string) {
    setAlternate(next);
    announce(`${title}: ${next.spoken}.`);
  }
  function backToResult() {
    setAlternate(null);
    if (resultView) announce(`Resultado: ${resultView.spoken}.`);
  }
  function toggleForm() {
    if (!result) return announce('Todavía no hay un resultado.');
    if (alternate?.kind === 'sd') return backToResult();
    const other = result.decimal ?? result.exact;
    if (!other) return announce('Este resultado no tiene otra forma.');
    showAlternate(
      {
        kind: 'sd',
        expression: other,
        spoken: resultSpeech(
          { ...result, value: other, decimal: undefined, exact: undefined },
          speechOptions,
        ),
      },
      result.decimal ? 'Decimal' : 'Forma exacta',
    );
  }
  function showEngineering(direction: 1 | -1) {
    const value = resultNumber();
    if (value === null) return announce('ENG funciona con resultados numéricos reales.');
    const exponent =
      alternate?.kind === 'eng' && alternate.exponent !== undefined
        ? alternate.exponent - 3 * direction
        : engineeringStart(value);
    const shown = engineering(value, exponent, preferences.decimalSeparator);
    showAlternate(
      {
        kind: 'eng',
        expression: shown.expression,
        exponent,
        spoken: mathSpeech(shown.expression, { decimalSeparator: preferences.decimalSeparator }),
      },
      'Notación de ingeniería',
    );
  }
  /** °′″: con un número recién calculado lo muestra en grados, minutos y segundos; si no, los escribe. */
  function degreesKey() {
    const value = resultNumber();
    if (justCalculated.current && value !== null) {
      if (alternate?.kind === 'dms') return backToResult();
      const dms = toDms(value, preferences.decimalSeparator);
      return showAlternate(
        {
          kind: 'dms',
          expression: dms.expression,
          spoken: mathSpeech(dms.expression, { decimalSeparator: preferences.decimalSeparator }),
        },
        'Grados, minutos y segundos',
      );
    }
    const before = expression.slice(0, input.current?.selectionStart ?? expression.length);
    const mark = /°\s*[\d.,]+$/.test(before) ? "'" : /'\s*[\d.,]+$/.test(before) ? '"' : '°';
    deviceInsert(mark, '', false);
  }
  function showFactors() {
    const value = resultNumber();
    const text = value !== null ? factorExpression(value) : null;
    if (!text)
      return announce('FACT descompone en primos un resultado entero entre 2 y un billón.');
    showAlternate({ kind: 'fact', expression: text, spoken: mathSpeech(text) }, 'Factores primos');
  }
  function showMixed() {
    if (!result) return announce('Todavía no hay un resultado.');
    if (alternate?.kind === 'mixed') return backToResult();
    const source = result.value.includes('/') ? result.value : result.exact;
    const mixed = source ? mixedFraction(source) : null;
    if (!mixed) return announce('La fracción mixta funciona con fracciones mayores que 1.');
    const part = mixed.numerator
      ? `<mfrac><mn>${mixed.numerator}</mn><mn>${mixed.denominator}</mn></mfrac>`
      : '';
    showAlternate(
      {
        kind: 'mixed',
        mathml: `<math display="inline"><mrow>${mixed.negative ? '<mo>−</mo>' : ''}<mn>${mixed.whole}</mn>${part}</mrow></math>`,
        spoken: `${mixed.negative ? 'menos ' : ''}${mixed.whole}${mixed.numerator ? ` enteros y ${fractionName(String(mixed.numerator), String(mixed.denominator))}` : ''}`,
      },
      'Fracción mixta',
    );
  }
  /** STO y una variable: guarda Ans en esa variable (o en la memoria M). */
  function store(name: string) {
    setStoring(false);
    const answer = lastAnswer.current;
    if (!answer) return announce('Todavía no hay un resultado para guardar.');
    if (name === 'M') {
      const value = convertSeparator(answer.value, answer.separator, 'punto');
      setMemory(value);
      if (!storage.write('memory', value)) reportStorageFailure();
      return announce(`Guardado en la memoria: ${mathSpeech(value)}.`);
    }
    void calculate(`${name}=ans`);
  }
  function solveExpression() {
    const text = expression.trim();
    if (!text) return announce('Escribí una ecuación en x, por ejemplo x^2-4=0, y después SOLVE.');
    void calculate(text.includes('=') ? text : `${text}=0`);
  }
  /** CALC: pide un valor para cada variable y calcula con ellos. */
  function calcWithValues() {
    const text = expression.trim();
    if (!text)
      return announce('Escribí una expresión con variables, por ejemplo 3x+1, y después CALC.');
    const names = freeVariables(text);
    if (!names.length) return void calculate(text);
    setKeyPrompt({
      title: 'CALC: valores de las variables',
      description: `Escribí un valor para ${names.join(', ')}. Se calcula ${text} con esos valores.`,
      fields: names.map((name) => ({
        id: name,
        label: `Valor de ${name}`,
        value: variables[name] !== undefined ? String(variables[name]) : '',
      })),
      submit: 'Calcular',
      done: (values) => {
        setKeyPrompt(null);
        void (async () => {
          const scope = { ...variables };
          for (const name of names) {
            try {
              const value = await client.evaluate(values[name], {
                ...numberOptions,
                angle: preferences.angle,
                resultForm: 'decimal',
              });
              const number = readNumber(value.value, value.separator ?? 'punto');
              if (number === null) throw new Error();
              scope[name] = number;
            } catch {
              announce(`El valor de ${name} tiene que ser un número real.`);
              return;
            }
          }
          await calculate(text, preferences.angle, scope);
        })();
      },
    });
  }
  /** Teclas que piden datos: integral, derivada en un punto, sumatoria y entero al azar. */
  function openKeyPrompt(kind: 'integral' | 'derivative' | 'sum' | 'random-int') {
    const sep = `${argumentSeparator} `;
    const body = expression.trim() && !expression.includes('=') ? expression.trim() : '';
    const run = (text: string) => {
      setKeyPrompt(null);
      setExpression(text);
      justCalculated.current = false;
      void calculate(text);
    };
    if (kind === 'integral')
      return setKeyPrompt({
        title: 'Integral definida',
        description: 'La integral de una función de x entre dos valores.',
        fields: [
          { id: 'f', label: 'Función de x', value: body },
          { id: 'a', label: 'Desde x igual a' },
          { id: 'b', label: 'Hasta x igual a' },
        ],
        submit: 'Calcular integral',
        done: (v) => run(`integrate(${v.f}${sep}x${sep}${v.a}${sep}${v.b})`),
      });
    if (kind === 'derivative')
      return setKeyPrompt({
        title: 'Derivada',
        description: 'La derivada de una función de x; con un punto, su valor en ese punto.',
        fields: [
          { id: 'f', label: 'Función de x', value: body },
          { id: 'a', label: 'En x igual a (opcional)', required: false },
        ],
        submit: 'Calcular derivada',
        done: (v) =>
          run(
            v.a.trim()
              ? `substitute(diff(${v.f}${sep}x)${sep}x${sep}${v.a})`
              : `diff(${v.f}${sep}x)`,
          ),
      });
    if (kind === 'sum')
      return setKeyPrompt({
        title: 'Sumatoria',
        description: 'Suma el término para x entero, desde un valor hasta otro.',
        fields: [
          { id: 'f', label: 'Término en x', value: body },
          { id: 'a', label: 'Desde x igual a' },
          { id: 'b', label: 'Hasta x igual a' },
        ],
        submit: 'Calcular sumatoria',
        done: (v) => run(`sum(${v.f}${sep}x${sep}${v.a}${sep}${v.b})`),
      });
    setKeyPrompt({
      title: 'Entero al azar',
      description: 'Un número entero al azar entre dos valores, incluidos.',
      fields: [
        { id: 'a', label: 'Desde' },
        { id: 'b', label: 'Hasta' },
      ],
      submit: 'Escribir número',
      done: (v) => {
        setKeyPrompt(null);
        const low = readNumber(v.a, preferences.decimalSeparator),
          high = readNumber(v.b, preferences.decimalSeparator);
        if (low === null || high === null || !Number.isInteger(low) || !Number.isInteger(high))
          return announce('Escribí dos números enteros.');
        const [a, b] = low <= high ? [low, high] : [high, low];
        const value = String(a + Math.floor(Math.random() * (b - a + 1)));
        deviceInsert(value, '', false);
        announce(`Número al azar: ${value}.`);
      },
    });
  }
  function closeKeyPrompt() {
    setKeyPrompt(null);
    focusEntry();
  }
  function resetCalculator() {
    setMemory('0');
    if (!storage.write('memory', '0')) reportStorageFailure();
    setVariables({});
    if (!variableService.save({})) reportStorageFailure();
    lastAnswer.current = null;
    previousAnswer.current = null;
    clear();
    announce(
      'Calculadora reiniciada: memoria, variables y Ans en cero. El historial y la configuración se conservan.',
    );
  }
  function closePanel() {
    setLcdPanel(null);
    focusEntry();
  }
  const panel = (() => {
    const decimal = preferences.decimalSeparator;
    switch (lcdPanel) {
      case 'menu':
        return {
          title: 'Menú de modos',
          columns: 4,
          items: calculatorModes.map((mode): LcdItem => ({
            id: mode.id,
            label: mode.label,
            icon: mode.icon,
          })),
        };
      case 'constants':
        return {
          title: 'Constantes físicas',
          columns: 1,
          items: physicalConstants.map((constant): LcdItem => ({
            id: constant.symbol,
            label: constant.label,
            detail: `${constant.symbol} = ${formatNumber(constant.value, { significant: 6, decimal })} ${constant.unit}`,
          })),
        };
      case 'variables':
        return {
          title: 'Variables guardadas',
          columns: 1,
          items: [
            ...['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y'].map((name): LcdItem => ({
              id: name,
              label: name,
              detail:
                variables[name] === undefined
                  ? 'sin valor'
                  : `= ${formatNumber(variables[name], { significant: 10, decimal })}`,
            })),
            { id: 'M', label: 'M, memoria', detail: `= ${reusable(memory)}` },
          ],
        };
      case 'reset':
        return {
          title: '¿Reiniciar la calculadora?',
          columns: 1,
          items: [
            { id: 'yes', label: 'Sí: borrar memoria, variables y Ans' },
            { id: 'no', label: 'No, volver' },
          ],
        };
      default:
        return null;
    }
  })();
  function choosePanelItem(item: LcdItem) {
    const kind = lcdPanel;
    setLcdPanel(null);
    if (kind === 'menu') {
      const mode = calculatorModes.find((candidate) => candidate.id === item.id)!;
      if (mode.tool === 'basic') navigate('basic');
      else openTool(mode.tool);
      announce(`Modo ${mode.label}.`);
    } else if (kind === 'constants') {
      deviceInsert(item.id, '', false);
      focusEntry();
      announce(`${item.label}: ${item.id}.`);
    } else if (kind === 'variables') {
      if (item.id === 'M') void memoryAction('recall');
      else deviceInsert(item.id, '', false);
      focusEntry();
    } else if (kind === 'reset') {
      if (item.id === 'yes') resetCalculator();
      else announce('Reinicio cancelado.');
      focusEntry();
    }
  }
  /** Una tecla de la calculadora: resuelve su función con Shift, Alpha y STO. */
  function pressKey(key: CalculatorKey, face: KeyFace) {
    const action = face.action;
    if (off && !(action.op === 'power' && action.on)) return;
    // Con un menú en la pantalla, la cruceta, «=», los números y AC lo manejan.
    if (lcdPanel && action.op !== 'layer') {
      setLayer('main');
      if (action.op === 'cursor') panelRef.current?.move(action.direction);
      else if (action.op === 'replay')
        panelRef.current?.move(action.direction === 'previous' ? 'up' : 'down');
      else if (action.op === 'calculate') panelRef.current?.choose();
      else if (/^k\d$/.test(key.id) && key.id !== 'k0')
        panelRef.current?.choose(Number(key.id.slice(1)) - 1);
      else if (['clear', 'menu', 'power', 'delete'].includes(action.op)) closePanel();
      return;
    }
    if (action.op === 'layer') {
      const next = layer === action.layer ? 'main' : action.layer;
      setLayer(next);
      announce(
        next === 'main'
          ? `${action.layer === 'shift' ? 'Shift' : 'Alpha'} desactivado.`
          : `${next === 'shift' ? 'Shift' : 'Alpha'} activado: la próxima tecla cambia de función.`,
      );
      return;
    }
    setLayer('main');
    if (storing && action.op !== 'variable') {
      setStoring(false);
      announce('Guardado cancelado.');
      if (action.op === 'store') return;
    }
    if (
      preferences.guided &&
      ['insert', 'wrap', 'variable', 'negative', 'decimal'].includes(action.op)
    )
      speech.hablarAutomatico(face.name);
    // En los demás modos, la edición va al campo de la herramienta y «=» la calcula.
    if (!inCalculator)
      switch (action.op) {
        case 'delete':
          return fieldErase();
        case 'clear':
          return fieldErase(true);
        case 'cursor':
          return fieldCaret(action.direction);
        case 'replay':
          return fieldStep(action.direction === 'previous' ? -1 : 1);
        case 'calculate':
          return submitTool();
        case 'undo':
        case 'overwrite':
        case 'solve':
        case 'calc':
          return announce('Esa tecla es del modo Calcular: MENU y 1 vuelven a Calcular.');
        case 'prompt':
          if (action.prompt !== 'random-int')
            return announce('Esa tecla es del modo Calcular: MENU y 1 vuelven a Calcular.');
      }
    switch (action.op) {
      case 'insert':
        return deviceInsert(action.text);
      case 'wrap':
        return deviceInsert(
          fillSeparators(action.before, preferences.decimalSeparator),
          fillSeparators(action.after, preferences.decimalSeparator),
        );
      case 'negative':
        return deviceInsert('-', '', false);
      case 'variable':
        return storing ? store(action.name) : deviceInsert(action.name, '', false);
      case 'decimal':
        return deviceInsert(preferences.decimalSeparator === 'coma' ? ',' : '.', '', false);
      case 'separator':
        return deviceInsert(argumentSeparator, '', false);
      case 'calculate':
        return void calculate(
          expression,
          preferences.angle,
          variables,
          action.form === 'decimal' ? { resultForm: 'decimal' } : {},
        );
      case 'delete':
        setAlternate(null);
        return erase();
      case 'clear':
        setAlternate(null);
        return clear();
      case 'undo': {
        const value = editHistory.undo(expression);
        if (value === undefined) return announce('No hay nada para deshacer.');
        setExpression(value);
        justCalculated.current = false;
        return announce(`Deshecho. ${value ? mathSpeech(value) : 'La expresión quedó vacía.'}`);
      }
      case 'overwrite':
        setOverwrite(!overwrite);
        return announce(
          overwrite
            ? 'Modo insertar: lo que escribís se agrega.'
            : 'Modo sobrescribir: lo que escribís reemplaza lo que sigue al cursor.',
        );
      case 'cursor':
        return moveCaret(action.direction);
      case 'replay':
        return replayHistory(action.direction);
      case 'memory':
        return void memoryAction(action.action);
      case 'menu':
        return setLcdPanel('menu');
      case 'setup':
        return navigate('settings');
      case 'options':
        dialogOrigin.current = document.activeElement as HTMLElement;
        dialogSelection.current = captureFocus();
        return setPalette(true);
      case 'power':
        if (!action.on) {
          setOff(true);
          return announce('Pantalla apagada. ON la vuelve a encender.');
        }
        if (off) {
          setOff(false);
          return announce('Pantalla encendida.');
        }
        focusEntry();
        return announce('Calculadora lista.');
      case 'store':
        if (!lastAnswer.current) return announce('Todavía no hay un resultado para guardar.');
        setStoring(true);
        return announce('STO: elegí la variable, de A a F, x, y o M.');
      case 'recall':
        return setLcdPanel('variables');
      case 'toggle-form':
        return toggleForm();
      case 'mixed':
        return showMixed();
      case 'engineering':
        return showEngineering(action.direction);
      case 'dms':
        return degreesKey();
      case 'factor':
        return showFactors();
      case 'solve':
        return solveExpression();
      case 'calc':
        return calcWithValues();
      case 'prompt':
        return openKeyPrompt(action.prompt);
      case 'constants':
        return setLcdPanel('constants');
      case 'tool':
        return openTool(action.tool);
      case 'reset':
        return setLcdPanel('reset');
      case 'copy':
        return void copy(
          result ? `${result.expression} = ${result.value}` : expression,
          'Cálculo copiado.',
        );
      case 'random': {
        const value = (Math.floor(Math.random() * 1000) / 1000).toFixed(3);
        deviceInsert(
          preferences.decimalSeparator === 'coma' ? value.replace('.', ',') : value,
          '',
          false,
        );
        return announce(`Número al azar: ${value}.`);
      }
      case 'previous-answer': {
        const previous = previousAnswer.current;
        if (!previous) return announce('Todavía no hay un resultado previo al anterior.');
        return deviceInsert(`(${reusable(previous.value, previous.separator)})`, '', false);
      }
    }
  }
  // Lo que muestra la pantalla: la expresión en forma de libro y el resultado (u otra forma).
  const lcdNatural = useMemo(
    () =>
      expression.trim()
        ? toMathML(expression, {
            decimalSeparator: preferences.decimalSeparator,
            display: 'inline',
          })
        : null,
    [expression, preferences.decimalSeparator],
  );
  const lcdAnswer = useMemo(() => {
    if (!result) return null;
    if (alternate?.mathml) return { mathml: alternate.mathml, text: alternate.spoken };
    const text = alternate?.expression ?? (result.table || result.headers ? '' : result.value);
    if (!text) return { mathml: null, text: 'Ver abajo ▼' };
    const decimal = alternate ? preferences.decimalSeparator : (result.separator ?? 'punto');
    return { mathml: toMathML(text, { decimalSeparator: decimal, display: 'inline' }), text };
  }, [result, alternate, preferences.decimalSeparator]);
  const alternateLabel = alternate
    ? {
        sd: result?.decimal ? 'decimal' : 'exacta',
        eng: 'ENG',
        dms: '°′″',
        fact: 'FACT',
        mixed: 'a b/c',
      }[alternate.kind]
    : '';

  async function copy(text: string, done = 'Resultado copiado.') {
    try {
      await navigator.clipboard.writeText(text);
      announce(done);
    } catch {
      announce('No pude copiar automáticamente. Seleccioná el texto del resultado para copiarlo.');
    }
  }
  /** La expresión de una entrada, escrita con el separador decimal que se usa ahora. */
  const entryExpression = (entry: HistoryEntry) =>
    convertSeparator(entry.expression, entry.separator ?? 'punto', preferences.decimalSeparator);
  function edit(entry: HistoryEntry) {
    justCalculated.current = false;
    setExpression(entryExpression(entry));
    changePreferences({ ...preferences, angle: entry.angleMode });
    openTool('basic', 'expression');
    announce('Cálculo listo para editar.');
  }
  function whereAmI() {
    const section = viewTitle;
    const field = lastField.current;
    const currentField = field?.getClientRects().length
      ? describeElement(field)
      : 'Ningún campo de edición enfocado';
    const draft = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '[data-expression], #expression',
      ),
    ).find((element) => element.getClientRects().length)?.value;
    announce(
      `${section}. ${keyboard.mode === 'math' ? 'Modo teclado matemático' : 'Modo escritura'}. ${preferences.guided ? 'Guía por voz activada' : 'Lector de pantalla externo'}. Campo: ${currentField}. ${draft ? `Expresión: ${mathSpeech(draft)}.` : 'Sin expresión en esta sección.'} ${result ? `Hay resultado: ${resultSpeech(result, speechOptions)}.` : 'Sin resultado.'} ${error ? `Error: ${error}.` : 'Sin errores.'}${layer !== 'main' ? ` ${layer === 'shift' ? 'Shift' : 'Alpha'} activado.` : ''}${storing ? ' STO esperando una variable.' : ''}`,
    );
  }

  function changeKeyboard(next: KeyboardSettings) {
    keyboardManager.cancelSequence();
    setKeyboard(next);
    if (!keyboardSettingsService.save(next)) reportStorageFailure();
    if (next.mode !== keyboard.mode)
      announce(
        next.mode === 'math' ? 'Modo teclado matemático activado.' : 'Modo escritura activado.',
      );
  }
  function stopAll() {
    clearTimeout(typingTimer.current);
    cancelAutomatic();
    speech.detener();
    feedbackSound.stop();
    commandBus.sendIfMounted('graphs', { type: 'graph', operation: 'stop' });
  }
  function openKeyboard() {
    stopAll();
    keyboardManager.cancelSequence();
    commandBus.cancelPending();
    setHelp(false);
    setView('keyboard');
    focusTarget('keyboard-title');
  }
  function closeCommandDialog() {
    const saved = dialogSelection.current;
    dialogSelection.current = null;
    setPalette(false);
    setFunctionPrompt(null);
    requestAnimationFrame(() => {
      if (restoreFocus(saved)) return;
      if (dialogOrigin.current?.getClientRects().length) dialogOrigin.current.focus();
      else document.getElementById('view-title')?.focus();
    });
  }
  function exitPractice() {
    setPractice(null);
    focusTarget('keyboard-title');
    announce('Práctica finalizada. Tus datos se conservaron.');
  }
  function announceResult() {
    announce(
      resultView
        ? `Resultado: ${resultView.spoken}`
        : 'Todavía no hay resultado en esta herramienta.',
    );
  }
  /** Campo de expresión y cursor sobre los que actúan las ayudas de edición. */
  /** Recorre una expresión por partes; la que se escribe puede llevar el cursor a una parte. */
  function explore(
    text: string,
    title: string,
    separator: DecimalSeparator,
    field?: HTMLInputElement | HTMLTextAreaElement,
  ) {
    const tree = explorerTree(text, { decimalSeparator: separator, speech: speechOptions });
    if (!tree)
      return explicitRead('No pude separarla en partes: revisá que la expresión esté completa.');
    explorerOrigin.current = document.activeElement as HTMLElement | null;
    explorerSelected.current = false;
    setExplorer({
      title,
      tree,
      ...(field && {
        select: ([start, end]: [number, number]) => {
          explorerSelected.current = true;
          field.focus();
          field.setSelectionRange(start, end);
          announce(
            `Elegido en la expresión: ${mathSpeech(field.value.slice(start, end), speechOptions)}.`,
          );
        },
      }),
    });
  }
  function exploreExpression() {
    const target = editingTarget();
    if (!target?.text.trim()) return explicitRead('No hay una expresión para explorar.');
    explore(target.text, 'Explorar la expresión', preferences.decimalSeparator, target.field);
  }
  function exploreResult() {
    if (!result) return explicitRead('Todavía no hay un resultado para explorar.');
    explore(result.value, 'Explorar el resultado', result.separator ?? 'punto');
  }
  function closeExplorer() {
    setExplorer(null);
    if (!explorerSelected.current)
      requestAnimationFrame(() => {
        if (explorerOrigin.current?.isConnected) explorerOrigin.current.focus();
      });
  }
  function editingTarget() {
    const expressionField = (element: Element | null | undefined) =>
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.matches('[data-expression], #expression') && element.getClientRects().length
          ? element
          : null
        : null;
    const saved = dialogSelection.current;
    const field =
      expressionField(saved?.element) ??
      expressionField(lastField.current) ??
      expressionField(
        Array.from(document.querySelectorAll('[data-expression], #expression')).find(
          (element) => element.getClientRects().length,
        ),
      );
    if (!field) return null;
    const caret =
      saved?.element === field && saved.start !== null
        ? saved.start
        : (field.selectionStart ?? field.value.length);
    return { field, text: field.value, caret };
  }
  function executeCommand(command: MathCommand) {
    // Desde la paleta, un comando de lectura devuelve el foco y el cursor al campo.
    const fromPalette = palette ? dialogSelection.current : null;
    const backToField = (caret?: number) => {
      if (!fromPalette) return;
      const target =
        caret === undefined ? fromPalette : { ...fromPalette, start: caret, end: caret };
      requestAnimationFrame(() => restoreFocus(target));
    };
    setPalette(false);
    keyboardManager.cancelSequence();
    cancelAutomatic();
    const action = command.action;
    if (action.type === 'insert') {
      if (activeTool === 'advanced' && view === 'work')
        commandBus.send('advanced', {
          type: 'tool',
          tool: 'advanced',
          operation: 'insert',
          variant: action.value,
        });
      else {
        editHistory.record(expression);
        if (view !== 'work' || !['basic', 'scientific'].includes(activeTool))
          openTool('basic', 'math-keyboard-area');
        keypadInsert(action.value);
      }
    } else if (action.type === 'function') {
      // Desde la paleta se conserva la selección guardada al abrirla.
      if (!palette) {
        dialogOrigin.current = document.activeElement as HTMLElement;
        dialogSelection.current = captureFocus();
      }
      setFunctionPrompt(command);
    } else if (action.type === 'tool') {
      openTool(action.tool);
      if (action.variant === 'complex') setVectorContext('complex');
      else if (action.tool === 'vectors') setVectorContext('vectors');
      if (action.operation) commandBus.send(action.tool, action);
      announce(
        `${command.name}. Contexto: ${command.category}. Completá los campos antes de calcular.`,
        keyboard.verbosity !== 'minimal',
      );
      void feedbackSound.play('change');
    } else if (action.type === 'graph') {
      if (activeTool !== 'graphs' || view !== 'work') openTool('graphs');
      commandBus.send('graphs', action);
    } else {
      switch (action.operation) {
        case 'mode': {
          const mode = keyboard.mode === 'math' ? 'writing' : 'math';
          changeKeyboard({ ...keyboard, mode });
          setView('work');
          setHelp(false);
          focusTarget(
            mode === 'math'
              ? 'math-keyboard-area'
              : ['basic', 'scientific'].includes(activeTool)
                ? 'expression'
                : 'view-title',
          );
          break;
        }
        case 'palette':
          dialogOrigin.current = document.activeElement as HTMLElement;
          dialogSelection.current = captureFocus();
          setPalette(true);
          break;
        case 'keyboard':
          openKeyboard();
          break;
        case 'where':
          whereAmI();
          break;
        case 'help':
          openHelp();
          break;
        case 'stop':
          stopAll();
          break;
        case 'read-expression':
          readExpression();
          break;
        case 'read-result':
          explicitRead(
            result ? `Resultado: ${resultSpeech(result, speechOptions)}.` : 'No hay resultado.',
          );
          backToField();
          break;
        case 'read-error':
          explicitRead(error || 'No hay errores.');
          backToField();
          break;
        case 'read-message':
          explicitRead(status || 'No hay un mensaje anterior.');
          backToField();
          break;
        case 'explore-expression':
          exploreExpression();
          break;
        case 'explore-result':
          exploreResult();
          break;
        case 'read-tool':
          explicitRead(`Herramienta actual: ${toolName(activeTool)}.`);
          backToField();
          break;
        case 'caret-token':
        case 'caret-rest':
        case 'caret-where':
        case 'caret-pair':
        case 'caret-balance': {
          const target = editingTarget();
          if (!target) {
            explicitRead('No hay un campo de expresión en esta sección.');
            break;
          }
          const { field, text, caret } = target;
          if (action.operation === 'caret-pair') {
            const pair = matchingParen(text, caret);
            if (!pair) explicitRead('No hay un paréntesis junto al cursor.');
            else {
              explicitRead(pair.speech);
              if (pair.match !== null) {
                // El cursor queda delante de la pareja: la tecla siguiente la lee.
                field.setSelectionRange(pair.match, pair.match);
                backToField(pair.match);
                break;
              }
            }
          } else
            explicitRead(
              action.operation === 'caret-token'
                ? (tokenAt(text, caret)?.speech ?? 'La expresión está vacía.')
                : action.operation === 'caret-rest'
                  ? readFromCaret(text, caret)
                  : action.operation === 'caret-where'
                    ? describeCaret(text, caret)
                    : describeBalance(text) || 'Los paréntesis están completos.',
            );
          backToField();
          break;
        }
        case 'repeat-action': {
          const last = lastCalculation.current[calculationKey];
          if (last) void calculate(last.value, last.angle, last.scope);
          else announce('Todavía no hay un cálculo para repetir.');
          break;
        }
        case 'calculate':
          if (activeTool === 'advanced')
            document.querySelector<HTMLFormElement>('#advanced form')?.requestSubmit();
          else void calculate();
          break;
        case 'erase':
        case 'delete':
        case 'undo':
        case 'redo': {
          if (activeTool === 'advanced') {
            commandBus.send('advanced', {
              type: 'tool',
              tool: 'advanced',
              operation: action.operation,
            });
            break;
          }
          if (!['basic', 'scientific'].includes(activeTool)) {
            announce(
              'No hay una edición matemática para deshacer en esta herramienta. Dentro de un campo usá su edición habitual.',
            );
            break;
          }
          if (action.operation === 'undo' || action.operation === 'redo') {
            const value = editHistory[action.operation](expression);
            if (value === undefined) announce('No hay más cambios disponibles.');
            else {
              setExpression(value);
              justCalculated.current = false;
              announce(
                `${action.operation === 'undo' ? 'Deshecho' : 'Rehecho'}. ${mathSpeech(value)}`,
              );
            }
          } else {
            editHistory.record(expression);
            if (action.operation === 'erase') erase();
            else {
              const start = input.current?.selectionStart ?? expression.length;
              const end = input.current?.selectionEnd ?? start;
              setExpression(
                expression.slice(0, start) + expression.slice(end > start ? end : start + 1),
              );
              justCalculated.current = false;
            }
          }
          break;
        }
        case 'diff':
        case 'integrate':
        case 'limit':
          openTool('advanced');
          commandBus.send('advanced', {
            type: 'tool',
            tool: 'advanced',
            operation: action.operation,
          });
          break;
        case 'basic':
        case 'tools':
        case 'result':
        case 'history':
        case 'graphs':
        case 'matrices':
        case 'dictation':
        case 'settings':
          navigate(action.operation);
          if (action.operation === 'result') announceResult();
          break;
      }
    }
    if (['detailed', 'training'].includes(keyboard.verbosity) && action.type === 'insert')
      announce(
        `${command.spokenLabel}. ${keyboard.verbosity === 'training' ? command.description : ''}`,
      );
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      keyboardManager.handle(event, {
        settings: keyboard,
        context: activeTool === 'vectors' ? vectorContext : activeTool,
        insideApp:
          !!target?.closest('.app') ||
          target === document.body ||
          target === document.documentElement,
        insideWorkspace: !!target?.closest('[data-keyboard-workspace]'),
        editing: !!target?.closest(
          'input, textarea, select, [contenteditable=true], [role=textbox]',
        ),
        nativeActivation: !!target?.closest('button, a, summary'),
        modal: !!document.querySelector('dialog[open]'),
        practice: practice?.mode ?? null,
        practiceCategory: practice?.category ?? '',
        execute: executeCommand,
        announce,
        sound: (kind) => void feedbackSound.play(kind),
        stop: stopAll,
        exitPractice,
        legacy: (event) =>
          handleKeyboard(event, {
            stop: stopAll,
            read: readExpression,
            help: openHelp,
            navigate: (target) => {
              navigate(target);
              if (target === 'result') announceResult();
            },
            symbolic: (operation) => {
              openTool('advanced');
              requestAnimationFrame(() => advanced.current?.selectOperation(operation));
            },
          }),
      });
    };
    const release = (event: KeyboardEvent) => keyboardManager.release(event);
    const observe = (event: KeyboardEvent) => keyboardManager.observe(event);
    const blur = () => keyboardManager.reset();
    window.addEventListener('keydown', observe, true);
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', release, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keydown', observe, true);
      window.removeEventListener('keyup', release, true);
      window.removeEventListener('blur', blur);
    };
  });

  const resultPanel = (
    <section className="result panel" aria-labelledby="result-title">
      <h2 id="result-title" tabIndex={-1}>
        Resultado
      </h2>
      {result ? (
        <>
          <MathView
            className="result-expression"
            text={result.expression}
            spoken={resultView!.expressionSpoken}
            srMath={preferences.srMath}
            decimalSeparator={preferences.decimalSeparator}
          />
          <div
            className={`result-value ${result.table || result.matrix ? 'sr-only' : ['Álgebra', 'Cálculo'].includes(result.kind) ? 'symbolic-value' : ''}`}
            data-speech={`Resultado: ${resultView!.spoken}`}
          >
            {result.table || result.matrix ? (
              <code className="result-syntax" aria-hidden="true">
                {result.value}
              </code>
            ) : (
              <MathView
                text={result.value}
                spoken={resultView!.spoken}
                srMath={preferences.srMath}
                decimalSeparator={preferences.decimalSeparator}
                approximate={result.approximate}
                syntaxClassName="result-syntax"
              />
            )}
          </div>
          {!!result.warnings?.length && (
            <div className="result-warnings">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {result.matrix && result.headers && (
            <ValueTable
              key={result.expression}
              headers={result.headers}
              rows={result.matrix}
              speechOptions={speechOptions}
            />
          )}
          {result.matrix && !result.headers && (
            <div className="result-table">
              <table className="data-table">
                <caption>Matriz o vector resultado</caption>
                <tbody>
                  {result.matrix.map((row, i) => (
                    <tr key={i}>
                      {row.map((value, j) => (
                        <td
                          key={j}
                          data-speech={`Fila ${i + 1}, columna ${j + 1}, ${mathSpeech(value)}`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.table && (
            <table className="data-table">
              <caption>Detalle del resultado</caption>
              <tbody>
                {result.table.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td data-speech={`${row.label}: ${mathSpeech(row.value)}`}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.unit && <p>Unidad: {result.unit}</p>}
          {result.exact && (
            <p>
              Forma exacta: <strong>{result.exact}</strong>
            </p>
          )}
          {result.decimal && (
            <p>
              Aproximación decimal: <strong>{result.decimal}</strong>
            </p>
          )}
          <p className="hint">
            {result.kind} · {angleNames[result.angleMode]}
            <br />
            {historySaved
              ? 'Guardado en tu historial local.'
              : 'Disponible en esta sesión. No se pudo guardar el historial; se perderán los cambios al cerrar.'}
          </p>
          <div className="actions">
            <button
              onClick={() => {
                const origin = calculationOrigin.current[calculationKey];
                if (!origin) return;
                openTool(origin.tool);
                requestAnimationFrame(() => {
                  if (origin.field?.isConnected) origin.field.focus();
                });
              }}
            >
              Volver a editar el cálculo
            </button>
            <button onClick={() => explicitRead(`Resultado: ${resultView!.spoken}`)}>
              Escuchar resultado
            </button>
            <button onClick={() => void copy(result.value)}>Copiar resultado</button>
            {!result.headers && <button onClick={exploreResult}>Explorar resultado</button>}
            {resultView?.latex && (
              <button onClick={() => void copy(resultView.latex!, 'LaTeX copiado.')}>
                Copiar como LaTeX
              </button>
            )}
            {resultView?.mathml && (
              <button onClick={() => void copy(resultView.mathml!, 'MathML copiado.')}>
                Copiar como MathML
              </button>
            )}
            <button
              onClick={() =>
                downloadHistory(
                  [{ ...result, id: crypto.randomUUID(), date: new Date().toISOString() }],
                  'txt',
                )
              }
            >
              Guardar resultado TXT
            </button>
            {result.graphable && !result.assigned && (
              <button
                onClick={() => {
                  // Gráficos lee la función con el separador elegido.
                  setGraphRequest({
                    id: Date.now(),
                    expression: reusable(result.value, result.separator),
                  });
                  openTool('graphs');
                  announce(
                    'Resultado cargado en Gráficos. Podés editar la función y pulsar Graficar funciones.',
                  );
                }}
              >
                Graficar resultado
              </button>
            )}
            <button
              onClick={() => {
                updateCalculation({ explanation: !explanation });
                if (preferences.guided && !explanation) speech.hablar(result.explanation);
              }}
              aria-expanded={explanation}
            >
              Explicar resultado
            </button>
          </div>
          <CalculationSteps steps={result.steps} speak={explicitRead} />
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
  );
  return (
    <CommandContext.Provider value={{ bus: commandBus, keyboard: keyboardManager }}>
      <div
        className={preferences.maximum ? 'app maximum' : 'app'}
        onFocusCapture={(event) => {
          const context = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-keyboard-context]',
          )?.dataset.keyboardContext;
          if (context === 'vectors' || context === 'complex') setVectorContext(context);
          if ((event.target as HTMLElement).matches('input, textarea, select'))
            lastField.current = event.target as HTMLElement;
          automatic.onFocusCapture(event);
        }}
        onChangeCapture={automatic.onChangeCapture}
        onKeyDownCapture={automatic.onKeyDownCapture}
        onPointerOver={automatic.onPointerOver}
        onPointerOut={automatic.onPointerOut}
      >
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            skipToContent();
          }}
        >
          Saltar al contenido
        </a>
        <header className="header">
          <p className="brand">
            <span className="brand-icon" aria-hidden="true">
              ∑
            </span>
            <span>
              Math<span className="brand-light">Voice</span>
            </span>
          </p>
          <nav aria-label="Secciones">
            <a
              href="#expression"
              aria-current={!help && view === 'work' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate('basic');
              }}
            >
              Calculadora
            </a>
            <a
              href="#view-title"
              aria-current={!help && view === 'tools' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate('tools');
              }}
            >
              Herramientas
            </a>
            <a
              href="#view-title"
              aria-current={!help && view === 'history' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate('history');
              }}
            >
              Historial
            </a>
            <a
              href="#view-title"
              aria-current={!help && view === 'settings' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate('settings');
              }}
            >
              Configuración
            </a>
            <a
              ref={helpButton}
              href="#view-title"
              aria-current={help || view === 'keyboard' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                openHelp();
              }}
            >
              Ayuda <kbd>F1</kbd>
            </a>
          </nav>
          <div className="voice-bar" role="group" aria-label="Voz y orientación">
            <button
              aria-pressed={preferences.guided}
              disabled={!speech.available}
              title={
                speech.available ? undefined : 'Síntesis de voz no disponible en este navegador'
              }
              onClick={() => {
                automatic.cancel();
                if (preferences.guided) {
                  changePreferences({ ...preferences, guided: false });
                  speech.detener();
                  announce('Guía por voz desactivada.', false);
                } else if (!preferences.welcomed) start(true);
                else {
                  changePreferences({ ...preferences, guided: true });
                  speech.hablar('Guía por voz activada. Se conserva la sección actual.');
                }
              }}
            >
              Guía por voz
            </button>
            <button onClick={whereAmI}>¿Dónde estoy?</button>
            <button
              onClick={() => {
                clearTimeout(typingTimer.current);
                automatic.cancel();
                speech.detener();
              }}
            >
              Detener voz <kbd>Esc</kbd>
            </button>
          </div>
        </header>
        <dialog
          ref={welcomeDialog}
          className="welcome"
          aria-labelledby="welcome-title"
          aria-describedby="welcome-text"
          onKeyDown={welcomeKey}
          onCancel={(event) => {
            event.preventDefault();
            start(false);
          }}
        >
          <h2 id="welcome-title">Bienvenido a MathVoice</h2>
          <p id="welcome-text">
            Elegí cómo querés escuchar la calculadora. Con la guía por voz, MathVoice lee cada
            control y cada resultado. Si usás NVDA, JAWS o VoiceOver, elegí usar tu lector para no
            escuchar dos voces.
          </p>
          <div className="actions">
            <button className="primary" disabled={!speech.available} onClick={() => start(true)}>
              Activar guía por voz
            </button>
            <button onClick={() => start(false)}>Usar mi lector de pantalla</button>
          </div>
          <label className="welcome-tutorial">
            <input
              type="checkbox"
              checked={withTutorial}
              onChange={(event) => setWithTutorial(event.target.checked)}
            />
            Hacer el recorrido de primeros pasos: seis pasos cortos para aprender a usarla
          </label>
        </dialog>
        <main id="main-content" aria-labelledby="view-title">
          {!help && view === 'work' && activeTool !== 'basic' && (
            <nav aria-label="Ubicación" className="breadcrumb">
              <a
                href="#view-title"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('tools');
                }}
              >
                Herramientas
              </a>
              <span aria-hidden="true"> › </span>
              <span aria-current="page">{toolName(activeTool)}</span>
            </nav>
          )}
          {!help && view === 'keyboard' && (
            <nav aria-label="Ubicación" className="breadcrumb">
              <a
                href="#view-title"
                onClick={(event) => {
                  event.preventDefault();
                  openHelp();
                }}
              >
                Ayuda
              </a>
              <span aria-hidden="true"> › </span>
              <span aria-current="page">Teclado y atajos</span>
            </nav>
          )}
          <h1 id="view-title" tabIndex={-1}>
            {viewTitle}
          </h1>
          {help && (
            <div
              className="panel help"
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeHelp();
              }}
            >
              <h2>Cómo usar MathVoice</h2>
              <p>{welcome}</p>
              <ol>
                <li>
                  Escribí una operación en el campo Expresión matemática, o usá Dictar expresión.
                </li>
                <li>
                  Presioná Enter para calcular. El resultado se anuncia y queda en la sección
                  Resultado, donde podés escucharlo, copiarlo o explicarlo.
                </li>
                <li>
                  La tecla MENU elige el modo: álgebra, matrices, gráficos, estadística, tabla, hoja
                  de cálculo y más. Todos se usan dentro de la calculadora: la herramienta aparece
                  en la pantalla y el teclado escribe en ella. Tus datos se conservan al cambiar de
                  modo.
                </li>
                <li>
                  El historial guarda tus cálculos en este dispositivo para escucharlos, editarlos o
                  exportarlos.
                </li>
              </ol>
              <p>
                Usá punto para decimales y coma entre argumentos. Por ejemplo: log(8,2). Las
                funciones inversas respetan el modo angular. El historial conserva el modo original
                de cada cálculo.
              </p>
              <h2>Atajos esenciales</h2>
              <table className="shortcut-table">
                <thead>
                  <tr>
                    <th scope="col">Atajo</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['F1', 'Abrir esta ayuda'],
                    ['Enter', 'Calcular la expresión'],
                    ['Control + Enter', 'Escuchar la expresión'],
                    ['Escape', 'Detener la voz'],
                    ['Alt + Shift + C', 'Ir a la calculadora'],
                    ['Alt + Shift + R', 'Ir al resultado'],
                    ['Alt + Shift + H', 'Ir al historial'],
                    ['Alt + Shift + G', 'Abrir gráficos'],
                    ['Alt + Shift + M', 'Abrir matrices'],
                    ['Alt + Shift + D', 'Abrir derivadas'],
                    ['Alt + Shift + L', 'Abrir límites'],
                    ['Alt + Shift + V', 'Iniciar o cancelar el dictado'],
                    ['Alt + Shift + E', '¿Dónde estoy?'],
                    ['Alt + Shift + P', 'Paleta de comandos'],
                    ['Alt + Shift + K', 'Teclado y atajos'],
                    ['F2', 'Cambiar entre escritura y teclado matemático'],
                  ].map(([keys, action]) => (
                    <tr key={keys}>
                      <th scope="row">{keys}</th>
                      <td>{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2>Herramientas de teclado</h2>
              <p>
                La paleta busca cualquier función por nombre. El teclado matemático asigna una tecla
                a cada operación; con un lector de pantalla puede hacer falta pasarle las teclas a
                la página. En Teclado y atajos están la referencia completa, la práctica y la
                personalización.
              </p>
              <div className="actions">
                <button onClick={() => executeCommand(commandById.get('palette')!)}>
                  Paleta de comandos
                </button>
                <button
                  aria-pressed={keyboard.mode === 'math'}
                  onClick={() => executeCommand(commandById.get('mode')!)}
                >
                  {keyboard.mode === 'math'
                    ? 'Modo matemático activado. Cambiar a escritura'
                    : 'Activar modo teclado matemático'}
                </button>
                <button onClick={openKeyboard}>Teclado y atajos</button>
                <button onClick={startTutorial}>Primeros pasos</button>
              </div>
              <button onClick={closeHelp}>Cerrar ayuda</button>
            </div>
          )}
          {storageWarning && <p className="warning">{storageWarning}</p>}
          {!help && view === 'tools' && (
            <ToolsPage
              current={activeTool}
              open={(tool) => openTool(tool, tool === 'basic' ? 'expression' : 'view-title')}
            />
          )}
          <div
            id="calculation-error"
            role={preferences.guided ? undefined : 'alert'}
            aria-atomic="true"
            className={error ? 'error' : 'sr-only'}
          >
            {error}
          </div>
          <div className="workspace" data-keyboard-workspace hidden={view !== 'work' || help}>
            {keyboard.mode === 'math' && (
              <div
                id="math-keyboard-area"
                className="math-keyboard-area"
                role="application"
                aria-roledescription="teclado matemático"
                tabIndex={0}
                aria-label="Área del teclado matemático"
                aria-describedby="math-keyboard-help"
              >
                Teclado matemático:{' '}
                {activeTool === 'vectors' && vectorContext === 'complex'
                  ? 'Complejos'
                  : toolName(activeTool)}
                .
                <p id="math-keyboard-help">
                  Presioná un atajo o abrí la paleta con Alt más Shift más P. F2 vuelve a escritura.
                  Tab sale de esta área. Dentro de los campos podés escribir normalmente.
                </p>
              </div>
            )}
            {tutorial !== null && (
              <Tutorial
                step={tutorial}
                repeat={() => explicitRead(tutorialIntro(tutorial))}
                skip={skipTutorialStep}
                finish={finishTutorial}
              />
            )}
            <section className="calculator" aria-label="Calculadora">
              <div className="device-layout" data-mode={inCalculator ? 'calc' : 'tool'}>
                <div className="device-head" aria-hidden="true">
                  <span className="device-brand">
                    <b>MathVoice</b>
                    <span className="device-model">MV-100 · Científica</span>
                    <span className="device-series">PARLANTE</span>
                  </span>
                  <span className="device-solar" />
                </div>
                <form
                  id="calc-form"
                  className="device-screen"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void calculate();
                  }}
                >
                  <div className="lcd-frame">
                    <div className="lcd" data-off={off || undefined}>
                      <div className="lcd-status" aria-hidden="true">
                        <span data-on={layer === 'shift' || undefined}>S</span>
                        <span data-on={layer === 'alpha' || undefined}>A</span>
                        <span data-on={memory !== '0' || undefined}>M</span>
                        <span data-on={storing || undefined}>STO</span>
                        <span data-on={overwrite || undefined}>INS</span>
                        <span data-on={preferences.numberFormat !== 'normal' || undefined}>
                          {preferences.numberFormat === 'fijo' ? 'FIX' : 'SCI'}
                        </span>
                        <span className="lcd-angle" data-on>
                          {preferences.angle === 'deg'
                            ? 'D'
                            : preferences.angle === 'grad'
                              ? 'G'
                              : 'R'}
                        </span>
                      </div>
                      <div className="lcd-entry" hidden={!inCalculator}>
                        <label className="sr-only" htmlFor="expression">
                          Expresión matemática
                        </label>
                        <input
                          ref={input}
                          id="expression"
                          data-preserve-reading
                          className="expression lcd-input"
                          value={expression}
                          maxLength={10000}
                          autoComplete="off"
                          spellCheck={false}
                          aria-describedby={
                            error ? 'expression-hint calculation-error' : 'expression-hint'
                          }
                          aria-invalid={!!error}
                          placeholder="Ej.: sqrt(25) + sin(pi/2)"
                          onChange={(e) => {
                            const value = e.target.value;
                            const before = expression;
                            setExpression(value);
                            replay.current = -1;
                            setAlternate(null);
                            justCalculated.current = false;
                            setError('');
                            clearTimeout(typingTimer.current);
                            const deleted = describeDeletion(before, value);
                            if (deleted && preferences.guided) speech.hablarAutomatico(deleted);
                            const caret = e.target.selectionStart ?? value.length;
                            const closing =
                              value.length === before.length + 1
                                ? describeClosing(value, caret)
                                : '';
                            if (closing) announce(closing);
                            if (preferences.guided && preferences.readTyping)
                              typingTimer.current = setTimeout(
                                () => speech.hablarAutomatico(mathSpeech(value)),
                                900,
                              );
                          }}
                          onKeyDown={(e) => {
                            if (keyboardManager.preservesReaderKeys(e.nativeEvent)) return;
                            // INS: escribir reemplaza el carácter que sigue al cursor.
                            if (
                              overwrite &&
                              e.key.length === 1 &&
                              !e.ctrlKey &&
                              !e.altKey &&
                              !e.metaKey
                            ) {
                              const target = e.currentTarget;
                              const at = target.selectionStart ?? 0;
                              if (at === target.selectionEnd && at < target.value.length)
                                target.setSelectionRange(at, at + 1);
                            }
                            // Con la guía, mover el cursor dice qué quedó a su derecha (Ctrl: la palabra).
                            if (
                              preferences.guided &&
                              ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) &&
                              !e.shiftKey &&
                              !e.altKey &&
                              !e.metaKey
                            ) {
                              const field = e.currentTarget;
                              const word = e.ctrlKey;
                              requestAnimationFrame(() => {
                                const caret = field.selectionStart ?? field.value.length;
                                speech.hablarAutomatico(
                                  word
                                    ? (tokenAt(field.value, caret)?.speech ??
                                        'Final de la expresión.')
                                    : speakCharAt(field.value, caret),
                                );
                              });
                              return;
                            }
                            if (
                              preferences.guided &&
                              preferences.readKeys &&
                              e.key.length === 1 &&
                              !e.ctrlKey &&
                              !e.altKey
                            )
                              speech.hablarAutomatico(keySpeech(e.key));
                          }}
                        />
                        <div
                          className="lcd-natural"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: lcdNatural ?? '' }}
                        />
                      </div>
                      {!inCalculator && (
                        <p className="lcd-mode" aria-hidden="true">
                          {toolName(activeTool)}
                        </p>
                      )}
                      <div
                        className="lcd-answer"
                        aria-hidden="true"
                        data-error={(inCalculator && !!error) || undefined}
                      >
                        {inCalculator && error ? (
                          'Error'
                        ) : lcdAnswer ? (
                          <>
                            {result?.approximate && !alternate && '≈ '}
                            {lcdAnswer.mathml ? (
                              <span dangerouslySetInnerHTML={{ __html: lcdAnswer.mathml }} />
                            ) : (
                              lcdAnswer.text
                            )}
                            {alternateLabel && <small>{alternateLabel}</small>}
                          </>
                        ) : null}
                      </div>
                      {panel && (
                        <LcdPanel
                          ref={panelRef}
                          title={panel.title}
                          items={panel.items}
                          columns={panel.columns}
                          onChoose={choosePanelItem}
                          onClose={closePanel}
                        />
                      )}
                    </div>
                  </div>
                </form>
                <div className="device-app" ref={appArea}>
                  <div className="device-toolbar" hidden={!inCalculator}>
                    <p className="hint" id="expression-hint">
                      {preferences.decimalSeparator === 'coma'
                        ? 'Enter para calcular · Coma para decimales · Punto y coma entre argumentos'
                        : 'Enter para calcular · Punto para decimales · Paréntesis para agrupar'}
                    </p>
                    <div className="actions main-actions">
                      <button
                        type="submit"
                        form="calc-form"
                        className="primary"
                        aria-disabled={busy}
                      >
                        {busy ? 'Calculando…' : 'Calcular'} <span aria-hidden="true">↵</span>
                      </button>
                      <button type="button" disabled={!speech.available} onClick={readExpression}>
                        Escuchar expresión
                      </button>
                      <button type="button" onClick={exploreExpression}>
                        Explorar expresión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clear();
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
                    {view === 'work' &&
                      !help &&
                      (activeTool === 'basic' || activeTool === 'scientific') && (
                        <Dictation
                          language={preferences.language}
                          guided={preferences.guided}
                          announce={announce}
                          onListeningChange={setListening}
                          confirm={(value, angle) => {
                            const text = convertSeparator(
                              value,
                              'punto',
                              preferences.decimalSeparator,
                            );
                            setExpression(text);
                            if (angle) changePreferences({ ...preferences, angle });
                            void calculate(text, angle ?? preferences.angle);
                          }}
                        />
                      )}
                  </div>
                  {inCalculator && resultPanel}
                  <div hidden={activeTool !== 'scientific'}>
                    <Tools insert={insert} />
                  </div>
                  <div hidden={activeTool !== 'advanced'}>
                    <AdvancedCalculator
                      ref={advanced}
                      busy={busy}
                      calculate={(value) => void calculate(value)}
                    />
                  </div>
                  <FeatureHub
                    active={view === 'work' && !help ? activeTool : null}
                    visited={visited}
                    graphRequest={graphRequest}
                    busy={busy}
                    variables={variables}
                    angle={preferences.angle}
                    decimalSeparator={preferences.decimalSeparator}
                    announce={announce}
                    evaluate={evaluateCell}
                    calculate={(value) => {
                      void calculate(value);
                    }}
                    insert={insert}
                    removeVariable={(name) => {
                      const next = { ...variables };
                      delete next[name];
                      setVariables(next);
                      if (!variableService.save(next)) reportStorageFailure();
                      announce(`Variable ${name} eliminada.`);
                    }}
                  />
                  {/* La hoja y los gráficos muestran lo suyo: no usan el panel de resultado. */}
                  {!inCalculator && !['sheet', 'graphs'].includes(activeTool) && resultPanel}
                  <details className="panel" hidden={!inCalculator}>
                    <summary>Ejemplos de operaciones</summary>
                    <div className="examples">
                      <span>Probá un ejemplo</span>
                      <div className="actions">
                        {['1/3 + 1/6', 'sqrt(144)', '2^10'].map((example) => (
                          <button
                            key={example}
                            onClick={() => {
                              justCalculated.current = false;
                              setExpression(example);
                              input.current?.focus();
                            }}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
                <CalculatorKeys
                  layer={layer}
                  storing={storing}
                  decimal={preferences.decimalSeparator}
                  onPress={pressKey}
                />
              </div>
            </section>
          </div>
          <div
            role="status"
            aria-live={preferences.guided ? 'off' : 'polite'}
            aria-atomic="true"
            className="sr-only"
          >
            <span key={announcementId}>{status}</span>
          </div>
          {view === 'keyboard' &&
            !help &&
            (practice ? (
              <section className="panel" aria-labelledby="practice-title">
                <h2 id="practice-title">
                  {practice.mode === 'identify' ? 'Identificar tecla' : 'Practicar teclado'}
                </h2>
                <p>
                  Los atajos se describen sin ejecutar acciones ni modificar datos. Tab y los atajos
                  del navegador siguen disponibles. Escape termina la práctica.
                </p>
                <div
                  id="practice-area"
                  className="math-keyboard-area"
                  role="application"
                  aria-roledescription="práctica de teclado"
                  tabIndex={0}
                  data-keyboard-workspace
                  aria-label="Área de práctica de teclado"
                >
                  Categoría: {practice.category || 'Todas'}. Presioná una tecla.
                </div>
                <button onClick={exitPractice}>Terminar práctica</button>
              </section>
            ) : (
              <KeyboardPanel
                settings={keyboard}
                change={changeKeyboard}
                execute={executeCommand}
                announce={announce}
                read={explicitRead}
                guided={preferences.guided}
                cancelAutomatic={cancelAutomatic}
                practice={(mode, category) => {
                  stopAll();
                  keyboardManager.cancelSequence();
                  setPractice({ mode, category });
                  announce(
                    'Práctica activada. Las teclas se describen sin ejecutarse. Escape sale.',
                  );
                }}
              />
            ))}
          {palette && (
            <CommandPalette
              settings={keyboard}
              execute={executeCommand}
              close={closeCommandDialog}
              announce={announce}
            />
          )}
          {keyPrompt && <KeyPrompt request={keyPrompt} close={closeKeyPrompt} />}
          {explorer && (
            <ExpressionExplorer request={explorer} announce={announce} close={closeExplorer} />
          )}
          {functionPrompt && (
            <FunctionPrompt
              key={functionPrompt.id}
              command={functionPrompt}
              decimal={preferences.decimalSeparator}
              close={closeCommandDialog}
              insert={(value) => {
                setFunctionPrompt(null);
                editHistory.record(expression);
                openTool('basic', 'expression');
                insert(value);
                announce(
                  `${functionPrompt.name} insertada. Revisá la expresión y presioná Enter para calcular.`,
                );
              }}
            />
          )}
          <div hidden={view !== 'settings' || help}>
            <Settings
              preferences={preferences}
              change={changePreferences}
              cancelAutomatic={cancelAutomatic}
              feedbackSounds={{
                enabled: keyboard.sounds,
                volume: keyboard.soundVolume,
                change: (sounds, soundVolume) =>
                  changeKeyboard({ ...keyboard, sounds, soundVolume }),
              }}
            />
          </div>
          <div hidden={view !== 'history' || help}>
            {/* Solo se arma al verlo: así escribir en la calculadora no recalcula el historial. */}
            {view === 'history' && (
              <History
                entries={entries}
                speechOptions={speechOptions}
                srMath={preferences.srMath}
                edit={edit}
                explore={(entry) =>
                  explore(entry.value, 'Explorar el resultado guardado', entry.separator ?? 'punto')
                }
                recalculate={(entry) => {
                  edit(entry);
                  void calculate(
                    entryExpression(entry),
                    entry.angleMode,
                    entry.variables ?? variables,
                  );
                }}
                remove={(id) => {
                  const next = entries.filter((e) => e.id !== id);
                  saveHistory(next);
                  announce(historyRemovalMessage(next.length));
                }}
                clear={() => {
                  saveHistory([]);
                  announce('Historial vacío.');
                }}
                speak={explicitRead}
                copy={(text) => void copy(text)}
              />
            )}
          </div>
        </main>
        <footer>
          <span>MathVoice · Calculadora parlante</span>
          <span>Cálculos locales. Sin cuenta.</span>
          <OfflineStatus />
        </footer>
      </div>
    </CommandContext.Provider>
  );
}
