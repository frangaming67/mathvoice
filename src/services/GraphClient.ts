import type { GraphData, GraphRequest } from './GraphService';
export function buildGraph(request: GraphRequest): Promise<GraphData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./graph.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error('El gráfico tardó demasiado. Simplificá las funciones.'));
    }, 6000);
    worker.onmessage = (event: MessageEvent<{ data: GraphData; error?: string }>) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.data);
    };
    worker.onerror = () => {
      finish();
      reject(new Error('No pude iniciar el motor de gráficos.'));
    };
    worker.postMessage(request);
  });
}
