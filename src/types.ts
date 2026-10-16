export type AngleMode = 'rad' | 'deg' | 'grad';
export type DecimalSeparator = 'punto' | 'coma';
/** Cómo se muestra un número decimal: tal cual, con decimales fijos o en notación científica. */
export type NumberFormat = 'normal' | 'fijo' | 'cientifico';
/** Forma principal del resultado: automática según la entrada, decimal, exacta (fracción) o ambas. */
export type ResultForm = 'auto' | 'decimal' | 'exacto' | 'ambos';
/** En modo real, un resultado no real es un error explicado; en modo complejo se devuelve. */
export type NumberMode = 'real' | 'complejo';
/** Cómo se expone la matemática a un lector de pantalla externo. */
export type ScreenReaderMath = 'mathml' | 'texto';
/** Lo que dice una celda de la tabla de valores donde la función no está definida. */
export const UNDEFINED_CELL = 'No definida';
export interface EvaluateOptions {
  angle: AngleMode;
  decimalSeparator?: DecimalSeparator;
  numberMode?: NumberMode;
  resultForm?: ResultForm;
  numberFormat?: NumberFormat;
  /** Decimales en formato fijo o cifras significativas en normal/científico. */
  numberDigits?: number;
  /** Último resultado válido; se usa como «ans» o «resultado» en la expresión. */
  ans?: string;
}
export interface CalculationStep {
  title: string;
  detail: string;
  formula?: string;
}
export interface CalculationResult {
  expression: string;
  value: string;
  decimal?: string;
  unit?: string;
  kind: string;
  explanation: string;
  angleMode: AngleMode;
  assigned?: { name: string; value: number };
  table?: { label: string; value: string }[];
  matrix?: string[][];
  /** Encabezados de las columnas de `matrix` cuando es una tabla de valores: x, f(x), g(x). */
  headers?: string[];
  variables?: Record<string, number>;
  steps?: CalculationStep[];
  /** Forma exacta (fracción o simbólica) cuando el valor principal es decimal. */
  exact?: string;
  /** Base del valor cuando es una conversión de bases o una operación binaria. */
  radix?: 2 | 8 | 10 | 16;
  /** El valor es un número complejo. */
  complex?: boolean;
  /** El valor es una función de x que se puede graficar. */
  graphable?: boolean;
  /** El valor es una aproximación numérica (cuadratura, raíces numéricas, etc.). */
  approximate?: boolean;
  /** Avisos que acompañan al resultado y deben leerse con él. */
  warnings?: string[];
  /** Descripción legible de la operación, en palabras. */
  description?: string;
  /** Separador decimal con que está escrito el valor; si falta, punto. */
  separator?: DecimalSeparator;
}
export interface HistoryEntry extends CalculationResult {
  id: string;
  date: string;
}
export interface Preferences {
  guided: boolean;
  welcomed: boolean;
  language: string;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  autoRead: boolean;
  readFocus: boolean;
  readHover: boolean;
  readTyping: boolean;
  readKeys: boolean;
  theme: string;
  fontSize: number;
  scale: number;
  spacing: number;
  maximum: boolean;
  angle: AngleMode;
  decimalSeparator: DecimalSeparator;
  numberFormat: NumberFormat;
  numberDigits: number;
  /** Cifras significativas al hablar un decimal; 0 lee todas. */
  spokenDigits: number;
  resultForm: ResultForm;
  numberMode: NumberMode;
  srMath: ScreenReaderMath;
  tutorialSeen: boolean;
}
export const defaultPreferences: Preferences = {
  guided: false,
  welcomed: false,
  language: 'es-AR',
  voice: '',
  rate: 1,
  pitch: 1,
  volume: 1,
  autoRead: true,
  readFocus: true,
  readHover: true,
  readTyping: false,
  readKeys: false,
  theme: 'light',
  fontSize: 18,
  scale: 1,
  spacing: 1.6,
  maximum: false,
  angle: 'rad',
  decimalSeparator: 'punto',
  numberFormat: 'normal',
  numberDigits: 10,
  spokenDigits: 6,
  resultForm: 'auto',
  numberMode: 'real',
  srMath: 'mathml',
  tutorialSeen: false,
};
