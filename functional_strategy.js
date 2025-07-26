/**
 * ===================================================================================
 * Strategy Functions (functions.js)
 * ===================================================================================
 *
 * Description:
 * This module provides functions to validate and analyze newly detected pools.
 * It acts as the "Secondary Validation Layer" by cross-referencing new pools
 * with the comprehensive data from DeFiLlama to check their APY and TVL.
 *
 * ===================================================================================
 */

import axios from 'axios';
import { API_URL } from './config.js';
import logger from './logger.js';

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
 * @returns {Promise<Array>} Array of recently detected incentive-driven pools.
 */
export async function fetchNewIncentivePools(config) {
  logger.info('Fetching DeFiLlama data to detect new incentive-driven opportunities...');
  
  const allLlamaPools = await fetchAllLlamaPools();
  
  // Filter for Solana incentive-driven pools
  const incentivePools = allLlamaPools.filter(pool => {
    if (pool.chain !== 'Solana') return false;
    if (pool.apy < config.minAPY) return false;
    if (pool.tvlUsd < config.minTVL) return false;
    
    const rewardRatio = (pool.apyReward || 0) / pool.apy;
    return rewardRatio >= config.minRewardAPYRatio;
  });
  
  logger.info(`Found ${incentivePools.length} total incentive-driven Solana pools`);
  
  // Try to identify "new" pools based on various indicators
  const newPools = [];
  const establishedPools = [];
  
  incentivePools.forEach(pool => {
    let isNew = false;
    
    // Indicators of "newness":
    // 1. Very high APY (often indicates new farming programs)
    if (pool.apy > 200) isNew = true;
    
    // 2. Low TVL but high APY (new pool haven't accumulated much liquidity yet)
    if (pool.tvlUsd < 500000 && pool.apy > 50) isNew = true;
    
    // 3. Very high reward APY ratio (new incentive programs)
    const rewardRatio = (pool.apyReward || 0) / pool.apy;
    if (rewardRatio > 0.8 && pool.apy > 80) isNew = true;
    
    // 4. Specific project patterns that indicate new launches
    const newProjectIndicators = ['new', 'launch', 'genesis', 'fresh'];
    if (newProjectIndicators.some(indicator => 
        pool.project.toLowerCase().includes(indicator) || 
        pool.symbol.toLowerCase().includes(indicator))) {
      isNew = true;
    }
    
    if (isNew) {
      newPools.push({ ...pool, isNew: true, detectionReason: 'High APY/New indicators' });
      logger.info(`� NEW OPPORTUNITY: ${pool.symbol} - APY: ${pool.apy.toFixed(2)}%, Reward: ${(pool.apyReward || 0).toFixed(2)}%, TVL: $${pool.tvlUsd.toFixed(0)}`);
    } else {
      establishedPools.push({ ...pool, isNew: false });
    }
  });
  
  logger.info(`Classified ${newPools.length} as NEW opportunities, ${establishedPools.length} as established`);
  
  // Prioritize new pools, then established ones
  const prioritizedPools = [
    ...newPools.sort((a, b) => b.apy - a.apy),
    ...establishedPools.sort((a, b) => b.apy - a.apy)
  ];
  
  // Log top new opportunities
  if (newPools.length > 0) {
    logger.info('� TOP NEW INCENTIVE OPPORTUNITIES:');
    newPools.slice(0, 5).forEach((pool, i) => {
      const rewardRatio = ((pool.apyReward || 0) / pool.apy * 100).toFixed(1);
      logger.info(`   ${i+1}. ${pool.symbol} - APY: ${pool.apy.toFixed(2)}% (${rewardRatio}% from rewards), TVL: $${pool.tvlUsd.toFixed(0)}`);
    });
  }
  
  return prioritizedPools;
}

/**
 * Validates new pools against DeFiLlama data and filters for incentive-driven criteria.
 * @param {Array} newPools - New pools from detector.
 * @param {Array} llamaPools - All pools from DeFiLlama.
 * @param {Object} config - Strategy configuration.
 * @returns {Array} Validated and filtered pools.
 */
