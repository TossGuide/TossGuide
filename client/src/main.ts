/**
 * BinSight app: a small state machine, rendered with plain DOM (no framework).
 *
 *   scan ──(photo)──> thinking ──> decide() ─┬─ answer ──> resolve() ─┬─ final ──────> result
 *    │                                        │                        └─ needs_answer ─> question ─> (resolve again)
 *    └──(type it)──> lookupTyped() ───────────┴─ confirm ─> picker ──(user picks)──> resolve()
 *
 * The model only says what the item IS. Where it GOES always comes from the cited
 * rules engine (@binsight/shared/rules).
 */
import '@fontsource-variable/inter';
import './styles.css';
import { decide, DEFAULT_THRESHOLD, type Decision } from '@binsight/shared/ml/decide';
import type { Candidate } from '@binsight/shared/ml/aggregate';
import { lookupTyped, resolve } from '@binsight/shared/rules/engine';
import { ITEMS, getItem } from '@binsight/shared/rules/items';
import { CONTEXTS, type Answers, type Context, type QuestionId, type Result } from '@binsight/shared/rules/types';
import { fileToPixels, videoToPixels, type Pixels } from './lib/image';
import { load as loadStored, save as saveStored } from './lib/storage';
import { StubClassifier, WorkerClassifier, type Classifier } from './ml/classifier';
import { icon } from './ui/icons';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Screen = 'scan' | 'thinking' | 'question' | 'picker' | 'result' | 'type';
type FinalResult = Extract<Result, { status: 'final' }>;
type QuestionResult = Extract<Result, { status: 'needs_answer' }>;

interface Pending {
  itemId: string;
  answers: Answers;
  /** Model confidence, if it came from the camera (shown as "Looks like: … 87%"). */
  confidence?: number;
  via: 'camera' | 'upload' | 'typed' | 'picker';
}

const isContext = (v: unknown): v is Context => CONTEXTS.includes(v as Context);

