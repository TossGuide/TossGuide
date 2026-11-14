/**
 * Trashify app: a small state machine, rendered with plain DOM (no framework).
 *
 *   scan ──(photo)──> thinking ──> decide() ─┬─ answer ──> resolve() ─┬─ final ──────> result
 *    │                                        │                        └─ needs_answer ─> question ─> (resolve again)
 *    └──(type it)──> lookupTyped() ───────────┴─ confirm ─> picker ──(user picks)──> resolve()
 *
 * The model only says what the item IS. Where it GOES always comes from the cited
 * rules engine (@trashify/shared/rules).
 */
import '@fontsource-variable/inter';
import './styles.css';
import { decide, DEFAULT_THRESHOLD, type Decision } from '@trashify/shared/ml/decide';
import type { Candidate } from '@trashify/shared/ml/aggregate';
import { lookupTyped, resolve } from '@trashify/shared/rules/engine';
import { ITEMS, getItem } from '@trashify/shared/rules/items';
import { CONTEXTS, type Answers, type Context, type QuestionId, type Result } from '@trashify/shared/rules/types';
import { fileToPixels, videoToPixels, type Pixels } from './lib/image';
import { load as loadStored, migrateLegacyKeys, save as saveStored } from './lib/storage';
import { StubClassifier, WorkerClassifier, type Classifier } from './ml/classifier';
import { icon } from './ui/icons';
import { FACULTIES } from '@trashify/shared/faculties';
import { countResult, EMPTY_TALLY_STATE, formatCo2, sanitize, type TallyState } from './lib/tally';
import { flushOutbox, getLeaderboard, postScan, type Leaderboard, type ScanPayload } from './lib/api';
import { aboutScreen } from './ui/about';
import { sound } from './lib/sound';
import { canSpeak, speak } from './lib/speech';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Screen = 'scan' | 'thinking' | 'question' | 'picker' | 'result' | 'type' | 'impact' | 'about';
type FinalResult = Extract<Result, { status: 'final' }>;
type QuestionResult = Extract<Result, { status: 'needs_answer' }>;

interface Pending {
  /** One physical item being sorted. Corrections keep the id, so it's counted once. */
  scanId: string;
  itemId: string;
  answers: Answers;
  /** Model confidence, if it came from the camera (shown as "Looks like: … 87%"). */
  confidence?: number;
  via: 'camera' | 'upload' | 'typed' | 'picker';
}

migrateLegacyKeys(); // before `state` reads saved settings below

const isContext = (v: unknown): v is Context => CONTEXTS.includes(v as Context);
const isFaculty = (v: unknown): v is string => typeof v === 'string' && (FACULTIES as readonly string[]).includes(v);
const isAnything = (v: unknown): v is unknown => v !== undefined;
let scanCounter = 0;
const newScanId = () => `${Date.now().toString(36)}-${(scanCounter++).toString(36)}`;

