// Primeros pasos: un recorrido corto y opcional. Cada paso se cumple haciendo la acción de
// verdad, y al cumplirse avanza solo.

import type { ToolId } from '../../components/toolCatalog';

/** Lo que el recorrido mira de la calculadora para saber si un paso se cumplió. */
export interface TutorialState {
  expression: string;
  /** Valor del último resultado de la calculadora, si hay. */
  result: string | null;
  tool: ToolId;
  /** Se abrió el explorador de expresiones desde que empezó el paso. */
  explored: boolean;
}

export interface TutorialStep {
  title: string;
  /** Qué hacer, dicho como se diría en voz alta. */
  text: string;
  /** Lo que se dice al cumplirlo. */
  success: string;
  done: (state: TutorialState) => boolean;
}

const compact = (text: string) => text.replace(/\s+/g, '');

export const tutorialSteps: TutorialStep[] = [
  {
    title: 'Tu primera cuenta',
    text: 'Escribí 2+3 en el campo Expresión matemática y presioná Enter. El resultado se dice y aparece en la pantalla de la calculadora.',
    success: 'Muy bien: 2 más 3 es 5.',
    done: (state) => state.result === '5',
  },
  {
    title: 'Fracciones exactas',
    text: 'Escribí 1/3+1/6. Antes de calcular, Control más Enter la lee para revisarla. Después presioná Enter.',
    success: 'Exacto: un tercio más un sexto es un medio.',
    done: (state) => state.result === '1/2',
  },
  {
    title: 'El teclado de la calculadora',
    text: 'Con Tab llegás al teclado de la calculadora: es una sola parada y las flechas recorren las teclas, que dicen su nombre. Buscá Raíz cuadrada y presioná Enter: se escribe la raíz con el cursor adentro.',
    success: 'Listo: la raíz quedó escrita y podés completar el número.',
    done: (state) => compact(state.expression).includes('sqrt('),
  },
  {
    title: 'Los modos de MENU',
    text: 'La tecla Menú de modos muestra los modos en la pantalla, como en una calculadora de mano. Abrila y elegí Tabla con la tecla 9.',
    success:
      'Estás en el modo Tabla: la herramienta aparece dentro de la calculadora y el teclado escribe en ella.',
    done: (state) => state.tool === 'table',
  },
  {
    title: 'Recorrer una fórmula por partes',
    text: 'Volvé a Calcular con Menú de modos y la tecla 1. Escribí (1+2)/(3+4) y elegí Explorar expresión: con las flechas entrás al numerador y al denominador.',
    success: 'Así se recorre cualquier fórmula o resultado largo. Escape cierra el explorador.',
    done: (state) => state.explored,
  },
  {
    title: 'Siempre hay ayuda',
    text: 'F1 abre la ayuda en cualquier momento, con los atajos esenciales; desde ahí podés volver a este recorrido. Para terminar, elegí Terminar recorrido.',
    success: '',
    done: () => false,
  },
];
