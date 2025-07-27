# 📚 WildNet Yield Farming Bot - Scripts Documentation

This document provides comprehensive information about all scripts, their purposes, usage, and relationships in the WildNet Yield Farming Bot project.

## 🏗️ **Project Architecture Overview**

The WildNet bot is a complete Solana yield farming automation system with:
- **Backend**: Database-integrated workflow manager with API server
- **Frontend**: Modern React dashboard with real-time data
- **Database**: PostgreSQL with Prisma ORM
- **External APIs**: DeFiLlama for pool data, CoinGecko for token prices

---

## 📦 **Package.json Scripts**

### **Core Application Scripts**

#### `npm start` / `npm run dev`
**Purpose**: Starts the main bot workflow manager
**File**: `workflow_manager_db.js`
**Use Case**: Primary command to run the yield farming bot
```bash
npm start
```
**What it does**:
- Connects to PostgreSQL database
- Runs automated pool detection every 30 minutes
- Manages investment positions (entry/exit)
- Updates watchlist with fresh pool data
- Calculates yields and portfolio performance

#### `npm run server`
**Purpose**: Starts the REST API server for the dashboard
**File**: `api-server.js`
**Use Case**: Backend API for React frontend
```bash
npm run server
```
**What it does**:
- Serves REST API endpoints (`/api/*`)
- Provides CoinGecko price proxy (CORS-free)
- Handles database queries for frontend
- Manages portfolio and analytics data

#### `npm run react-dashboard`
**Purpose**: Starts the React frontend development server
**File**: `frontend-react/`
**Use Case**: Interactive web dashboard
```bash
npm run react-dashboard
```
**What it does**:
- Launches React development server on port 3001
- Provides real-time portfolio monitoring
- Shows live token prices via CoinGecko
- Displays pool watchlist and analytics

### **Database Scripts**

#### `npm run setup`
**Purpose**: Complete database initialization
**Use Case**: First-time setup or reset
```bash
npm run setup
```
**What it does**:
1. Starts PostgreSQL Docker container
2. Generates Prisma client
3. Pushes database schema
4. Ready for bot operation

#### `npm run db:generate`
**Purpose**: Generates Prisma client from schema
**Use Case**: After schema changes
```bash
npm run db:generate
```

#### `npm run db:push`
**Purpose**: Pushes Prisma schema to database
**Use Case**: Schema deployment
```bash
npm run db:push
```

#### `npm run db:studio`
**Purpose**: Opens Prisma Studio (database GUI)
**Use Case**: Visual database management
```bash
npm run db:studio
```

#### `npm run db:reset`
**Purpose**: Resets database (⚠️ DESTRUCTIVE)
**Use Case**: Clean slate development
```bash
npm run db:reset
```

### **Docker Scripts**

#### `npm run docker:up`
**Purpose**: Starts PostgreSQL in Docker
```bash
npm run docker:up
```

#### `npm run docker:down`
**Purpose**: Stops Docker containers
```bash
npm run docker:down
```

#### `npm run docker:logs`
**Purpose**: Shows PostgreSQL container logs
```bash
npm run docker:logs
```

### **Analysis Scripts**

#### `npm run analyze`
**Purpose**: Runs comprehensive yield analysis
**File**: `yield-analysis.js`
**Use Case**: Portfolio performance analysis
```bash
npm run analyze
```
**What it does**:
- Analyzes all trading positions
- Calculates returns and profitability
- Shows risk-adjusted performance
- Generates detailed reports

#### `npm run yield`
**Purpose**: Quick yield summary
**Use Case**: Fast performance overview
```bash
npm run yield
```

### **Build Scripts**

#### `npm run build-react`
**Purpose**: Builds React app for production
**Use Case**: Production deployment
```bash
npm run build-react
```

---

## 🔧 **Core JavaScript Files**

### **Main Application Files**

#### **`workflow_manager_db.js`** ⭐ **MAIN BOT**
**Purpose**: Central orchestrator for the yield farming bot
**Key Features**:
- Pool detection and validation
- Investment entry/exit logic
- Watchlist management
- Performance tracking
- Risk assessment

**Run with**: `npm start`

**What it does every 30 minutes**:
1. **Exit Check**: Reviews active positions for exit conditions
2. **Watchlist Update**: Refreshes pool data from DeFiLlama
3. **Investment Evaluation**: Finds new opportunities
4. **Portfolio Management**: Rebalances positions
5. **Analytics**: Calculates yields and performance

#### **`api-server.js`** 🌐 **API BACKEND**
**Purpose**: REST API server for the React dashboard
**Key Features**:
- Database API endpoints
- CoinGecko price proxy
- Real-time data serving
- CORS handling

**Run with**: `npm run server`

**API Endpoints**:
- `/api/positions` - Portfolio positions
- `/api/watchlist` - Tracked pools
- `/api/logs` - System logs
- `/api/coingecko/prices` - Token prices
- `/api/yield/*` - Yield analytics

### **Strategy & Logic Files**

#### **`functional_strategy.js`** 🧠 **CORE STRATEGY**
**Purpose**: Pool detection, validation, and selection logic
**Key Functions**:
- `fetchNewIncentivePools()` - Gets pools from DeFiLlama
- `validateAndFilterNewPools()` - Applies investment criteria
- `enrichPoolData()` - Adds risk and analysis data
- `selectOptimalPools()` - Chooses best opportunities

#### **`yield-calculator.js`** 📊 **YIELD CALCULATIONS**
**Purpose**: Investment simulation and return calculations
**Key Functions**:
- `calculateYield()` - Position yield calculation
- `calculatePortfolioYield()` - Overall portfolio performance
- `simulateInvestment()` - What-if scenarios
- `projectFutureYields()` - Future return projections

