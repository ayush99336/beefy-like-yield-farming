import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { dbService } from './services/database.js';
import yieldCalculator from './yield-calculator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await dbService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// =================== POSITIONS ENDPOINTS ===================

app.get('/api/positions', async (req, res) => {
  try {
    const positions = await dbService.getAllPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions/active', async (req, res) => {
  try {
    const positions = await dbService.getActivePositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions/exited', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const positions = await dbService.getExitedPositions(parseInt(limit));
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== WATCHLIST ENDPOINTS ===================

app.get('/api/watchlist', async (req, res) => {
  try {
    const watchlist = await dbService.getWatchlist();
    res.json(watchlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/watchlist/cleanup', async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const deletedCount = await dbService.cleanOldWatchlistEntries(days);
    res.json({ message: `Cleaned up ${deletedCount} old watchlist entries` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== LOGS ENDPOINTS ===================

app.get('/api/logs', async (req, res) => {
  try {
    const { limit = 100, level } = req.query;
    const logs = await dbService.getLogs(parseInt(limit), level);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== CYCLES ENDPOINTS ===================

app.get('/api/cycles', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const cycles = await dbService.getRecentCycles(parseInt(limit));
    res.json(cycles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== COINGECKO PROXY ENDPOINTS ===================

// CoinGecko configuration
const COINGECKO_CONFIG = {
  apiKey: process.env.COINGECKO_API_KEY || '',
  // Demo API keys use regular endpoint, Pro API keys use pro-api endpoint
  baseUrl: 'https://api.coingecko.com/api/v3',
  timeout: 10000
};

// Advanced caching and rate limiting for CoinGecko API
let lastApiCall = 0;
const API_CALL_INTERVAL = 5000; // 5 seconds between calls
const priceCache = new Map();
const CACHE_DURATION = 120000; // 2 minutes cache
const pendingRequests = new Map(); // Request deduplication

// CoinGecko API proxy to avoid CORS issues
app.get('/api/coingecko/prices', async (req, res) => {
  try {
    const { ids, vs_currencies = 'usd' } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'ids parameter is required' });
    }

    const cacheKey = `${ids}-${vs_currencies}`;
    const now = Date.now();

    // Check cache first
    const cached = priceCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('💾 Serving from cache:', cacheKey);
      return res.json(cached.data);
    }

    // Check if this exact request is already in progress
    if (pendingRequests.has(cacheKey)) {
      console.log('⏳ Request already in progress, waiting...:', cacheKey);
      try {
        const result = await pendingRequests.get(cacheKey);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: 'Request failed' });
      }
    }

    // Rate limiting
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < API_CALL_INTERVAL) {
      const waitTime = API_CALL_INTERVAL - timeSinceLastCall;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms for ${cacheKey}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Create a promise for this request to avoid duplicates
    const requestPromise = (async () => {
      try {
        lastApiCall = Date.now();

        console.log('🌐 Making fresh CoinGecko request:', { 
          ids, 
          vs_currencies, 
          hasApiKey: !!COINGECKO_CONFIG.apiKey,
          baseUrl: COINGECKO_CONFIG.baseUrl 
        });

        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'WildNet-YieldBot/1.0'
        };

        // Add API key if available (Demo API)
        if (COINGECKO_CONFIG.apiKey) {
          headers['X-CG-Demo-API-Key'] = COINGECKO_CONFIG.apiKey;
        }

        const response = await axios.get(`${COINGECKO_CONFIG.baseUrl}/simple/price`, {
          params: { ids, vs_currencies },
          headers,
          timeout: COINGECKO_CONFIG.timeout
        });

        const data = response.data;
        
        // Cache the result
        priceCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        console.log('✅ CoinGecko API response cached:', Object.keys(data));
        return data;

      } finally {
        // Remove from pending requests
        pendingRequests.delete(cacheKey);
      }
    })();

    // Add to pending requests
    pendingRequests.set(cacheKey, requestPromise);

    const result = await requestPromise;
    res.json(result);
    
  } catch (error) {
    console.error('❌ CoinGecko proxy error:', error.message);
    if (error.response) {
      console.error('CoinGecko API Error Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      res.status(error.response.status).json({ 
        error: 'CoinGecko API Error', 
        details: error.response.data,
        status: error.response.status
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch token prices', 
        details: error.message 
      });
    }
  }
});

// =================== ANALYTICS ENDPOINTS ===================

app.get('/api/analytics/metrics', async (req, res) => {
  try {
    const metrics = await dbService.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const dashboardData = await dbService.getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== PORTFOLIO SUMMARY ENDPOINTS ===================

app.get('/api/portfolio/summary', async (req, res) => {
  try {
    const [activePositions, metrics] = await Promise.all([
      dbService.getActivePositions(),
      dbService.getPerformanceMetrics()
    ]);

    const summary = {
      activePositionsCount: activePositions.length,
      totalValue: activePositions.reduce((sum, pos) => sum + (pos.entryTvl || 0), 0),
      averageApy: activePositions.length > 0 
        ? activePositions.reduce((sum, pos) => sum + pos.entryApy, 0) / activePositions.length 
        : 0,
      averageRisk: activePositions.length > 0 
        ? activePositions.reduce((sum, pos) => sum + (pos.entryRiskScore || 0), 0) / activePositions.length 
        : 0,
      metrics
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== MANUAL ACTIONS ENDPOINTS ===================

app.post('/api/positions/:poolId/exit', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { reason = 'manual', profitLoss = 0 } = req.body;
    
    await dbService.exitPosition(poolId, { reason, profitLoss });
    res.json({ message: `Position ${poolId} exited successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== YIELD ANALYTICS ENDPOINTS ===================

app.get('/api/yield/analytics', async (req, res) => {
  try {
    const positions = await dbService.getAllPositions();
    const analytics = await yieldCalculator.generateYieldAnalytics(positions);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yield/portfolio', async (req, res) => {
  try {
    const positions = await dbService.getAllPositions();
    const portfolioYield = await yieldCalculator.calculatePortfolioYield(positions);
    res.json(portfolioYield);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yield/projections', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const activePositions = await dbService.getActivePositions();
    const projections = await yieldCalculator.projectFutureYields(activePositions, parseInt(days));
    res.json(projections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yield/simulate/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { days = 7, amount } = req.query;
    
    // This would need to fetch pool data from DeFiLlama
    // For now, return a placeholder response
    const simulation = {
      poolId,
      message: 'Simulation endpoint - requires pool data integration',
      parameters: { days: parseInt(days), amount: amount || yieldCalculator.PRINCIPAL_USD }
    };
    
    res.json(simulation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yield/metrics', async (req, res) => {
  try {
    const metrics = await dbService.getYieldMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await dbService.connect();
    
    app.listen(PORT, () => {
      console.log(`🚀 API Server running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
      console.log(`❤️  Health: http://localhost:${PORT}/health`);
      console.log(`📝 Logs: http://localhost:${PORT}/api/logs`);
      console.log(`💼 Active Positions: http://localhost:${PORT}/api/positions/active`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await dbService.disconnect();
  process.exit(0);
});

startServer();
