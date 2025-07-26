/**
 * ===================================================================================
 * Solana Liquidity Pool Discovery Engine (with File Saving)
 * ===================================================================================
 *
 * Description:
 * This script acts as the "Discovery Engine" for our Solana bot. It fetches data
 * from the DefiLlama API, filters for high-yield pools on Solana, displays the
 * top 10 results in the console, and saves the detailed data for the top 100
 * pools to a JSON file for later analysis.
 *
 * How it Works:
 * 1. Makes an HTTP GET request to the DefiLlama API.
 * 2. Parses the JSON response containing thousands of pools.
 * 3. Filters the pools to keep only those on the "Solana" chain that meet the criteria.
 * 4. Sorts the results to show the most profitable pools first.
 * 5. Saves the complete, detailed data for the top 100 pools into a file named
 * `solana_pools_data.json`.
 * 6. Prints a clean, readable summary of the top 10 pools to the console.
 *
 * -----------------------------------------------------------------------------------
 *
 * To Run This Code:
 * 1. Make sure you have Node.js installed on your computer.
 * 2. Create a new folder for your project.
 * 3. Open a terminal in that folder and run `npm init -y`.
 * 4. Install the 'axios' library by running `npm install axios`.
 * 5. Save this code as a file named `discovery_engine.js` in your project folder.
 * 6. Run the script from your terminal with the command: `node discovery_engine.js`
 * 7. A new file `solana_pools_data.json` will be created in your folder.
 *
 * ===================================================================================
 */

// We use 'axios' to make API requests and 'fs' (File System) to write files.
import axios from 'axios';
import fs from 'fs';

// --- Configuration ---
// You can change these values to match your strategy.
const APY_THRESHOLD = 30; // The minimum APY we are interested in (e.g., 30 for 30%).
const MIN_TVL_USD = 50000; // The minimum Total Value Locked (TVL) in USD to consider a pool.
const FILE_NAME = 'solana_pools_data.json'; // The name of the output file.

/**
 * The main function to discover, analyze, and save liquidity pool data.
 */
async function discoverAndSavePools() {
    console.log("🚀 Starting Discovery Engine...");
    console.log(`🔍 Searching for Solana pools with APY > ${APY_THRESHOLD}% and TVL > $${MIN_TVL_USD.toLocaleString()}...`);

    try {
        // 1. FETCH DATA
        const response = await axios.get('https://yields.llama.fi/pools');
        const allPools = response.data.data;

        // 2. FILTER FOR SOLANA & APPLY STRATEGY
        const highYieldPools = allPools.filter(pool =>
            pool.chain === "Solana" &&
            pool.apy > APY_THRESHOLD &&
            pool.tvlUsd > MIN_TVL_USD
        );

        if (highYieldPools.length === 0) {
            console.log("\n✅ No pools found matching your criteria right now. Try lowering your thresholds.");
            return;
        }

        console.log(`\n✅ Success! Found ${highYieldPools.length} high-yield pools matching your criteria.`);

        // 3. SORT THE RESULTS
        highYieldPools.sort((a, b) => b.apy - a.apy);

        // 4. SAVE TOP 100 TO FILE
        const top100Pools = highYieldPools.slice(0, 100);
        try {
            // Convert the array of pool objects into a nicely formatted JSON string.
            const jsonData = JSON.stringify(top100Pools, null, 2); // `null, 2` makes the file readable.
            fs.writeFileSync(FILE_NAME, jsonData);
            console.log(`\n💾 Successfully saved detailed data for top ${top100Pools.length} pools to ${FILE_NAME}`);
        } catch (fileError) {
            console.error(`\n❌ Error saving data to file: ${fileError.message}`);
        }

        // 5. DISPLAY TOP 10 IN CONSOLE
        console.log("\n--- Top 10 High-Yield Solana Pools (from saved data) ---");
        console.log("---------------------------------------------------------------------------------");
        console.log("| Project         | Symbol          | APY (%)         | TVL ($)         |");
        console.log("|-----------------|-----------------|-----------------|-----------------|");

        top100Pools.slice(0, 10).forEach(pool => {
            const projectName = pool.project.padEnd(15).slice(0, 15);
            const symbol = pool.symbol.padEnd(15).slice(0, 15);
            const apy = pool.apy.toFixed(2).padStart(15);
            const tvl = Math.round(pool.tvlUsd).toLocaleString().padStart(15);

            console.log(`| ${projectName} | ${symbol} | ${apy} | ${tvl} |`);
        });
        console.log("---------------------------------------------------------------------------------");


    } catch (error) {
        console.error("\n❌ An error occurred while running the Discovery Engine:");
        console.error(error.message);
    } finally {
        console.log("\n🏁 Discovery Engine has finished its run.");
    }
}

// Execute the main function.
discoverAndSavePools();
















// Yes, absolutely. The data you've shared makes perfect sense, and it tells a very specific and important story about the kind of pools your bot is finding.

// Let's break down why it's correct and what it's telling us:

