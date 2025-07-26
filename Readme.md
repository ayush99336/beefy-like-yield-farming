# Strategy Module & Workflow Manager Documentation

This document summarizes the enhancements and structure of the two key JavaScript files in our short-term (24h) yield farming framework on Solana:

1. **functional\_strategy.js** (Strategy Module)
2. **workflow\_manager.js** (Simulation Workflow Manager)

---

## 1. functional\_strategy.js

### 📦 Configuration

* **`defaultConfig`**: Centralized thresholds for detection, analysis, and selection:

  * **Detection**: `minAPY`, `minTVL`, `minRewardAPY`, `minRewardAPYRatio`, `newPoolAgeDays`, etc.
  * **Risk/Analysis**: `volatilitySigmaThreshold`, `maxRiskScore`
  * **Selection**: `maxPerToken`, `maxTotal`
* **`sampleStats`**: Template stats (e.g., `apyMin`, `apyMax`, `tvlMax`, `volRatioMax`) for normalizing profit potential.

### 🕵️ Phase 1: Data Fetching & Validation

* **`fetchAllLlamaPools`**: Retrieves all pools from DeFiLlama.
* **`fetchNewIncentivePools(config)`**:

  1. **Filters** for Solana pools meeting `minAPY`, `minTVL`, and absolute `minRewardAPY`.
  2. **Normalizes** `apyReward` and `rewardTokens` safely when fields are null.
  3. **Marks "new" pools** via indicators:

     * **Age** (`firstSeenAt < newPoolAgeDays`)
     * **High APY** thresholds
     * **Low TVL + medium APY** mix
     * **Reward ratio** (> `highRewardRatioThreshold`)
     * **Rapid TVL growth** (`tvlGrowthPct1d`)
     * **Keyword patterns** (`new`, `launch`, etc.)
  4. **Prioritizes**: New pools first by APY, then established ones.
* **`validateAndFilterNewPools(detected, allPools, config)`**:

  * Cross-references watchlist/other detections against full DeFiLlama data.
  * Reapplies `minAPY`, `minTVL`, `minRewardAPY`, and `minRewardAPYRatio` safeguards.

### 📊 Phase 2: Analysis Functions

* **`calculateRiskScore(pool, config)`**:

  * Composite 0–10 risk score based on:

    * Very high APY (> 100%) ➔ +3
    * Low TVL (< 100k) ➔ +2
    * High reward ratio (> threshold) ➔ +2
    * Multi-asset exposure, down prediction, IL risk, sigma volatility ➔ additional points
* **`calculateProfitPotential(pool, stats)`**:

  * Normalizes APY and TVL (log scale) and factors **volume/TVL ratio** for a 0–1 score.
* **`enrichPoolData(pools, stats, config)`**:

  * Annotates each pool with `riskScore` and `profitPotential`.

### 🎯 Phase 3: Selection Function

* **`selectOptimalPools(enrichedPools, config)`**:

  1. **Filters** out pools above `maxRiskScore`.
  2. **Groups** by `rewardTokens[0]` to ensure diversification.
  3. **Selects** up to `maxPerToken` per token, then top `maxTotal` overall by `profitPotential`.

---

## 2. workflow\_manager.js

### 🔧 Core Responsibilities

* Orchestrates repeated **workflow cycles** every 30 min to:

  1. **Detect** new incentive-driven pools.
  2. **Track** them in a watchlist with age-based pruning.
  3. **Validate**, **analyze**, and **invest** for short-term (24 h) simulation.

### 🗄️ State Management

* **`loadJsonFile`** / **`saveJsonFile`**: Safe read/write of `active_portfolio.json` and `watchlist.json`.
* **Constants**:

  * `HOLD_DURATION_MS` = 24 h, `RUN_INTERVAL_MS` = 30 min
  * `MAX_ACTIVE_POSITIONS` = 5, `MIN_WATCHLIST_AGE_MS` = 15 min

### 🚪 Portfolio Lifecycle

* **`checkForExits(portfolio)`**:

  * Exits positions held ≥ 24 h, moves them to `exited`, logs exit.
* **`updateWatchlist(watchlist)`**:

  * Calls `fetchNewIncentivePools(defaultConfig)` for top 10 opportunities.
  * **Adds** new pools (by `pool.pool`), stamps `firstSeen`.
  * **Prunes** entries older than 7 days.
* **`investFromWatchlist(portfolio, watchlist)`**:

  1. **Skips** if no slot available.
  2. **Filters** watchlist entries aged ≥ 15 min.
  3. **Validates** with `validateAndFilterNewPools`.
  4. **Analyzes** top 20 with `enrichPoolData(sampleStats)`.
  5. **Selects** up to `slots` via `selectOptimalPools`.
  6. **Invests**: logs and pushes new positions into `portfolio.active`.

### 🔄 Main Loop

* **`workflowLoop()`**:

  * Loads state, runs exit/update/invest steps, saves state, and logs summary.
  * Triggered on startup and every 30 min via `setInterval`.

---

This documentation provides an at-a-glance understanding of how each piece collaborates to detect, validate, analyze, and simulate yield-farming positions over a 24 h window on Solana. Adjust thresholds and stats in `defaultConfig` and `sampleStats` for your risk tolerance and market conditions.
