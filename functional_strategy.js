/**
 * ===================================================================================
 * Strategy Functions (functions.js)
 * ===================================================================================
 *
 * Description:
 * This module provides functions to detect, validate, analyze, and select
 * short-term high-APY incentive-driven pools on Solana, with improved risk,
 * volatility, and reward-sustainability profiling.
 *
 * ===================================================================================
 */

import axios from 'axios';
import { STRATEGY_CONFIG, TIMING_CONFIG, CONFIG_HELPERS, defaultConfig } from './config.js';
import logger from './logger.js';

// --- Configuration Defaults ---
export { defaultConfig } from './config.js';

// --- Sample Stats Object for Profit Calculation ---
export const sampleStats = {
  apyMin: 0,
  apyMax: 1000,
  tvlMax: 10_000_000,
  volRatioMax: 0.1
};

// --- Phase 1: Data Fetching & Validation ---

/**
 * Fetches all pools data from DeFiLlama API.
 * @returns {Promise<Array>} Array of pool objects.
 */
export async function fetchAllLlamaPools() {
  const response = await axios.get('https://yields.llama.fi/pools');
  return response.data.data;
}

/**
 * Fetches newly launched incentive-driven pools by analyzing DeFiLlama data for recent entries.
 * @param {Object} config - Strategy configuration.
 * @returns {Promise<Array>} Array of prioritized pools.
 */
export async function fetchNewIncentivePools(config = defaultConfig) {
  logger.info('Fetching DeFiLlama data to detect new incentive-driven opportunities...');
  const allPools = await fetchAllLlamaPools();

  const incentivePools = allPools.filter(pool => {
    if (pool.chain !== 'Solana') return false;
    if (pool.apy < config.minAPY) return false;
    if (pool.tvlUsd < config.minTVL) return false;
    const apyReward = pool.apyReward || 0;
    if (apyReward < config.minRewardAPY) return false;
    const rewardRatio = apyReward / Math.max(pool.apy, 1);
    return rewardRatio >= config.minRewardAPYRatio;
  });

  logger.info(`Found ${incentivePools.length} Solana incentive-driven pools`);
  
  // Log some examples of what we found
  if (incentivePools.length > 0) {
    logger.info(`Pool examples:`);
    incentivePools.slice(0, 3).forEach(pool => {
      logger.info(`  • ${pool.symbol} (${pool.project}): APY ${pool.apy}%, Reward APY ${pool.apyReward}%, TVL $${pool.tvlUsd?.toLocaleString()}`);
    });
  }

  const newPools = [];
  const established = [];

  incentivePools.forEach(pool => {
    let isNew = false;
    const apyReward = pool.apyReward || 0;
    const rewardRatio = apyReward / Math.max(pool.apy, 1);

    // 1. Ultra-fresh window check (1-4 hours)
    if (CONFIG_HELPERS.isUltraFresh(pool.firstSeenAt)) {
      isNew = true;
      logger.info(`Pool ${pool.symbol} flagged as new: Ultra-fresh (${pool.firstSeenAt})`);
    }
    
    // 2. Age indicator (legacy 7-day check)
    if (pool.firstSeenAt && !isNew) {
      const ageDays = (Date.now() - new Date(pool.firstSeenAt).getTime()) / 86400000;
      if (ageDays < config.newPoolAgeDays) isNew = true;
    }
    
    // 3. Very high APY
    if (pool.apy > config.highAPYThreshold) isNew = true;
    // 4. Low TVL + medium APY
    if (pool.tvlUsd < config.lowTVLThreshold && pool.apy > config.mediumAPYThreshold) isNew = true;
    // 5. High reward ratio
    if (rewardRatio > config.highRewardRatioThreshold && pool.apy > config.mediumAPYThreshold) isNew = true;
    // 6. Rapid TVL growth
    if (pool.tvlGrowthPct1d && pool.tvlGrowthPct1d > config.tvlGrowthPctThreshold) isNew = true;
    // 7. Keyword indicators
    const keywords = ['new', 'launch', 'genesis', 'fresh'];
    if (keywords.some(k => pool.project?.toLowerCase().includes(k) || pool.symbol?.toLowerCase().includes(k))) {
      isNew = true;
    }

    const rewardTokens = Array.isArray(pool.rewardTokens) ? pool.rewardTokens : [];
    const record = { ...pool, isNew, rewardRatio, rewardTokens };
    (isNew ? newPools : established).push(record);
  });

  return [
    ...newPools.sort((a, b) => b.apy - a.apy),
    ...established.sort((a, b) => b.apy - a.apy)
  ];
}

/**
 * Validates new pools against full DeFiLlama data and config criteria.
 * @param {Array} detectedPools
 * @param {Array} allPools
 * @param {Object} config
 * @returns {Array} validatedPools
 */
