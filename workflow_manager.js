/**
 * ===================================================================================
 * Simulation Workflow Manager (workflow_manager.js)
 * ===================================================================================
 *
 * Description:
 * Orchestrates the short-term (24h) yield farming simulation on Solana.
 * Decouples detection, validation, analysis, and selection phases, using
 * the robust strategy module (functional_strategy.js).
 *
 * ===================================================================================
 */

import fs from 'fs';
import logger from './logger.js';
import {
  fetchNewIncentivePools,
  validateAndFilterNewPools,
  enrichPoolData,
  selectOptimalPools,
  defaultConfig,
  sampleStats,
} from './functional_strategy.js';

// --- Configuration ---
const PORTFOLIO_FILE       = 'active_portfolio.json';
const WATCHLIST_FILE       = 'watchlist.json';
const HOLD_DURATION_MS     = 24 * 60 * 60 * 1000;  // Hold positions 24h
const RUN_INTERVAL_MS      = 30 * 60 * 1000;       // Run every 30 minutes
const MAX_ACTIVE_POSITIONS = 5;
const MIN_WATCHLIST_AGE_MS = 15 * 60 * 1000;       // Validate watchlist after 15 min

// --- State Management ---
function loadJsonFile(path, defaultVal) {
  try {
    if (fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path, 'utf-8'));
    }
  } catch (e) {
    logger.error(`Failed to load ${path}: ${e.message}`);
  }
  return defaultVal;
}

function saveJsonFile(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    logger.info(`Saved state to ${path}`);
  } catch (e) {
    logger.error(`Failed to save ${path}: ${e.message}`);
  }
}

// --- Portfolio Lifecycle ---
function checkForExits(portfolio) {
  const now = Date.now();
  const stillActive = [];

  portfolio.active.forEach(pos => {
    if (now - pos.entryTimestamp >= HOLD_DURATION_MS) {
      logger.info(`Exiting ${pos.symbol} after 24h hold.`);
      pos.status = 'exited';
      pos.exitTimestamp = now;
      portfolio.exited.push(pos);
    } else {
      stillActive.push(pos);
    }
  });

  portfolio.active = stillActive;
}

async function updateWatchlist(watchlist) {
  logger.info('Updating watchlist with newest pools...');
  const detected = await fetchNewIncentivePools(defaultConfig);
  const map = new Map(watchlist.map(p => [p.poolId, p]));
  let added = 0;

  for (const pool of detected.slice(0, 10)) {
    if (!map.has(pool.pool)) {
      watchlist.push({
        poolId:     pool.pool,
        symbol:     pool.symbol,
        project:    pool.project,
        firstSeen:  pool.firstSeenAt || Date.now(),
        isNew:      pool.isNew,
      });
      added++;
    }
  }

  // Prune older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const before = watchlist.length;
  watchlist = watchlist.filter(p => p.firstSeen > cutoff);
  const removed = before - watchlist.length;

  if (added)   logger.info(`Added ${added} new watchlist entries.`);
  if (removed) logger.info(`Removed ${removed} stale watchlist entries.`);
  return watchlist;
}

async function investFromWatchlist(portfolio, watchlist) {
  logger.info('Evaluating watchlist for investment...');
  const slots = MAX_ACTIVE_POSITIONS - portfolio.active.length;
  if (slots <= 0) {
    logger.info('No available slots, portfolio is full.');
    return;
  }

  // Filter pools that have aged on watchlist
  const now = Date.now();
  const matured = watchlist.filter(w => now - w.firstSeen >= MIN_WATCHLIST_AGE_MS);
  if (!matured.length) {
    logger.info('No matured pools to validate yet.');
    return;
  }

  // Validate & prioritize
  const allPools = await fetchNewIncentivePools(defaultConfig);
  const validated = validateAndFilterNewPools(matured, allPools, defaultConfig);
  if (!validated.length) {
    logger.info('No validated pools meeting criteria.');
    return;
  }

  // Analyze & select top candidates
  const enriched = enrichPoolData(validated.slice(0, 20), sampleStats, defaultConfig);
  const optimal  = selectOptimalPools(enriched, defaultConfig).slice(0, slots);

  let addedCount = 0;
  for (const cand of optimal) {
    if (!portfolio.active.some(p => p.poolId === cand.pool)) {
      logger.info(`▶ Entering ${cand.symbol} | APY ${cand.apy.toFixed(2)}% | Risk ${cand.riskScore}`);
      portfolio.active.push({
        poolId:        cand.pool,
        symbol:        cand.symbol,
        project:       cand.project,
        entryTimestamp: now,
        entryApy:      cand.apy,
        entryRisk:     cand.riskScore,
        isNew:         cand.isNew,
      });
      addedCount++;
    }
  }

  if (addedCount) {
    logger.info(`Added ${addedCount} new positions.`);
  } else {
    logger.info('All top candidates already active.');
  }
}

// --- Main Loop ---
async function workflowLoop() {
  logger.info(`--- Workflow Cycle @ ${new Date().toISOString()} ---`);

  const portfolio = loadJsonFile(PORTFOLIO_FILE, { active: [], exited: [] });
  let watchlist = loadJsonFile(WATCHLIST_FILE, []);

  checkForExits(portfolio);
  watchlist = await updateWatchlist(watchlist);
  await investFromWatchlist(portfolio, watchlist);

  saveJsonFile(PORTFOLIO_FILE, portfolio);
  saveJsonFile(WATCHLIST_FILE, watchlist);

  logger.info(`Cycle Complete: Active=${portfolio.active.length}, Exited=${portfolio.exited.length}, Watchlist=${watchlist.length}`);
}

logger.info('Starting Workflow Manager...');
logger.info(`Interval: ${RUN_INTERVAL_MS/60000}m | Hold: ${HOLD_DURATION_MS/3600000}h | Watchlist Age: ${MIN_WATCHLIST_AGE_MS/60000}m`);

workflowLoop();
setInterval(workflowLoop, RUN_INTERVAL_MS);