**Principal**: $1,000 per pool investment simulation

#### **`config.js`** ⚙️ **CENTRAL CONFIGURATION**
**Purpose**: All bot settings and thresholds
**Key Settings**:
- **Investment Criteria**: Min APY (50%), Min TVL ($100k)
- **Risk Limits**: Max risk score (7/10)
- **Timing**: Hold duration (48h), Check interval (30min)
- **Portfolio**: Max positions (5), Position size ($1k)

### **Analysis Tools**

#### **`yield-analysis.js`** 📈 **CLI ANALYSIS TOOL**
**Purpose**: Command-line yield analysis and reporting
**Usage**: `npm run analyze` or `npm run yield`
**Features**:
- Portfolio performance metrics
- Position-by-position analysis
- Risk-adjusted returns
- Profitability reports
- Color-coded terminal output

### **Utility Files**

#### **`logger.js`** 📝 **LOGGING SYSTEM**
**Purpose**: Centralized logging for all modules
**Features**:
- Console and file logging
- Multiple log levels
- Timestamp formatting
- Error tracking

#### **`services/database.js`** 🗄️ **DATABASE SERVICE**
**Purpose**: Prisma ORM wrapper and database operations
**Key Functions**:
- Position management (CRUD)
- Watchlist operations
- Log storage and retrieval
- Performance metrics
- Health checks

---

## 🌐 **Frontend (React Dashboard)**

### **Location**: `frontend-react/`
**Purpose**: Interactive web dashboard for monitoring the bot
**URL**: http://localhost:3001 (when running)

#### **Key Components**:
- **Dashboard**: Main tabbed interface
- **PortfolioOverview**: Active positions and yields
- **CoinGeckoDataViewer**: Live token prices
- **LogsViewer**: System activity logs
- **YieldSimulator**: Investment scenarios
- **Watchlist**: Tracked pools display

#### **Services** (`frontend-react/src/services.ts`):
- **apiService**: Backend API communication
- **priceService**: CoinGecko price fetching
- **yieldCalculator**: Frontend yield calculations

---

##  **Typical Workflow**

### **Development Workflow**:
```bash
# 1. Start database
npm run docker:up

# 2. Initialize schema (first time)
npm run db:generate && npm run db:push

# 3. Start main bot (Terminal 1)
npm start

# 4. Start API server (Terminal 2)
npm run server

# 5. Start React dashboard (Terminal 3)
npm run react-dashboard

# 6. Monitor performance
npm run analyze
```

### **Production Workflow**:
```bash
# 1. Build React app
npm run build-react

# 2. Start services
npm run setup
npm start &
npm run server &

# 3. Monitor
npm run yield
```

---

## 📊 **Data Flow Architecture**

```
DeFiLlama API → workflow_manager_db.js → PostgreSQL Database
                       ↓
CoinGecko API → api-server.js ← React Dashboard
                       ↓
              yield-calculator.js → Analytics
```

### **Database Tables**:
- **Position**: Investment positions (active/exited)
- **WatchlistPool**: Tracked pools for investment
- **WorkflowCycle**: Bot execution logs
- **Log**: System activity logs

---

## ⚡ **Quick Commands Reference**

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm start` | Start main bot | Always (primary service) |
| `npm run server` | Start API | When using dashboard |
| `npm run react-dashboard` | Start frontend | For monitoring/analysis |
| `npm run analyze` | Full analysis | Daily performance review |
| `npm run yield` | Quick summary | Quick status check |
| `npm run db:studio` | Database GUI | Data inspection |
| `npm run setup` | Full setup | First time or reset |

---

## 🔧 **Configuration Files**

### **Environment** (`.env`):
```bash
DATABASE_URL="postgresql://..."
COINGECKO_API_KEY="your_key_here"
```

### **Docker** (`docker-compose.yml`):
- PostgreSQL database setup
- Port mapping (5432)
- Data persistence

### **Database** (`prisma/schema.prisma`):
- Table definitions
- Relationships
- Index configurations

---

## 🚀 **Getting Started**

### **First Time Setup**:
1. Clone repository
2. Install dependencies: `npm install`
3. Set up environment: Copy `.env.example` to `.env`
4. Add CoinGecko API key to `.env`
5. Run setup: `npm run setup`
6. Start bot: `npm start`

### **Daily Operations**:
1. Check bot status: `npm run yield`
2. View dashboard: `npm run react-dashboard`
3. Analyze performance: `npm run analyze`
4. Monitor logs: `npm run docker:logs`

---

## ⚠️ **Important Notes**

### **Safety**:
- The bot uses **simulation mode** with $1,000 per pool calculations
- No real trading occurs - this is for analysis and strategy development
- Database contains simulated position data

### **API Limits**:
- **DeFiLlama**: No API key required, but rate-limited
- **CoinGecko**: Requires API key for better rate limits
- **Caching**: 30-second cache reduces API calls

### **Performance**:
- Bot cycles every 30 minutes
- Positions held for 48 hours
- Maximum 5 active positions
- Minimum 50% APY requirement

---

## 🐛 **Troubleshooting**

### **Common Issues**:

1. **Database Connection**: 
   ```bash
   npm run docker:up
   npm run db:push
   ```

2. **API Errors**: Check `.env` for CoinGecko API key

3. **Port Conflicts**: 
   - Bot: No port (background process)
   - API: Port 3000
   - React: Port 3001
   - Database: Port 5432

4. **Missing Data**: 
   ```bash
   npm run analyze
   # Check if bot has been running long enough
   ```

---

This documentation covers all scripts and their purposes in the WildNet Yield Farming Bot project. Each script serves a specific role in the automated yield farming strategy and monitoring system.
