# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chrishnawestmoreland-oss/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chrishnawestmoreland-oss/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 197 pre-token protocols ranked by implied value under the radar-2 model, with a farm plan for each, plus a live-token view. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

## Model (radar-2)

The board ranks every rankable pre-token protocol in the snapshot — pre-token means the snapshot records no token at all (no market cap, no CoinGecko id, no symbol), and rankable excludes exchanges, versioned pools, and wrapped, staked and bridged products (bridges, liquid staking, liquid restaking and restaked-BTC categories, names containing a whole word "wrapped", "staked" or "staking", and names beginning with an exchange name), because those are products of tokens that already trade. That is 197 rows: the 40-protocol watchlist at the $50M TVL floor plus every rankable protocol below it.

Implied value is built only from the snapshot's figures:

- **Base:** TVL at 0.25x up to $1B, then 0.125x above $1B — the biggest protocols' launches face dilution and value the market has already captured.
- **Growth:** 7-day TVL change clamped to −60%..+120%, times a 0.6 weight.
- **Maturity:** 0.6 + up to 0.4 over 3 years of age (unknown age counts as 365 days).
- **Chains:** 1 + 0.03 per extra chain, up to 5.
- **Category:** a fixed table — lending and risk curators price highest (1.12x), bridges lowest (0.55–0.60x).

`implied = max(1, round(base × growth × maturity × chains × category))`, sorted by implied value, then TVL, then slug. Each row carries a six-step farm plan derived from its own category, chains, TVL tier and age. Protocols that already trade are kept apart in a live view at the market's own values, never mixed into the ranked board.

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
