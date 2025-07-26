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
import { API_URL } from './config.js';
import logger from './logger.js';

// --- Configuration Defaults ---
export const defaultConfig = {
  // Phase 1 - Pool Detection Criteria
  minAPY: 50,
  minTVL: 100_000,
  minRewardAPY: 20,
  minRewardAPYRatio: 0.5,
  newPoolAgeDays: 7,
  highAPYThreshold: 200,
  mediumAPYThreshold: 80,
  lowTVLThreshold: 500_000,
  highRewardRatioThreshold: 0.8,
  tvlGrowthPctThreshold: 50,

  // Phase 2 - Risk & Analysis Criteria
  volatilitySigmaThreshold: 2,
  maxRiskScore: 5,

  // Phase 3 - Selection/Diversification
  maxPerToken: 2,
  maxTotal: 10
};

// --- Sample Stats Object for Profit Calculation ---
export const sampleStats = {
  apyMin: 0,
  apyMax: 1000,
  tvlMax: 10_000_000,
  volRatioMax: 0.1
};

// --- Phase 1: Data Fetching & Validation ---

export async function fetchAllLlamaPools() {
  const response = await axios.get('https://yields.llama.fi/pools');
  return response.data.data;
}

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

  const newPools = [];
  const established = [];

  incentivePools.forEach(pool => {
    let isNew = false;
    const apyReward = pool.apyReward || 0;
    const rewardRatio = apyReward / Math.max(pool.apy, 1);

    if (pool.firstSeenAt) {
      const ageDays = (Date.now() - new Date(pool.firstSeenAt).getTime()) / 86400000;
      if (ageDays < config.newPoolAgeDays) isNew = true;
    }
    if (pool.apy > config.highAPYThreshold) isNew = true;
    if (pool.tvlUsd < config.lowTVLThreshold && pool.apy > config.mediumAPYThreshold) isNew = true;
    if (rewardRatio > config.highRewardRatioThreshold && pool.apy > config.mediumAPYThreshold) isNew = true;
    if (pool.tvlGrowthPct1d && pool.tvlGrowthPct1d > config.tvlGrowthPctThreshold) isNew = true;
    const keywords = ['new', 'launch', 'genesis', 'fresh'];
    if (keywords.some(k => pool.project?.toLowerCase().includes(k) || pool.symbol?.toLowerCase().includes(k))) {
      isNew = true;
    }

    // normalize rewardTokens to array
    const rewardTokens = Array.isArray(pool.rewardTokens) ? pool.rewardTokens : [];
    const record = { ...pool, isNew, rewardRatio, rewardTokens };

    (isNew ? newPools : established).push(record);
  });

  return [
    ...newPools.sort((a, b) => b.apy - a.apy),
    ...established.sort((a, b) => b.apy - a.apy)
  ];
}

export function validateAndFilterNewPools(detectedPools, allPools, config = defaultConfig) {
  logger.info(`Validating ${detectedPools.length} detected pools...`);
  const map = new Map(allPools.map(p => [p.pool, p]));
  const result = [];

  detectedPools.forEach(p => {
    const data = map.get(p.pool) || map.get(p.address);
    if (!data) return;
    if (data.chain !== 'Solana' || data.apy < config.minAPY || data.tvlUsd < config.minTVL) return;

    const apyReward = data.apyReward || 0;
    if (apyReward < config.minRewardAPY) return;
    const rewardRatio = apyReward / Math.max(data.apy, 1);
    if (rewardRatio < config.minRewardAPYRatio) return;

    const rewardTokens = Array.isArray(data.rewardTokens) ? data.rewardTokens : [];
    result.push({ ...data, firstSeenAt: p.firstSeenAt, rewardTokens, rewardRatio });
  });

  return result.sort((a, b) => b.apy - a.apy);
}

// --- Phase 2: Analysis Functions ---

export function calculateRiskScore(pool, config = defaultConfig) {
  let risk = 0;
  if (pool.apy > 100) risk += 3;
  if (pool.tvlUsd < 100_000) risk += 2;
  if (( (pool.apyReward||0) / Math.max(pool.apy, 1) ) > config.highRewardRatioThreshold) risk += 2;
  if (pool.exposure !== 'single') risk += 1;
  if (pool.predictions?.predictedClass === 'Down') risk += 2;
  if (pool.ilRisk === 'yes') risk += 1;
  if (pool.sigma > config.volatilitySigmaThreshold) risk += 1;
  return Math.min(risk, 10);
}

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
  logger.info(`Enriching ${pools.length} pools with scores...`);
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
