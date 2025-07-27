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
  // Workflow cycle interval (15 minutes for intensive farming)
  cycleIntervalMs: 15 * 60 * 1000,
  
  // Position hold duration (24 hours for intensive farming)
  holdDurationMs: 24 * 60 * 60 * 1000,
  
  // Watchlist age threshold (10 minutes)
  watchlistAgeMs: 10 * 60 * 1000,
  
  // Ultra-fresh pool window (30 minutes - 6 hours for new pools)
  newPoolMinAgeHrs: 0.5,
  newPoolMaxAgeHrs: 6,
  
  // API request timeout
  apiTimeoutMs: 10000
};

// === Pool Detection Strategy Configuration ===
export const STRATEGY_CONFIG = {
  // Phase 1 - Pool Detection Criteria (Loosened for intensive farming)
  minAPY: 30,                   // minimum total APY to consider (reduced from 50)
  minTVL: 50_000,               // minimum TVL (USD) to consider (reduced from 100k)
  minRewardAPY: 15,             // minimum absolute reward APY (reduced from 20)
  minRewardAPYRatio: 0.3,       // reward APY must be >= 30% of total APY (reduced from 0.5)
  newPoolAgeDays: 14,           // pool age (days) threshold for "new" (increased from 7)
  highAPYThreshold: 300,        // APY above this is flagged as new/very high (reduced from 400)
  mediumAPYThreshold: 60,       // medium APY threshold for combined checks (reduced from 80)
  lowTVLThreshold: 800_000,     // TVL below this with medium APY flags new (increased from 500k)
  highRewardRatioThreshold: 0.7,// reward ratio threshold for new incentive (reduced from 0.8)
  tvlGrowthPctThreshold: 30,    // 1d TVL growth percentage threshold for new (reduced from 50)

  // Phase 2 - Risk & Analysis Criteria (More aggressive for intensive farming)
  volatilitySigmaThreshold: 3,  // sigma above this adds risk (increased from 2)
  maxRiskScore: 8,              // maximum acceptable risk score (0–10) - increased from 7

  // Phase 3 - Selection/Diversification (More opportunities)
  maxPerToken: 3,               // max pools to pick per reward token (increased from 2)
  maxTotal: 8,                  // max pools to select overall (increased from 5)
  maxPositions: 8               // max active positions (increased from 5)
};

// === Exit Strategy Configuration ===
export const EXIT_CONFIG = {
  // APY drop threshold for exit (30% for more aggressive farming)
  apyDropThreshold: 0.3,
  
  // Time-based exit (uses TIMING_CONFIG.holdDurationMs)
  enableTimeBasedExit: true,
  
  // Performance-based exit
  enablePerformanceExit: true,
  
  // Risk-based exit (more lenient)
  enableRiskExit: true,
  maxExitRiskScore: 9
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
