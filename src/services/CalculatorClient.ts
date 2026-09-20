import type { AngleMode, CalculationResult } from '../types';
export class CalculatorClient {
  async evaluate(
    expression: string,
    angle: AngleMode,
    variables: Record<string, number> = {},
  ): Promise<CalculationResult> {
    const worker = new Worker(new URL('./calculator.worker.ts', import.meta.url), {
      type: 'module',
    });
    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error('El cálculo tardó demasiado. Probá una expresión más sencilla.'));
      }, 6000);
      worker.onmessage = (event: MessageEvent<{ result: CalculationResult; error?: string }>) => {
        finish();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      worker.onerror = () => {
        finish();
        reject(new Error('No se pudo iniciar el motor matemático. Volvé a intentarlo.'));
      };
      worker.postMessage({ expression, angle, variables });
    });
  }
}
