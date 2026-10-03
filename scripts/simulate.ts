import { writeFileSync } from 'node:fs';
import { BOT_SKILLS } from '../src/core/bot';
import { applyPreset, buildConfig, defaultSettings, PRESETS } from '../src/core/settings';
import { simulateRun, summarize } from '../src/core/simulate';

const RUNS = Number(process.argv[2] ?? 2000);
const tiers = defaultSettings().tiers;
const lines: string[] = [
  `# Score simulation (${RUNS} runs per player profile and preset)`,
  '',
  `Tiers: ${tiers.map((t) => `${t.name} from ${t.min}`).join(', ')}`,
];
for (const preset of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
  const cfg = buildConfig(applyPreset(defaultSettings(), preset));
  lines.push(
    '',
    `## ${preset[0].toUpperCase()}${preset.slice(1)}`,
    '',
    `| Profile | Mean | P10 | Median | P90 | ${tiers.map((t) => t.name).join(' | ')} |`,
    `|---|---|---|---|---|${tiers.map(() => '---|').join('')}`,
  );
  for (const skill of Object.values(BOT_SKILLS)) {
    const s = summarize(Array.from({ length: RUNS }, (_, i) => simulateRun(i + 1, skill, cfg)), tiers);
    lines.push(`| ${skill.name} | ${s.mean.toFixed(0)} | ${s.p10} | ${s.p50} | ${s.p90} | ${s.tierShare.map((x) => `${(x * 100).toFixed(0)}%`).join(' | ')} |`);
  }
}
lines.push(
  '',
  'Tier columns show the share of players whose final score lands in that tier.',
  'Gift tiers are set in the staff settings menu; the defaults above come from `src/config.ts`.',
);
const report = `${lines.join('\n')}\n`;
writeFileSync('docs/simulation-report.md', report);
console.log(report);
