/**
 * ===================================================================================
 * Simulation Workflow Manager
 * ===================================================================================
 *
 * Description:
 * This script acts as the "brain" for the yield farming bot simulation. It runs
 * on a schedule, manages the state of the simulated portfolio, and decides when
 * to "enter" and "exit" positions based on predefined rules.
 *
 * ===================================================================================
 */

import fs from 'fs';
import logger from './logger.js';
import {
    fetchAllPools,
    selectIncentivePools,
    enrichPoolData,
    selectOptimalPools,
    saveJsonReport
} from './functional_strategy.js';
import { STRATEGY_CONFIG } from './config.js';

// --- Configuration ---
const PORTFOLIO_FILE = 'active_portfolio.json';
const INCENTIVE_POOLS_LOG_FILE = 'incentive_pools_latest.json';
const HOLD_DURATION_MS = 48 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 60 * 60 * 1000;

// --- State Management Functions ---
const loadPortfolio = () => {
    try {
        if (fs.existsSync(PORTFOLIO_FILE)) {
            const data = fs.readFileSync(PORTFOLIO_FILE);
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error(`Error loading portfolio file: ${error.message}`);
    }
    return { active: [], exited: [] };
};

const savePortfolio = (portfolio) => {
    try {
        fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2));
        logger.info(`Portfolio state saved to ${PORTFOLIO_FILE}`);
    } catch (error) {
        logger.error(`Error saving portfolio: ${error.message}`);
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
            position.exitApy = position.entryApy; // Placeholder
            portfolio.exited.push(position);
        } else {
            remainingActive.push(position);
        }
    });

    portfolio.active = remainingActive;
};

const findNewInvestment = async (portfolio) => {
    logger.info('Searching for new investment opportunities...');

    const allPools = await fetchAllPools();
    const candidatePools = selectIncentivePools(allPools, STRATEGY_CONFIG);

    // Log the top raw incentive pools found in this cycle
    saveJsonReport(INCENTIVE_POOLS_LOG_FILE, candidatePools.slice(0, 25));

    const enrichedPools = enrichPoolData(candidatePools);
    const optimalPools = selectOptimalPools(enrichedPools, STRATEGY_CONFIG);

    if (optimalPools.length === 0) {
        logger.info('No new optimal pools found that meet the criteria.');
        return;
    }

    const topCandidate = optimalPools[0];
    const isAlreadyInvested = portfolio.active.some(p => p.poolId === topCandidate.pool);

    if (isAlreadyInvested) {
        logger.info(`Top candidate ${topCandidate.symbol} is already in the active portfolio. Holding.`);
        return;
    }

    logger.info(`Entering new simulated position in ${topCandidate.symbol} with APY ${topCandidate.apy.toFixed(2)}%`);
    const newPosition = {
        poolId: topCandidate.pool,
        project: topCandidate.project,
        symbol: topCandidate.symbol,
        status: 'active',
        entryTimestamp: Date.now(),
        entryApy: topCandidate.apy,
        entryTvl: topCandidate.tvlUsd,
        entryRiskScore: topCandidate.riskScore,
    };
    portfolio.active.push(newPosition);
};

const workflowLoop = async () => {
    logger.info(`--- Running Workflow Cycle at ${new Date().toLocaleString()} ---`);
    const portfolio = loadPortfolio();
    checkForExits(portfolio);
    await findNewInvestment(portfolio);
    savePortfolio(portfolio);
    logger.info(`--- Cycle Complete. Active: ${portfolio.active.length}, Exited: ${portfolio.exited.length} ---`);
};

// --- Main Execution ---
logger.info('Starting Workflow Manager.');
logger.info(`Manager will run every ${RUN_INTERVAL_MS / 60 / 1000} minutes.`);
logger.info(`Positions will be held for ${HOLD_DURATION_MS / 60 / 60 / 1000} hours.`);

workflowLoop();
setInterval(workflowLoop, RUN_INTERVAL_MS);
