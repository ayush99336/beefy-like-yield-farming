/**
 * ===================================================================================
 * Yield Calculator & Investment Simulator (yield-calculator.js)
 * ===================================================================================
 *
 * Description:
 * Calculates farming yields and simulates investment returns with a principal of $1000
 * per pool. Tracks entry/exit APYs and computes actual returns based on hold duration.
 *
 * ===================================================================================
 */

import logger from './logger.js';
import { fetchPoolById } from './functional_strategy.js';
import { YIELD_CONFIG } from './config.js';

// --- Configuration from unified config ---
export const PRINCIPAL_USD = YIELD_CONFIG.principalUsd;          // $1000 per pool
export const DAILY_COMPOUND_RATE = YIELD_CONFIG.dailyCompoundRate; // 365 for daily compounding

/**
 * Calculates yield for a position based on entry/exit APY and hold duration
 * @param {Object} position - Position object with entry data
 * @param {Object} exitData - Exit data including current APY
 * @returns {Object} Yield calculation results
 */
export function calculateYield(position, exitData = null) {
  const entryTime = new Date(position.entryTimestamp);
  const exitTime = exitData ? new Date(exitData.timestamp) : new Date();
  const holdDays = (exitTime - entryTime) / (1000 * 60 * 60 * 24);
  
  // Use exit APY if provided, otherwise use entry APY
  const avgApy = exitData ? (position.entryApy + exitData.exitApy) / 2 : position.entryApy;
  
  // Calculate compound interest: A = P(1 + r/n)^(nt)
  // Where: P = principal, r = APY/100, n = compounding frequency, t = time in years
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
    exitApy: exitData?.exitApy || position.entryApy,
    avgApy,
    holdDays: Math.round(holdDays * 100) / 100,
    timeInYears: Math.round(timeInYears * 10000) / 10000,
    finalAmount: Math.round(finalAmount * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    returnPercentage: Math.round(returnPercentage * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    dailyReturn: Math.round(dailyReturn * 10000) / 10000,
    isProfit: totalReturn > 0
  };
}

/**
 * Calculates yield for multiple positions (portfolio analysis)
 * @param {Array} positions - Array of position objects
 * @returns {Object} Portfolio yield analysis
 */
export async function calculatePortfolioYield(positions) {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalReturns = 0;
  const positionYields = [];
  
  for (const position of positions) {
    let yieldData;
    
    if (position.status === 'active') {
      // For active positions, fetch current APY
      const currentPool = await fetchPoolById(position.poolId);
      const exitData = currentPool ? {
        timestamp: new Date(),
        exitApy: currentPool.apy
      } : null;
      
      yieldData = calculateYield(position, exitData);
    } else {
      // For exited positions, use stored exit data
      yieldData = calculateYield(position, {
        timestamp: position.exitTimestamp,
        exitApy: position.exitApy || position.entryApy
      });
    }
    
    totalInvested += yieldData.principal;
    totalCurrentValue += yieldData.finalAmount;
    totalReturns += yieldData.totalReturn;
    
    positionYields.push({
      ...position,
      yieldData
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
}

/**
 * Simulates investment returns for a specific timeframe
 * @param {Object} pool - Pool data with APY
 * @param {number} daysToHold - Number of days to simulate
 * @param {number} customPrincipal - Custom investment amount (optional)
 * @returns {Object} Simulation results
 */
export function simulateInvestment(pool, daysToHold, customPrincipal = PRINCIPAL_USD) {
  const principal = customPrincipal;
  const annualRate = pool.apy / 100;
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
    poolId: pool.pool,
    symbol: pool.symbol,
    project: pool.project,
    apy: pool.apy,
    principal,
    daysToHold,
    finalAmount: Math.round(finalAmount * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    returnPercentage: Math.round(returnPercentage * 100) / 100,
    dailyReturn: Math.round(dailyReturn * 10000) / 10000,
    annualizedReturn: returnPercentage / timeInYears
  };
}

/**
 * Calculates risk-adjusted returns (Sharpe-like ratio)
 * @param {Object} yieldData - Yield calculation results
 * @param {number} riskScore - Risk score from 0-10
 * @returns {Object} Risk-adjusted metrics
 */
export function calculateRiskAdjustedReturns(yieldData, riskScore) {
  // Convert risk score to a risk factor (higher risk = higher factor)
  const riskFactor = 1 + (riskScore / 10);
  const riskAdjustedReturn = yieldData.returnPercentage / riskFactor;
  const riskAdjustedDaily = yieldData.dailyReturn / riskFactor;
  
  return {
    ...yieldData,
    riskScore,
    riskFactor: Math.round(riskFactor * 100) / 100,
    riskAdjustedReturn: Math.round(riskAdjustedReturn * 100) / 100,
    riskAdjustedDaily: Math.round(riskAdjustedDaily * 10000) / 10000,
    efficiency: Math.round((yieldData.returnPercentage / Math.max(riskScore, 1)) * 100) / 100
  };
}

/**
 * Generates yield analytics for dashboard
 * @param {Array} positions - All positions
 * @returns {Object} Analytics data
 */
export async function generateYieldAnalytics(positions) {
  try {
    logger.info(' Generating yield analytics...');
    
    const portfolioYield = await calculatePortfolioYield(positions);
    
    // Separate active and exited positions
    const activePositions = positions.filter(p => p.status === 'active');
    const exitedPositions = positions.filter(p => p.status === 'exited');
    
    // Calculate analytics for each category
    const activeYield = activePositions.length > 0 
      ? await calculatePortfolioYield(activePositions) 
      : { totalInvested: 0, totalCurrentValue: 0, totalReturns: 0 };
      
    const exitedYield = exitedPositions.length > 0 
      ? await calculatePortfolioYield(exitedPositions) 
      : { totalInvested: 0, totalCurrentValue: 0, totalReturns: 0 };
    
    // Best and worst performing positions
    const sortedPositions = portfolioYield.positionYields.sort(
      (a, b) => b.yieldData.returnPercentage - a.yieldData.returnPercentage
    );
    
    const bestPerformer = sortedPositions[0] || null;
    const worstPerformer = sortedPositions[sortedPositions.length - 1] || null;
    
    // Monthly performance breakdown
    const now = new Date();
    const monthlyPerformance = {};
    
    portfolioYield.positionYields.forEach(p => {
      const entryDate = new Date(p.entryTimestamp);
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyPerformance[monthKey]) {
        monthlyPerformance[monthKey] = {
          invested: 0,
          returns: 0,
          positions: 0
        };
      }
      
      monthlyPerformance[monthKey].invested += p.yieldData.principal;
      monthlyPerformance[monthKey].returns += p.yieldData.totalReturn;
      monthlyPerformance[monthKey].positions += 1;
    });
    
    return {
      overall: portfolioYield,
      active: activeYield,
      exited: exitedYield,
      bestPerformer,
      worstPerformer,
      monthlyPerformance,
      analytics: {
        totalPrincipal: PRINCIPAL_USD,
        averageAPY: positions.length > 0 
          ? positions.reduce((sum, p) => sum + p.entryApy, 0) / positions.length 
          : 0,
        totalDaysInvested: portfolioYield.positionYields.reduce(
          (sum, p) => sum + p.yieldData.holdDays, 0
        ),
        projectedAnnualReturn: portfolioYield.portfolioReturnPercentage * (365 / (portfolioYield.averageHoldDays || 1))
      }
    };
    
  } catch (error) {
    logger.error(`Error generating yield analytics: ${error.message}`);
    throw error;
  }
}

/**
 * Simulates future yields based on current active positions
 * @param {Array} activePositions - Active positions
 * @param {number} projectionDays - Days to project into future
 * @returns {Object} Projection results
 */
export async function projectFutureYields(activePositions, projectionDays = 30) {
  try {
    const projections = [];
    let totalProjectedReturn = 0;
    
    for (const position of activePositions) {
      const currentPool = await fetchPoolById(position.poolId);
      if (!currentPool) continue;
      
      // Current yield calculation
      const currentYield = calculateYield(position, {
        timestamp: new Date(),
        exitApy: currentPool.apy
      });
      
      // Project future yield if held for additional days
      const futureExitDate = new Date();
      futureExitDate.setDate(futureExitDate.getDate() + projectionDays);
      
      const projectedYield = calculateYield(position, {
        timestamp: futureExitDate,
        exitApy: currentPool.apy // Assuming APY stays constant
      });
      
      const additionalReturn = projectedYield.totalReturn - currentYield.totalReturn;
      totalProjectedReturn += additionalReturn;
      
      projections.push({
        ...position,
        currentYield,
        projectedYield,
        additionalReturn: Math.round(additionalReturn * 100) / 100,
        projectedAPY: currentPool.apy
      });
    }
    
    return {
      projectionDays,
      positions: projections,
      totalCurrentValue: projections.reduce((sum, p) => sum + p.currentYield.finalAmount, 0),
      totalProjectedValue: projections.reduce((sum, p) => sum + p.projectedYield.finalAmount, 0),
      totalAdditionalReturn: Math.round(totalProjectedReturn * 100) / 100,
      averageProjectedDailyReturn: projections.length > 0 
        ? totalProjectedReturn / (projections.length * projectionDays) 
        : 0
    };
    
  } catch (error) {
    logger.error(`Error projecting future yields: ${error.message}`);
    throw error;
  }
}

export default {
  calculateYield,
  calculatePortfolioYield,
  simulateInvestment,
  calculateRiskAdjustedReturns,
  generateYieldAnalytics,
  projectFutureYields,
  PRINCIPAL_USD
};
