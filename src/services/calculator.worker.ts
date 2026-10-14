import { MathEngine } from './MathEngine';
import { serializeMathError } from './mathErrors';
import type { WorkerRequest, WorkerResponse } from './CalculatorClient';
const engine = new MathEngine();
const reply = (message: WorkerResponse) => self.postMessage(message);
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, expression, options, variables } = event.data;
  reply({ type: 'start', id });
  try {
    reply({ type: 'result', id, result: engine.evaluate(expression, options, variables) });
  } catch (error) {
    reply({ type: 'error', id, error: serializeMathError(error) });
  }
};
reply({ type: 'ready' });
