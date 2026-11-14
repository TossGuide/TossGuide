/**
 * About / how it works: the pipeline, the MEASURED accuracy (straight from
 * `npm run eval`, never typed in by hand), privacy and data sources.
 */
import summary from '@binsight/shared/ml/eval-summary.json';
import calibration from '@binsight/shared/ml/calibration.json';
import { SOURCES } from '@binsight/shared/rules/sources';
import { ITEMS } from '@binsight/shared/rules/items';

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
    <summary>Bin-level confusion matrix</summary>
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
  return `
  <section class="about" aria-labelledby="a-title">
    <h1 id="a-title" class="page-title" tabindex="-1">How BinSight works</h1>

    <ol class="pipeline" aria-label="Pipeline">
      <li><strong>Camera</strong><span>Your photo, on your phone</span></li>
      <li><strong>On-device AI</strong><span>CLIP compares it with ${ITEMS.length} item types. No training, no cloud.</span></li>
      <li><strong>Decision</strong><span>Not sure, or the top guesses go in different bins? It asks you instead of guessing.</span></li>
      <li><strong>Edmonton rules</strong><span>Hand-written rules from City of Edmonton and UofA pages, each one cited</span></li>
      <li><strong>Your bin</strong><span>Plus the reason, how to prep it, and the source link</span></li>
    </ol>

    <div class="card">
      <h2>Measured accuracy</h2>
      ${isVenue ? '' : `<p class="callout warn" style="margin:0">These numbers come from a <strong>${esc(s.label)}</strong>, not from photos taken at the venue. Re-run <code>npm run eval</code> on venue photos to update them.</p>`}
      <div class="stats">
        <div class="stat"><span class="stat-num">${pct(s.binAccuracy)}</span><span class="stat-label">right bin (top guess)</span></div>
        <div class="stat"><span class="stat-num">${pct(s.top1)}</span><span class="stat-label">right item (top guess)</span></div>
        <div class="stat"><span class="stat-num">${pct(s.top3)}</span><span class="stat-label">right item in top 3</span></div>
      </div>
      <p class="fineprint">
        When BinSight answers without asking (${pct(a.autoAnswerRate)} of photos at threshold ${calibration.threshold}), the bin is right ${pct(a.autoBinAccuracy)} of the time.
        The other ${pct(a.confirmRate)} get a one-tap “Is this a…?” question${a.confirmRate > 0 ? `, and the right item is in that list ${pct(a.pickerContainsTruth)} of the time` : ''}.
        ${s.images} photos of ${s.items} items · median ${Math.round(s.medianLatencyMs)} ms per photo on a laptop CPU · ${esc(s.model)}.
      </p>
      ${confusion()}
    </div>

    <div class="card">
      <h2>Private by design</h2>
      <p style="margin:0">The model runs inside your browser. <strong>Your photo never leaves your phone</strong> and is never stored. After the first visit it works with no internet. The leaderboard only gets your faculty, the item type and the bin.</p>
    </div>

    <div class="card">
      <h2>Where the rules come from</h2>
      <p class="fineprint" style="margin:0">Edmonton’s recycling list changed on Oct 1, 2026 (coffee cups, chip bags and foam now go in the blue bag at home). Campus bins follow the UofA Zero Waste rules, which still differ.</p>
      <ul class="source-list">
        ${Object.values(SOURCES)
          .map((src) => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a></li>`)
          .join('')}
      </ul>
      <p class="fineprint" style="margin:0">CO₂e estimates: US EPA WARM v16. Model: OpenAI CLIP ViT-B/32 (MIT licence), ONNX conversion by Xenova, run with Transformers.js.</p>
    </div>
    <p class="fineprint" style="text-align:center">Built in 24 hours at HackEd Beta 2026 by Aditya &amp; Sanika.</p>
  </section>`;
}
