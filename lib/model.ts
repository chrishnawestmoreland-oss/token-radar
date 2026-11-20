// Token Radar — the radar-2 model.
//
// One sealed snapshot in, one ranked board out. The board ranks every rankable
// pre-token protocol in the snapshot: no TVL ceiling, no row cap. A protocol is
// pre-token when the snapshot records no token for it at all (no market cap, no
// CoinGecko id, no symbol); a rankable protocol is a pre-token one that is not an
// exchange and whose name does not end in a version marker, so versioned pools
// of a protocol that already trades never stand in for the protocol itself.
// Rankable also excludes wrapped, staked and bridged products — bridges, liquid
// staking, liquid restaking and restaked-BTC categories, names containing a whole
// word "wrapped", "staked" or "staking", and names beginning with an exchange
// name — because those are products of tokens that already trade, not launches.
//
// Implied value is the entry's own claim, built only from the snapshot's figures:
//
//   base         TVL up to $1B at 0.25x, every dollar above $1B at 0.125x.
//                The biggest protocols' launches face dilution and value the
//                market has already captured, so the multiple bends down.
//   growth       change_7d clamped to [-60, 120]; 1 + growth% x 0.6
//   maturity     0.6 + min(age, 1095) / 1095 x 0.4; age unknown counts as 365 days
//   chains       1 + 0.03 x min(chains - 1, 5); distribution across chains helps
//   category     a fixed table below; lending and curators price higher than
//                bridges and liquid staking, which launch against thin margins
//   implied      max(1, round(base x growth x maturity x chains x category))
//
// No protocol name is ever special-cased: the same arithmetic scores every row.
// Live-token protocols are kept apart and shown at the market's own values.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The radar-2 constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple_low: number;
  base_multiple_high: number;
  base_kink_usd: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_step_max: number;
}

export const MODEL: ModelConstants = {
  base_multiple_low: 0.25,
  base_multiple_high: 0.125,
  base_kink_usd: 1_000_000_000,
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_step_max: 5,
};

export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A protocol's category, priced by what a launch in that category is worth. */
export const CATEGORY_MULTIPLIERS: Record<string, number> = {
  Dexs: 1.1,
  Lending: 1.12,
  Derivatives: 1.08,
  Yield: 1.0,
  'Yield Aggregator': 1.02,
  'Risk Curators': 1.12,
  RWA: 1.08,
  Restaking: 1.0,
  'Liquid Restaking': 0.85,
  'Liquid Staking': 0.75,
  Bridge: 0.6,
  'Canonical Bridge': 0.55,
  'Cross Chain Bridge': 0.6,
  CDP: 1.05,
  'CDP Manager': 1.05,
  'Stablecoin Wrapper': 0.8,
  'Dual-Token Stablecoin': 0.85,
  'Prediction Market': 1.05,
  Insurance: 0.95,
  'Onchain Capital Allocator': 1.05,
  'Leveraged Farming': 1.0,
  Farm: 1.0,
  'Basis Trading': 1.0,
  Indexes: 0.95,
  'Governance Incentives': 0.9,
  Payments: 0.95,
  'Uncollateralized Lending': 1.05,
  'Collateral Markets': 1.05,
  'Interest Rate Derivatives': 1.05,
  'Liquidity Manager': 1.0,
  'Staking Pool': 0.85,
  'Restaked BTC': 0.7,
  'Decentralized BTC': 0.9,
  'Anchor BTC': 0.9,
  CeDeFi: 0.9,
  Chain: 0.9,
  'Crypto Card Issuer': 0.9,
  'OTC Marketplace': 0.9,
};

export function categoryMultiplier(category: string | null): number {
  if (category === null) return 1.0;
  return CATEGORY_MULTIPLIERS[category] ?? 1.0;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    category_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A live-token protocol, shown at the market's own value, never ranked. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
}

/** One compact row for data.js: the board row the dashboard renders, with its plan. */
export interface CompactRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** Everything the dashboard needs, written to data.js. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  watchlist: string[];
  rows: CompactRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Whole days from `listedAt` to `asOf`, at least zero; null when either is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const listedMs = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(listedMs)) return null;
  return Math.max(0, Math.floor((asOfMs - listedMs) / DAY_MS));
}

/** A finite number, else `fallback`. */
function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The diminishing base value: full multiple to the kink, half of it above. */
export function baseValue(tvlUsd: number, model: ModelConstants): number {
  if (tvlUsd <= model.base_kink_usd) return tvlUsd * model.base_multiple_low;
  return (
    model.base_kink_usd * model.base_multiple_low +
    (tvlUsd - model.base_kink_usd) * model.base_multiple_high
  );
}

/** Every multiplier and the implied value one protocol scores under radar-2. */
export function scoreProtocol(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): {
  implied: number;
  base: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  categoryMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finiteOr(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_step_max);
  const categoryMult = categoryMultiplier(protocol.category);
  const base = baseValue(protocol.tvl_usd, model);
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult * categoryMult));
  return { implied, base, growthPct, growthMult, maturityMult, chainMult, categoryMult, age };
}

