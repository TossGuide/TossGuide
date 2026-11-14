/**
 * TossGuide evaluation harness: `npm run eval [-- --dir eval/images --label "venue set"]`
 *
 * Runs the REAL classifier (same model, same prompt embeddings, same scoring code as
 * the browser) over labelled photos in <dir>/<itemId>/*.jpg and reports:
 *   - top-1 / top-3 item accuracy
 *   - bin-level accuracy (what actually matters: did it pick the right bin?)
 *   - confusion matrix
 *   - per-item latency
 *   - threshold sweep: auto-answer accuracy vs % of scans that need a confirm tap
 * Then picks the aggregation method, temperature and threshold FROM THE DATA and
 * writes eval/REPORT.md, eval/summary.json (shown on the About screen) and
 * shared/src/ml/calibration.json (used by the app).
 */
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { classifyEmbedding, type PromptBank } from '../shared/src/ml/classify-core';
import { decide } from '../shared/src/ml/decide';
import type { AggregateMethod, Candidate } from '../shared/src/ml/aggregate';
import { MODEL_ID, VISION_DTYPE } from '../shared/src/ml/model-config';
import { possibleDestinations, resolve } from '../shared/src/rules/engine';
import { getItem } from '../shared/src/rules/items';
import type { Context } from '../shared/src/rules/types';
import bankJson from '../shared/src/ml/embeddings/prompts.json';

env.cacheDir = join(process.cwd(), '.cache', 'models');
const bank = bankJson as PromptBank;

// ---------- CLI args ----------
const args = process.argv.slice(2);
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : def;
};
const DIR = arg('dir', 'eval/images');
const LABEL = arg('label', 'venue eval set');
const WRITE_CALIBRATION = !args.includes('--no-calibrate');
/** Target: when we answer without asking, be right about the BIN at least this often. */
const TARGET_AUTO_BIN_ACCURACY = Number(arg('target', '0.95'));
const CONTEXT: Context = 'edmonton-residential';

interface Sample {
  label: string;
  path: string;
  embed: number[];
  ms: number;
}

function listImages(dir: string) {
  if (!existsSync(dir)) return [];
  const out: { label: string; path: string }[] = [];
  for (const label of readdirSync(dir).sort()) {
    const p = join(dir, label);
    if (!statSync(p).isDirectory()) continue;
    if (!getItem(label)) {
      console.warn(`⚠ skipping folder "${label}": not an item id in shared/src/rules/items.ts`);
      continue;
    }
    for (const f of readdirSync(p).sort()) if (/\.(jpe?g|png|webp|heic)$/i.test(f)) out.push({ label, path: join(p, f) });
  }
  return out;
}

/** Same preprocessing idea as the app: apply EXIF rotation, downscale, then the CLIP processor. */
async function loadImage(path: string) {
  const { data, info } = await sharp(path)
    .rotate() // honour EXIF orientation from phone cameras
    .resize(448, 448, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
}

const binsMatch = (a: string, b: string) =>
  possibleDestinations(a, CONTEXT).join() === possibleDestinations(b, CONTEXT).join();
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function embedAll(): Promise<Sample[]> {
  const files = listImages(DIR);
  if (files.length === 0) return [];
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: VISION_DTYPE });
  // Warm-up so the first image's latency isn't session start-up.
  await model(await processor(await loadImage(files[0]!.path)));
  const out: Sample[] = [];
  for (const f of files) {
    const img = await loadImage(f.path);
    const t = performance.now();
    const { image_embeds } = await model(await processor(img));
    const ms = performance.now() - t;
    out.push({ label: f.label, path: f.path, embed: Array.from(image_embeds.data as Float32Array), ms });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return out;
}

function evaluate(samples: Sample[], method: AggregateMethod, temperature: number) {
  let top1 = 0, top3 = 0, bin = 0, nll = 0;
  const preds: { s: Sample; ranked: Candidate[] }[] = [];
  for (const s of samples) {
    const ranked = classifyEmbedding(s.embed, bank, { method, temperature });
    const rank = ranked.findIndex((c) => c.itemId === s.label);
    if (rank === 0) top1++;
    if (rank >= 0 && rank < 3) top3++;
    if (binsMatch(ranked[0]!.itemId, s.label)) bin++;
    nll += -Math.log(Math.max(1e-9, ranked[rank]?.score ?? 0));
    preds.push({ s, ranked });
  }
  const n = samples.length;
  return { method, temperature, top1: top1 / n, top3: top3 / n, bin: bin / n, nll: nll / n, preds };
}

