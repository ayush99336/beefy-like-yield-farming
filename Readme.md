# WildNet Yield Farming Bot

**Automated Solana yield farming bot with incentive-driven pool detection and real-time analytics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Solana](https://img.shields.io/badge/Solana-Compatible-purple.svg)](https://solana.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org/)

## Key Features

- **Automated Pool Discovery**: Scans DeFiLlama for high-APY Solana pools with intelligent filtering
- **Risk Management**: Comprehensive risk scoring and portfolio management system
- **Real-time Analytics**: Live dashboard with yield projections and performance metrics
- **Investment Simulation**: $1000 principal per pool with compound interest calculations
- **Dynamic Strategy**: Short-term, incentive-driven farming with configurable parameters
- **Performance Tracking**: Detailed position monitoring and portfolio analytics
- **Smart Exit Conditions**: Automated exits based on APY drops and risk thresholds
- **Multi-Asset Support**: Diversified token exposure with risk-adjusted selection
- **Database Integration**: PostgreSQL with Prisma ORM for data persistence
- **REST API**: Complete API endpoints for external integrations
- **React Dashboard**: Professional web interface for monitoring and control

## References

- [Yield Farming on Solana](https://www.coingecko.com/research/publications/yield-farming-on-solana)
- [DefiLlama Explained: Features, LlamaSwap & More (2024)](https://www.datawallet.com/crypto/defillama-explained)
- [Yield Farming in DeFi Explained: Possibilities, Risks & Strategies](https://cointelegraph.com/explained/defi-yield-farming-explained)

## Overview

WildNet is an intelligent yield farming bot designed for the Solana ecosystem. It automatically discovers high-yield opportunities, manages investments with risk assessment, and provides real-time analytics through a comprehensive dashboard.

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd wildnet-3
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# 3. Setup database and services
npm run setup

# 4. Start the bot (main service)
npm start

# 5. Start API server (for dashboard)
npm run server

# 6. Start React dashboard (for monitoring)
npm run react-dashboard
```

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   API Server    │    │  Main Bot Core  │
│  (Dashboard)    │◄──►│  (Express.js)   │◄──►│ (Workflow Mgr)  │
│  Port: 3001     │    │  Port: 3000     │    │   Background    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    │  (Prisma ORM)   │
                    └─────────────────┘
```

### Project Structure

```
wildnet-3/
├── Core Bot Files
│   ├── workflow_manager_db.js    # Main orchestrator
│   ├── functional_strategy.js    # Pool detection & validation
│   ├── yield-calculator.js       # Investment calculations
│   └── config.js                # Unified configuration
│
├── API & Backend
│   ├── api-server.js            # Express.js REST API
│   ├── backend/                 # Additional services
│   └── services/                # External API integrations
│
├── Frontend
│   └── frontend-react/          # React dashboard
│       ├── src/components/      # UI components
│       ├── src/services/        # API clients
│       └── src/utils/           # Utilities
│
├── Database
│   ├── prisma/                  # Database schema & migrations
│   ├── database/                # SQL scripts
│   └── docker-compose.yml       # PostgreSQL container
│
├── Analytics & Monitoring
│   ├── yield-analysis.js        # CLI analytics tool
│   ├── logger.js               # Logging system
│   └── bot_activity.log        # Activity logs
│
└── Configuration
    ├── .env                    # Environment variables
    ├── config.js              # Strategy parameters
    └── package.json           # Dependencies & scripts
```

## Configuration

### Environment Variables (.env)

```bash
# Database Configuration
DATABASE_URL="postgresql://wildnet:wildnetpassword@localhost:5432/wildnet?schema=public"

# External APIs
COINGECKO_API_KEY=your_coingecko_api_key_here
BITQUERY_API_ID=your_bitquery_id
BITQUERY_API_SECRET=your_bitquery_secret
BITQUERY_ACCESS_TOKEN=your_access_token

# Bot Strategy Parameters
MIN_APY=30                    # Minimum APY threshold (%)
MIN_TVL=50000                # Minimum TVL threshold ($)
MAX_RISK_SCORE=7             # Maximum risk tolerance (0-10)
PORTFOLIO_SIZE=5             # Max concurrent positions
CHECK_INTERVAL_MINUTES=15    # Detection cycle frequency

# API Configuration
PORT=3000                    # API server port
NODE_ENV=development         # Environment mode
LOG_LEVEL=info              # Logging verbosity
```

### Strategy Configuration (config.js)

#### Pool Detection Criteria
```javascript
STRATEGY_CONFIG: {
  minAPY: 30,                 // 30% minimum APY
  minTVL: 50000,             // $50k minimum TVL
  minRewardAPY: 15,          // 15% minimum reward APY
  minRewardAPYRatio: 0.3,    // 30% of total APY from rewards
  maxRiskScore: 7,           // Risk tolerance (0-10 scale)
  maxPerToken: 2,            // Max positions per reward token
  maxTotal: 5                // Max total active positions
}
```

#### Timing Configuration
```javascript
TIMING_CONFIG: {
  detectionCycleMs: 900000,   // 15 minutes between scans
  holdDurationMs: 86400000,   // 24 hours position hold
  minWatchlistAgeMs: 900000,  // 15 min watchlist maturation
  exitCheckIntervalMs: 1800000 // 30 min exit condition checks
}
```

#### Exit Strategy
```javascript
EXIT_CONFIG: {
  apyDropThreshold: 0.3,      // Exit if APY drops 30%
  maxExitRiskScore: 9,        // Emergency exit risk level
  minHoldDurationMs: 3600000, // 1 hour minimum hold
  emergencyExitEnabled: true   // Enable emergency exits
}
```

## Core Bot Logic

### Pool Detection Process

1. **Discovery Phase**
   - Fetches all Solana pools from DeFiLlama API
   - Filters by minimum APY, TVL, and reward criteria
   - Identifies "new" pools using multiple indicators:
     - Pool age (< 7 days)
     - High APY (> 50%)
     - Rapid TVL growth
     - Keyword patterns ("new", "launch", etc.)

2. **Validation Phase**
   - Cross-references detected pools with full dataset
   - Applies strict validation criteria
   - Calculates risk scores (0-10 scale)
   - Computes profit potential scores

3. **Selection Phase**
   - Filters pools by maximum risk tolerance
   - Ensures token diversification
   - Selects optimal pools by profit potential
   - Maintains portfolio size limits

### Investment Simulation

- **Principal**: $1000 per pool position
- **Compounding**: Daily compound interest calculation
- **Hold Duration**: 24-hour short-term strategy
- **Exit Conditions**: APY drops > 30% or risk score > 9

### Risk Assessment

Risk scores are calculated based on:
- **APY Level**: Very high APY (>100%) adds risk
- **TVL Size**: Low TVL (<100k) increases risk
- **Reward Ratio**: High reward dependency adds risk
- **Volatility**: Token price volatility factor
- **Market Conditions**: Overall market sentiment

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System health check |
| `GET` | `/api/positions` | Active positions |
| `GET` | `/api/watchlist` | Monitored pools |
| `GET` | `/api/portfolio` | Portfolio summary |
| `GET` | `/api/analytics` | Yield analytics |
| `GET` | `/api/coingecko/prices/:tokens` | Token prices |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/yield` | Yield performance |
| `GET` | `/api/analytics/portfolio` | Portfolio metrics |
| `GET` | `/api/analytics/projections` | Future projections |
| `GET` | `/api/analytics/risk` | Risk assessment |

## Dashboard Features

### Real-time Monitoring
- **Portfolio Overview**: Current positions and performance
- **Pool Discovery**: Newly detected opportunities
- **Yield Analytics**: Historical and projected returns
- **Risk Metrics**: Real-time risk assessment

### Performance Tracking
- **Position Tracking**: Entry/exit points and hold duration
- **Yield Calculations**: Compound interest with daily updates
- **Profit/Loss**: Real-time P&L with percentage returns
- **Portfolio Analytics**: Win rate, average hold time, total returns

### Risk Management
- **Risk Scores**: Visual risk indicators (0-10 scale)
- **Exit Conditions**: Automated exit trigger monitoring
- **Diversification**: Token and pool distribution tracking
- **Emergency Controls**: Manual override capabilities

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **PostgreSQL**: v15 or higher (via Docker)
- **NPM**: Latest version
- **Git**: For cloning repository

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd wildnet-3
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd frontend-react && npm install && cd ..
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Database Setup**
   ```bash
   npm run docker:up        # Start PostgreSQL container
   npm run db:generate      # Generate Prisma client
   npm run db:push         # Push schema to database
   ```

5. **Start Services**
   ```bash
   # Terminal 1: Main Bot
   npm start
   
   # Terminal 2: API Server
   npm run server
   
   # Terminal 3: React Dashboard
   npm run react-dashboard
   ```

### Access Points

- **React Dashboard**: http://localhost:3001
- **API Server**: http://localhost:3000
- **Database Studio**: `npm run db:studio`

## Usage Examples

### Monitoring Performance

```bash
# View yield analytics
npm run analyze

# Get validation details
npm run analyze -- --validation-details

# Check portfolio summary
npm run yield
```

### Database Management

```bash
# View database in browser
npm run db:studio

# Reset database
npm run db:reset

# Check PostgreSQL logs
npm run docker:logs
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Build React dashboard
npm run build-react

# View Docker container status
docker compose ps
```

## Strategy Optimization

### Performance Tuning

**For Higher Returns:**
- Increase `MIN_APY` threshold
- Reduce `MAX_RISK_SCORE` for safer positions
- Extend `holdDurationMs` for longer positions

**For More Aggressive Strategy:**
- Lower `MIN_APY` and `MIN_TVL` thresholds
- Increase `MAX_RISK_SCORE` tolerance
- Reduce `holdDurationMs` for faster turnover

**For Better Diversification:**
- Increase `maxPerToken` for more token exposure
- Adjust `maxTotal` portfolio size
- Modify reward ratio requirements

### Risk Management

**Conservative Approach:**
```javascript
STRATEGY_CONFIG: {
  minAPY: 50,
  minTVL: 100000,
  maxRiskScore: 5
}
```

**Aggressive Approach:**
```javascript
STRATEGY_CONFIG: {
  minAPY: 20,
  minTVL: 25000,
  maxRiskScore: 8
}
```

## Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Check if PostgreSQL is running
docker compose ps

# Restart database
npm run docker:down && npm run docker:up
```

**No Pools Detected:**
```bash
# Check API connectivity
npm run analyze -- --validation-details

# Review configuration in config.js
# Lower thresholds if needed
```

**React Dashboard Not Loading:**
```bash
# Ensure API server is running
curl http://localhost:3000/health

# Check frontend dependencies
cd frontend-react && npm install
```

### Debugging

**Enable Debug Logging:**
```bash
# Set LOG_LEVEL=debug in .env
LOG_LEVEL=debug npm start
```

**Monitor Bot Activity:**
```bash
# Follow activity logs
tail -f bot_activity.log

# Monitor database changes
npm run db:studio
```

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-feature`
3. **Commit changes**: `git commit -m 'Add new feature'`
4. **Push to branch**: `git push origin feature/new-feature`
5. **Create Pull Request**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **DeFiLlama**: Pool data API
- **CoinGecko**: Token price data
- **Solana**: Blockchain infrastructure
- **Prisma**: Database ORM
- **React**: Frontend framework

## Additional Resources

- **[SCRIPTS_DOCUMENTATION.md](./SCRIPTS_DOCUMENTATION.md)**: Detailed script documentation
- **[Solana Documentation](https://docs.solana.com/)**: Solana development guides
- **[DeFiLlama API](https://defillama.com/docs/api)**: Pool data API documentation
- **[CoinGecko API](https://www.coingecko.com/en/api)**: Price data API documentation

---

**Built with passion for DeFi innovation on Solana**

## Complete Documentation

**[SCRIPTS_DOCUMENTATION.md](./SCRIPTS_DOCUMENTATION.md)** - Complete guide to all scripts, commands, and architecture

## Available Commands

| Command | Purpose | Use Case |
|---------|---------|----------|
| `npm start` | Start main bot | Primary bot operation |
| `npm run server` | Start API server | Backend for dashboard |
| `npm run react-dashboard` | Start frontend | Web monitoring interface |
| `npm run analyze` | Yield analysis | Performance review |
| `npm run setup` | Database setup | First-time initialization |

## Access Points

- **React Dashboard**: http://localhost:3001
- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Architecture

- **Main Bot**: `workflow_manager_db.js` - Pool detection & portfolio management
- **API Server**: `api-server.js` - REST API with CoinGecko proxy
- **Frontend**: `frontend-react/` - React dashboard with real-time data
- **Database**: PostgreSQL with Prisma ORM
- **Strategy**: `functional_strategy.js` - Investment logic & validation

---

# Legacy Documentation - Strategy Module & Workflow Manager

This document summarizes the enhancements and structure of the two key JavaScript files in our short-term (24h) yield farming framework on Solana:

1. **functional_strategy.js** (Strategy Module)
2. **workflow_manager.js** (Simulation Workflow Manager)

---

## 1. functional_strategy.js

### Configuration

* **`defaultConfig`**: Centralized thresholds for detection, analysis, and selection:

  * **Detection**: `minAPY`, `minTVL`, `minRewardAPY`, `minRewardAPYRatio`, `newPoolAgeDays`, etc.
  * **Risk/Analysis**: `volatilitySigmaThreshold`, `maxRiskScore`
  * **Selection**: `maxPerToken`, `maxTotal`
* **`sampleStats`**: Template stats (e.g., `apyMin`, `apyMax`, `tvlMax`, `volRatioMax`) for normalizing profit potential.

### Phase 1: Data Fetching & Validation

* **`fetchAllLlamaPools`**: Retrieves all pools from DeFiLlama.
* **`fetchNewIncentivePools(config)`**:

  1. **Filters** for Solana pools meeting `minAPY`, `minTVL`, and absolute `minRewardAPY`.
  2. **Normalizes** `apyReward` and `rewardTokens` safely when fields are null.
  3. **Marks "new" pools** via indicators:

     * **Age** (`firstSeenAt < newPoolAgeDays`)
     * **High APY** thresholds
     * **Low TVL + medium APY** mix
     * **Reward ratio** (> `highRewardRatioThreshold`)
     * **Rapid TVL growth** (`tvlGrowthPct1d`)
     * **Keyword patterns** (`new`, `launch`, etc.)
  4. **Prioritizes**: New pools first by APY, then established ones.
* **`validateAndFilterNewPools(detected, allPools, config)`**:

  * Cross-references watchlist/other detections against full DeFiLlama data.
  * Reapplies `minAPY`, `minTVL`, `minRewardAPY`, and `minRewardAPYRatio` safeguards.

### Phase 2: Analysis Functions

* **`calculateRiskScore(pool, config)`**:

  * Composite 0–10 risk score based on:

    * Very high APY (> 100%) → +3
    * Low TVL (< 100k) → +2
    * High reward ratio (> threshold) → +2
    * Multi-asset exposure, down prediction, IL risk, sigma volatility → additional points
* **`calculateProfitPotential(pool, stats)`**:

  * Normalizes APY and TVL (log scale) and factors **volume/TVL ratio** for a 0–1 score.
* **`enrichPoolData(pools, stats, config)`**:

  * Annotates each pool with `riskScore` and `profitPotential`.

### Phase 3: Selection Function

* **`selectOptimalPools(enrichedPools, config)`**:

  1. **Filters** out pools above `maxRiskScore`.
  2. **Groups** by `rewardTokens[0]` to ensure diversification.
  3. **Selects** up to `maxPerToken` per token, then top `maxTotal` overall by `profitPotential`.

---

## 2. workflow_manager.js

### Core Responsibilities

* Orchestrates repeated **workflow cycles** every 30 min to:

  1. **Detect** new incentive-driven pools.
  2. **Track** them in a watchlist with age-based pruning.
  3. **Validate**, **analyze**, and **invest** for short-term (24 h) simulation.

### State Management

* **`loadJsonFile`** / **`saveJsonFile`**: Safe read/write of `active_portfolio.json` and `watchlist.json`.
* **Constants**:

  * `HOLD_DURATION_MS` = 24 h, `RUN_INTERVAL_MS` = 30 min
  * `MAX_ACTIVE_POSITIONS` = 5, `MIN_WATCHLIST_AGE_MS` = 15 min

### Portfolio Lifecycle

* **`checkForExits(portfolio)`**:

  * Exits positions held ≥ 24 h, moves them to `exited`, logs exit.
* **`updateWatchlist(watchlist)`**:

  * Calls `fetchNewIncentivePools(defaultConfig)` for top 10 opportunities.
  * **Adds** new pools (by `pool.pool`), stamps `firstSeen`.
  * **Prunes** entries older than 7 days.
* **`investFromWatchlist(portfolio, watchlist)`**:

  1. **Skips** if no slot available.
  2. **Filters** watchlist entries aged ≥ 15 min.
  3. **Validates** with `validateAndFilterNewPools`.
  4. **Analyzes** top 20 with `enrichPoolData(sampleStats)`.
  5. **Selects** up to `slots` via `selectOptimalPools`.
  6. **Invests**: logs and pushes new positions into `portfolio.active`.

### Main Loop

* **`workflowLoop()`**:

  * Loads state, runs exit/update/invest steps, saves state, and logs summary.
  * Triggered on startup and every 30 min via `setInterval`.

---

This documentation provides an at-a-glance understanding of how each piece collaborates to detect, validate, analyze, and simulate yield-farming positions over a 24 h window on Solana. Adjust thresholds and stats in `defaultConfig` and `sampleStats` for your risk tolerance and market conditions.
```

## 📚 **Complete Documentation**

**👉 [SCRIPTS_DOCUMENTATION.md](./SCRIPTS_DOCUMENTATION.md)** - Complete guide to all scripts, commands, and architecture

## 🔧 Available Commands

| Command | Purpose | Use Case |
|---------|---------|----------|
| `npm start` | Start main bot | Primary bot operation |
| `npm run server` | Start API server | Backend for dashboard |
| `npm run react-dashboard` | Start frontend | Web monitoring interface |
| `npm run analyze` | Yield analysis | Performance review |
| `npm run setup` | Database setup | First-time initialization |

## 🌐 Access Points

- **React Dashboard**: http://localhost:3001
- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🏗️ Architecture

- **Main Bot**: `workflow_manager_db.js` - Pool detection & portfolio management
- **API Server**: `api-server.js` - REST API with CoinGecko proxy
- **Frontend**: `frontend-react/` - React dashboard with real-time data
- **Database**: PostgreSQL with Prisma ORM
- **Strategy**: `functional_strategy.js` - Investment logic & validation

---

# Legacy Documentation - Strategy Module & Workflow Manager

This document summarizes the enhancements and structure of the two key JavaScript files in our short-term (24h) yield farming framework on Solana:

1. **functional\_strategy.js** (Strategy Module)
2. **workflow\_manager.js** (Simulation Workflow Manager)

---

## 1. functional\_strategy.js

### 📦 Configuration

* **`defaultConfig`**: Centralized thresholds for detection, analysis, and selection:

  * **Detection**: `minAPY`, `minTVL`, `minRewardAPY`, `minRewardAPYRatio`, `newPoolAgeDays`, etc.
  * **Risk/Analysis**: `volatilitySigmaThreshold`, `maxRiskScore`
  * **Selection**: `maxPerToken`, `maxTotal`
* **`sampleStats`**: Template stats (e.g., `apyMin`, `apyMax`, `tvlMax`, `volRatioMax`) for normalizing profit potential.

### 🕵️ Phase 1: Data Fetching & Validation

* **`fetchAllLlamaPools`**: Retrieves all pools from DeFiLlama.
* **`fetchNewIncentivePools(config)`**:

  1. **Filters** for Solana pools meeting `minAPY`, `minTVL`, and absolute `minRewardAPY`.
  2. **Normalizes** `apyReward` and `rewardTokens` safely when fields are null.
  3. **Marks "new" pools** via indicators:

     * **Age** (`firstSeenAt < newPoolAgeDays`)
     * **High APY** thresholds
     * **Low TVL + medium APY** mix
     * **Reward ratio** (> `highRewardRatioThreshold`)
     * **Rapid TVL growth** (`tvlGrowthPct1d`)
     * **Keyword patterns** (`new`, `launch`, etc.)
  4. **Prioritizes**: New pools first by APY, then established ones.
* **`validateAndFilterNewPools(detected, allPools, config)`**:

  * Cross-references watchlist/other detections against full DeFiLlama data.
  * Reapplies `minAPY`, `minTVL`, `minRewardAPY`, and `minRewardAPYRatio` safeguards.

###  Phase 2: Analysis Functions

* **`calculateRiskScore(pool, config)`**:

  * Composite 0–10 risk score based on:

    * Very high APY (> 100%) ➔ +3
    * Low TVL (< 100k) ➔ +2
    * High reward ratio (> threshold) ➔ +2
    * Multi-asset exposure, down prediction, IL risk, sigma volatility ➔ additional points
* **`calculateProfitPotential(pool, stats)`**:

  * Normalizes APY and TVL (log scale) and factors **volume/TVL ratio** for a 0–1 score.
* **`enrichPoolData(pools, stats, config)`**:

  * Annotates each pool with `riskScore` and `profitPotential`.

### 🎯 Phase 3: Selection Function

* **`selectOptimalPools(enrichedPools, config)`**:

  1. **Filters** out pools above `maxRiskScore`.
  2. **Groups** by `rewardTokens[0]` to ensure diversification.
  3. **Selects** up to `maxPerToken` per token, then top `maxTotal` overall by `profitPotential`.

---

## 2. workflow\_manager.js

### 🔧 Core Responsibilities

* Orchestrates repeated **workflow cycles** every 30 min to:

  1. **Detect** new incentive-driven pools.
  2. **Track** them in a watchlist with age-based pruning.
  3. **Validate**, **analyze**, and **invest** for short-term (24 h) simulation.

### 🗄️ State Management

* **`loadJsonFile`** / **`saveJsonFile`**: Safe read/write of `active_portfolio.json` and `watchlist.json`.
* **Constants**:

  * `HOLD_DURATION_MS` = 24 h, `RUN_INTERVAL_MS` = 30 min
  * `MAX_ACTIVE_POSITIONS` = 5, `MIN_WATCHLIST_AGE_MS` = 15 min

### 🚪 Portfolio Lifecycle

* **`checkForExits(portfolio)`**:

  * Exits positions held ≥ 24 h, moves them to `exited`, logs exit.
* **`updateWatchlist(watchlist)`**:

  * Calls `fetchNewIncentivePools(defaultConfig)` for top 10 opportunities.
  * **Adds** new pools (by `pool.pool`), stamps `firstSeen`.
  * **Prunes** entries older than 7 days.
* **`investFromWatchlist(portfolio, watchlist)`**:

  1. **Skips** if no slot available.
  2. **Filters** watchlist entries aged ≥ 15 min.
  3. **Validates** with `validateAndFilterNewPools`.
  4. **Analyzes** top 20 with `enrichPoolData(sampleStats)`.
  5. **Selects** up to `slots` via `selectOptimalPools`.
  6. **Invests**: logs and pushes new positions into `portfolio.active`.

###  Main Loop

* **`workflowLoop()`**:

  * Loads state, runs exit/update/invest steps, saves state, and logs summary.
  * Triggered on startup and every 30 min via `setInterval`.

---

This documentation provides an at-a-glance understanding of how each piece collaborates to detect, validate, analyze, and simulate yield-farming positions over a 24 h window on Solana. Adjust thresholds and stats in `defaultConfig` and `sampleStats` for your risk tolerance and market conditions.
