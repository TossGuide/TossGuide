import { describe, expect, it } from 'vitest';
import { WorkerClassifier, type WorkerLike } from '../src/ml/classifier';
import type { FromWorker, ToWorker } from '../src/ml/protocol';

/** A fake worker that replies like the real one, so we test the wrapper without a model. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  sent: ToWorker[] = [];
  failLoad = false;
  postMessage(msg: ToWorker) {
    this.sent.push(msg);
    queueMicrotask(() => {
      if (msg.type === 'load') {
        if (this.failLoad) return this.emit({ type: 'error', message: 'network down' });
        this.emit({ type: 'progress', file: 'a.onnx', loaded: 50, total: 100 });
        this.emit({ type: 'progress', file: 'b.json', loaded: 10, total: 100 });
        this.emit({ type: 'ready', device: 'wasm', loadMs: 5 });
      } else {
        if (msg.image.width === 0) return this.emit({ type: 'error', id: msg.id, message: 'bad image' });
        this.emit({ type: 'result', id: msg.id, candidates: [{ itemId: 'pop_can', score: 0.9 }], ms: 3 });
      }
    });
  }
  emit(m: FromWorker) {
    this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
  }
  terminate() {}
}

const px = (w = 2) => ({ data: new Uint8ClampedArray(w * 2 * 4), width: w, height: 2 });

describe('WorkerClassifier', () => {
  it('reports combined progress across files, then becomes ready', async () => {
    const w = new FakeWorker();
    const c = new WorkerClassifier(() => w);
    const seen: number[] = [];
    await c.load((f) => seen.push(f));
    expect(c.ready).toBe(true);
    expect(seen).toEqual([0.5, 0.3, 1]);
  });
  it('only sends one load message even if load() is called twice', async () => {
    const w = new FakeWorker();
    const c = new WorkerClassifier(() => w);
    await Promise.all([c.load(), c.load()]);
    expect(w.sent.filter((m) => m.type === 'load')).toHaveLength(1);
  });
  it('refuses to classify before the model is ready', async () => {
    const c = new WorkerClassifier(() => new FakeWorker());
    await expect(c.classify(px())).rejects.toThrow(/not ready/);
  });
  it('routes results and errors to the right request', async () => {
    const c = new WorkerClassifier(() => new FakeWorker());
    await c.load();
    const [ok, bad] = await Promise.allSettled([c.classify(px()), c.classify(px(0))]);
    expect(ok.status === 'fulfilled' && ok.value.candidates[0]!.itemId).toBe('pop_can');
    expect(bad.status === 'rejected' && (bad.reason as Error).message).toBe('bad image');
  });
  it('a failed load can be retried', async () => {
    const w = new FakeWorker();
    w.failLoad = true;
    const c = new WorkerClassifier(() => w);
    await expect(c.load()).rejects.toThrow(/network/);
    w.failLoad = false;
    await c.load();
    expect(c.ready).toBe(true);
  });
});
