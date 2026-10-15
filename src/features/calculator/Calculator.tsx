import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { Keypad } from '../../components/Keypad';
import { AdvancedCalculator, type AdvancedHandle } from '../../components/AdvancedCalculator';
import { describeElement, useAutomaticSpeech } from '../../accessibility/useAutomaticSpeech';
import { FeatureHub } from '../../components/FeatureHub';
import { variableService } from '../../services/VariableService';
import { resultSpeech } from '../../accessibility/resultSpeech';
import { keySpeech } from '../../accessibility/symbolSpeech';
import { Dictation } from '../../components/Dictation';
import { OfflineStatus } from '../../components/OfflineStatus';
import { toggleSign } from '../../parser/toggleSign';
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
  const speechOptions = {
    verbosity: keyboard.verbosity,
    spokenDigits: preferences.spokenDigits,
    decimalSeparator: preferences.decimalSeparator,
  };
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
  const { result, error, explanation } = calculations[calculationKey] ?? emptyCalculation;
  function updateCalculation(patch: Partial<ToolCalculationState>, tool = calculationKey) {
    setCalculations((previous) => ({
      ...previous,
      [tool]: { ...emptyCalculation, ...previous[tool], ...patch },
    }));
  }
  const setError = (error: string) => updateCalculation({ error });
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
    (text: string, voice = true) => {
      const warning = pendingStorageWarning.current;
      pendingStorageWarning.current = '';
      const message = [text, warning].filter(Boolean).join(' ');
      setStatus(message);
      setAnnouncementId((previous) => previous + 1);
      if (voice || warning) {
        cancelAutomatic();
        speech.hablarAutomatico(message);
      }
    },
    [cancelAutomatic],
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
    cancelAutomatic();
    const draft = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '[data-expression], #expression',
      ),
    ).find((element) => element.getClientRects().length)?.value;
    speech.hablar(draft ? mathSpeech(draft) : 'No hay expresión visible en esta sección.');
  }, [cancelAutomatic]);
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
    welcomeDialog.current?.close();
    input.current?.focus();
    openTool('basic', 'expression');
    requestAnimationFrame(() => {
      automatic.cancel();
      if (guided)
        speech.hablarLista(
          [`${welcome} Pasá el puntero sobre cualquier control para escucharlo.${warning}`],
          () => {},
        );
    });
  }
  function insert(value: string, focus = true) {
    justCalculated.current = false;
    const el = input.current;
    const start = el?.selectionStart ?? expression.length;
    const end = el?.selectionEnd ?? start;
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
        result && ['Básico', 'Científico'].includes(result.kind) ? `(${result.value})` : '';
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
      keypadInsert(`(${memory})`);
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
      try {
        next = (
          await client.evaluate(
            `(${memory})${action === 'add' ? '+' : '-'}(${result.value})`,
            preferences.angle,
          )
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
  ) {
    if (computing.current) return;
    computing.current = true;
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
      const calculated = await client.evaluate(value, angle, scope);
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
      if (keyboard.sounds) void feedbackSound.play('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No pude completar el cálculo.';
      updateCalculation({ error: message }, targetTool);
      setStatus('');
      if (document.activeElement === focused) origin?.focus();
      automatic.cancel();
      if (preferences.guided) speech.hablarAutomatico(message);
      if (keyboard.sounds) void feedbackSound.play('error');
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
    justCalculated.current = false;
    setExpression(entry.expression);
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
    const keypad = document.getElementById('keypad-panel') as HTMLDetailsElement | null;
    const draft = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '[data-expression], #expression',
      ),
    ).find((element) => element.getClientRects().length)?.value;
    announce(
      `${section}. ${keyboard.mode === 'math' ? 'Modo teclado matemático' : 'Modo escritura'}. ${preferences.guided ? 'Guía por voz activada' : 'Lector de pantalla externo'}. Campo: ${currentField}. ${draft ? `Expresión: ${mathSpeech(draft)}.` : 'Sin expresión en esta sección.'} ${result ? `Hay resultado: ${resultSpeech(result, speechOptions)}.` : 'Sin resultado.'} ${error ? `Error: ${error}.` : 'Sin errores.'} Teclado de botones ${keypad?.open ? 'abierto' : 'cerrado'}.`,
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
    setPalette(false);
    setFunctionPrompt(null);
    requestAnimationFrame(() => {
      if (dialogOrigin.current?.getClientRects().length) dialogOrigin.current.focus();
      else document.getElementById('view-title')?.focus();
    });
  }
  function exitPractice() {
    setPractice(null);
    focusTarget('keyboard-title');
    announce('Práctica finalizada. Tus datos se conservaron.');
  }
  function explicitRead(message: string) {
    cancelAutomatic();
    speech.hablar(message);
  }
  function executeCommand(command: MathCommand) {
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
      dialogOrigin.current = document.activeElement as HTMLElement;
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
      if (keyboard.sounds) void feedbackSound.play('change');
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
          break;
        case 'read-error':
          explicitRead(error || 'No hay errores.');
          break;
        case 'read-message':
          explicitRead(status || 'No hay un mensaje anterior.');
          break;
        case 'read-tool':
          explicitRead(`Herramienta actual: ${toolName(activeTool)}.`);
          break;
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
        insideApp: !!target?.closest('.app'),
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
        stop: stopAll,
        exitPractice,
        legacy: (event) =>
          handleKeyboard(event, {
            stop: stopAll,
            read: readExpression,
            help: openHelp,
            navigate,
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
              aria-current={!help && view === 'work' && activeTool === 'basic' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate('basic');
              }}
            >
              Calculadora
            </a>
            <a
              href="#view-title"
              aria-current={
                !help && (view === 'tools' || (view === 'work' && activeTool !== 'basic'))
                  ? 'page'
                  : undefined
              }
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
                  Abrí Herramientas para álgebra, matrices, gráficos, estadística y más. Tus datos
                  se conservan al cambiar de herramienta.
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
                role="group"
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
            <div hidden={activeTool !== 'basic' && activeTool !== 'scientific'}>
              <section className="calculator panel" aria-label="Escribir una operación">
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
                    data-preserve-reading
                    className="expression"
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
                      setExpression(value);
                      justCalculated.current = false;
                      setError('');
                      clearTimeout(typingTimer.current);
                      if (preferences.guided && preferences.readTyping)
                        typingTimer.current = setTimeout(
                          () => speech.hablarAutomatico(mathSpeech(value)),
                          900,
                        );
                    }}
                    onKeyDown={(e) => {
                      if (keyboardManager.preservesReaderKeys(e.nativeEvent)) return;
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
                </form>
                {view === 'work' &&
                  !help &&
                  (activeTool === 'basic' || activeTool === 'scientific') && (
                    <Dictation
                      language={preferences.language}
                      guided={preferences.guided}
                      announce={announce}
                      onListeningChange={setListening}
                      confirm={(value, angle) => {
                        setExpression(value);
                        if (angle) changePreferences({ ...preferences, angle });
                        void calculate(value, angle ?? preferences.angle);
                      }}
                    />
                  )}
              </section>
            </div>
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
              announce={announce}
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
            <section className="result panel" aria-labelledby="result-title">
              <h2 id="result-title" tabIndex={-1}>
                Resultado
              </h2>
              {result ? (
                <>
                  <p className="result-expression">{result.expression}</p>
                  <p
                    className={`result-value ${result.table || result.matrix ? 'sr-only' : ['Álgebra', 'Cálculo'].includes(result.kind) ? 'symbolic-value' : ''}`}
                    aria-label={`Resultado: ${result.value}`}
                    data-speech={`Resultado: ${resultSpeech(result, speechOptions)}`}
                  >
                    {result.approximate && <span aria-hidden="true">≈ </span>}
                    {result.value}
                  </p>
                  {!!result.warnings?.length && (
                    <div className="result-warnings">
                      {result.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}
                  {result.matrix && (
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
                            <td data-speech={`${row.label}: ${mathSpeech(row.value)}`}>
                              {row.value}
                            </td>
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
                    <button
                      disabled={!speech.available}
                      onClick={() => {
                        automatic.cancel();
                        speech.hablar(`Resultado: ${resultSpeech(result, speechOptions)}`);
                      }}
                    >
                      Escuchar resultado
                    </button>
                    <button onClick={() => void copy(result.value)}>Copiar resultado</button>
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
                          setGraphRequest({ id: Date.now(), expression: result.value });
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
                  <CalculationSteps
                    steps={result.steps}
                    speak={(text) => {
                      automatic.cancel();
                      speech.hablar(text);
                    }}
                  />
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
            <div hidden={activeTool !== 'basic' && activeTool !== 'scientific'}>
              <details className="panel" id="keypad-panel">
                <summary>Teclado de botones y memoria</summary>
                <p className="hint">
                  Abrí este teclado si preferís calcular con botones. Si escribís con tu teclado
                  físico, podés dejarlo cerrado.
                </p>
                <Keypad
                  insert={keypadInsert}
                  erase={erase}
                  clear={clear}
                  sign={() => {
                    setExpression(toggleSign(expression));
                    justCalculated.current = false;
                  }}
                  calculate={() => void calculate()}
                  busy={busy}
                  memory={memory}
                  onMemory={(action) => void memoryAction(action)}
                />
              </details>
              <details className="panel">
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
                  role="group"
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
          {functionPrompt && (
            <FunctionPrompt
              key={functionPrompt.id}
              command={functionPrompt}
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
            />
          </div>
          <div hidden={view !== 'history' || help}>
            <History
              entries={entries}
              edit={edit}
              recalculate={(entry) => {
                edit(entry);
                void calculate(entry.expression, entry.angleMode, entry.variables ?? variables);
              }}
              remove={(id) => {
                saveHistory(entries.filter((e) => e.id !== id));
                announce('Cálculo eliminado.');
              }}
              clear={() => {
                saveHistory([]);
                announce('Historial vacío.');
              }}
              speak={(text) => {
                automatic.cancel();
                speech.hablar(text);
              }}
              copy={(text) => void copy(text)}
            />
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
