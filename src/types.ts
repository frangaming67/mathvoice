export type AngleMode = 'rad' | 'deg' | 'grad';
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
  variables?: Record<string, number>;
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
};
