import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CalculatorClient,
  type WorkerLike,
  type WorkerRequest,
  type WorkerResponse,
} from './CalculatorClient';
import { MathInputError } from './mathErrors';
import type { CalculationResult } from '../types';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;
  postMessage(message: unknown) {
    this.posted.push(message as WorkerRequest);
  }
  terminate() {
    this.terminated = true;
  }
  send(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent);
  }
  last() {
    return this.posted[this.posted.length - 1];
  }
  answer(value: string) {
    const { id, expression } = this.last();
    this.send({ type: 'start', id });
    this.send({ type: 'result', id, result: { value, expression } as CalculationResult });
  }
}

let workers: FakeWorker[];
const create = () => {
  const worker = new FakeWorker();
  workers.push(worker);
  return worker;
};
const settled = async <T>(promise: Promise<T>) => {
  let state: 'pendiente' | 'resuelta' | 'rechazada' = 'pendiente';
  promise.then(
    () => (state = 'resuelta'),
    () => (state = 'rechazada'),
  );
  await Promise.resolve();
  await Promise.resolve();
  return state;
};

beforeEach(() => {
  workers = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('Worker persistente', () => {
  it('reutiliza el mismo Worker en cálculos sucesivos', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const first = client.evaluate('2+2', 'rad');
    workers[0].send({ type: 'ready' });
    workers[0].answer('4');
    await expect(first).resolves.toMatchObject({ value: '4' });
    const second = client.evaluate('3*3', 'deg');
    workers[0].answer('9');
    await expect(second).resolves.toMatchObject({ value: '9' });
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(false);
  });

  it('warmup carga el motor antes del primer cálculo', () => {
    const client = new CalculatorClient({ createWorker: create });
    client.warmup();
    expect(workers).toHaveLength(1);
    workers[0].send({ type: 'ready' });
    void client.evaluate('1+1', 'rad');
    expect(workers).toHaveLength(1);
    expect(workers[0].last()).toMatchObject({ type: 'evaluate', expression: '1+1' });
  });

  it('envía las opciones y acepta la firma vieja', () => {
    const client = new CalculatorClient({ createWorker: create });
    void client.evaluate('sin(30)', 'deg', { a: 1 });
    expect(workers[0].last()).toMatchObject({ options: { angle: 'deg' }, variables: { a: 1 } });
    workers[0].answer('0.5');
    void client.evaluate('2,5', { angle: 'rad', decimalSeparator: 'coma', ans: '3' });
    expect(workers[0].last().options).toEqual({ angle: 'rad', decimalSeparator: 'coma', ans: '3' });
  });

  it('atiende un cálculo por vez, en orden', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const first = client.evaluate('1', 'rad');
    const second = client.evaluate('2', 'rad');
    workers[0].send({ type: 'ready' });
    expect(workers[0].posted).toHaveLength(1);
    expect(client.busy).toBe(true);
    workers[0].answer('1');
    expect(workers[0].posted).toHaveLength(2);
    workers[0].answer('2');
    await expect(first).resolves.toMatchObject({ value: '1' });
    await expect(second).resolves.toMatchObject({ value: '2' });
    expect(client.busy).toBe(false);
  });
});

describe('tiempo límite', () => {
  it('mide el cálculo y no la carga del motor', async () => {
    const client = new CalculatorClient({ createWorker: create, timeout: 6000 });
    const result = client.evaluate('2+2', 'rad');
    vi.advanceTimersByTime(9000);
    expect(await settled(result)).toBe('pendiente');
    workers[0].send({ type: 'ready' });
    workers[0].send({ type: 'start', id: workers[0].last().id });
    vi.advanceTimersByTime(5999);
    expect(await settled(result)).toBe('pendiente');
    workers[0].answer('4');
    await expect(result).resolves.toMatchObject({ value: '4' });
  });

  it('al vencer termina el Worker y crea otro para el siguiente cálculo', async () => {
    const client = new CalculatorClient({ createWorker: create, timeout: 6000 });
    const slow = client.evaluate('factorial(99999)', 'rad');
    const next = client.evaluate('1+1', 'rad');
    workers[0].send({ type: 'ready' });
    workers[0].send({ type: 'start', id: workers[0].last().id });
    vi.advanceTimersByTime(6001);
    const error = await slow.catch((e: MathInputError) => e);
    expect(error).toBeInstanceOf(MathInputError);
    expect((error as MathInputError).code).toBe('tiempo');
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].last()).toMatchObject({ expression: '1+1' });
    workers[1].send({ type: 'ready' });
    workers[1].answer('2');
    await expect(next).resolves.toMatchObject({ value: '2' });
  });

  it('si el motor no carga nunca, avisa', async () => {
    const client = new CalculatorClient({ createWorker: create, loadTimeout: 20000 });
    const result = client.evaluate('2+2', 'rad');
    vi.advanceTimersByTime(20001);
    await expect(result).rejects.toMatchObject({ code: 'motor' });
  });
});

describe('cancelar y errores', () => {
  it('cancel corta el cálculo, rechaza y deja otro motor listo', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const result = client.evaluate('integrate(x,x)', 'rad');
    workers[0].send({ type: 'ready' });
    expect(client.cancel()).toBe(true);
    await expect(result).rejects.toMatchObject({
      code: 'cancelado',
      message: 'Cálculo cancelado.',
    });
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(client.cancel()).toBe(false);
  });

  it('el error cruza con código y posición sobre el texto original', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const result = client.evaluate('sqrt(2', 'rad');
    const { id } = workers[0].last();
    workers[0].send({ type: 'ready' });
    workers[0].send({
      type: 'error',
      id,
      error: {
        message: 'Falta cerrar 1 paréntesis abierto en la posición 5.',
        code: 'parentesis',
        position: 5,
      },
    });
    const error = (await result.catch((e: MathInputError) => e)) as MathInputError;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Falta cerrar 1 paréntesis abierto en la posición 5.');
    expect((error as MathInputError).position).toBe(5);
    expect((error as MathInputError).code).toBe('parentesis');
  });

  it('si el Worker falla, rechaza y se recupera', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const result = client.evaluate('2+2', 'rad');
    workers[0].onerror?.(new Event('error') as ErrorEvent);
    await expect(result).rejects.toMatchObject({ code: 'motor' });
    const again = client.evaluate('2+2', 'rad');
    expect(workers).toHaveLength(2);
    workers[1].send({ type: 'ready' });
    workers[1].answer('4');
    await expect(again).resolves.toMatchObject({ value: '4' });
  });

  it('ignora mensajes de un Worker ya descartado', async () => {
    const client = new CalculatorClient({ createWorker: create });
    const result = client.evaluate('2+2', 'rad');
    const stale = workers[0];
    client.cancel();
    await result.catch(() => undefined);
    const fresh = client.evaluate('3+3', 'rad');
    stale.send({ type: 'result', id: 2, result: { value: 'viejo' } as CalculationResult });
    workers[1].send({ type: 'ready' });
    workers[1].answer('6');
    await expect(fresh).resolves.toMatchObject({ value: '6' });
  });
});
