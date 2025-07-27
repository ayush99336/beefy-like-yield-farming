/**
 * ===================================================================================
 * Unified Configuration (config.js)
 * ===================================================================================
 *
 * Centralized configuration for the WildNet Yield Farming Bot
 * All timing, thresholds, and strategy parameters are defined here
 * to ensure consistency across all modules.
 */

// === API Configuration ===
export const API_CONFIG = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  corsEnabled: true,
  timeout: 10000
};

// === External API Configuration ===
export const EXTERNAL_API_CONFIG = {
  // CoinGecko API
  coingecko: {
    apiKey: process.env.COINGECKO_API_KEY || '', // Add your CoinGecko API key here
    baseUrl: 'https://api.coingecko.com/api/v3',
    timeout: 5000,
    rateLimit: {
      requestsPerMinute: 50, // Free tier limit
      cacheExpiryMs: 60000   // Cache prices for 1 minute
    }
  },
  
  // Solana token mapping for CoinGecko
  solanaTokenMapping: {
    'WSOL': 'wrapped-solana',
    'SOL': 'solana',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'RAY': 'raydium',
    'SRM': 'serum',
    'ORCA': 'orca',
    'STEP': 'step-finance',
    'COPE': 'cope',
    'ROPE': 'rope-token',
    'FIDA': 'bonfida',
    'KIN': 'kin',
    'MAPS': 'maps',
    'MEDIA': 'media-network',
    'PORT': 'port-finance',
    'SBR': 'saber',
    'SLIM': 'solanium',
    'TULIP': 'tulip-protocol',
    'WAG': 'waggle-network'
  }
};

// === Database Configuration ===
export const DB_CONFIG = {
  url: process.env.DATABASE_URL || 'postgresql://wildnet:wildnet123@localhost:5432/wildnet_farming',
  connectionRetries: 3,
  connectionDelay: 5000
};

// === Timing Configuration ===
export const TIMING_CONFIG = {
  // Workflow cycle interval (30 minutes)
  cycleIntervalMs: 30 * 60 * 1000,
  
  // Position hold duration (48 hours)
  holdDurationMs: 48 * 60 * 60 * 1000,
  
  // Watchlist age threshold (15 minutes)
  watchlistAgeMs: 15 * 60 * 1000,
  
  // Ultra-fresh pool window (1-4 hours for new pools)
  newPoolMinAgeHrs: 1,
  newPoolMaxAgeHrs: 4,
  
  // API request timeout
  apiTimeoutMs: 10000
};

// === Pool Detection Strategy Configuration ===
export const STRATEGY_CONFIG = {
  // Phase 1 - Pool Detection Criteria
  minAPY: 50,                   // minimum total APY to consider
  minTVL: 100_000,              // minimum TVL (USD) to consider
  minRewardAPY: 20,             // minimum absolute reward APY
  minRewardAPYRatio: 0.5,       // reward APY must be >= 50% of total APY
  newPoolAgeDays: 7,            // pool age (days) threshold for "new"
  highAPYThreshold: 200,        // APY above this is flagged as new/very high
  mediumAPYThreshold: 80,       // medium APY threshold for combined checks
  lowTVLThreshold: 500_000,     // TVL below this with medium APY flags new
  highRewardRatioThreshold: 0.8,// reward ratio threshold for new incentive
  tvlGrowthPctThreshold: 50,    // 1d TVL growth percentage threshold for new

  // Phase 2 - Risk & Analysis Criteria
  volatilitySigmaThreshold: 2,  // sigma above this adds risk
  maxRiskScore: 7,              // maximum acceptable risk score (0–10) - increased from 5

  // Phase 3 - Selection/Diversification
  maxPerToken: 2,               // max pools to pick per reward token
  maxTotal: 5,                  // max pools to select overall - matches workflow
  maxPositions: 5               // max active positions
};

// === Exit Strategy Configuration ===
export const EXIT_CONFIG = {
  // APY drop threshold for exit (50%)
  apyDropThreshold: 0.5,
  
  // Time-based exit (uses TIMING_CONFIG.holdDurationMs)
  enableTimeBasedExit: true,
  
  // Performance-based exit
  enablePerformanceExit: true,
  
  // Risk-based exit
  enableRiskExit: true,
  maxExitRiskScore: 8
};

// === Yield Calculation Configuration ===
export const YIELD_CONFIG = {
  // Principal amount for simulation ($1000 per pool)
  principalUsd: 1000,
  
  // Daily compounding rate (365 times per year)
  dailyCompoundRate: 365,
  
  // Minimum yield threshold for reporting
  minYieldThreshold: 0.01 // 1%
};

// === Logging Configuration ===
export const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || 'info',
  enableFileLogging: true,
  enableConsoleLogging: true,
  maxLogEntries: 1000,
  logRetentionDays: 30
};

// === Default Configuration (for backward compatibility) ===
export const defaultConfig = {
  ...STRATEGY_CONFIG,
  newPoolMinAgeHrs: TIMING_CONFIG.newPoolMinAgeHrs,
  newPoolMaxAgeHrs: TIMING_CONFIG.newPoolMaxAgeHrs
};

// === Workflow Configuration ===
export const WORKFLOW_CONFIG = {
  intervalMs: TIMING_CONFIG.cycleIntervalMs,
  holdDurationMs: TIMING_CONFIG.holdDurationMs,
  watchlistAgeMs: TIMING_CONFIG.watchlistAgeMs,
  maxPositions: STRATEGY_CONFIG.maxPositions,
  maxRiskScore: STRATEGY_CONFIG.maxRiskScore,
  apyDropThreshold: EXIT_CONFIG.apyDropThreshold,
  enableDetailedLogging: true
};

// === Helper Functions ===
export const CONFIG_HELPERS = {
  /**
   * Convert hours to milliseconds
   */
  hoursToMs: (hours) => hours * 60 * 60 * 1000,
  
  /**
   * Convert days to milliseconds
   */
  daysToMs: (days) => days * 24 * 60 * 60 * 1000,
  
  /**
   * Check if a pool is in the ultra-fresh window
   */
  isUltraFresh: (firstSeenAt) => {
    if (!firstSeenAt) return false;
    const ageHours = (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60);
    return ageHours >= TIMING_CONFIG.newPoolMinAgeHrs && ageHours <= TIMING_CONFIG.newPoolMaxAgeHrs;
  },
  
  /**
   * Check if a position should be exited based on hold duration
   */
  shouldExitByTime: (entryTimestamp) => {
    return Date.now() - new Date(entryTimestamp).getTime() >= TIMING_CONFIG.holdDurationMs;
  },
  
  /**
   * Check if a position should be exited based on APY drop
   */
  shouldExitByPerformance: (entryApy, currentApy) => {
    const dropRatio = (entryApy - currentApy) / entryApy;
    return dropRatio >= EXIT_CONFIG.apyDropThreshold;
  }
};

// === Legacy exports for backward compatibility ===
export const config = STRATEGY_CONFIG;
export const API_URL = 'https://api.dexpaprika.com/networks/solana/pools?order_by=created_at&sort=desc&limit=100';

// Export all configs as default
export default {
  API_CONFIG,
  DB_CONFIG,
  TIMING_CONFIG,
  STRATEGY_CONFIG,
  EXIT_CONFIG,
  YIELD_CONFIG,
  LOG_CONFIG,
  WORKFLOW_CONFIG,
  defaultConfig,
  CONFIG_HELPERS
};
