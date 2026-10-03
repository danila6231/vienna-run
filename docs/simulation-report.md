# Score simulation (500 runs per player profile)

Tiers: Small treat from 0, Gift B from 80, Gift C from 100, Gift D from 120

| Profile | Mean | P10 | Median | P90 | Small treat | Gift B | Gift C | Gift D |
|---|---|---|---|---|---|---|---|---|
| casual | 180 | 125 | 180 | 230 | 0% | 2% | 5% | 93% |
| average | 221 | 170 | 220 | 270 | 0% | 0% | 0% | 100% |
| skilled | 223 | 170 | 220 | 275 | 0% | 0% | 0% | 100% |

Tier columns show the share of players whose final score lands in that tier.
To rebalance gifts, change `tiers` in `src/config.ts` and run `npm run simulate` again.