// 1. The APYs Are Astronomical (and That's Expected)
// You're seeing APYs like 7040.4% and 6019.41%. In a normal market, this would seem like an error. In the world of brand-new, highly speculative tokens on Solana, this is exactly the kind of data you would expect to see.

// Why? These insane APYs are driven entirely by the apyBase field, which comes from trading fees. This indicates an absolutely massive amount of trading volume relative to the amount of money in the pool (the TVL). It's a sign of a "hot" new token that people are frantically buying and selling.

// 2. The apyReward is Zero
// Notice that for every pool you've shared, apyReward is 0. This is a key insight.

// What it means: The yield is not coming from a project offering incentives. It's coming purely from a speculative frenzy. This is very different from a stable, long-term farm where a project might offer a steady 50% APY in reward tokens.

// 3. The Token Symbols Are a Clue
// Look at the symbols: WSOL-BONKYO, WSOL-BUNKS, WSOL-STONKS, WSOL-CLAUDE-OS. These are very likely new "meme coins" or highly speculative tokens.

// What it means: Your bot is successfully identifying the very first wave of activity for new tokens. The high APY is a direct result of the initial hype and volatility.

// Conclusion: The Data is Correct and Highlights Risk
// So, does the data make sense? Yes, it perfectly reflects the high-risk, high-reward environment of new token launches.

// Your script is correctly identifying pools that are experiencing extreme, short-term trading volume. However, this analysis also reveals the immense risk:

// Impermanent Loss: With this level of volatility, the risk of impermanent loss is massive.

// Sustainability: These APYs are not sustainable. As trading volume dies down or more liquidity is added, the apyBase will plummet, often within hours or days.

// "Rug Pull" Risk: New, unknown tokens carry a very high risk of being scams where the developer can drain the liquidity.

// You have successfully built a tool that finds exactly what you were looking for. The next step, as your project plan outlines, is to simulate how an investment would perform in this incredibly volatile environment, which will almost certainly show that while the initial APY is high, the actual profit or loss after 48 hours is a completely different story.






// will this be problem if I use these data which have 0 in rewards , does this mean they have no incentives



// Show thinking
// That's a very sharp observation, and you've hit on a critical point for building a smart bot.

// To answer your question directly: No, it is not a problem for your code. In fact, it's a very important discovery.

// Here’s the breakdown:

// You are correct. When the data shows "apyReward": 0, it means that specific pool is not offering extra tokens as an incentive. The entire APY is coming from "apyBase", which is generated purely by trading fees.

// Why this is NOT a problem: Your goal is to find profitable opportunities. Your code is doing this perfectly. It has correctly identified pools with extremely high APYs. The data is simply revealing that the source of that profit is from a speculative trading frenzy, not from a project's planned incentive program.

// What this means for your strategy: This is a different type of opportunity.

// Incentive-Driven Pools (apyReward > 0): These are often more stable. A project wants to build long-term liquidity, so they offer rewards. The strategy here might be to stay in the pool for a while to accumulate those rewards.

// Volume-Driven Pools (apyBase > 0, apyReward = 0): This is what you're finding now. These are short-term, high-risk, high-reward opportunities. The strategy here is to get in and out very quickly, capitalizing on the trading volume before it disappears.

// Your code is working perfectly. It's giving you valuable market intelligence. You've learned that the most profitable pools at this moment are driven by hype and volume. A smart bot needs to be able to recognize this and adjust its strategy accordingly. This is a key part of what would make a bot like Beefy Finance successful.
// That's an excellent and very sharp observation. You've hit on a key point in analyzing these pools.

// To answer your questions directly:

// Does apyReward: 0 mean they have no incentives?
// Yes, that is exactly what it means. The yield from these specific pools is coming 100% from trading fees (apyBase) and not from any extra reward tokens being given out by the project.

// Will this be a problem if I use this data?
// No, not at all! In fact, this is an incredibly important finding and makes your discovery engine even more valuable. It's not a problem, it's a critical piece of intelligence.

// Why This Isn't a Problem (It's an Insight)
// Your goal is to find profitable pools, and your script is doing that perfectly. What this data tells you is the type of opportunity you've found.

// Think of it this way:

// Incentive-Driven Pools (High apyReward): These are like a store offering a huge "20% cash back" coupon. The profit comes from the store's special promotion. This is classic yield farming. The strategy is to stay in the pool to collect the reward tokens.

// Volume-Driven Pools (High apyBase): The pools you found are different. They are like a tiny shop that suddenly has a line of thousands of people outside trying to buy a single hot item. The shop isn't offering a coupon; it's just making a massive amount of money from the sheer volume of sales.

// The pools your script found are in a speculative frenzy. The astronomical apyBase means the trading volume is massive compared to the amount of liquidity in the pool.

// This isn't a problem for your bot; it's the first step in creating a smarter strategy. A real-world bot (like Beefy) would analyze this and decide: "This is a high-volume, short-term opportunity. The strategy isn't to farm rewards for weeks, but to get in, collect trading fees for a few hours, and get out before the hype dies."