const state = {
  screen: 'scan' as Screen,
  context: loadStored<Context>('binsight.context', 'edmonton-residential', isContext),
  model: { status: 'loading' as 'loading' | 'ready' | 'error', progress: 0, error: '' },
  camera: { status: 'idle' as 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' },
  pending: null as Pending | null,
  question: null as QuestionResult | null,
  result: null as FinalResult | null,
  picker: { candidates: [] as Candidate[], reason: '' as string, from: 'camera' as 'camera' | 'typed' },
  typedQuery: '',
  error: '',
  lastPrediction: null as { candidates: Candidate[]; decision: Decision; ms: number } | null,
};

/** Called on every final answer. Phase 2 hooks the impact tally + leaderboard in here. */
const finalResultListeners: ((r: FinalResult, p: Pending) => void)[] = [];
export const onFinalResult = (fn: (r: FinalResult, p: Pending) => void) => finalResultListeners.push(fn);

let classifier: Classifier = new WorkerClassifier(
  () => new Worker(new URL('./ml/classifier.worker.ts', import.meta.url), { type: 'module' }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const $app = document.getElementById('app')!;
const $announcer = document.getElementById('announcer')!;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const itemName = (id: string) => getItem(id)?.name ?? id;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const announce = (msg: string) => {
  $announcer.textContent = '';
  // Re-set on the next frame so screen readers announce repeated identical text too.
  requestAnimationFrame(() => ($announcer.textContent = msg));
};
const CONTEXT_LABEL: Record<Context, string> = { 'edmonton-residential': 'Home', 'uofa-campus': 'Campus' };

// ---------------------------------------------------------------------------
// Camera (one persistent <video>, moved between renders so the stream survives)
// ---------------------------------------------------------------------------

const video = document.createElement('video');
video.playsInline = true;
video.muted = true;
video.setAttribute('aria-label', 'Camera preview');
let stream: MediaStream | null = null;

async function startCamera() {
  if (stream || state.camera.status === 'starting') return;
  if (!navigator.mediaDevices?.getUserMedia) {
    state.camera.status = 'unavailable';
    return render();
  }
  state.camera.status = 'starting';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    state.camera.status = 'live';
  } catch (e) {
    const name = (e as DOMException)?.name;
    state.camera.status = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
  }
  if (state.screen === 'scan') render();
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

function go(screen: Screen) {
  state.screen = screen;
  render();
}

async function classifyPixels(px: Pixels, via: 'camera' | 'upload') {
  state.error = '';
  go('thinking');
  try {
    const { candidates, ms } = await classifier.classify(px);
    const decision = decide(candidates, state.context, { threshold: DEFAULT_THRESHOLD });
    state.lastPrediction = { candidates, decision, ms };
    if (decision.kind === 'answer') {
      startItem({ itemId: decision.itemId, answers: {}, confidence: decision.confidence, via });
    } else {
      // Not sure (or the top guesses go to different bins): ask, never guess.
      const fallback = decision.candidates.length ? decision.candidates : [];
      state.picker = { candidates: fallback, reason: decision.reason, from: 'camera' };
      go('picker');
    }
  } catch (e) {
    state.error = `Couldn’t analyse that photo (${(e as Error).message}). Try again or type it.`;
    go('scan');
  }
}

function startItem(p: Pending) {
  state.pending = p;
  advance();
}

/** Ask the rules engine; show a question, or the final result. */
function advance() {
  const p = state.pending;
  if (!p) return go('scan');
  const r = resolve(p.itemId, state.context, p.answers);
  if (!r.ok) {
    state.error = r.message;
    return go('scan');
  }
  if (r.status === 'needs_answer') {
    state.question = r;
    go('question');
    announce(r.question.text);
    return;
  }
  state.result = r;
  go('result');
  announce(`${r.itemName}: ${r.destination.name}. ${r.reason}`);
  for (const fn of finalResultListeners) fn(r, p);
}

function answer(q: QuestionId, value: boolean) {
  if (!state.pending) return;
  state.pending = { ...state.pending, answers: { ...state.pending.answers, [q]: value } };
  advance();
}

function handleTyped(text: string) {
  state.typedQuery = text;
  const matches = lookupTyped(text);
  const [top, second] = matches;
  if (!top) {
    state.error = `We don’t know “${text}” yet. Try another word, or check the City’s WasteWise app.`;
    return go('type');
  }
  // A clear typed match goes straight through; otherwise let the user choose.
  if (top.score >= 0.9 && (!second || second.score < top.score - 0.1)) {
    return startItem({ itemId: top.itemId, answers: {}, via: 'typed' });
  }
  state.picker = { candidates: matches.slice(0, 3), reason: 'typed', from: 'typed' };
  go('picker');
}

function setContext(c: Context) {
  if (c === state.context) return;
  state.context = c;
  saveStored('binsight.context', c);
  // Re-sort the current item under the new rules: great for showing home vs campus differences.
  if ((state.screen === 'result' || state.screen === 'question') && state.pending) {
    state.pending = { ...state.pending, answers: {} };
    advance();
  } else render();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function topbar() {
  return `
  <header class="topbar">
    <div class="logo"><img class="logo-mark" src="/favicon.svg" alt="" />BinSight</div>
    <div class="context-toggle" role="group" aria-label="Sorting rules">
      ${CONTEXTS.map(
        (c) =>
          `<button type="button" data-action="context" data-context="${c}" aria-pressed="${state.context === c}">${CONTEXT_LABEL[c]}</button>`,
      ).join('')}
    </div>
  </header>`;
}

function scanScreen() {
  const ready = state.model.status === 'ready';
  const cam = state.camera.status;
  const camMsg =
    cam === 'denied'
      ? `<div class="viewport-msg" role="status">${icon('camera', 40)}<h2>Camera is blocked</h2><p>No problem: upload a photo or type the item instead. You can allow the camera in your browser settings.</p></div>`
      : cam === 'unavailable'
        ? `<div class="viewport-msg" role="status">${icon('camera', 40)}<h2>No camera found</h2><p>Upload a photo or type the item instead.</p></div>`
        : cam === 'live'
          ? '<div class="frame-guide"></div>'
          : `<div class="viewport-msg">${icon('camera', 40)}<p>Starting camera…</p></div>`;
  const modelBox =
    state.model.status === 'loading'
      ? `<div class="model-status" role="status" aria-live="polite">
           <span><strong>Loading the on-device model…</strong> (first time only, about 90 MB)</span>
           <div class="progress" role="progressbar" aria-label="Model download" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.model.progress * 100)}"><span style="width:${(state.model.progress * 100).toFixed(1)}%"></span></div>
           <span>You can already <button type="button" class="link-btn" data-action="type">type an item</button>.</span>
         </div>`
      : state.model.status === 'error'
        ? `<div class="error-box" role="alert">Couldn’t load the model: ${esc(state.model.error)}. <button type="button" class="link-btn" data-action="retry-model">Try again</button> or type the item.</div>`
        : '';
  return `
  <section class="scan" aria-labelledby="scan-title">
    <h1 id="scan-title" class="sr-only" tabindex="-1">Scan an item</h1>
    ${state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : ''}
    <div class="viewport" id="viewport">
      ${camMsg}
      <span class="privacy-chip">${icon('lock', 14)} Your photo stays on your phone</span>
    </div>
    ${modelBox}
    <div class="controls">
      <button type="button" class="side-btn" data-action="upload" ${ready ? '' : 'disabled'} aria-label="Upload a photo">${icon('upload')}Upload</button>
      <button type="button" class="shutter" data-action="shutter" ${ready && cam === 'live' ? '' : 'disabled'} aria-label="Scan item">${icon('camera', 34)}</button>
      <button type="button" class="side-btn" data-action="type" aria-label="Type the item">${icon('keyboard')}Type it</button>
    </div>
    <input type="file" id="file" accept="image/*" hidden />
  </section>`;
}

function thinkingScreen() {
  return `<section class="sheet thinking" aria-busy="true"><div class="dots" aria-hidden="true"><span></span><span></span><span></span></div><h1 tabindex="-1" style="margin:0;font-size:1.2rem">Looking closely…</h1><p class="muted" style="margin:0">Running on your phone, not in the cloud.</p></section>`;
}

function questionScreen() {
  const q = state.question!;
  return `
  <section class="sheet" aria-labelledby="q-title">
    <div class="sheet-body">
      <span class="muted">Quick check about your <strong>${esc(q.itemName.toLowerCase())}</strong></span>
      <h1 id="q-title" class="question-text" tabindex="-1">${esc(q.question.text)}</h1>
      ${q.question.hint ? `<p class="muted" style="margin:0">${esc(q.question.hint)}</p>` : ''}
      <div class="yes-no">
        <button type="button" class="btn primary" data-action="answer" data-q="${q.question.id}" data-v="yes">Yes</button>
        <button type="button" class="btn" data-action="answer" data-q="${q.question.id}" data-v="no">No</button>
      </div>
      <button type="button" class="link-btn" data-action="not-right">That’s not a ${esc(q.itemName.toLowerCase())}</button>
    </div>
  </section>`;
}

function pickerScreen() {
  const { candidates, reason } = state.picker;
  const title =
    reason === 'typed' ? 'Did you mean…' : reason === 'destinations_disagree' ? 'Which one is it?' : 'Is this a…';
  const why =
    reason === 'destinations_disagree'
      ? 'These look alike but go in different bins, so we’d rather ask than guess.'
      : reason === 'low_confidence'
        ? 'We’re not sure enough to tell you, and a wrong bin is worse than a quick tap.'
        : reason === 'no_candidates'
          ? 'We couldn’t recognise that one.'
          : '';
  return `
  <section class="sheet" aria-labelledby="p-title">
    <div class="sheet-body">
      <h1 id="p-title" tabindex="-1" style="margin:0">${title}</h1>
      ${why ? `<p class="muted" style="margin:0">${why}</p>` : ''}
      <div class="choices">
        ${candidates
          .map(
            (c) =>
              `<button type="button" class="choice" data-action="pick" data-item="${esc(c.itemId)}">${esc(itemName(c.itemId))}${state.picker.from === 'camera' ? `<small>${pct(c.score)}</small>` : ''}</button>`,
          )
          .join('')}
      </div>
      <button type="button" class="btn block" data-action="type">${icon('keyboard')} Something else: type it</button>
      <button type="button" class="link-btn" data-action="home">Start over</button>
    </div>
  </section>`;
}

function typeScreen() {
  return `
  <section class="sheet" aria-labelledby="t-title">
    <form class="sheet-body type-form" data-form="type" autocomplete="off">
      <h1 id="t-title" style="margin:0">Type the item</h1>
      ${state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : ''}
      <label for="typed">What are you holding?</label>
      <input id="typed" name="typed" list="item-list" placeholder="e.g. coffee cup, battery, chip bag" value="${esc(state.typedQuery)}" required />
      <datalist id="item-list">${ITEMS.map((i) => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
      <button type="submit" class="btn primary block">Find the bin</button>
      <button type="button" class="link-btn" data-action="home">${state.model.status === 'ready' ? 'Use the camera instead' : 'Back'}</button>
    </form>
  </section>`;
}

function resultScreen() {
  const r = state.result!;
  const p = state.pending;
  const d = r.destination;
  const label = r.uncertain ? 'Not sure? Check first' : r.context === 'uofa-campus' ? 'On campus, use' : 'At home, use';
  const seen =
    p?.confidence !== undefined
      ? `Looks like: <strong>${esc(r.itemName)}</strong>, ${pct(p.confidence)}`
      : `Item: <strong>${esc(r.itemName)}</strong>`;
  return `
  <section class="sheet result" aria-labelledby="r-title" data-destination="${d.id}">
    <div class="dest" data-colour="${d.colour}">
      <div class="dest-icon">${icon(d.icon, 36)}</div>
      <div>
        <div class="dest-label">${label}</div>
        <h1 id="r-title" class="dest-name" tabindex="-1">${esc(d.name)}</h1>
      </div>
    </div>
    <div class="sheet-body">
      <div class="seen-as">${seen}</div>
      <p class="reason">${esc(r.reason)}</p>
      ${
        r.prep.length
          ? `<ul class="prep" aria-label="Before you toss it">${r.prep.map((s) => `<li>${icon('check', 18)}<span>${esc(s)}</span></li>`).join('')}</ul>`
          : ''
      }
      ${r.alternative ? `<div class="callout">${esc(r.alternative.note)}</div>` : ''}
      ${r.uncertain ? `<div class="callout warn">The official guidance doesn’t clearly cover this item, so we won’t guess.</div>` : ''}
      <div class="sources">
        <span>Source${r.sources.length > 1 ? 's' : ''}:</span>
        ${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('')}
      </div>
      <div class="actions">
        <button type="button" class="btn" data-action="not-right">Not right?</button>
        <button type="button" class="btn primary" data-action="home">${icon('camera', 20)} Scan another</button>
      </div>
    </div>
  </section>`;
}

let lastScreen: Screen | null = null;

function render() {
  const screens: Record<Screen, () => string> = {
    scan: scanScreen,
    thinking: thinkingScreen,
    question: questionScreen,
    picker: pickerScreen,
    result: resultScreen,
    type: typeScreen,
  };
  $app.innerHTML = `<div class="app">${topbar()}<main class="main" id="main">${screens[state.screen]()}</main></div>`;

  if (state.screen === 'scan') {
    document.getElementById('viewport')?.prepend(video);
    void startCamera();
  }
  // Move focus to the new screen's heading so keyboard and screen-reader users follow along.
  if (lastScreen !== state.screen) {
    const target =
      state.screen === 'type'
        ? (document.getElementById('typed') as HTMLElement | null)
        : ($app.querySelector('h1[tabindex="-1"]') as HTMLElement | null);
    if (lastScreen !== null) target?.focus();
    lastScreen = state.screen;
  }
  exposeTestHook();
}

// ---------------------------------------------------------------------------
// Events (one delegated listener)
// ---------------------------------------------------------------------------

$app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  switch (el.dataset.action) {
    case 'context':
      setContext(el.dataset.context as Context);
      break;
    case 'shutter':
      if (state.camera.status === 'live' && video.videoWidth) void classifyPixels(videoToPixels(video), 'camera');
      break;
    case 'upload':
      document.getElementById('file')?.click();
      break;
    case 'type':
      state.error = '';
      go('type');
      break;
    case 'home':
      state.error = '';
      state.pending = null;
      go('scan');
      break;
    case 'answer':
      answer(el.dataset.q as QuestionId, el.dataset.v === 'yes');
      break;
    case 'pick':
      startItem({ itemId: el.dataset.item!, answers: {}, via: 'picker' });
      break;
    case 'not-right': {
      // Offer the model's other guesses if we have them, else go to typing.
      const others = state.lastPrediction?.candidates.filter((c) => c.itemId !== state.pending?.itemId).slice(0, 3);
      if (state.pending?.via !== 'typed' && others?.length) {
        state.picker = { candidates: others, reason: 'not_right', from: 'camera' };
        go('picker');
      } else go('type');
      break;
    }
    case 'retry-model':
      void loadModel();
      break;
  }
});

$app.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id !== 'file' || !input.files?.[0]) return;
  const file = input.files[0];
  input.value = '';
  try {
    await classifyPixels(await fileToPixels(file), 'upload');
  } catch {
    state.error = 'Couldn’t read that image. Try a JPEG or PNG photo.';
    go('scan');
  }
});