function sweep(preds: { s: Sample; ranked: Candidate[] }[]) {
  const rows = [];
  for (let th = 0.05; th <= 0.951; th += 0.05) {
    let answered = 0, answeredBinOk = 0, confirmHasTruth = 0, confirmed = 0;
    for (const { s, ranked } of preds) {
      const d = decide(ranked, CONTEXT, { threshold: th });
      if (d.kind === 'answer') {
        answered++;
        if (binsMatch(d.itemId, s.label)) answeredBinOk++;
      } else {
        confirmed++;
        if (d.candidates.some((c) => c.itemId === s.label)) confirmHasTruth++;
      }
    }
    const n = preds.length;
    rows.push({
      threshold: Math.round(th * 100) / 100,
      autoAnswerRate: answered / n,
      autoBinAccuracy: answered ? answeredBinOk / answered : 1,
      confirmRate: confirmed / n,
      pickerContainsTruth: confirmed ? confirmHasTruth / confirmed : 1,
      // End-to-end: right bin with no tap, or the right item is one tap away in the picker.
      endToEnd: (answeredBinOk + confirmHasTruth) / n,
    });
  }
  return rows;
}

async function main() {
  const samples = await embedAll();
  if (samples.length === 0) {
    console.error(`No labelled images found in ${DIR}/<itemId>/*.jpg. See PROGRESS.md "TEAM TODO".`);
    process.exit(1);
  }
  const labels = [...new Set(samples.map((s) => s.label))];
  console.log(`${samples.length} images across ${labels.length} items from ${DIR}`);

  // 1) Pick aggregation method (by top-1, tie-break top-3), then temperature (by NLL = calibration).
  const methods: AggregateMethod[] = ['max', 'mean', 'logsumexp'];
  const byMethod = methods.map((m) => evaluate(samples, m, 1));
  byMethod.sort((a, b) => b.top1 - a.top1 || b.top3 - a.top3);
  const method = byMethod[0]!.method;
  const temps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const byTemp = temps.map((t) => evaluate(samples, method, t)).sort((a, b) => a.nll - b.nll);
  const best = byTemp[0]!;

  // 2) Threshold sweep with the chosen method/temperature.
  const rows = sweep(best.preds);
  const meeting = rows.filter((r) => r.autoBinAccuracy >= TARGET_AUTO_BIN_ACCURACY && r.autoAnswerRate > 0);
  const chosen = meeting.length ? meeting[0]! : [...rows].sort((a, b) => b.autoBinAccuracy - a.autoBinAccuracy)[0]!;

  // 3) Confusion matrix (true item x predicted top-1).
  const predLabels = [...new Set(best.preds.map((p) => p.ranked[0]!.itemId))];
  const cols = [...labels, ...predLabels.filter((p) => !labels.includes(p))];
  const cm: Record<string, Record<string, number>> = {};
  for (const { s, ranked } of best.preds) {
    cm[s.label] ??= {};
    cm[s.label]![ranked[0]!.itemId] = (cm[s.label]![ranked[0]!.itemId] ?? 0) + 1;
  }
  // 3b) Bin-level confusion (true bin x predicted bin), compact enough for the About screen.
  //     An item's "bin" is its default destination at home with no follow-up answers.
  const binOf = (id: string) => {
    const r = resolve(id, CONTEXT, {});
    return r.ok && r.status === 'final' ? r.destination.shortName : r.ok ? 'asks first' : '?';
  };
  const binConfusion: Record<string, Record<string, number>> = {};
  for (const { s, ranked } of best.preds) {
    const t = binOf(s.label), pr = binOf(ranked[0]!.itemId);
    binConfusion[t] ??= {};
    binConfusion[t]![pr] = (binConfusion[t]![pr] ?? 0) + 1;
  }
  const perItem = labels.map((l) => {
    const ps = best.preds.filter((p) => p.s.label === l);
    return {
      itemId: l,
      n: ps.length,
      top1: ps.filter((p) => p.ranked[0]!.itemId === l).length / ps.length,
      bin: ps.filter((p) => binsMatch(p.ranked[0]!.itemId, l)).length / ps.length,
      medianMs: median(ps.map((p) => p.s.ms)),
    };
  });
  const failures = best.preds
    .filter((p) => p.ranked[0]!.itemId !== p.s.label)
    .map((p) => ({
      path: relative(process.cwd(), p.s.path),
      truth: p.s.label,
      predicted: p.ranked.slice(0, 3).map((c) => `${c.itemId} ${pct(c.score)}`),
      rightBin: binsMatch(p.ranked[0]!.itemId, p.s.label),
    }));

  const summary = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    model: `${MODEL_ID} (${VISION_DTYPE} vision encoder)`,
    context: CONTEXT,
    images: samples.length,
    items: labels.length,
    method,
    temperature: best.temperature,
    top1: best.top1,
    top3: best.top3,
    binAccuracy: best.bin,
    medianLatencyMs: median(samples.map((s) => s.ms)),
    threshold: chosen.threshold,
    atThreshold: chosen,
    methodComparison: byMethod.map(({ method: m, top1, top3, bin }) => ({ method: m, top1, top3, bin })),
    binConfusion,
    sweep: rows,
    perItem,
  };

  mkdirSync('eval', { recursive: true });
  writeFileSync('eval/summary.json', JSON.stringify(summary, null, 2));
  writeFileSync('shared/src/ml/eval-summary.json', JSON.stringify({ ...summary, sweep: undefined, perItem: undefined }, null, 2));
  if (WRITE_CALIBRATION) {
    writeFileSync(
      'shared/src/ml/calibration.json',
      JSON.stringify(
        {
          _comment: 'Written by `npm run eval`. Do not hand-edit; re-run the eval instead.',
          threshold: chosen.threshold,
          temperature: best.temperature,
          method,
          source: `${LABEL}: ${samples.length} images, ${summary.generatedAt}`,
        },
        null,
        2,
      ) + '\n',
    );
  }
  writeFileSync('eval/REPORT.md', report(summary, cm, cols, failures));
  console.log(
    `top-1 ${pct(best.top1)}  top-3 ${pct(best.top3)}  bin ${pct(best.bin)}  | method ${method}, T=${best.temperature}, threshold ${chosen.threshold} -> auto-answer ${pct(chosen.autoAnswerRate)} at ${pct(chosen.autoBinAccuracy)} bin accuracy`,
  );
  console.log('wrote eval/REPORT.md, eval/summary.json' + (WRITE_CALIBRATION ? ', shared/src/ml/calibration.json' : ''));
}

