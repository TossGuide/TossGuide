/** Messages between the UI thread and the model Web Worker. */
import type { Candidate } from '@trashifyyeg/shared/ml/aggregate';

export type ToWorker =
  | { type: 'load' }
  | { type: 'classify'; id: number; image: { data: Uint8ClampedArray; width: number; height: number } };

export type FromWorker =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready'; device: string; loadMs: number }
  | { type: 'result'; id: number; candidates: Candidate[]; ms: number }
  | { type: 'error'; id?: number; message: string };
