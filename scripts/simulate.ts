import { writeFileSync } from 'node:fs';
import { CONFIG } from '../src/config';
import { BOT_SKILLS } from '../src/core/bot';
import { simulateRun, summarize } from '../src/core/simulate';

const RUNS = Number(process.argv[2] ?? 2000);
const lines: string[] = [
  `# Score simulation (${RUNS} runs per player profile)`,
  '',
  `Tiers: ${CONFIG.tiers.map((t) => `${t.name} from ${t.min}`).join(', ')}`,
  '',
  `| Profile | Mean | P10 | Median | P90 | ${CONFIG.tiers.map((t) => t.name).join(' | ')} |`,
  `|---|---|---|---|---|${CONFIG.tiers.map(() => '---|').join('')}`,
];
for (const skill of Object.values(BOT_SKILLS)) {
  const s = summarize(Array.from({ length: RUNS }, (_, i) => simulateRun(i + 1, skill)), CONFIG.tiers);
  lines.push(`| ${skill.name} | ${s.mean.toFixed(0)} | ${s.p10} | ${s.p50} | ${s.p90} | ${s.tierShare.map((x) => `${(x * 100).toFixed(0)}%`).join(' | ')} |`);
}
lines.push(
  '',
  'Tier columns show the share of players whose final score lands in that tier.',
  'To rebalance gifts, change `tiers` in `src/config.ts` and run `npm run simulate` again.',
);
const report = `${lines.join('\n')}\n`;
writeFileSync('docs/simulation-report.md', report);
console.log(report);