function report(
  s: any,
  cm: Record<string, Record<string, number>>,
  cols: string[],
  failures: { path: string; truth: string; predicted: string[]; rightBin: boolean }[],
): string {
  const short = (id: string) => id.replace(/_/g, ' ');
  const lines = [
    `# TossGuide evaluation report`,
    ``,
    `**Data:** ${s.label}: ${s.images} photos of ${s.items} items · **Model:** ${s.model} · **Generated:** ${s.generatedAt}`,
    `Bins are judged in the \`${s.context}\` context. Regenerate with \`npm run eval\`.`,
    ``,
    `## Headline`,
    `| Metric | Value |`,
    `|---|---|`,
    `| Top-1 item accuracy | **${pct(s.top1)}** |`,
    `| Top-3 item accuracy | ${pct(s.top3)} |`,
    `| **Bin-level accuracy** (top-1 lands in the right bin) | **${pct(s.binAccuracy)}** |`,
    `| Median vision latency (Node, CPU) | ${s.medianLatencyMs.toFixed(0)} ms |`,
    `| Chosen threshold | ${s.threshold} → answers ${pct(s.atThreshold.autoAnswerRate)} of scans directly at ${pct(s.atThreshold.autoBinAccuracy)} bin accuracy; asks for the rest (right item in the picker ${pct(s.atThreshold.pickerContainsTruth)} of the time) |`,
    ``,
    `## Aggregation method (temperature 1)`,
    `| Method | Top-1 | Top-3 | Bin |`,
    `|---|---|---|---|`,
    ...s.methodComparison.map((m: any) => `| ${m.method} | ${pct(m.top1)} | ${pct(m.top3)} | ${pct(m.bin)} |`),
    ``,
    `Chosen: **${s.method}**, temperature **${s.temperature}** (lowest negative log-likelihood, i.e. best calibrated).`,
    ``,
    `## Threshold sweep`,
    `"Auto-answer" = shown directly with no tap. Target: ≥ ${pct(TARGET_AUTO_BIN_ACCURACY)} bin accuracy on auto-answers.`,
    ``,
    `| Threshold | Auto-answer rate | Auto-answer bin accuracy | Needs confirm | Truth in picker | End-to-end |`,
    `|---|---|---|---|---|---|`,
    ...s.sweep.map(
      (r: any) =>
        `| ${r.threshold}${r.threshold === s.threshold ? ' ✅' : ''} | ${pct(r.autoAnswerRate)} | ${pct(r.autoBinAccuracy)} | ${pct(r.confirmRate)} | ${pct(r.pickerContainsTruth)} | ${pct(r.endToEnd)} |`,
    ),
    ``,
    `## Per item`,
    `| Item | Photos | Top-1 | Bin | Median ms |`,
    `|---|---|---|---|---|`,
    ...s.perItem.map((p: any) => `| ${short(p.itemId)} | ${p.n} | ${pct(p.top1)} | ${pct(p.bin)} | ${p.medianMs.toFixed(0)} |`),
    ``,
    `## Confusion matrix (rows = truth, columns = top-1 prediction)`,
    `| truth \\ predicted | ${cols.map(short).join(' | ')} |`,
    `|---|${cols.map(() => '---').join('|')}|`,
    ...Object.keys(cm).map((t) => `| **${short(t)}** | ${cols.map((c) => (cm[t]![c] ? (c === t ? `**${cm[t]![c]}**` : `${cm[t]![c]}`) : '·')).join(' | ')} |`),
    ``,
    `## Failures (honest list)`,
    failures.length === 0 ? '_None._' : `| Photo | Truth | Top-3 predicted | Right bin anyway? |\n|---|---|---|---|`,
    ...failures.map((f) => `| ${f.path} | ${short(f.truth)} | ${f.predicted.join(', ')} | ${f.rightBin ? 'yes' : '**no**'} |`),
    ``,
  ];
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