/** A name ending in a release marker (V2, v2, 2.0, …) is a versioned pool, not a protocol. */
const VERSION_MARKER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * Categories that are products of tokens that already trade — bridges and
 * liquid (re)staking — never a token launch in their own right.
 */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** A whole word "wrapped", "staked" or "staking" in a name marks a wrapped/staked product. */
const WRAPPED_OR_STAKED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange name marks that exchange's product. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** True when the snapshot records no token for the protocol at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * True when the board may rank the protocol: pre-token, not an exchange, not
 * versioned, and not a wrapped, staked or bridged product of a token that
 * already trades.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !VERSION_MARKER.test(p.name) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !WRAPPED_OR_STAKED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** Compare two scored rows: implied value down, then TVL down, then slug up. */
function compareScored(
  a: { implied: number; p: SnapshotProtocol },
  b: { implied: number; p: SnapshotProtocol },
): number {
  if (b.implied !== a.implied) return b.implied - a.implied;
  if (b.p.tvl_usd !== a.p.tvl_usd) return b.p.tvl_usd - a.p.tvl_usd;
  return a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0;
}

/** The first chain a protocol names, or a neutral phrase when it names none. */
function firstChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The capital one farm position takes, from the protocol's own TVL tier. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols need longer. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * The category's one qualifying action, in words a farmer can follow. The families
 * are matched on the category string, never on a protocol's name, so any protocol
 * in a family gets that family's action.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain} and leave the supply open so it accrues interest.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) {
    return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds inside its app.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis')) {
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position on ${chain}.`;
  }
  if (c.includes('prediction')) {
    return `Fund your account with $${capital} and take one position in a live market on ${name}.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  }
  if (c.includes('farm')) {
    return `Deposit $${capital} into ${name}'s farm on ${chain} and keep the deposit staked.`;
  }
  if (c.includes('index')) {
    return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
  }
  if (c.includes('payment') || c.includes('card')) {
    return `Spend $${capital} through ${name} on ${chain} so the activity is tied to your wallet.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** One farm step as a single string: the action, then its cost and its time. */
function step(text: string, cost: string, time: string): string {
  let s = `${text} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 597)}...`;
  if (s.length < 20) s = `${s} Keep the position open and check the protocol's own page for updates.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each derived from the protocol's own record
 * (category, chains, TVL tier, age). No step pays to claim, and no step names a
 * third-party points site: the protocol's own page is the only source to trust.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = firstChain(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return [
    step(
      `Open a fresh wallet that holds only the funds you plan to farm with, and write its seed phrase on paper and store it offline`,
      `under $3 of gas for the first transaction`,
      `5 minutes`,
    ),
    step(actionFor(p, capital, chain), `$${capital} of capital and about $${gas} of gas`, `15 minutes to set up`),
    step(
      `Make one qualifying action each week, such as a deposit, a swap, a borrow or a vote, so the wallet shows steady use`,
      `about $2 of gas a week`,
      `10 minutes a week`,
    ),
    step(
      `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot`,
      `the $${capital} stays in the position`,
      `${hold} days`,
    ),
    step(
      `Before you withdraw, open ${p.name}'s own points or rewards page from its official site and claim only from the link it publishes, and never pay a fee to claim`,
      `no fee to check, and never pay to claim`,
      `10 minutes`,
    ),
    step(
      `Write the wallet address, the dates and every transaction hash in a farm log so you can repeat the position or unwind it cleanly`,
      `nothing but the log itself`,
      `5 minutes`,
    ),
  ];
}

/** The ranked board: every rankable protocol, strongest first, ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const rankable = snapshot.protocols.filter(isRankable);
  const scored = rankable.map((p) => ({ p, ...scoreProtocol(p, snapshot.as_of, model) }));
  scored.sort(compareScored);
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_usd: Math.round(s.base),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      category_multiplier: round4(s.categoryMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
}

/** The live-token protocols, by market cap, exchanges excluded. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd as number,
      change_7d: p.change_7d,
    }));
}

/** A board row in the compact form data.js carries. */
export function compactRow(row: BoardRow, onWatchlist: boolean): CompactRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiplier: row.model.category_multiplier,
    watchlist: onWatchlist,
    farm_steps: row.farm_steps,
  };
}

/** The board and the dashboard dataset, from one snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    watchlist: [...snapshot.watchlist].sort(),
    rows: board.map((r) => compactRow(r, watchlist.has(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json has no as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: watchlist coverage, ranks
 * 1..n in order, implied value non-increasing and not all equal, and farm steps
 * of 3..12 per row, each 20..600 characters.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) {
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} outranks row ${i} on implied value`;
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `${r.slug} has ${r.farm_steps.length} farm steps`;
    }
    for (const s of r.farm_steps) {
      if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    }
  }
  return null;
}

/** The dashboard's dataset as one script: window.RADAR, no fetch, no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
