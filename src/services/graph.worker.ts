import { sampleGraph, type GraphRequest } from './GraphService';
self.onmessage = (event: MessageEvent<GraphRequest>) => {
  try {
    self.postMessage({ data: sampleGraph(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'No pude construir el gráfico.',
    });
  }
};
