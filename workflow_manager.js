/**
 * ===================================================================================
 * Simulation Workflow Manager
 * =================================================const workflowLoop = async () => {
    logger.info(`\n--- 🚀 Running NEW Incentive Pool Detection Cycle at ${new Date().toLocaleString()} ---`);

    const portfolio = loadJsonFile(PORTFOLIO_FILE, { active: [], exited: [] });
    let watchlist = loadJsonFile(WATCHLIST_FILE, []);

    checkForExits(portfolio);
    watchlist = await updateWatchlist(watchlist);
    await investFromWatchlist(portfolio, watchlist);

    saveJsonFile(PORTFOLIO_FILE, portfolio);
    saveJsonFile(WATCHLIST_FILE, watchlist);

    const newCount = portfolio.active.filter(p => p.isNew).length;
    const establishedCount = portfolio.active.length - newCount;
    
    logger.info(`--- ✅ Cycle Complete. Active: ${portfolio.active.length} (${newCount} new, ${establishedCount} established), Exited: ${portfolio.exited.length}, Tracked: ${watchlist.length} ---`);
};===================
 *
 * Description:
 * This script orchestrates the entire yield farming simulation. It uses a robust
 * architecture that decouples pool detection from investment analysis to handle
 * data provider lag.
 *
 * 1. Update Watchlist: Finds newly created pools and adds them to a watchlist.
 * 2. Invest from Watchlist: Analyzes pools that have "matured" on the watchlist
 * for a set period, validates them with DeFiLlama, and then simulates investment.
 *
 * ===================================================================================
 */

import fs from 'fs';
import logger from './logger.js';
import { detectNewPools } from './pool_detector.js';
import {
    fetchAllLlamaPools,
    fetchNewIncentivePools,
    validateAndFilterNewPools,
    enrichPoolData,
    selectOptimalPools,
} from './functional_strategy.js';
import { STRATEGY_CONFIG } from './config.js';

// --- Configuration ---
const PORTFOLIO_FILE = 'active_portfolio.json';
const WATCHLIST_FILE = 'watchlist.json';
const HOLD_DURATION_MS = 48 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 30 * 60 * 1000; // Run every 30 minutes
const MAX_ACTIVE_POSITIONS = 5;
const MIN_WATCHLIST_AGE_MS = 30 * 60 * 1000; // Wait 30 mins before validating a new pool

// --- State Management Functions ---
const loadJsonFile = (filePath, defaultValue) => {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath));
        }
    } catch (error) {
        logger.error(`Error loading file ${filePath}: ${error.message}`);
    }
    return defaultValue;
};

const saveJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.info(`State saved to ${filePath}`);
    } catch (error) {
        logger.error(`Error saving to ${filePath}: ${error.message}`);
    }
};

// --- Workflow Core Functions ---
const checkForExits = (portfolio) => {
    logger.info(`Checking ${portfolio.active.length} active position(s) for exit...`);
    const now = Date.now();
    const remainingActive = [];

    portfolio.active.forEach(position => {
        if (now - position.entryTimestamp >= HOLD_DURATION_MS) {
            logger.info(`Exiting position in ${position.symbol} after meeting hold duration.`);
            position.status = 'exited';
            position.exitTimestamp = now;
            portfolio.exited.push(position);
        } else {
            remainingActive.push(position);
        }
    });

    portfolio.active = remainingActive;
};

