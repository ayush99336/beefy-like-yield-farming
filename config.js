/**
 * ===================================================================================
 * Strategy Configuration (config.js)
 * ===================================================================================
 */

export const config = {
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
  maxRiskScore: 5,              // maximum acceptable risk score (0–10)

  // Phase 3 - Selection/Diversification
  maxPerToken: 2,               // max pools to pick per reward token
  maxTotal: 10                  // max pools to select overall
};

export const API_URL = 'https://api.dexpaprika.com/networks/solana/pools?order_by=created_at&sort=desc&limit=100';
