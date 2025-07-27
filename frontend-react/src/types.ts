// Types for the yield farming application
export interface Position {
  id: number;
  poolId: string;
  symbol: string;
  project: string;
  status: 'active' | 'exited';
  entryTimestamp: string;
  entryApy: number;
  entryRewardApy?: number;
  entryTvl?: number;
  entryRiskScore?: number;
  isNew: boolean;
  detectionReason?: string;
  exitTimestamp?: string;
  exitApy?: number;
  exitReason?: string;
  profitLoss?: number;
  cycleId: number;
}

export interface PoolData {
  pool: string;
  symbol: string;
  project: string;
  apy: number;
  apyReward?: number;
  tvlUsd: number;
  chain: string;
  riskScore?: number;
}

export interface WatchlistPool {
  id: number;
  poolId: string;
  symbol: string;
  project: string;
  firstSeen: string;
  isNew: boolean;
  lastChecked: string;
  status: 'watching' | 'invested' | 'ignored';
}

export interface YieldCalculation {
  principal: number;
  entryApy: number;
  exitApy: number;
  avgApy: number;
  holdDays: number;
  timeInYears: number;
  finalAmount: number;
  totalReturn: number;
  returnPercentage: number;
  annualizedReturn: number;
  dailyReturn: number;
  isProfit: boolean;
}

export interface PortfolioYield {
  totalInvested: number;
  totalCurrentValue: number;
  totalReturns: number;
  portfolioReturnPercentage: number;
  averageHoldDays: number;
  profitablePositions: number;
  totalPositions: number;
  winRate: number;
  positionYields: PositionWithYield[];
}

export interface PositionWithYield extends Position {
  yieldData: YieldCalculation;
  currentApy?: number;
}

export interface YieldAnalytics {
  overall: PortfolioYield;
  active: PortfolioYield;
  exited: PortfolioYield;
  bestPerformer?: PositionWithYield;
  worstPerformer?: PositionWithYield;
  monthlyPerformance: Record<string, {
    invested: number;
    returns: number;
    positions: number;
  }>;
  analytics: {
    totalPrincipal: number;
    averageAPY: number;
    totalDaysInvested: number;
    projectedAnnualReturn: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface DashboardMetrics {
  totalPositions: number;
  activePositions: number;
  completedPositions: number;
  averageEntryApy: number;
  averageProfitLoss: number;
  avgHoldHours: number;
  newPoolsPercentage: number;
  totalWatchlist: number;
}

export interface DetectionCycle {
  id: number;
  cycleTimestamp: string;
  totalPoolsFound: number;
  newPoolsFound: number;
  activePositions: number;
  watchlistSize: number;
}

export interface Log {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  details?: any;
  cycleId: number;
}

// Constants
export const PRINCIPAL_USD = 1000;
export const DAILY_COMPOUND_RATE = 365;

// API endpoints
export const API_ENDPOINTS = {
  health: '/health',
  positions: '/api/positions',
  positionsActive: '/api/positions/active',
  positionsExited: '/api/positions/exited',
  watchlist: '/api/watchlist',
  logs: '/api/logs',
  cycles: '/api/cycles',
  dashboard: '/api/dashboard',
  yieldAnalytics: '/api/yield/analytics',
  yieldPortfolio: '/api/yield/portfolio',
  yieldProjections: '/api/yield/projections',
  yieldMetrics: '/api/yield/metrics',
} as const;
