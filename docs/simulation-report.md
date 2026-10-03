# Score simulation (500 runs per player profile)

Tiers: Small treat from 0, Gift B from 80, Gift C from 100, Gift D from 120

| Profile | Mean | P10 | Median | P90 | Small treat | Gift B | Gift C | Gift D |
|---|---|---|---|---|---|---|---|---|
| casual | 182 | 115 | 180 | 250 | 1% | 3% | 7% | 89% |
| average | 214 | 150 | 210 | 280 | 0% | 0% | 1% | 99% |
| skilled | 209 | 150 | 205 | 270 | 0% | 0% | 1% | 99% |

Tier columns show the share of players whose final score lands in that tier.
To rebalance gifts, change `tiers` in `src/config.ts` and run `npm run simulate` again.
