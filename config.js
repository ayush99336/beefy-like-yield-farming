/**
 * ===================================================================================
 * Strategy Configuration (config.js)
 * ===================================================================================
 */

export const STRATEGY_CONFIG = {
    // DeFiLlama-based criteria (primary filtering)
    minAPY: 25,               // Slightly increased - Minimum total APY from DeFiLlama
    minTVL: 30000,           // Slightly increased - Minimum Total Value Locked in USD  
    minRewardAPYRatio: 0.4,  // Minimum ratio of reward APY to total APY (incentive-driven)
    maxRiskScore: 8,         // Maximum acceptable risk score (0-10)
    
    // Pool selection criteria (for DexPaprika newness detection)
    minVolume24h: 5000,      // Further reduced - Recent pools may have lower volume initially
    minTransactions24h: 25,  // Further reduced - Recent pools may have fewer transactions
    minPoolAgeHours: 0.5,    // Very recent - Pool must be at least 30 minutes old
    maxPoolAgeHours: 48,     // Reduced to 48h - Focus on very recent pools
    
    // APY Estimation
    assumedFeeRate: 0.003,    // Assumed trading fee rate (0.3%) for APY calculation
    estimatedMinApy: 20,      // Further reduced - Recent pools may start with lower estimated APY

    // Portfolio Management
    maxActivePositions: 5,
    holdDurationHours: 48,

    // Exit criteria
    exitApyThreshold: 15,     // Exit if estimated APY drops below this
    exitPriceDropPercent: -30 // Exit if 24h price change is worse than this
};

export const API_URL = 'https://api.dexpaprika.com/networks/solana/pools?order_by=created_at&sort=desc&limit=100';