const state = {
  screen: 'scan' as Screen,
  context: loadStored<Context>('trashify.context', 'edmonton-residential', isContext),
  model: { status: 'loading' as 'loading' | 'ready' | 'error', progress: 0, error: '' },
  camera: { status: 'idle' as 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' },
  pending: null as Pending | null,
  question: null as QuestionResult | null,
  result: null as FinalResult | null,
  picker: { candidates: [] as Candidate[], reason: '' as string, from: 'camera' as 'camera' | 'typed' },
  typedQuery: '',
  error: '',
  lastPrediction: null as { candidates: Candidate[]; decision: Decision; ms: number } | null,
  tally: sanitize(loadStored<unknown>('trashify.tally', EMPTY_TALLY_STATE, isAnything)) as TallyState,
  faculty: loadStored<string | null>('trashify.faculty', null, (v): v is string | null => v === null || isFaculty(v)),
  leaderboard: { status: 'loading' } as Leaderboard | { status: 'loading' },
  /** Set by "Not right?": the next answer replaces this scan instead of adding one. */
  correcting: null as string | null,
  /** What the last result did to the tally (shown on the result card). */
  lastCount: null as { diverted: boolean; replaced: boolean } | null,
  soundOn: loadStored<boolean>('trashify.sound', false, (v): v is boolean => typeof v === 'boolean'),
  offlineReady: false,
};
// Browsers block audio until a user gesture, so a saved "sound on" takes effect on the first tap.
for (const ev of ['pointerdown', 'keydown'] as const)
  document.addEventListener(ev, () => (sound.enabled = state.soundOn), { once: true, capture: true });

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
  // Only try once per page load: re-asking after a denial or a missing camera would
  // re-render forever (render() calls startCamera()).
  if (stream || state.camera.status !== 'idle') return;
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
      startItem({ scanId: '', itemId: decision.itemId, answers: {}, confidence: decision.confidence, via });
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
  // A correction keeps the scan id of the item being corrected; anything else is new.
  const scanId = state.correcting ?? newScanId();
  state.correcting = null;
  if (scanId !== pendingPost?.scanId) sendPendingPost();
  state.pending = { ...p, scanId };
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
    return startItem({ scanId: '', itemId: top.itemId, answers: {}, via: 'typed' });
  }
  state.picker = { candidates: matches.slice(0, 3), reason: 'typed', from: 'typed' };
  go('picker');
}

function setContext(c: Context) {
  if (c === state.context) return;
  state.context = c;
  saveStored('trashify.context', c);
  // Re-sort the current item under the new rules: great for showing home vs campus differences.
  if ((state.screen === 'result' || state.screen === 'question') && state.pending) {
    state.pending = { ...state.pending, answers: {} };
    advance();
  } else render();
}

// ---------------------------------------------------------------------------
// Impact: local tally + faculty leaderboard
// ---------------------------------------------------------------------------

/**
 * The server post for the current scan waits until the user moves on (next scan,
 * "Scan another", the Impact tab, or leaving the page), so a quick correction sends
 * only the final answer and the leaderboard never sees the wrong guess.
 */
let pendingPost: { scanId: string; payload: ScanPayload } | null = null;
let postTimer: ReturnType<typeof setTimeout> | undefined;

function sendPendingPost() {
  clearTimeout(postTimer);
  const p = pendingPost;
  pendingPost = null;
  if (p) void postScan(p.payload);
}

onFinalResult((r, p) => {
  const { state: next, replaced, diverted } = countResult(state.tally, p.scanId, r.itemId, r.destination.id);
  state.tally = next;
  state.lastCount = { diverted, replaced };
  sound.bin(r.destination.id);
  if (diverted && !replaced) sound.collect(next.streak);
  saveStored('trashify.tally', next);
  if (state.faculty) {
    pendingPost = {
      scanId: p.scanId,
      payload: {
        faculty: state.faculty,
        itemId: r.itemId,
        destination: r.destination.id,
        divertedFromLandfill: r.destination.divertsFromLandfill,
      },
    };
    clearTimeout(postTimer);
    postTimer = setTimeout(sendPendingPost, 15_000);
  }
  // Re-render the tally line (listeners run after the result is drawn).
  const line = document.getElementById('tally-line');
  if (line) line.outerHTML = tallyLine();
  exposeTestHook();
});

async function refreshLeaderboard() {
  state.leaderboard = { status: 'loading' };
  if (state.screen === 'impact') render();
  state.leaderboard = await getLeaderboard();
  if (state.screen === 'impact') render();
  else exposeTestHook();
}

