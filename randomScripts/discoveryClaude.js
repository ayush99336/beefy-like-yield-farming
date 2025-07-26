import axios from 'axios';
import fs from 'fs';
import { Connection, PublicKey } from '@solana/web3.js';

class HybridYieldFarmingStrategy {
    constructor() {
        this.connection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            'confirmed'
        );
        
        // Strategy parameters
        this.config = {
            minAPY: 30,
            minTVL: 50000,
            minRewardAPYRatio: 0.6, // Reward APY should be at least 60% of total APY
            maxRiskScore: 7, // Out of 10
            diversificationLimit: 5, // Max positions in similar token pairs
        };

        this.poolDatabase = new Map();
        this.riskMetrics = new Map();
    }

    /**
     * Step 1: Get high-level incentive-driven pools from DeFiLlama
     */
    async fetchIncentiveDrivenPools() {
        console.log('🔍 Fetching incentive-driven pools from DeFiLlama...');
        
        try {
            const response = await axios.get('https://yields.llama.fi/pools');
            const allPools = response.data.data;

            const solanaPools = allPools.filter(pool =>
                pool.chain === "Solana" &&
                pool.apy > this.config.minAPY &&
                pool.tvlUsd > this.config.minTVL &&
                this.isIncentiveDriven(pool)
            );

            console.log(`✅ Found ${solanaPools.length} incentive-driven Solana pools`);
            return solanaPools.sort((a, b) => b.apy - a.apy);

        } catch (error) {
            console.error('❌ Error fetching DeFiLlama data:', error.message);
            return [];
        }
    }

    /**
     * Enhanced incentive detection logic
     */
    isIncentiveDriven(pool) {
        const baseApy = pool.apyBase || 0;
        const rewardApy = pool.apyReward || 0;
        const totalApy = pool.apy || 0;

        // Multiple criteria for incentive-driven classification
        const rewardDominant = rewardApy > baseApy;
        const significantRewards = rewardApy / totalApy >= this.config.minRewardAPYRatio;
        const hasRewardTokens = pool.rewardTokens && pool.rewardTokens.length > 0;
        
        return rewardDominant || significantRewards || hasRewardTokens;
    }

    /**
     * Step 2: Get detailed pool data from specific DEXs for validation
     */
    async enrichPoolData(llamaPools) {
        console.log('🔬 Enriching pool data with DEX-specific information...');
        
        const enrichedPools = [];
        
        for (const pool of llamaPools.slice(0, 50)) { // Limit to top 50 for performance
            try {
                const enrichedPool = await this.getDetailedPoolInfo(pool);
                if (enrichedPool) {
                    enrichedPools.push(enrichedPool);
                }
            } catch (error) {
                console.warn(`⚠️ Could not enrich pool ${pool.pool}: ${error.message}`);
                // Still include the basic pool data
                enrichedPools.push(this.formatBasicPool(pool));
            }
        }

        return enrichedPools;
    }

    /**
     * Get detailed information for a specific pool
     */
    async getDetailedPoolInfo(llamaPool) {
        // Try to identify the DEX and get specific data
        const dexIdentifier = this.identifyDEX(llamaPool);
        
        let detailedInfo = {};
        
        switch (dexIdentifier) {
            case 'raydium':
                detailedInfo = await this.getRaydiumDetails(llamaPool);
                break;
            case 'orca':
                detailedInfo = await this.getOrcaDetails(llamaPool);
                break;
            default:
                detailedInfo = await this.getGenericDetails(llamaPool);
        }

        return {
            // DeFiLlama data (clean and standardized)
            source: 'hybrid',
            llamaId: llamaPool.pool,
            project: llamaPool.project,
            symbol: llamaPool.symbol,
            apy: llamaPool.apy,
            apyBase: llamaPool.apyBase || 0,
            apyReward: llamaPool.apyReward || 0,
            tvlUsd: llamaPool.tvlUsd,
            
            // Enhanced data
            ...detailedInfo,
            
            // Risk and strategy metrics
            riskScore: this.calculateRiskScore(llamaPool, detailedInfo),
            profitPotential: this.calculateProfitPotential(llamaPool, detailedInfo),
            liquidityScore: this.calculateLiquidityScore(llamaPool, detailedInfo),
            
            // Metadata
            lastUpdated: Date.now(),
            confidenceLevel: this.calculateConfidenceLevel(llamaPool, detailedInfo)
        };
    }

    /**
     * Identify which DEX a pool belongs to
     */
    identifyDEX(pool) {
        const project = pool.project.toLowerCase();
        
        if (project.includes('raydium')) return 'raydium';
        if (project.includes('orca')) return 'orca';
        if (project.includes('meteora')) return 'meteora';
        if (project.includes('saber')) return 'saber';
        
        return 'unknown';
    }

    /**
     * Calculate risk score (0-10, where 10 is highest risk)
     */
    calculateRiskScore(llamaPool, detailedInfo) {
        let risk = 0;
        
        // APY risk (very high APY = higher risk)
        if (llamaPool.apy > 100) risk += 3;
        else if (llamaPool.apy > 50) risk += 2;
        else if (llamaPool.apy > 30) risk += 1;
        
        // TVL risk (lower TVL = higher risk)
        if (llamaPool.tvlUsd < 100000) risk += 2;
        else if (llamaPool.tvlUsd < 500000) risk += 1;
        
        // Reward dependency risk
        const rewardRatio = (llamaPool.apyReward || 0) / llamaPool.apy;
        if (rewardRatio > 0.8) risk += 2; // Very dependent on rewards
        else if (rewardRatio > 0.6) risk += 1;
        
        // Project maturity (newer projects = higher risk)
        if (detailedInfo.isNewPool) risk += 2;
        
        // Token pair risk
        if (detailedInfo.hasStablecoinPair) risk -= 1; // Reduce risk for stable pairs
        if (detailedInfo.hasVolatileTokens) risk += 1;
        
        return Math.min(Math.max(risk, 0), 10);
    }

    /**
     * Calculate profit potential score
     */
    calculateProfitPotential(llamaPool, detailedInfo) {
        let score = 0;
        
        // Base APY score
        score += Math.min(llamaPool.apy / 10, 20); // Max 20 points for APY
        
        // Reward sustainability
        if (detailedInfo.rewardDuration) {
            score += Math.min(detailedInfo.rewardDuration / 30, 10); // Longer rewards = better
        }
        
        // Liquidity bonus
        score += Math.min(Math.log10(llamaPool.tvlUsd / 10000), 5);
        
        // Volume activity
        if (detailedInfo.volume24h) {
            const volumeToTvl = detailedInfo.volume24h / llamaPool.tvlUsd;
            score += Math.min(volumeToTvl * 10, 5);
        }
        
        return Math.round(score);
    }

    /**
     * Strategy: Select optimal pools for portfolio
     */
    async selectOptimalPools(enrichedPools) {
        console.log('🎯 Selecting optimal pools for yield farming strategy...');
        
        // Filter by risk tolerance
        const acceptablePools = enrichedPools.filter(pool => 
            pool.riskScore <= this.config.maxRiskScore
        );
        
        // Diversification: avoid too many similar pairs
        const diversifiedPools = this.diversifySelection(acceptablePools);
        
        // Sort by profit potential adjusted for risk
        const scoredPools = diversifiedPools.map(pool => ({
            ...pool,
            adjustedScore: pool.profitPotential * (10 - pool.riskScore) / 10
        })).sort((a, b) => b.adjustedScore - a.adjustedScore);
        
        return scoredPools.slice(0, 10); // Top 10 pools
    }

    /**
     * Ensure portfolio diversification
     */
    diversifySelection(pools) {
        const tokenPairCount = new Map();
        const diversifiedPools = [];
        
        for (const pool of pools) {
            const tokenPair = this.getTokenPairKey(pool.symbol);
            const currentCount = tokenPairCount.get(tokenPair) || 0;
            
            if (currentCount < this.config.diversificationLimit) {
                diversifiedPools.push(pool);
                tokenPairCount.set(tokenPair, currentCount + 1);
            }
        }
        
        return diversifiedPools;
    }

    /**
     * Generate portfolio allocation recommendations
     */
    generatePortfolioAllocation(selectedPools, totalInvestment = 10000) {
        console.log('💰 Generating portfolio allocation...');
        
        const totalScore = selectedPools.reduce((sum, pool) => sum + pool.adjustedScore, 0);
        
        return selectedPools.map(pool => {
            const allocation = (pool.adjustedScore / totalScore) * totalInvestment;
            return {
                ...pool,
                recommendedAllocation: Math.round(allocation),
                allocationPercentage: ((allocation / totalInvestment) * 100).toFixed(2)
            };
        });
    }

    /**
     * Save comprehensive strategy report
     */
    async saveStrategyReport(portfolio, filename = 'yield_farming_strategy.json') {
        const report = {
            timestamp: new Date().toISOString(),
            strategy: 'Incentive-Driven Yield Farming',
            totalPools: portfolio.length,
            expectedWeightedAPY: this.calculateWeightedAPY(portfolio),
            portfolioRisk: this.calculatePortfolioRisk(portfolio),
            diversificationScore: this.calculateDiversificationScore(portfolio),
            portfolio: portfolio,
            metadata: {
                minAPY: this.config.minAPY,
                minTVL: this.config.minTVL,
                maxRisk: this.config.maxRiskScore
            }
        };

        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`💾 Strategy report saved to ${filename}`);
        
        return report;
    }

    /**
     * Display strategy summary
     */
    displayStrategySummary(portfolio) {
        console.log('\n🚀 YIELD FARMING STRATEGY SUMMARY');
        console.log('==========================================');
        
        const totalAllocation = portfolio.reduce((sum, pool) => sum + pool.recommendedAllocation, 0);
        const weightedAPY = this.calculateWeightedAPY(portfolio);
        const avgRisk = portfolio.reduce((sum, pool) => sum + pool.riskScore, 0) / portfolio.length;
        
        console.log(`Total Investment: $${totalAllocation.toLocaleString()}`);
        console.log(`Expected Weighted APY: ${weightedAPY.toFixed(2)}%`);
        console.log(`Average Risk Score: ${avgRisk.toFixed(1)}/10`);
        console.log(`Number of Pools: ${portfolio.length}`);
        
        console.log('\nTOP POOL ALLOCATIONS:');
        console.log('--------------------------------------------------------------------');
        console.log('| Pool | Allocation | APY | Risk | Reward APY | Project |');
        console.log('--------------------------------------------------------------------');
        
        portfolio.forEach(pool => {
            const allocation = `$${pool.recommendedAllocation.toLocaleString()}`.padEnd(10);
            const apy = `${pool.apy.toFixed(1)}%`.padEnd(6);
            const risk = `${pool.riskScore}/10`.padEnd(5);
            const rewardApy = `${(pool.apyReward || 0).toFixed(1)}%`.padEnd(10);
            const project = pool.project.padEnd(12);
            
            console.log(`| ${pool.symbol.slice(0, 8).padEnd(8)} | ${allocation} | ${apy} | ${risk} | ${rewardApy} | ${project} |`);
        });
        console.log('--------------------------------------------------------------------');
    }

    // Helper methods
    calculateWeightedAPY(portfolio) {
        const totalAllocation = portfolio.reduce((sum, pool) => sum + pool.recommendedAllocation, 0);
        return portfolio.reduce((sum, pool) => {
            const weight = pool.recommendedAllocation / totalAllocation;
            return sum + (pool.apy * weight);
        }, 0);
    }

    calculatePortfolioRisk(portfolio) {
        return portfolio.reduce((sum, pool) => sum + pool.riskScore, 0) / portfolio.length;
    }

    getTokenPairKey(symbol) {
        return symbol.split(/[-\/]/).sort().join('-');
    }

    calculateLiquidityScore(llamaPool, detailedInfo) {
        return Math.min(Math.log10(llamaPool.tvlUsd / 1000), 10);
    }

    calculateConfidenceLevel(llamaPool, detailedInfo) {
        // Higher confidence for established pools with good data
        let confidence = 0.5;
        
        if (llamaPool.tvlUsd > 1000000) confidence += 0.2;
        if (detailedInfo.hasDetailedData) confidence += 0.2;
        if (llamaPool.apyBase > 0) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    calculateDiversificationScore(portfolio) {
        const uniqueProjects = new Set(portfolio.map(pool => pool.project)).size;
        return (uniqueProjects / portfolio.length) * 100;
    }

    // Placeholder methods for DEX-specific data (implement based on available APIs)
    async getRaydiumDetails(pool) { return { dex: 'raydium', hasDetailedData: false }; }
    async getOrcaDetails(pool) { return { dex: 'orca', hasDetailedData: false }; }
    async getGenericDetails(pool) { return { hasDetailedData: false }; }
    
    formatBasicPool(pool) {
        return {
            source: 'defi-llama',
            project: pool.project,
            symbol: pool.symbol,
            apy: pool.apy,
            apyBase: pool.apyBase || 0,
            apyReward: pool.apyReward || 0,
            tvlUsd: pool.tvlUsd,
            riskScore: 5, // Default medium risk
            profitPotential: Math.min(pool.apy / 5, 20),
            liquidityScore: this.calculateLiquidityScore(pool, {}),
            confidenceLevel: 0.7
        };
    }
}

// Main execution
async function runHybridStrategy() {
    const strategy = new HybridYieldFarmingStrategy();
    
    try {
        console.log('🚀 Starting Hybrid Yield Farming Strategy...\n');
        
        // Step 1: Get incentive-driven pools
        const incentivePools = await strategy.fetchIncentiveDrivenPools();
        
        // Step 2: Enrich with detailed data
        const enrichedPools = await strategy.enrichPoolData(incentivePools);
        
        // Step 3: Select optimal pools
        const selectedPools = await strategy.selectOptimalPools(enrichedPools);
        
        // Step 4: Generate portfolio allocation
        const portfolio = strategy.generatePortfolioAllocation(selectedPools, 10000);
        
        // Step 5: Display and save results
        strategy.displayStrategySummary(portfolio);
        await strategy.saveStrategyReport(portfolio);
        
        console.log('\n✅ Strategy analysis complete!');
        
    } catch (error) {
        console.error('❌ Strategy execution failed:', error.message);
    }
}

export default HybridYieldFarmingStrategy;

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runHybridStrategy();
}