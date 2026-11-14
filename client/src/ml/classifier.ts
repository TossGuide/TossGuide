/**
 * Main-thread wrapper around the model worker: turns postMessage into Promises.
 *
 * It takes a factory instead of `new Worker(...)` directly so unit tests can pass
 * a fake worker, and so the Playwright test hook can swap in a stub classifier.
 */
import type { Candidate } from '@trashifyyeg/shared/ml/aggregate';
import type { Pixels } from '../lib/image';
import type { FromWorker, ToWorker } from './protocol';

export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null;
  terminate(): void;
}

export interface ClassifyResult {
  candidates: Candidate[];
  ms: number;
}

export interface Classifier {
  load(onProgress?: (fraction: number) => void): Promise<void>;
  classify(px: Pixels): Promise<ClassifyResult>;
  readonly ready: boolean;
}

export class WorkerClassifier implements Classifier {
  private worker: WorkerLike;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: ClassifyResult) => void; reject: (e: Error) => void }>();
  private loadPromise: Promise<void> | null = null;
  private onProgress?: (fraction: number) => void;
  private loadSettle?: { resolve: () => void; reject: (e: Error) => void };
  /** Bytes per model file, so progress across several files is one smooth bar. */
  private files = new Map<string, { loaded: number; total: number }>();
  ready = false;

  constructor(factory: () => WorkerLike) {
    this.worker = factory();
    this.worker.onmessage = (e) => this.handle(e.data);
  }

  load(onProgress?: (fraction: number) => void): Promise<void> {
    this.onProgress = onProgress;
    this.loadPromise ??= new Promise<void>((resolve, reject) => {
      this.loadSettle = { resolve, reject };
      this.worker.postMessage({ type: 'load' });
    });
    return this.loadPromise;
  }

  classify(px: Pixels): Promise<ClassifyResult> {
    if (!this.ready) return Promise.reject(new Error('Model not ready'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      // Copy into a fresh buffer we can transfer (zero-copy hand-off to the worker).
      const data = new Uint8ClampedArray(px.data);
      this.worker.postMessage({ type: 'classify', id, image: { data, width: px.width, height: px.height } }, [data.buffer]);
    });
  }

  private handle(m: FromWorker) {
    switch (m.type) {
      case 'progress': {
        this.files.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0;
        let total = 0;
        for (const f of this.files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        if (total > 0) this.onProgress?.(Math.min(1, loaded / total));
        break;
      }
      case 'ready':
        this.ready = true;
        this.onProgress?.(1);
        this.loadSettle?.resolve();
        break;
      case 'result':
        this.pending.get(m.id)?.resolve({ candidates: m.candidates, ms: m.ms });
        this.pending.delete(m.id);
        break;
      case 'error':
        if (m.id !== undefined) {
          this.pending.get(m.id)?.reject(new Error(m.message));
          this.pending.delete(m.id);
        } else {
          this.loadPromise = null; // let the user retry loading
          this.loadSettle?.reject(new Error(m.message));
        }
        break;
    }
  }
}

/** Deterministic stand-in used by tests (via the window.__trashifyyeg hook). */
export class StubClassifier implements Classifier {
  ready = true;
  constructor(public candidates: Candidate[] = []) {}
  async load() {}
  async classify(): Promise<ClassifyResult> {
    return { candidates: this.candidates, ms: 1 };
  }
}