const updateWatchlist = async (watchlist) => {
    logger.info('📝 Maintaining historical tracking of detected opportunities...');
    
    // Get current opportunities for historical tracking
    const currentOpportunities = await fetchNewIncentivePools(STRATEGY_CONFIG);
    const watchlistMap = new Map(watchlist.map(p => [p.poolId, p]));
    let addedCount = 0;

    currentOpportunities.slice(0, 10).forEach(pool => { // Track top 10
        if (!watchlistMap.has(pool.pool)) {
            watchlist.push({ 
                poolId: pool.pool,
                symbol: pool.symbol,
                project: pool.project,
                apy: pool.apy,
                tvl: pool.tvlUsd,
                isNew: pool.isNew || false,
                firstSeenAt: Date.now() 
            });
            addedCount++;
        }
    });

    // Keep only recent entries (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const before = watchlist.length;
    watchlist = watchlist.filter(p => p.firstSeenAt > sevenDaysAgo);
    const cleaned = before - watchlist.length;

    if (addedCount > 0) {
        logger.info(`Added ${addedCount} new opportunities to historical tracking.`);
    }
    if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} old entries from tracking.`);
    }
    
    return watchlist;
};

const investFromWatchlist = async (portfolio, watchlist) => {
    logger.info('🎯 Searching for NEW incentive-driven pool opportunities...');

    const availableSlots = MAX_ACTIVE_POSITIONS - portfolio.active.length;
    if (availableSlots <= 0) {
        logger.info('Portfolio is full. No new investments will be made.');
        return;
    }

    // Use our new approach: Find newly launched incentive-driven pools
    const prioritizedPools = await fetchNewIncentivePools(STRATEGY_CONFIG);
    
    if (prioritizedPools.length === 0) {
        logger.info('No incentive-driven pools found that meet criteria.');
        return;
    }

    // Enrich and select optimal pools
    const enrichedPools = enrichPoolData(prioritizedPools.slice(0, 20)); // Top 20 for performance
    const optimalPools = selectOptimalPools(enrichedPools, STRATEGY_CONFIG);

    let newPositionsCount = 0;
    for (const candidate of optimalPools) {
        if (portfolio.active.length >= MAX_ACTIVE_POSITIONS) break;

        const isAlreadyInvested = portfolio.active.some(p => p.poolId === candidate.pool);
        if (!isAlreadyInvested) {
            const statusTag = candidate.isNew ? '🆕 NEW' : '📊 ESTABLISHED';
            const rewardPercent = ((candidate.apyReward || 0) / candidate.apy * 100).toFixed(1);
            
            logger.info(`++ ${statusTag} Entering position in ${candidate.symbol}`);
            logger.info(`   APY: ${candidate.apy.toFixed(2)}% (${rewardPercent}% from rewards), TVL: $${candidate.tvlUsd.toFixed(0)}, Risk: ${candidate.riskScore}`);
            
            portfolio.active.push({
                poolId: candidate.pool,
                project: candidate.project,
                symbol: candidate.symbol,
                status: 'active',
                entryTimestamp: Date.now(),
                entryApy: candidate.apy,
                entryRewardApy: candidate.apyReward || 0,
                entryTvl: candidate.tvlUsd,
                entryRiskScore: candidate.riskScore,
                isNew: candidate.isNew || false,
                detectionReason: candidate.detectionReason || 'Standard criteria',
            });
            newPositionsCount++;
        }
    }

    if (newPositionsCount === 0) {
        logger.info('All top candidates are already in the active portfolio.');
    } else {
        logger.info(`✅ Added ${newPositionsCount} new positions to portfolio.`);
    }
};

const workflowLoop = async () => {
    logger.info(`--- Running Workflow Cycle at ${new Date().toLocaleString()} ---`);

    const portfolio = loadJsonFile(PORTFOLIO_FILE, { active: [], exited: [] });
    const watchlist = loadJsonFile(WATCHLIST_FILE, []);

    checkForExits(portfolio);
    await updateWatchlist(watchlist);
    await investFromWatchlist(portfolio, watchlist);

    saveJsonFile(PORTFOLIO_FILE, portfolio);
    saveJsonFile(WATCHLIST_FILE, watchlist); // Save the updated watchlist

    logger.info(`--- Cycle Complete. Active: ${portfolio.active.length}, Exited: ${portfolio.exited.length}, Watchlist: ${watchlist.length} ---`);
};

// --- Main Execution ---
logger.info('Starting Workflow Manager.');
logger.info(`Manager will run every ${RUN_INTERVAL_MS / 1000 / 60} minutes.`);
logger.info(`Positions will be held for ${HOLD_DURATION_MS / 1000 / 60 / 60} hours.`);
logger.info(`Pools will be validated after being on the watchlist for ${MIN_WATCHLIST_AGE_MS / 1000 / 60} minutes.`);

workflowLoop();
setInterval(workflowLoop, RUN_INTERVAL_MS);
