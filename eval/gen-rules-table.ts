/**
 * Prints the rules table as Markdown, generated from the actual rules data so the
 * research doc can never drift from the code. Usage: npx tsx eval/gen-rules-table.ts
 */
import { ITEMS } from '../shared/src/rules/items';
import { RULES } from '../shared/src/rules/rules';
import { DESTINATIONS, QUESTIONS } from '../shared/src/rules/destinations';
import type { RuleNode } from '../shared/src/rules/types';

function show(n: RuleNode): string {
  if ('ask' in n) return `**Q: ${QUESTIONS[n.ask].text}** Yes → ${show(n.yes)}; No → ${show(n.no)}`;
  const d = DESTINATIONS[n.destination].shortName;
  const flag = n.uncertain ? ' ⚠️ *uncertain*' : '';
  return `${d}${flag} [${n.sources.join(', ')}]`;
}
console.log('| Item | Edmonton home | UofA campus |');
console.log('|---|---|---|');
for (const it of ITEMS) {
  const r = RULES[it.id]!;
  console.log(`| ${it.name} (\`${it.id}\`) | ${show(r['edmonton-residential'])} | ${show(r['uofa-campus'])} |`);
}
