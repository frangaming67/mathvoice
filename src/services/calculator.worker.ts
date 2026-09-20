import { MathEngine } from './MathEngine';
import type { AngleMode } from '../types';
const engine = new MathEngine();
self.onmessage = (
  event: MessageEvent<{ expression: string; angle: AngleMode; variables: Record<string, number> }>,
) => {
  try {
    self.postMessage({
      result: engine.evaluate(event.data.expression, event.data.angle, event.data.variables),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'No pude completar el cálculo.',
    });
  }
};
