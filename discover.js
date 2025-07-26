/**
 * ===================================================================================
 * Solana Liquidity Pool Analyzer (Volume-Driven vs. Incentive-Driven)
 * ===================================================================================
 *
 * Description:
 * This script analyzes the Solana DeFi ecosystem to identify and categorize high-yield
 * liquidity pools. It separates opportunities into two distinct types:
 * 1. Volume-Driven Pools: High APY primarily from trading fees (apyBase).
 * 2. Incentive-Driven Pools: High APY primarily from token rewards (apyReward).
 *
 * This provides a more nuanced view of the yield landscape, perfect for analysis.
 *
 * -----------------------------------------------------------------------------------
 *
 * To Run This Code:
 * 1. Make sure you have Node.js installed.
 * 2. In your project folder, open `package.json` and add the line: "type": "module",
 * 3. Open a terminal and run `npm install axios`.
 * 4. Run this script with the command: `node discovery_engine.js`
 * 5. A new file `solana_pools_data.json` will be created in your folder.
 *
 * ===================================================================================
 */

// Use ES Module style imports.
import axios from 'axios';
import fs from 'fs';

// --- Configuration ---
const APY_THRESHOLD = 30; // The minimum total APY we are interested in.
const MIN_TVL_USD = 50000; // The minimum Total Value Locked to consider a pool.
const FILE_NAME = 'solana_pools_data.json'; // The name of the output file.

/**
 * The main function to discover, categorize, and display pool data.
 */
async function analyzePools() {
    console.log("Starting Pool Analyzer...");
    console.log(`Searching for Solana pools with APY > ${APY_THRESHOLD}% and TVL > $${MIN_TVL_USD.toLocaleString()}...`);

    try {
        // 1. FETCH DATA
        const response = await axios.get('https://yields.llama.fi/pools');
        const allPools = response.data.data;

        // 2. INITIAL FILTERING
        const highYieldPools = allPools.filter(pool =>
            pool.chain === "Solana" &&
            pool.apy > APY_THRESHOLD &&
            pool.tvlUsd > MIN_TVL_USD
        );

        if (highYieldPools.length === 0) {
            console.log("\nNo pools found matching your criteria right now.");
            return;
        }

        console.log(`\nSuccess! Found ${highYieldPools.length} pools matching your criteria.`);

        // 3. CATEGORIZE POOLS
        const volumeDrivenPools = [];
        const incentiveDrivenPools = [];

        highYieldPools.forEach(pool => {
            const baseApy = pool.apyBase || 0;
            const rewardApy = pool.apyReward || 0;

            // If reward APY is the larger component, it's incentive-driven. Otherwise, it's volume-driven.
            if (rewardApy > baseApy) {
                incentiveDrivenPools.push(pool);
            } else {
                volumeDrivenPools.push(pool);
            }
        });

        // 4. SORT CATEGORIES
        volumeDrivenPools.sort((a, b) => b.apy - a.apy);
        incentiveDrivenPools.sort((a, b) => b.apy - a.apy);

        // 5. SAVE RAW DATA TO FILE (Top 100 overall)
        const top100Overall = highYieldPools.sort((a, b) => b.apy - a.apy).slice(0, 100);
        fs.writeFileSync(FILE_NAME, JSON.stringify(top100Overall, null, 2));
        console.log(`\nSuccessfully saved raw data for top ${top100Overall.length} pools to ${FILE_NAME}`);

        // 6. DISPLAY RESULTS
        displayResults("Volume-Driven Pools (Yield from Trading Fees)", volumeDrivenPools);
        displayResults("Incentive-Driven Pools (Yield from Rewards)", incentiveDrivenPools);

    } catch (error) {
        console.error("\nAn error occurred while running the analyzer:");
        console.error(error.message);
    } finally {
        console.log("\nAnalyzer has finished its run.");
    }
}

/**
 * Helper function to display a formatted table for a list of pools.
 * @param {string} title - The title of the table.
 * @param {Array} pools - The array of pool objects to display.
 */
function displayResults(title, pools) {
    console.log(`\n--- ${title} ---`);

    if (pools.length === 0) {
        console.log("No pools found in this category.");
        return;
    }

    console.log("----------------------------------------------------------------------------------------------------");
    console.log("| Project         | Symbol          | TVL ($)       | Fee APY (%) | Reward APY (%) | Total APY (%) |");
    console.log("|-----------------|-----------------|---------------|-------------|----------------|---------------|");

    pools.slice(0, 10).forEach(pool => {
        const projectName = pool.project.padEnd(15).slice(0, 15);
        const symbol = pool.symbol.padEnd(15).slice(0, 15);
        const tvl = Math.round(pool.tvlUsd).toLocaleString().padStart(13);
        const apyBase = (pool.apyBase || 0).toFixed(2).padStart(11);
        const apyReward = (pool.apyReward || 0).toFixed(2).padStart(14);
        const totalApy = pool.apy.toFixed(2).padStart(13);

        console.log(`| ${projectName} | ${symbol} | ${tvl} | ${apyBase} | ${apyReward} | ${totalApy} |`);
    });
    console.log("----------------------------------------------------------------------------------------------------");
}


// Execute the main function.
analyzePools();