export function validateAndFilterNewPools(detectedPools, allPools, config = defaultConfig) {
  const map = new Map(allPools.map(p => [p.pool, p]));
  const result = [];
  let filtered = 0;
  let reasons = { chain: 0, apy: 0, tvl: 0, rewardApy: 0, rewardRatio: 0 };

  detectedPools.forEach(p => {
    const data = map.get(p.pool) || map.get(p.address);
    if (!data) return;
    
    // Debug logging for pool validation
    logger.info(`🔍 Validating pool: ${data.symbol || p.pool}`);
    logger.info(`   APY: ${data.apy}% (min: ${config.minAPY}%)`);
    logger.info(`   TVL: $${data.tvlUsd?.toLocaleString()} (min: $${config.minTVL.toLocaleString()})`);
    logger.info(`   Reward APY: ${data.apyReward || 0}% (min: ${config.minRewardAPY}%)`);
    
    if (data.chain !== 'Solana') { 
      logger.info(`    Failed: Wrong chain (${data.chain})`);
      reasons.chain++; filtered++; return; 
    }
    if (data.apy < config.minAPY) { 
      logger.info(`    Failed: Low APY`);
      reasons.apy++; filtered++; return; 
    }
    if (data.tvlUsd < config.minTVL) { 
      logger.info(`    Failed: Low TVL`);
      reasons.tvl++; filtered++; return; 
    }

    const apyReward = data.apyReward || 0;
    if (apyReward < config.minRewardAPY) { 
      logger.info(`    Failed: Low reward APY`);
      reasons.rewardApy++; filtered++; return; 
    }
    const rewardRatio = apyReward / Math.max(data.apy, 1);
    logger.info(`   Reward Ratio: ${(rewardRatio * 100).toFixed(1)}% (min: ${(config.minRewardAPYRatio * 100)}%)`);
    if (rewardRatio < config.minRewardAPYRatio) { 
      logger.info(`    Failed: Low reward ratio`);
      reasons.rewardRatio++; filtered++; return; 
    }

    logger.info(`   ✅ Passed validation!`);
    const rewardTokens = Array.isArray(data.rewardTokens) ? data.rewardTokens : [];
    result.push({ ...data, firstSeenAt: p.firstSeenAt, rewardTokens, rewardRatio });
  });

  if (filtered > 0) {
    logger.info(`Filtered out ${filtered} pools:`);
    logger.info(`  • Wrong chain: ${reasons.chain}`);
    logger.info(`  • Low APY (<${config.minAPY}%): ${reasons.apy}`);
    logger.info(`  • Low TVL (<$${config.minTVL.toLocaleString()}): ${reasons.tvl}`);
    logger.info(`  • Low reward APY (<${config.minRewardAPY}%): ${reasons.rewardApy}`);
    logger.info(`  • Low reward ratio (<${(config.minRewardAPYRatio * 100)}%): ${reasons.rewardRatio}`);
  }

  logger.info(` ${result.length} pools passed validation`);

  return result.sort((a, b) => b.apy - a.apy);
}

// --- Phase 2: Analysis Functions ---

/**
 * Calculates a composite risk score (0–10).
 */
export function calculateRiskScore(pool, config = defaultConfig) {
  let risk = 0;
  if (pool.apy > 100) risk += 3;
  if (pool.tvlUsd < 100_000) risk += 2;
  if (((pool.apyReward||0) / Math.max(pool.apy, 1)) > config.highRewardRatioThreshold) risk += 2;
  if (pool.exposure !== 'single') risk += 1;
  if (pool.predictions?.predictedClass === 'Down') risk += 2;
  if (pool.ilRisk === 'yes') risk += 1;
  if (pool.sigma > config.volatilitySigmaThreshold) risk += 1;
  return Math.min(risk, 10);
}

/**
 * Computes profit potential score normalized by stats.
 */
export function calculateProfitPotential(pool, stats = sampleStats) {
  const { apyMin, apyMax, tvlMax, volRatioMax } = stats;
  const apy = pool.apy || 0;
  const tvl = pool.tvlUsd || 0;
  const vol1d = pool.volumeUsd1d || 0;
  const normAPY = (apy - apyMin) / (apyMax - apyMin);
  const normTVL = Math.log10(tvl + 1) / Math.log10(tvlMax);
  const volumeRatio = vol1d / (tvl || 1);
  return normAPY * 0.6 + normTVL * 0.3 + Math.min(volumeRatio, volRatioMax) * 0.1;
}

export function enrichPoolData(pools, stats = sampleStats, config = defaultConfig) {
  return pools.map(pool => {
    const risk = calculateRiskScore(pool, config);
    const profit = calculateProfitPotential(pool, stats);
    return { ...pool, riskScore: risk, profitPotential: profit };
  });
}

// --- Phase 3: Selection Function ---

export function selectOptimalPools(enrichedPools, config = defaultConfig) {
  const candidates = enrichedPools.filter(p => p.riskScore <= config.maxRiskScore);
  const byToken = {};
  candidates.forEach(p => {
    const tok = p.rewardTokens.length > 0 ? p.rewardTokens[0] : 'none';
    byToken[tok] = byToken[tok] || [];
    byToken[tok].push(p);
  });

  let selected = [];
  Object.values(byToken).forEach(arr => {
    selected.push(...arr.sort((a, b) => b.profitPotential - a.profitPotential).slice(0, config.maxPerToken));
  });

  return selected
    .sort((a, b) => b.profitPotential - a.profitPotential)
    .slice(0, config.maxTotal);
}

/**
 * Fetches a single pool by ID (or address) from DeFiLlama and calculates riskScore.
 * @param {string} poolId
 * @returns {Promise<Object|null>}
 */
export async function fetchPoolById(poolId) {
  const allPools = await fetchAllLlamaPools();
  const pool = allPools.find(p => p.pool === poolId || p.address === poolId);
  if (!pool) return null;
  pool.riskScore = calculateRiskScore(pool, defaultConfig);
  return pool;
}
