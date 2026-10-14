import type { AngleMode, CalculationResult, EvaluateOptions } from '../types';
import { MathInputError, mathErrorFrom, type SerializedMathError } from './mathErrors';

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface WorkerRequest {
  type: 'evaluate';
  id: number;
  expression: string;
  options: EvaluateOptions;
  variables: Record<string, number>;
}

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'start'; id: number }
  | { type: 'result'; id: number; result: CalculationResult }
  | { type: 'error'; id: number; error: SerializedMathError };

export interface CalculatorClientOptions {
  createWorker?: () => WorkerLike;
  /** Tiempo máximo de un cálculo, sin contar la carga del motor. */
  timeout?: number;
  /** Tiempo máximo para que el motor termine de cargar. */
  loadTimeout?: number;
}

interface Job {
  request: WorkerRequest;
  resolve: (result: CalculationResult) => void;
  reject: (error: MathInputError) => void;
}

const createCalculatorWorker = (): WorkerLike =>
  new Worker(new URL('./calculator.worker.ts', import.meta.url), { type: 'module' });

/**
 * Motor de cálculo en un Worker persistente: se carga una vez, atiende un cálculo por vez
 * y se recrea si un cálculo vence el tiempo o se cancela.
 */
export class CalculatorClient {
  private readonly createWorker: () => WorkerLike;
  private readonly timeout: number;
  private readonly loadTimeout: number;
  private worker?: WorkerLike;
  private ready = false;
  private current?: Job;
  private queue: Job[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private loadTimer?: ReturnType<typeof setTimeout>;
  private nextId = 1;

  constructor(options: CalculatorClientOptions = {}) {
    this.createWorker = options.createWorker ?? createCalculatorWorker;
    this.timeout = options.timeout ?? 6000;
    this.loadTimeout = options.loadTimeout ?? 30000;
  }

  /** Hay un cálculo en curso o en espera. */
  get busy() {
    return !!this.current || this.queue.length > 0;
  }

  /** Carga el motor por adelantado (por ejemplo, en requestIdleCallback al abrir la app). */
  warmup() {
    this.ensureWorker();
  }

  evaluate(
    expression: string,
    angleOrOptions: AngleMode | EvaluateOptions,
    variables: Record<string, number> = {},
  ): Promise<CalculationResult> {
    const options = typeof angleOrOptions === 'string' ? { angle: angleOrOptions } : angleOrOptions;
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.queue.push({
        request: { type: 'evaluate', id, expression, options, variables },
        resolve,
        reject,
      });
      this.pump();
    });
  }

  /** Corta el cálculo en curso y los que esperan. Devuelve true si había algo para cancelar. */
  cancel(): boolean {
    const pending = [this.current, ...this.queue].filter((job): job is Job => !!job);
    if (!pending.length) return false;
    this.current = undefined;
    this.queue = [];
    this.reset();
    pending.forEach((job) => job.reject(new MathInputError('Cálculo cancelado.', 'cancelado')));
    this.ensureWorker();
    return true;
  }

  /** Libera el Worker; los cálculos pendientes se cancelan. */
  dispose() {
    const pending = [this.current, ...this.queue].filter((job): job is Job => !!job);
    this.current = undefined;
    this.queue = [];
    this.reset();
    pending.forEach((job) => job.reject(new MathInputError('Cálculo cancelado.', 'cancelado')));
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    this.worker = worker;
    this.ready = false;
    worker.onmessage = (event: MessageEvent) => this.receive(worker, event.data as WorkerResponse);
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault?.();
      this.crash(worker);
    };
    this.loadTimer = setTimeout(() => this.crash(worker), this.loadTimeout);
    return worker;
  }

  private pump() {
    if (this.current || !this.queue.length) return;
    const worker = this.ensureWorker();
    this.current = this.queue.shift()!;
    worker.postMessage(this.current.request);
    if (this.ready) this.startTimer();
  }

  private startTimer() {
    clearTimeout(this.timer);
    const job = this.current;
    if (!job) return;
    this.timer = setTimeout(() => {
      if (this.current !== job) return;
      this.current = undefined;
      this.reset();
      job.reject(
        new MathInputError(
          'El cálculo tardó demasiado. Probá una expresión más sencilla.',
          'tiempo',
        ),
      );
      this.pump();
    }, this.timeout);
  }

  private receive(worker: WorkerLike, data: WorkerResponse) {
    if (worker !== this.worker || !data) return;
    if (data.type === 'ready') {
      this.ready = true;
      clearTimeout(this.loadTimer);
      this.startTimer();
      return;
    }
    const job = this.current;
    if (!job || job.request.id !== data.id) return;
    if (data.type === 'start') {
      this.startTimer();
      return;
    }
    clearTimeout(this.timer);
    this.current = undefined;
    if (data.type === 'result') job.resolve(data.result);
    else job.reject(mathErrorFrom(data.error));
    this.pump();
  }

  private crash(worker: WorkerLike) {
    if (worker !== this.worker) return;
    const job = this.current;
    this.current = undefined;
    this.reset();
    job?.reject(
      new MathInputError('No se pudo iniciar el motor matemático. Volvé a intentarlo.', 'motor'),
    );
    this.pump();
  }

  private reset() {
    clearTimeout(this.timer);
    clearTimeout(this.loadTimer);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
  }
}
