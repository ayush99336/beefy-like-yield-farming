import axios from 'axios';
import { Position, PoolData, YieldAnalytics, PRINCIPAL_USD, DAILY_COMPOUND_RATE } from './types';

// External API configuration (matches backend config)
const COINGECKO_CONFIG = {
  apiKey: process.env.REACT_APP_COINGECKO_API_KEY || '',
  baseUrl: 'https://api.coingecko.com/api/v3',
  timeout: 5000,
  cacheExpiryMs: 60000 // 1 minute cache
};

// Token mapping for CoinGecko (Solana ecosystem)
// Note: Some tokens might not be available on CoinGecko
const TOKEN_MAPPING: { [key: string]: string } = {
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
  'WAG': 'waggle-network',
  // Note: These tokens might not be available on CoinGecko
  'MEOW': 'cat-in-a-dogs-world', // Might not exist
  'DUCK': 'ducky', // Might not exist
  'FOXSY': 'foxsy', // Might not exist
  'KRAI': 'krai', // Might not exist
  'COM': 'community-token', // Might not exist
  'XNPCS': 'npc-token' // Might not exist
};

// Price cache
interface PriceCache {
  [tokenId: string]: {
    price: number;
    timestamp: number;
  };
}

const priceCache: PriceCache = {};

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// CoinGecko API instance - using backend proxy to avoid CORS
const coinGeckoApi = axios.create({
  baseURL: API_BASE_URL, // Use our backend instead of CoinGecko directly
  timeout: COINGECKO_CONFIG.timeout,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for debugging
coinGeckoApi.interceptors.request.use(
  (config) => {
    console.log('🌐 Backend Proxy Request:', {
      url: config.url,
      baseURL: config.baseURL,
      params: config.params,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('🌐 Backend Proxy Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
coinGeckoApi.interceptors.response.use(
  (response) => {
    console.log('✅ Backend Proxy Response:', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ Backend Proxy Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Price Service
export const priceService = {
  // Get cached price or fetch from CoinGecko
  async getTokenPrice(symbol: string): Promise<number> {
    const tokenId = TOKEN_MAPPING[symbol.toUpperCase()];
    if (!tokenId) {
      console.warn(`Token ${symbol} not found in mapping, defaulting to $1`);
      return 1;
    }

    // Check cache first
    const cached = priceCache[tokenId];
    if (cached && (Date.now() - cached.timestamp) < COINGECKO_CONFIG.cacheExpiryMs) {
      return cached.price;
    }

    try {
      const response = await coinGeckoApi.get(`/api/coingecko/prices`, {
        params: {
          ids: tokenId,
          vs_currencies: 'usd'
        }
      });

      const price = response.data[tokenId]?.usd || 1;
      
      // Cache the price
      priceCache[tokenId] = {
        price,
        timestamp: Date.now()
      };

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      // Return cached price if available, otherwise default to $1
      return cached?.price || 1;
    }
  },

  // Request deduplication for multiple requests with same symbols
  requestCache: new Map<string, Promise<{ [symbol: string]: number }>>(),

  // Get multiple token prices at once with deduplication
  async getMultipleTokenPrices(symbols: string[]): Promise<{ [symbol: string]: number }> {
    console.log('🏷️ Input symbols:', symbols);
    
    // Create cache key for deduplication
    const cacheKey = symbols.sort().join(',');
    
    // Check if request is already pending
    if (priceService.requestCache.has(cacheKey)) {
      console.log('⏳ Reusing pending request for symbols:', symbols);
      return priceService.requestCache.get(cacheKey)!;
    }
    
    const tokenIds = symbols
      .map(symbol => TOKEN_MAPPING[symbol.toUpperCase()])
      .filter(Boolean);

    console.log('🔗 Mapped token IDs:', tokenIds);

    if (tokenIds.length === 0) {
      console.warn('❌ No valid token IDs found for symbols:', symbols);
      return {};
    }

    // Create request promise
    const requestPromise = (async () => {
      try {
        const requestUrl = `/api/coingecko/prices?ids=${tokenIds.join(',')}&vs_currencies=usd`;
        console.log('🌐 Backend Proxy request:', requestUrl);
        
        const response = await coinGeckoApi.get(`/api/coingecko/prices`, {
          params: {
            ids: tokenIds.join(','),
            vs_currencies: 'usd'
          }
        });

        console.log('✅ CoinGecko API response:', response.data);

        const prices: { [symbol: string]: number } = {};
        
        symbols.forEach(symbol => {
          const tokenId = TOKEN_MAPPING[symbol.toUpperCase()];
          if (tokenId && response.data[tokenId]) {
            const price = response.data[tokenId].usd;
            prices[symbol] = price;
            console.log(`💰 ${symbol} (${tokenId}): $${price}`);
            
            // Cache the price
            priceCache[tokenId] = {
              price,
              timestamp: Date.now()
            };
          } else {
            prices[symbol] = 1; // Default price
            console.warn(`⚠️ No price data for ${symbol} (${tokenId})`);
          }
        });

        console.log('📊 Final prices object:', prices);
        return prices;
      } catch (error) {
        console.error('❌ Failed to fetch multiple token prices:', error);
        if (axios.isAxiosError(error)) {
          console.error('API Error Response:', error.response?.data);
          console.error('API Error Status:', error.response?.status);
        }
        // Return default prices
        const defaultPrices: { [symbol: string]: number } = {};
        symbols.forEach(symbol => {
          defaultPrices[symbol] = 1;
        });
        return defaultPrices;
      } finally {
        // Clean up request cache
        priceService.requestCache.delete(cacheKey);
      }
    })();

    // Store pending request
    priceService.requestCache.set(cacheKey, requestPromise);
    
    return requestPromise;
  },

  // Extract token symbols from pool symbols (e.g., "WSOL-USDT" -> ["WSOL", "USDT"])
  extractTokenSymbols(poolSymbol: string): string[] {
    return poolSymbol.split('-').filter(Boolean);
  },

  // Get pool value based on token prices
  async getPoolValue(poolSymbol: string, amount: number = PRINCIPAL_USD): Promise<number> {
    const tokens = this.extractTokenSymbols(poolSymbol);
    if (tokens.length !== 2) {
      return amount; // Fallback to original amount
    }

    try {
      const prices = await this.getMultipleTokenPrices(tokens);
      // Assume 50/50 split for LP tokens
      const token1Value = (amount / 2) / prices[tokens[0]] * prices[tokens[0]];
      const token2Value = (amount / 2) / prices[tokens[1]] * prices[tokens[1]];
      return token1Value + token2Value;
    } catch (error) {
      console.error(`Failed to calculate pool value for ${poolSymbol}:`, error);
      return amount;
    }
  }
};

// API service functions
export const apiService = {
  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await api.get('/health');
    return response.data;
  },

  // Positions
  async getPositions(): Promise<Position[]> {
    const response = await api.get('/api/positions');
    return response.data;
  },

  async getActivePositions(): Promise<Position[]> {
    const response = await api.get('/api/positions/active');
    return response.data;
  },

  async getExitedPositions(limit: number = 50): Promise<Position[]> {
    const response = await api.get(`/api/positions/exited?limit=${limit}`);
    return response.data;
  },

  // Yield analytics
  async getYieldAnalytics(): Promise<YieldAnalytics> {
    const response = await api.get('/api/yield/analytics');
    return response.data;
  },

  async getYieldPortfolio(): Promise<any> {
    const response = await api.get('/api/yield/portfolio');
    return response.data;
  },

  async getYieldProjections(days: number = 30): Promise<any> {
    const response = await api.get(`/api/yield/projections?days=${days}`);
    return response.data;
  },

  // Dashboard
  async getDashboardData(): Promise<any> {
    const response = await api.get('/api/dashboard');
    return response.data;
  },

  // Logs
  async getLogs(limit: number = 100): Promise<any[]> {
    const response = await api.get(`/api/logs?limit=${limit}`);
    return response.data;
  },

  // Cycles
  async getCycles(limit: number = 50): Promise<any[]> {
    const response = await api.get(`/api/cycles?limit=${limit}`);
    return response.data;
  },

  // Metrics
  async getMetrics(): Promise<any> {
    const response = await api.get('/api/metrics');
    return response.data;
  },

  // Watchlist
  async getWatchlist(): Promise<any[]> {
    const response = await api.get('/api/watchlist');
    return response.data;
  },

  async cleanupWatchlist(days: number = 7): Promise<{ message: string }> {
    const response = await api.post('/api/watchlist/cleanup', { days });
    return response.data;
  },
};

// DeFiLlama service for fetching current pool data
export const defiLlamaService = {
  async getAllPools(): Promise<PoolData[]> {
    try {
      const response = await axios.get('https://yields.llama.fi/pools');
      return response.data.data.filter((pool: any) => pool.chain === 'Solana');
    } catch (error) {
      console.error('Error fetching DeFiLlama pools:', error);
      return [];
    }
  },

  async getPoolById(poolId: string): Promise<PoolData | null> {
    try {
      const pools = await this.getAllPools();
      return pools.find(pool => pool.pool === poolId) || null;
    } catch (error) {
      console.error('Error fetching pool by ID:', error);
      return null;
    }
  },
};

// Enhanced Yield calculation utilities with real price data
export const yieldCalculator = {
  // Calculate yield with real token prices
  async calculateYieldWithPrices(position: Position, currentApy?: number): Promise<any> {
    const entryTime = new Date(position.entryTimestamp);
    const exitTime = position.exitTimestamp ? new Date(position.exitTimestamp) : new Date();
    const holdDays = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24);
    
    // Use current APY if provided, exit APY if available, otherwise entry APY
    const exitApy = currentApy || position.exitApy || position.entryApy;
    const avgApy = (position.entryApy + exitApy) / 2;
    
    // Get real token prices
    const tokens = priceService.extractTokenSymbols(position.symbol);
    let entryPrice = PRINCIPAL_USD;
    let currentPrice = PRINCIPAL_USD;
    
    try {
      if (tokens.length === 2) {
        // For LP tokens, calculate based on token price changes
        // Simulate entry price as current price (since we don't have historical data)
        // In production, you'd want to store entry prices
        entryPrice = PRINCIPAL_USD;
        
        // Current pool value based on token prices
        currentPrice = await priceService.getPoolValue(position.symbol, PRINCIPAL_USD);
      }
    } catch (error) {
      console.error(`Price calculation error for ${position.symbol}:`, error);
    }
    
    // Calculate impermanent loss/gain (simplified)
    const priceChangeMultiplier = currentPrice / entryPrice;
    
    // Calculate yield from farming
    const principal = entryPrice;
    const annualRate = avgApy / 100;
    const compoundingFreq = DAILY_COMPOUND_RATE;
    const timeInYears = holdDays / 365;
    
    const farmingRewards = principal * (Math.pow(
      (1 + annualRate / compoundingFreq), 
      compoundingFreq * timeInYears
    ) - 1);
    
    // Total return = farming rewards + price change
    const priceChange = (currentPrice - entryPrice);
    const totalReturn = farmingRewards + priceChange;
    const finalAmount = entryPrice + totalReturn;
    
    const returnPercentage = (totalReturn / principal) * 100;
    const farmingReturnPercentage = (farmingRewards / principal) * 100;
    const priceReturnPercentage = (priceChange / principal) * 100;
    
    return {
      principal: Math.round(principal * 100) / 100,
      entryPrice: Math.round(entryPrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      entryApy: position.entryApy,
      exitApy,
      avgApy,
      holdDays: Math.round(holdDays * 100) / 100,
      timeInYears: Math.round(timeInYears * 10000) / 10000,
      farmingRewards: Math.round(farmingRewards * 100) / 100,
      priceChange: Math.round(priceChange * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      currentValue: Math.round(finalAmount * 100) / 100,
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      farmingReturnPercentage: Math.round(farmingReturnPercentage * 100) / 100,
      priceReturnPercentage: Math.round(priceReturnPercentage * 100) / 100,
      isProfit: totalReturn > 0,
      priceChangeMultiplier: Math.round(priceChangeMultiplier * 10000) / 10000
    };
  },

  // Legacy method for backwards compatibility
  calculateYield(position: Position, currentApy?: number): any {
    const entryTime = new Date(position.entryTimestamp);
    const exitTime = position.exitTimestamp ? new Date(position.exitTimestamp) : new Date();
    const holdDays = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24);
    
    // Use current APY if provided, exit APY if available, otherwise entry APY
    const exitApy = currentApy || position.exitApy || position.entryApy;
    const avgApy = (position.entryApy + exitApy) / 2;
    
    // Calculate compound interest: A = P(1 + r/n)^(nt)
    const principal = PRINCIPAL_USD;
    const annualRate = avgApy / 100;
    const compoundingFreq = DAILY_COMPOUND_RATE;
    const timeInYears = holdDays / 365;
    
    const finalAmount = principal * Math.pow(
      (1 + annualRate / compoundingFreq), 
      compoundingFreq * timeInYears
    );
    
    const totalReturn = finalAmount - principal;
    const returnPercentage = (totalReturn / principal) * 100;
    const annualizedReturn = returnPercentage / timeInYears;
    const dailyReturn = returnPercentage / holdDays;
    
    return {
      principal,
      entryApy: position.entryApy,
      exitApy,
      avgApy,
      holdDays: Math.round(holdDays * 100) / 100,
      timeInYears: Math.round(timeInYears * 10000) / 10000,
      finalAmount: Math.round(finalAmount * 100) / 100,
      currentValue: Math.round(finalAmount * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      dailyReturn: Math.round(dailyReturn * 10000) / 10000,
      isProfit: totalReturn > 0
    };
  },

  // Use real prices if available, fallback to simulation
  async simulatePosition(position: Position): Promise<any> {
    try {
      return await this.calculateYieldWithPrices(position);
    } catch (error) {
      console.warn(`Using simulated yield for ${position.symbol}, price data unavailable:`, error);
      return this.calculateYield(position);
    }
  },

  async calculatePortfolioYield(positions: Position[]): Promise<any> {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalReturns = 0;
    const positionYields = [];
    
    for (const position of positions) {
      let currentApy = position.entryApy;
      
      // Fetch current APY for active positions
      if (position.status === 'active') {
        try {
          const currentPool = await defiLlamaService.getPoolById(position.poolId);
          if (currentPool) {
            currentApy = currentPool.apy;
          }
        } catch (error) {
          console.warn(`Failed to fetch current APY for ${position.symbol}`);
        }
      }
      
      const yieldData = this.calculateYield(position, currentApy);
      
      totalInvested += yieldData.principal;
      totalCurrentValue += yieldData.finalAmount;
      totalReturns += yieldData.totalReturn;
      
      positionYields.push({
        ...position,
        yieldData,
        currentApy
      });
    }
    
    const portfolioReturn = totalReturns;
    const portfolioReturnPercentage = totalInvested > 0 ? (portfolioReturn / totalInvested) * 100 : 0;
    
    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalReturns: Math.round(totalReturns * 100) / 100,
      portfolioReturnPercentage: Math.round(portfolioReturnPercentage * 100) / 100,
      averageHoldDays: positions.length > 0 
        ? positionYields.reduce((sum, p) => sum + p.yieldData.holdDays, 0) / positions.length 
        : 0,
      profitablePositions: positionYields.filter(p => p.yieldData.isProfit).length,
      totalPositions: positions.length,
      winRate: positions.length > 0 
        ? (positionYields.filter(p => p.yieldData.isProfit).length / positions.length) * 100 
        : 0,
      positionYields
    };
  },

  simulateInvestment(apy: number, daysToHold: number, customPrincipal: number = PRINCIPAL_USD): any {
    const principal = customPrincipal;
    const annualRate = apy / 100;
    const timeInYears = daysToHold / 365;
    
    // Calculate with daily compounding
    const finalAmount = principal * Math.pow(
      (1 + annualRate / DAILY_COMPOUND_RATE), 
      DAILY_COMPOUND_RATE * timeInYears
    );
    
    const totalReturn = finalAmount - principal;
    const returnPercentage = (totalReturn / principal) * 100;
    const dailyReturn = returnPercentage / daysToHold;
    
    return {
      apy,
      principal,
      daysToHold,
      finalAmount: Math.round(finalAmount * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      dailyReturn: Math.round(dailyReturn * 10000) / 10000,
      annualizedReturn: returnPercentage / timeInYears
    };
  }
};

// Utility functions
export const formatCurrency = (amount: number): string => {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPercent = (percent: number): string => {
  return percent.toFixed(2) + '%';
};

export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'Just now';
};

export const getRiskColor = (risk: number): string => {
  if (risk <= 3) return '#4caf50'; // green
  if (risk <= 6) return '#ff9800'; // orange
  return '#f44336'; // red
};

export const getApyColor = (apy: number): string => {
  if (apy >= 100) return '#4caf50'; // green
  if (apy >= 50) return '#ff9800'; // orange
  return '#2196f3'; // blue
};
