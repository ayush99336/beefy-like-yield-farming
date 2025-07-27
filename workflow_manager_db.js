/**
 * ===================================================================================
 * Database-Integrated Workflow Manager (workflow_manager_db.js)
 * ===================================================================================
 *
 * Description:
 * Orchestrates the yield farming simulation with full database integration.
 * Stores all positions, watchlist, logs, and cycles in PostgreSQL.
 *
 * ===================================================================================
 */

import logger from './logger.js';
import { dbService } from './services/database.js';
import yieldCalculator from './yield-calculator.js';
import { WORKFLOW_CONFIG, TIMING_CONFIG, CONFIG_HELPERS, YIELD_CONFIG } from './config.js';
import {
  fetchNewIncentivePools,
  validateAndFilterNewPools,
  enrichPoolData,
  selectOptimalPools,
  defaultConfig,
  sampleStats,
  fetchPoolById
} from './functional_strategy.js';

// --- Configuration from unified config ---
const HOLD_DURATION_MS     = TIMING_CONFIG.holdDurationMs;      // 48 hours
const RUN_INTERVAL_MS      = TIMING_CONFIG.cycleIntervalMs;     // 30 minutes
const MAX_ACTIVE_POSITIONS = WORKFLOW_CONFIG.maxPositions;     // 5 positions
const MIN_WATCHLIST_AGE_MS = TIMING_CONFIG.watchlistAgeMs;     // 15 minutes
const MAX_RISK_SCORE       = WORKFLOW_CONFIG.maxRiskScore;     // Risk threshold 7
const APY_DROP_THRESHOLD   = WORKFLOW_CONFIG.apyDropThreshold * 100; // 50% (convert to percentage)

// --- Portfolio Lifecycle ---
async function checkForExits(cycleId) {
  logger.info('🔍 Checking for positions to exit...');
  
  try {
    const activePositions = await dbService.getActivePositions();
    const now = Date.now();
    let exitedCount = 0;

    for (const pos of activePositions) {
      const hoursHeld = (now - new Date(pos.entryTimestamp).getTime()) / (1000 * 60 * 60);
      const current = await fetchPoolById(pos.poolId);
      
      if (!current) {
        await dbService.addLog(cycleId, 'warn', `Could not fetch current data for ${pos.symbol}`, { poolId: pos.poolId });
        continue;
      }

      // Use unified config helpers for exit decisions
      const timeExit = CONFIG_HELPERS.shouldExitByTime(pos.entryTimestamp);
      const apyExit = CONFIG_HELPERS.shouldExitByPerformance(pos.entryApy, current.apy);
      const highRisk = current.riskScore > MAX_RISK_SCORE;
      const apyDrop = ((pos.entryApy - current.apy) / pos.entryApy) * 100;

      if (timeExit || apyExit || highRisk) {
        const reason = timeExit ? 'time_exit_48h' : apyExit ? 'apy_drop_50pct' : 'risk_exit';
        
        // Calculate yield for this position
        const yieldData = yieldCalculator.calculateYield(pos, {
          timestamp: new Date(),
          exitApy: current.apy
        });
        
        logger.info(`⚡ Exiting ${pos.symbol} | Reason: ${reason} | APY Drop: ${apyDrop.toFixed(1)}% | Risk: ${current.riskScore} | Return: $${yieldData.totalReturn} (${yieldData.returnPercentage}%)`);
        
        await dbService.exitPosition(pos.poolId, {
          reason: reason,
          exitApy: current.apy,
          profitLoss: yieldData.totalReturn
        });
        
        await dbService.addLog(cycleId, 'info', `Exited position: ${pos.symbol}`, {
          reason,
          apyDrop: apyDrop.toFixed(1),
          riskScore: current.riskScore,
          hoursHeld: hoursHeld.toFixed(1),
          entryApy: pos.entryApy,
          exitApy: current.apy,
          yieldReturn: yieldData.totalReturn,
          yieldPercentage: yieldData.returnPercentage,
          principal: yieldCalculator.PRINCIPAL_USD
        });
        
        exitedCount++;
      }
    }

    if (exitedCount > 0) {
      logger.info(`✅ Exited ${exitedCount} positions`);
    }
    
    return exitedCount;
  } catch (error) {
    logger.error(`Error checking for exits: ${error.message}`);
    await dbService.addLog(cycleId, 'error', `Error checking exits: ${error.message}`);
    return 0;
  }
}

