/**
 * ===================================================================================
 * Functional Yield Farming Strategy
 * ===================================================================================
 *
 * Description:
 * This script implements a simulated yield farming strategy using a functional
 * programming approach. It discovers, analyzes, and selects incentive-driven
 * liquidity pools from Solana, generating a final portfolio allocation report.
 *
 * Each step of the process is handled by a pure, independent function, making
 * the logic clear, testable, and easy to maintain.
 *
 * -----------------------------------------------------------------------------------
 *
 * To Run This Code:
 * 1. Make sure you have Node.js installed.
 * 2. In your project folder, open `package.json` and add the line: "type": "module",
 * 3. Open a terminal and run `npm install axios`.
 * 4. Run this script with the command: `node functional_strategy.js`
 *
 * ===================================================================================
 */

import axios from 'axios';
import fs from 'fs';

// --- Configuration ---
const STRATEGY_CONFIG = {
    minAPY: 30,
    minTVL: 50000,
    // A pool is "incentive-driven" if reward APY is at least 60% of the total APY.
    minRewardAPYRatio: 0.6,
    maxRiskScore: 7, // Max acceptable risk score (out of 10)
    totalInvestment: 10000, // Total capital to allocate in the simulation
};

const API_URL = 'https://yields.llama.fi/pools';
const REPORT_FILE = 'yield_farming_strategy_functional.json';

// --- Phase 1: Discovery Functions ---

/**
 * Fetches all pool data from the DeFiLlama API.
 * @returns {Promise<Array>} A promise that resolves to an array of all pools.
 */
const fetchAllPools = async () => {
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
const selectIncentivePools = (allPools, config) => {
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

    console.log(`Found ${incentivePools.length} potential incentive-driven pools.`);
    return incentivePools.sort((a, b) => b.apy - a.apy);
};


// --- Phase 2: Analysis Functions ---

/**
 * Calculates a risk score for a given pool.
 * @param {object} pool - The pool object.
 * @returns {number} A risk score from 0 to 10.
 */
const calculateRiskScore = (pool) => {
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
const enrichPoolData = (pools) => {
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
const selectOptimalPools = (enrichedPools, config) => {
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
 * Generates the final portfolio with investment allocation for each pool.
 * @param {Array} selectedPools - The final list of pools to include.
 * @param {number} totalInvestment - The total amount of capital to allocate.
 * @returns {Array} The final portfolio with allocation details.
 */
const generatePortfolio = (selectedPools, totalInvestment) => {
    console.log('Generating final portfolio allocation...');
    const totalScore = selectedPools.reduce((sum, pool) => sum + pool.adjustedScore, 0);

    if (totalScore === 0) {
        return []; // Avoid division by zero if no pools are selected
    }

    return selectedPools.map(pool => {
        const allocation = (pool.adjustedScore / totalScore) * totalInvestment;
        return {
            project: pool.project,
            symbol: pool.symbol,
            apy: pool.apy,
            tvlUsd: pool.tvlUsd,
            riskScore: pool.riskScore,
            recommendedAllocation: Math.round(allocation),
            allocationPercentage: ((allocation / totalInvestment) * 100).toFixed(2),
        };
    });
};


// --- Phase 4: Reporting Functions ---

/**
 * Displays a summary of the generated portfolio to the console.
 * @param {Array} portfolio - The final portfolio object.
 */
const displaySummary = (portfolio) => {
    if (portfolio.length === 0) {
        console.log('\nCould not generate a portfolio based on the current criteria.');
        return;
    }

    console.log('\n--- YIELD FARMING STRATEGY SUMMARY ---');
    console.log('==================================================================');
    console.log('| Project         | Symbol          | Allocation  | APY (%) | Risk |');
    console.log('|-----------------|-----------------|-------------|---------|------|');

    portfolio.forEach(p => {
        const project = p.project.padEnd(15).slice(0, 15);
        const symbol = p.symbol.padEnd(15).slice(0, 15);
        const allocation = `$${p.recommendedAllocation.toLocaleString()}`.padStart(11);
        const apy = p.apy.toFixed(2).padStart(7);
        const risk = p.riskScore.toString().padStart(4);

        console.log(`| ${project} | ${symbol} | ${allocation} | ${apy} | ${risk} |`);
    });
    console.log('==================================================================');
};

/**
 * Saves the final report to a JSON file.
 * @param {object} reportData - The data to be written to the file.
 */
const saveReport = (reportData) => {
    try {
        fs.writeFileSync(REPORT_FILE, JSON.stringify(reportData, null, 2));
        console.log(`\nStrategy report saved to ${REPORT_FILE}`);
    } catch (error) {
        console.error('Error saving report to file:', error.message);
    }
};


// --- Main Execution ---

/**
 * The main orchestrator function that runs the entire strategy.
 */
const runStrategy = async () => {
    // Phase 1: Discovery
    const allPools = await fetchAllPools();
    const candidatePools = selectIncentivePools(allPools, STRATEGY_CONFIG);

    // Phase 2: Analysis
    const enrichedPools = enrichPoolData(candidatePools);

    // Phase 3: Selection
    const selectedPools = selectOptimalPools(enrichedPools, STRATEGY_CONFIG);
    const portfolio = generatePortfolio(selectedPools, STRATEGY_CONFIG.totalInvestment);

    // Phase 4: Reporting
    displaySummary(portfolio);
    saveReport({
        generatedAt: new Date().toISOString(),
        config: STRATEGY_CONFIG,
        portfolio: portfolio,
    });

    console.log('\nStrategy analysis complete!');
};

// Run the main function
runStrategy();