export function validateAndFilterNewPools(newPools, llamaPools, config) {
  logger.info(`Validating ${newPools.length} newly detected pools against DeFiLlama data...`);
  logger.info(`Criteria: APY > ${config.minAPY}%, TVL > $${config.minTVL}, RewardRatio > ${config.minRewardAPYRatio}`);
  
  // Create a map for faster lookup
  const llamaPoolMap = new Map(llamaPools.map(p => [p.pool, p]));
  
  const validatedPools = [];
  let matchedCount = 0;
  let criteriaFailCount = 0;
  
  newPools.forEach(newPool => {
    // Try to find this pool in DeFiLlama data
    const llamaData = llamaPoolMap.get(newPool.id) || llamaPoolMap.get(newPool.address);
    
    if (llamaData) {
      matchedCount++;
      logger.info(`Found match: ${llamaData.symbol} - APY: ${llamaData.apy}%, TVL: $${llamaData.tvlUsd}, Chain: ${llamaData.chain}`);
      
      if (llamaData.chain === 'Solana' &&
          llamaData.apy > config.minAPY &&
          llamaData.tvlUsd > config.minTVL) {
        
        // Check if it's incentive-driven
        const rewardRatio = (llamaData.apyReward || 0) / llamaData.apy;
        logger.info(`${llamaData.symbol} reward ratio: ${rewardRatio.toFixed(3)} (need ${config.minRewardAPYRatio})`);
        
        if (rewardRatio >= config.minRewardAPYRatio) {
          validatedPools.push({
            ...llamaData,
            createdAt: newPool.created_at || newPool.createdAt,
            firstSeenAt: newPool.firstSeenAt
          });
          logger.info(`✅ ${llamaData.symbol} passed all criteria!`);
        } else {
          criteriaFailCount++;
          logger.info(`❌ ${llamaData.symbol} failed reward ratio test`);
        }
      } else {
        criteriaFailCount++;
        logger.info(`❌ ${llamaData.symbol} failed basic criteria (APY/TVL/Chain)`);
      }
    }
  });
  
  logger.info(`Validation results: ${matchedCount} matched in DeFiLlama, ${criteriaFailCount} failed criteria, ${validatedPools.length} passed all tests`);
  return validatedPools.sort((a, b) => b.apy - a.apy);
}




// --- Phase 2: Analysis Functions ---

/**
 * Calculates a risk score for a given pool.
 */
export const calculateRiskScore = (pool) => {
    let risk = 0;
    if (pool.apy > 100) risk += 3;
    if (pool.tvlUsd < 100000) risk += 2;
    if ((pool.apyReward / pool.apy) > 0.8) risk += 2;
    if (pool.exposure !== 'single') risk += 1;
    // Add extra risk for being a brand new pool
    risk += 1;
    return Math.min(risk, 10);
};

/**
 * Enriches each pool with calculated scores.
 */
export const enrichPoolData = (pools) => {
    logger.info(`Enriching data for ${pools.length} pools with risk and profit scores...`);
    return pools.map(pool => ({
        ...pool,
        riskScore: calculateRiskScore(pool),
        profitPotential: (pool.apy * 0.5) + (Math.log10(pool.tvlUsd) * 5),
    }));
};


// --- Phase 3: Selection Function ---

/**
 * Selects the optimal pools for the portfolio.
 */
export const selectOptimalPools = (enrichedPools, config) => {
    logger.info('Selecting optimal pools based on risk-adjusted scores...');
    const acceptablePools = enrichedPools.filter(pool => pool.riskScore <= config.maxRiskScore);

    const scoredPools = acceptablePools.map(pool => ({
        ...pool,
        adjustedScore: pool.profitPotential * (10 - pool.riskScore) / 10
    })).sort((a, b) => b.adjustedScore - a.adjustedScore);

    return scoredPools.slice(0, 10);
};