async function updateWatchlist(cycleId) {
  logger.info('👀 Updating watchlist with newest pools...');
  
  try {
    const detected = await fetchNewIncentivePools(defaultConfig);
    const existingWatchlist = await dbService.getWatchlist();
    const existingIds = new Set(existingWatchlist.map(p => p.poolId));
    let added = 0;

    for (const pool of detected.slice(0, 15)) { // Top 15 new pools
      if (!existingIds.has(pool.pool)) {
        await dbService.addToWatchlist({
          poolId: pool.pool,
          symbol: pool.symbol,
          project: pool.project,
          isNew: pool.isNew || false
        });
        added++;
      }
    }

    // Clean up old watchlist entries
    const cleaned = await dbService.cleanOldWatchlistEntries(7);

    if (added > 0) {
      logger.info(`📝 Added ${added} new pools to watchlist`);
      await dbService.addLog(cycleId, 'info', `Added ${added} new pools to watchlist`);
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned ${cleaned} old watchlist entries`);
      await dbService.addLog(cycleId, 'info', `Cleaned ${cleaned} old watchlist entries`);
    }
    
    return { added, cleaned };
  } catch (error) {
    logger.error(`Error updating watchlist: ${error.message}`);
    await dbService.addLog(cycleId, 'error', `Error updating watchlist: ${error.message}`);
    return { added: 0, cleaned: 0 };
  }
}

async function investFromWatchlist(cycleId) {
  logger.info('💰 Evaluating watchlist for investment...');
  
  try {
    const activePositions = await dbService.getActivePositions();
    let slots = MAX_ACTIVE_POSITIONS - activePositions.length;
    
    if (slots <= 0) {
      logger.info('🏦 Portfolio is full. No new investments will be made.');
      await dbService.addLog(cycleId, 'info', 'Portfolio is full, skipping investments');
      return 0;
    }

    const now = Date.now();
    const watchlist = await dbService.getWatchlist();
    const matured = watchlist.filter(w => now - new Date(w.firstSeen).getTime() >= MIN_WATCHLIST_AGE_MS);
    
    if (!matured.length) {
      logger.info('⏰ No matured pools to validate yet.');
      return 0;
    }

    const allPools = await fetchNewIncentivePools(defaultConfig);
    const validated = validateAndFilterNewPools(matured, allPools, defaultConfig);
    
    if (!validated.length) {
      logger.info('❌ No validated pools meeting criteria.');
      await dbService.addLog(cycleId, 'info', 'No pools passed validation criteria');
      return 0;
    }

    const enriched = enrichPoolData(validated.slice(0, 20), sampleStats, defaultConfig);
    const optimal = selectOptimalPools(enriched, defaultConfig);

    // --- Rebalancing Logic ---
    for (const cand of optimal) {
      if (activePositions.length < MAX_ACTIVE_POSITIONS) break;

      const worst = activePositions.reduce(
        (min, p) => p.entryApy < min.entryApy ? p : min, 
        activePositions[0]
      );
      
      if (cand.apy > worst.entryApy + 20) { // 20% APY improvement threshold
        logger.info(`🔄 Rebalancing: Replacing ${worst.symbol} (APY ${worst.entryApy}%) with ${cand.symbol} (APY ${cand.apy}%)`);
        
        // Calculate yield for the position being exited
        const yieldData = yieldCalculator.calculateYield(worst, {
          timestamp: new Date(),
          exitApy: worst.entryApy // Use entry APY as we don't have current data
        });
        
        await dbService.exitPosition(worst.poolId, {
          reason: 'rebalanced',
          exitApy: worst.entryApy,
          profitLoss: yieldData.totalReturn
        });
        
        await dbService.addLog(cycleId, 'info', `Rebalancing: Replacing ${worst.symbol} with ${cand.symbol}`, {
          oldApy: worst.entryApy,
          newApy: cand.apy,
          improvement: cand.apy - worst.entryApy,
          exitedReturn: yieldData.totalReturn,
          exitedPercentage: yieldData.returnPercentage
        });
        
        slots++;
      }
    }

    const remaining = optimal.slice(0, slots);
    let investedCount = 0;
    
    for (const cand of remaining) {
      if (!activePositions.some(p => p.poolId === cand.pool)) {
        // Simulate investment to show projected returns
        const simulation = yieldCalculator.simulateInvestment(cand, 1); // 1 day projection
        
        logger.info(`🚀 Entering ${cand.symbol} | APY ${cand.apy.toFixed(2)}% | Risk ${cand.riskScore} | ${cand.isNew ? '🆕 NEW' : '📈 EST'} | Daily Est: $${simulation.totalReturn.toFixed(2)}`);
        
        await dbService.addPosition(cycleId, {
          poolId: cand.pool,
          symbol: cand.symbol,
          project: cand.project,
          entryApy: cand.apy,
          entryRewardApy: cand.apyReward || 0,
          entryTvl: cand.tvlUsd || 0,
          entryRisk: cand.riskScore,
          isNew: cand.isNew,
          detectionReason: cand.isNew ? 'New incentive pool' : 'High APY opportunity'
        });
        
        // Update watchlist status
        await dbService.updateWatchlistStatus(cand.pool, 'invested');
        
        await dbService.addLog(cycleId, 'info', `New investment: ${cand.symbol}`, {
          apy: cand.apy,
          risk: cand.riskScore,
          isNew: cand.isNew,
          tvl: cand.tvlUsd,
          principal: yieldCalculator.PRINCIPAL_USD,
          projectedDailyReturn: simulation.totalReturn,
          projectedDailyPercentage: simulation.returnPercentage
        });
        
        investedCount++;
      }
    }
    
    if (investedCount > 0) {
      logger.info(`✅ Made ${investedCount} new investments`);
    }
    
    return investedCount;
  } catch (error) {
    logger.error(`Error investing from watchlist: ${error.message}`);
    await dbService.addLog(cycleId, 'error', `Error investing: ${error.message}`);
    return 0;
  }
}

// --- Main Loop ---
async function workflowLoop() {
  const startTime = Date.now();
  logger.info(`\n=== 🤖 Workflow Cycle @ ${new Date().toISOString()} ===`);
  
  try {
    // Start a new detection cycle
    const cycle = await dbService.startDetectionCycle();
    await dbService.addLog(cycle.id, 'info', 'Started new detection cycle');
    
    // Execute workflow phases
    const exitedCount = await checkForExits(cycle.id);
    const watchlistStats = await updateWatchlist(cycle.id);
    const investedCount = await investFromWatchlist(cycle.id);
    
    // Get final stats and yield analytics
    const activePositions = await dbService.getActivePositions();
    const allPositions = await dbService.getAllPositions();
    const watchlist = await dbService.getWatchlist();
    const cycleDuration = Date.now() - startTime;
    
    // Generate yield analytics
    const yieldAnalytics = await yieldCalculator.generateYieldAnalytics(allPositions);
    
    // Update cycle stats
    await dbService.updateCycleStats(cycle.id, {
      activePositions: activePositions.length,
      watchlistSize: watchlist.length,
      totalPoolsFound: watchlistStats.added + watchlist.length,
      newPoolsFound: watchlistStats.added
    });
    
    // Log yield performance
    logger.info(`💰 Portfolio Performance:`);
    logger.info(`   • Total Invested: $${yieldAnalytics.overall.totalInvested}`);
    logger.info(`   • Current Value: $${yieldAnalytics.overall.totalCurrentValue}`);
    logger.info(`   • Total Returns: $${yieldAnalytics.overall.totalReturns} (${yieldAnalytics.overall.portfolioReturnPercentage}%)`);
    logger.info(`   • Win Rate: ${yieldAnalytics.overall.winRate.toFixed(1)}% (${yieldAnalytics.overall.profitablePositions}/${yieldAnalytics.overall.totalPositions})`);
    logger.info(`   • Avg Hold: ${yieldAnalytics.overall.averageHoldDays.toFixed(1)} days`);
    
    // Log final cycle summary
    const summary = `Cycle Complete: Active=${activePositions.length}, Watchlist=${watchlist.length}, New=${watchlistStats.added}, Exited=${exitedCount}, Invested=${investedCount}, Duration=${(cycleDuration/1000).toFixed(1)}s, Returns=${yieldAnalytics.overall.portfolioReturnPercentage.toFixed(2)}%`;
    logger.info(`✨ ${summary}`);
    
    await dbService.addLog(cycle.id, 'info', 'Cycle completed successfully', {
      activePositions: activePositions.length,
      watchlistSize: watchlist.length,
      newPoolsAdded: watchlistStats.added,
      positionsExited: exitedCount,
      newInvestments: investedCount,
      cycleDurationMs: cycleDuration,
      portfolioValue: yieldAnalytics.overall.totalCurrentValue,
      portfolioReturns: yieldAnalytics.overall.totalReturns,
      portfolioReturnPercentage: yieldAnalytics.overall.portfolioReturnPercentage,
      winRate: yieldAnalytics.overall.winRate
    });
    
  } catch (error) {
    logger.error(`❌ Workflow error: ${error.message}`);
    console.error(error);
  }
}

// --- Startup ---
async function startWorkflow() {
  try {
    // Connect to database
    await dbService.connect();
    
    logger.info('\n🚀 Starting Database-Integrated Workflow Manager...');
    logger.info(`⚙️  Configuration:`);
    logger.info(`   • Interval: ${RUN_INTERVAL_MS/60000} minutes`);
    logger.info(`   • Hold Duration: ${HOLD_DURATION_MS/3600000} hours`);
    logger.info(`   • Max Positions: ${MAX_ACTIVE_POSITIONS}`);
    logger.info(`   • Watchlist Age: ${MIN_WATCHLIST_AGE_MS/60000} minutes`);
    logger.info(`   • Max Risk Score: ${MAX_RISK_SCORE}`);
    logger.info(`   • APY Drop Threshold: ${(WORKFLOW_CONFIG.apyDropThreshold * 100)}%`);
    logger.info(`   • Ultra-Fresh Window: ${TIMING_CONFIG.newPoolMinAgeHrs}-${TIMING_CONFIG.newPoolMaxAgeHrs} hours`);
    logger.info(`   • Principal Per Pool: $${YIELD_CONFIG.principalUsd}`);
    
    // Run initial cycle
    await workflowLoop();
    
    // Schedule recurring cycles
    setInterval(workflowLoop, RUN_INTERVAL_MS);
    
    logger.info(`\n✅ Workflow Manager running successfully!`);
    logger.info(`📊 API Dashboard: http://localhost:3000/api/dashboard`);
    logger.info(`🏥 Health Check: http://localhost:3000/health`);
    
  } catch (error) {
    logger.error(`❌ Failed to start workflow: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down Workflow Manager...');
  await dbService.disconnect();
  process.exit(0);
});

startWorkflow();
