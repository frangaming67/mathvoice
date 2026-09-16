import { MathEngine } from './MathEngine';
import type { AngleMode } from '../types';
const engine = new MathEngine();
self.onmessage = (event: MessageEvent<{ expression: string; angle: AngleMode }>) => {
  try {
    self.postMessage({ result: engine.evaluate(event.data.expression, event.data.angle) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'No pude completar el cálculo.',
    });
  }
};