$app.addEventListener('submit', (e) => {
  const form = (e.target as HTMLElement).closest('form[data-form="type"]');
  if (!form) return;
  e.preventDefault();
  const text = (new FormData(form as HTMLFormElement).get('typed') as string | null)?.trim() ?? '';
  state.error = '';
  if (text) handleTyped(text);
});

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------

let lastProgressRender = 0;
async function loadModel() {
  state.model = { status: 'loading', progress: 0, error: '' };
  render();
  try {
    await classifier.load((f) => {
      state.model.progress = f;
      // Throttle re-renders during download.
      const now = performance.now();
      if (state.screen === 'scan' && now - lastProgressRender > 250) {
        lastProgressRender = now;
        const bar = document.querySelector<HTMLElement>('.progress > span');
        const pb = document.querySelector<HTMLElement>('.progress');
        if (bar && pb) {
          bar.style.width = `${(f * 100).toFixed(1)}%`;
          pb.setAttribute('aria-valuenow', String(Math.round(f * 100)));
        }
      }
    });
    state.model.status = 'ready';
  } catch (e) {
    state.model = { status: 'error', progress: 0, error: (e as Error).message };
  }
  if (state.screen === 'scan' || state.screen === 'type') render();
  else exposeTestHook();
}

// ---------------------------------------------------------------------------
// Test hook (non-production builds only): window.__binsight for Playwright
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __binsight?: Record<string, unknown>;
  }
}
const TEST_HOOK = import.meta.env.DEV || import.meta.env.VITE_TEST_HOOK === '1';

function exposeTestHook() {
  if (!TEST_HOOK) return;
  window.__binsight = {
    ...(window.__binsight ?? {}),
    modelReady: state.model.status === 'ready',
    lastPrediction: state.lastPrediction,
    lastResult: state.result,
    context: state.context,
    screen: state.screen,
    /** Replace the real model with fixed candidates (deterministic e2e tests). */
    useStub: (candidates: Candidate[]) => {
      classifier = new StubClassifier(candidates);
      state.model = { status: 'ready', progress: 1, error: '' };
      render();
    },
    /** Classify an RGBA image without a camera (stub or real model). */
    classifyPixels: (px: Pixels) => classifyPixels(px, 'upload'),
  };
}

// Boot
const params = new URLSearchParams(location.search);
render();
if (!(TEST_HOOK && params.has('stub'))) void loadModel();
else {
  classifier = new StubClassifier([]);
  state.model = { status: 'ready', progress: 1, error: '' };
  render();
}