function openImpact() {
  go('impact');
  // Give a just-sent scan a moment to land before reading the board.
  setTimeout(() => void refreshLeaderboard(), 150);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function topbar() {
  return `
  <header class="topbar">
    <div class="logo"><img class="logo-mark" src="/favicon.svg" alt="" />Trashify</div>
    <button type="button" class="icon-btn" data-action="sound" aria-pressed="${state.soundOn}" aria-label="Sound effects">${icon(state.soundOn ? 'sound' : 'mute', 22)}</button>
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
      ${state.offlineReady && ready ? `<span class="offline-chip">${icon('check', 14)} Works offline</span>` : ''}
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
            (c, i) =>
              `<button type="button" class="choice${i === 0 && state.picker.from === 'camera' ? ' best' : ''}" data-action="pick" data-item="${esc(c.itemId)}">${esc(itemName(c.itemId))}${state.picker.from === 'camera' ? `<small>${i === 0 ? 'best guess · ' : ''}${pct(c.score)}</small>` : ''}</button>`,
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
      ${tallyLine()}
      <div class="sources">
        <span>Source${r.sources.length > 1 ? 's' : ''}:</span>
        ${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('')}
      </div>
      <div class="actions">
        <button type="button" class="btn" data-action="not-right">Not right?</button>
        <button type="button" class="btn primary" data-action="home">${icon('camera', 20)} Scan another</button>
      </div>
      ${canSpeak() ? `<button type="button" class="link-btn" data-action="speak">${icon('sound', 18)} Read it out loud</button>` : ''}
    </div>
  </section>`;
}

function tallyLine() {
  const c = state.lastCount;
  if (!c) return '<div id="tally-line" hidden></div>';
  const t = state.tally;
  const msg = c.diverted
    ? `<strong>+1 kept out of landfill.</strong> You’re at ${t.itemsDiverted} item${t.itemsDiverted === 1 ? '' : 's'}${state.faculty ? ` for ${esc(state.faculty)}` : ''}.`
    : `This one isn’t counted as diverted: ${state.result?.uncertain ? 'check first, then sort it right.' : 'landfill is the right place for it.'}`;
  return `<div id="tally-line" class="tally-line ${c.diverted ? 'up' : ''}">${icon('chart', 18)}<span>${msg}</span></div>`;
}

function tabbar() {
  const tabs: [Screen, string, Parameters<typeof icon>[0], string][] = [
    ['scan', 'Scan', 'camera', 'home'],
    ['impact', 'Impact', 'chart', 'impact'],
    ['about', 'About', 'info', 'about'],
  ];
  const current: Screen = state.screen === 'impact' || state.screen === 'about' ? state.screen : 'scan';
  return `<nav class="tabbar" aria-label="Main">${tabs
    .map(
      ([scr, label, ic, action]) =>
        `<button type="button" data-action="${action}" ${current === scr ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span></button>`,
    )
    .join('')}</nav>`;
}

function leaderboardBlock() {
  const lb = state.leaderboard;
  if (lb.status === 'loading') return '<p class="muted" role="status">Loading leaderboard…</p>';
  if (lb.status === 'offline')
    return `<div class="callout warn" role="status"><strong>Leaderboard offline.</strong> Your own tally still works, and scans will be sent when we’re back online. <button type="button" class="link-btn" data-action="refresh-leaderboard">Try again</button></div>`;
  if (!lb.rows.length)
    return '<p class="muted">No scans yet. Pick your faculty and sort something to put it on the board.</p>';
  const max = Math.max(1, ...lb.rows.map((r) => r.itemsDiverted));
  return `<ol class="board" aria-label="Faculty leaderboard">${lb.rows
    .map(
      (r, i) => `<li ${r.faculty === state.faculty ? 'class="mine"' : ''}>
        <div class="board-row"><span class="rank">${i + 1}</span><span class="board-name">${esc(r.faculty)}${r.faculty === state.faculty ? '<span class="you"> (you)</span>' : ''}</span><span class="board-num">${r.itemsDiverted} <small>item${r.itemsDiverted === 1 ? '' : 's'}</small></span></div>
        <div class="bar" aria-hidden="true"><span style="width:${((r.itemsDiverted / max) * 100).toFixed(1)}%"></span></div>
        <div class="board-sub">${formatCo2(r.co2eKg)} CO₂e est. · ${r.scans} scan${r.scans === 1 ? '' : 's'}</div>
      </li>`,
    )
    .join('')}</ol>`;
}

function impactScreen() {
  const t = state.tally;
  return `
  <section class="impact" aria-labelledby="i-title">
    <h1 id="i-title" class="page-title" tabindex="-1">Your impact</h1>
    <div class="stats">
      <div class="stat"><span class="stat-num" data-testid="items-diverted">${t.itemsDiverted}</span><span class="stat-label">items kept out of landfill</span></div>
      <div class="stat"><span class="stat-num" data-testid="co2e">${formatCo2(t.co2eKg)}</span><span class="stat-label">CO₂e saved (estimate)</span></div>
      <div class="stat"><span class="stat-num">${t.scans}</span><span class="stat-label">items sorted</span></div>
    </div>
    <p class="fineprint">CO₂e uses US EPA WARM v16 factors and only items we have a cited weight for, so it’s an underestimate. Stored on this device only.</p>
    <div class="card">
      <h2>Faculty leaderboard</h2>
      <label for="faculty" class="field-label">Your scans count for</label>
      <select id="faculty" class="select">
        <option value="" ${state.faculty ? '' : 'selected'}>Don’t join the leaderboard</option>
        ${FACULTIES.map((f) => `<option ${f === state.faculty ? 'selected' : ''}>${esc(f)}</option>`).join('')}
      </select>
      <p class="fineprint">Only the faculty, item type and bin are sent. Never your photo.</p>
      ${leaderboardBlock()}
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
    impact: impactScreen,
    about: aboutScreen,
  };
  $app.innerHTML = `<div class="app">${topbar()}<main class="main" id="main">${screens[state.screen]()}</main>${tabbar()}</div>`;

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
      state.correcting = null;
      sendPendingPost();
      go('scan');
      break;
    case 'impact':
      state.correcting = null;
      sendPendingPost();
      openImpact();
      break;
    case 'about':
      state.correcting = null;
      sendPendingPost();
      go('about');
      break;
    case 'sound':
      state.soundOn = !state.soundOn;
      sound.enabled = state.soundOn;
      saveStored('trashify.sound', state.soundOn);
      if (state.soundOn) sound.bin('edm_blue_bag'); // a preview, so you know it's on
      render();
      break;
    case 'speak': {
      const r = state.result;
      if (r) speak(`${r.itemName}. ${r.destination.name}. ${r.reason} ${r.prep.join('. ')}`);
      break;
    }
    case 'refresh-leaderboard':
      void refreshLeaderboard();
      break;
    case 'answer':
      answer(el.dataset.q as QuestionId, el.dataset.v === 'yes');
      break;
    case 'pick':
      startItem({ scanId: '', itemId: el.dataset.item!, answers: {}, via: 'picker' });
      break;
    case 'not-right': {
      if (state.screen === 'result' && state.pending) state.correcting = state.pending.scanId;
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
  if (input.id === 'faculty') {
    state.faculty = isFaculty(input.value) ? input.value : null;
    saveStored('trashify.faculty', state.faculty);
    announce(state.faculty ? `Your scans now count for ${state.faculty}.` : 'Leaderboard off.');
    return render();
  }
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
// Test hook (non-production builds only): window.__trashify for Playwright
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __trashify?: Record<string, unknown>;
  }
}
const TEST_HOOK = import.meta.env.DEV || import.meta.env.VITE_TEST_HOOK === '1';

function exposeTestHook() {
  if (!TEST_HOOK) return;
  window.__trashify = {
    ...(window.__trashify ?? {}),
    modelReady: state.model.status === 'ready',
    lastPrediction: state.lastPrediction,
    lastResult: state.result,
    tally: { scans: state.tally.scans, itemsDiverted: state.tally.itemsDiverted, co2eKg: state.tally.co2eKg },
    faculty: state.faculty,
    leaderboard: state.leaderboard,
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
window.addEventListener('online', () => void flushOutbox());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendPendingPost();
});
void flushOutbox();

// Offline mode: the service worker exists only in production builds (sw.js is
// generated by build/offline-plugin.ts). Registering it is best-effort.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        state.offlineReady = true;
        if (state.screen === 'scan') render();
      })
      .catch(() => undefined);
  });
}
render();
if (!(TEST_HOOK && params.has('stub'))) void loadModel();
else {
  classifier = new StubClassifier([]);
  state.model = { status: 'ready', progress: 1, error: '' };
  render();
}
