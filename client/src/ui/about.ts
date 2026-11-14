/**
 * About / how it works: the pipeline, the MEASURED accuracy (straight from
 * `npm run eval`, never typed in by hand), privacy and data sources.
 */
import summary from '@tossguide/shared/ml/eval-summary.json';
import { SOURCES } from '@tossguide/shared/rules/sources';
import { icon } from './icons';

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Summary {
  label: string;
  generatedAt: string;
  model: string;
  images: number;
  items: number;
  top1: number;
  top3: number;
  binAccuracy: number;
  medianLatencyMs: number;
  threshold: number;
  atThreshold: { autoAnswerRate: number; autoBinAccuracy: number; confirmRate: number; pickerContainsTruth: number; endToEnd: number };
  binConfusion?: Record<string, Record<string, number>>;
}
const s = summary as unknown as Summary;

function confusion(): string {
  const cm = s.binConfusion;
  if (!cm) return '';
  const rows = Object.keys(cm).sort();
  const cols = [...new Set(rows.concat(...rows.map((r) => Object.keys(cm[r]!))))].sort();
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(cm[r]!)));
  return `
  <details class="cm">
    <summary>Confusion matrix</summary>
    <div class="cm-scroll" tabindex="0" role="region" aria-label="Confusion matrix, true bin by predicted bin">
    <table>
      <caption class="sr-only">Rows: the photo's real bin. Columns: the bin of the model's top guess.</caption>
      <thead><tr><th scope="col">Real ↓ / Guessed →</th>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr><th scope="row">${esc(r)}</th>${cols
              .map((c) => {
                const n = cm[r]![c] ?? 0;
                const a = n ? 0.12 + 0.6 * (n / max) : 0;
                return `<td class="${r === c ? 'diag' : n ? 'off' : ''}" style="--a:${a.toFixed(2)}">${n || '·'}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>
    </div>
  </details>`;
}

export function aboutScreen(): string {
  const a = s.atThreshold;
  const isVenue = /venue/i.test(s.label) && !/smoke|wikimedia|commons|dev/i.test(s.label);
  const steps: [Parameters<typeof icon>[0], string][] = [
    ['camera', 'Snap'],
    ['chip', 'On-device AI'],
    ['paper', 'Edmonton rules'],
    ['recycle', 'Your bin'],
  ];
  return `
  <section class="about" aria-labelledby="a-title">
    <h1 id="a-title" class="page-title" tabindex="-1">How it works</h1>

    <ol class="steps" aria-label="Pipeline">
      ${steps.map(([ic, label]) => `<li>${icon(ic, 22)}<span>${label}</span></li>`).join('')}
    </ol>
    <p class="lede">
      ${icon('lock', 16)} Runs on your phone: your photo never leaves it, and it works offline.
      Not sure? It asks instead of guessing.
    </p>

    <div class="card">
      <h2>Measured accuracy</h2>
      <div class="stats stats-2">
        <div class="stat"><span class="stat-num">${pct(s.binAccuracy)}</span><span class="stat-label">right bin</span></div>
        <div class="stat"><span class="stat-num">${pct(a.autoBinAccuracy)}</span><span class="stat-label">right bin when it answers without asking</span></div>
      </div>
      <p class="fineprint">${s.images} test photos of ${s.items} items${isVenue ? '' : ' (web photos, not venue photos yet)'} · ${Math.round(s.medianLatencyMs)} ms per photo</p>
      ${confusion()}
    </div>

    <details class="more">
      <summary>Sources &amp; credits</summary>
      <ul class="source-list">
        ${Object.values(SOURCES)
          .map((src) => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a></li>`)
          .join('')}
      </ul>
      <p class="fineprint">CO₂e: US EPA WARM v16. Model: OpenAI CLIP ViT-B/32 (MIT), via Transformers.js.</p>
    </details>
    <p class="fineprint center">Built at HackEd Beta 2026 by Aditya &amp; Sanika</p>
  </section>`;
}
