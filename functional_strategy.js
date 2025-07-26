/**
 * ===================================================================================
 * Strategy Functions (functions.js)
 * ===================================================================================
 *
 * Description:
 * This module provides a set of pure functions to implement a simulated yield
 * farming strategy. It discovers, analyzes, and selects incentive-driven
 * liquidity pools from Solana. It is designed to be imported and used by a
 * workflow manager.
 *
 * ===================================================================================
 */

import axios from 'axios';
import { API_URL } from './config.js'; // Import constants from config
import fs from 'fs';

// --- Phase 1: Discovery Functions ---

/**
 * Fetches all pool data from the DeFiLlama API.
 * @returns {Promise<Array>} A promise that resolves to an array of all pools.
 */
export const fetchAllPools = async () => {
    try {
        console.log('Fetching pool data from DeFiLlama...');
        const response = await axios.get(API_URL);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching DeFiLlama data:', error.message);
        return [];
    }
};

/**
 * Filters and selects incentive-driven pools based on the strategy configuration.
 * @param {Array} allPools - The raw array of pools from the API.
 * @param {object} config - The strategy configuration object.
 * @returns {Array} An array of filtered and sorted incentive-driven pools.
 */
export const selectIncentivePools = (allPools, config) => {
    console.log('Filtering for incentive-driven Solana pools...');

    const isIncentiveDriven = (pool) => {
        const rewardApy = pool.apyReward || 0;
        const totalApy = pool.apy || 0;
        // Avoid division by zero
        if (totalApy === 0) return false;
        return (rewardApy / totalApy) >= config.minRewardAPYRatio;
    };

    const incentivePools = allPools.filter(pool =>
        pool.chain === "Solana" &&
        pool.apy > config.minAPY &&
        pool.tvlUsd > config.minTVL &&
        isIncentiveDriven(pool)
    );

    const sortedPools = incentivePools.sort((a, b) => b.apy - a.apy);

    console.log(`Found ${sortedPools.length} potential incentive-driven pools.`);

    // --- New Logging Section ---
    if (sortedPools.length > 0) {
        console.log('\n--- Top Incentive-Driven Pools Found ---');
        console.log('| Project         | Symbol          | APY (%) | TVL ($)         |');
        console.log('|-----------------|-----------------|---------|-----------------|');
        sortedPools.slice(0, 10).forEach(pool => {
            const project = pool.project.padEnd(15).slice(0, 15);
            const symbol = pool.symbol.padEnd(15).slice(0, 15);
            const apy = pool.apy.toFixed(2).padStart(7);
            const tvl = Math.round(pool.tvlUsd).toLocaleString().padStart(15);
            console.log(`| ${project} | ${symbol} | ${apy} | ${tvl} |`);
        });
        console.log('------------------------------------------');
    }
    // --- End New Logging Section ---

    return sortedPools;
};


// --- Phase 2: Analysis Functions ---

/**
 * Calculates a risk score for a given pool.
 * @param {object} pool - The pool object.
 * @returns {number} A risk score from 0 to 10.
 */
export const calculateRiskScore = (pool) => {
    let risk = 0;
    if (pool.apy > 100) risk += 3;
    if (pool.tvlUsd < 100000) risk += 2;
    if ((pool.apyReward / pool.apy) > 0.8) risk += 2;
    if (pool.exposure !== 'single') risk += 1; // Penalize non-single token exposure slightly
    return Math.min(risk, 10);
};

/**
 * Enriches each pool with calculated scores for risk and profit potential.
 * @param {Array} pools - An array of pool objects.
 * @returns {Array} The array of pools, with added scoring properties.
 */
export const enrichPoolData = (pools) => {
    console.log('Enriching pools with risk and profit scores...');
    return pools.map(pool => ({
        ...pool,
        riskScore: calculateRiskScore(pool),
        // A simple profit potential score based on APY and TVL
        profitPotential: (pool.apy * 0.5) + (Math.log10(pool.tvlUsd) * 5),
    }));
};


// --- Phase 3: Selection & Allocation Functions ---

/**
 * Selects the optimal pools for the portfolio based on risk and potential.
 * @param {Array} enrichedPools - Pools with scoring data.
 * @param {object} config - The strategy configuration object.
 * @returns {Array} A slice of the top pools for the portfolio.
 */
export const selectOptimalPools = (enrichedPools, config) => {
    console.log('Selecting optimal pools based on risk-adjusted scores...');
    const acceptablePools = enrichedPools.filter(pool => pool.riskScore <= config.maxRiskScore);

    const scoredPools = acceptablePools.map(pool => ({
        ...pool,
        // Adjust profit score by risk. A lower risk score results in a higher adjusted score.
        adjustedScore: pool.profitPotential * (10 - pool.riskScore) / 10
    })).sort((a, b) => b.adjustedScore - a.adjustedScore);

    return scoredPools.slice(0, 10); // Return the top 10 pools
};

/**
 * Saves data as a JSON report to the specified file.
 * @param {string} filePath - Filename to save the report.
 * @param {any} data - Data to serialize to JSON.
 */
export function saveJsonReport(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving JSON report to ${filePath}:`, error.message);
  }
}
