#!/usr/bin/env node

/**
 * ===================================================================================
 * Yield Analysis CLI Tool (yield-analysis.js)
 * ===================================================================================
 *
 * Description:
 * Command-line tool to analyze farming yields and calculate returns
 * with the $1000 per pool investment simulation.
 *
 * ===================================================================================
 */

import { dbService } from './services/database.js';
import yieldCalculator from './yield-calculator.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatCurrency(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(percent) {
  const color = percent >= 0 ? 'green' : 'red';
  return colorize(`${percent.toFixed(2)}%`, color);
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(` ${title} `, 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

function printSection(title) {
  console.log('\n' + colorize(`📊 ${title}`, 'yellow'));
  console.log(colorize('-'.repeat(40), 'yellow'));
}

async function showPortfolioSummary() {
  try {
    const positions = await dbService.getAllPositions();
    const analytics = await yieldCalculator.generateYieldAnalytics(positions);
    
    printHeader('PORTFOLIO YIELD SUMMARY');
    
    // Overall Performance
    printSection('Overall Performance');
    console.log(`${colorize('Total Invested:', 'white')} ${formatCurrency(analytics.overall.totalInvested)}`);
    console.log(`${colorize('Current Value:', 'white')} ${formatCurrency(analytics.overall.totalCurrentValue)}`);
    console.log(`${colorize('Net P&L:', 'white')} ${formatCurrency(analytics.overall.totalReturns)} (${formatPercent(analytics.overall.portfolioReturnPercentage)})`);
    console.log(`${colorize('Win Rate:', 'white')} ${formatPercent(analytics.overall.winRate)} (${analytics.overall.profitablePositions}/${analytics.overall.totalPositions} positions)`);
    console.log(`${colorize('Avg Hold Time:', 'white')} ${analytics.overall.averageHoldDays.toFixed(1)} days`);
    
    // Active vs Exited
    printSection('Active vs Exited Breakdown');
    console.log(`${colorize('Active Positions:', 'blue')} ${analytics.active.totalPositions} positions, ${formatCurrency(analytics.active.totalCurrentValue)} value`);
    console.log(`${colorize('Exited Positions:', 'magenta')} ${analytics.exited.totalPositions} positions, ${formatCurrency(analytics.exited.totalReturns)} P&L`);
    
    // Best and Worst Performers
    if (analytics.bestPerformer) {
      printSection('Best Performer');
      const best = analytics.bestPerformer;
      console.log(`${colorize('Pool:', 'white')} ${best.symbol} (${best.project})`);
      console.log(`${colorize('Return:', 'white')} ${formatCurrency(best.yieldData.totalReturn)} (${formatPercent(best.yieldData.returnPercentage)})`);
      console.log(`${colorize('APY:', 'white')} ${best.entryApy.toFixed(2)}% → ${(best.yieldData.exitApy || best.entryApy).toFixed(2)}%`);
      console.log(`${colorize('Hold Time:', 'white')} ${best.yieldData.holdDays.toFixed(1)} days`);
    }
    
    if (analytics.worstPerformer && analytics.overall.totalPositions > 1) {
      printSection('Worst Performer');
      const worst = analytics.worstPerformer;
      console.log(`${colorize('Pool:', 'white')} ${worst.symbol} (${worst.project})`);
      console.log(`${colorize('Return:', 'white')} ${formatCurrency(worst.yieldData.totalReturn)} (${formatPercent(worst.yieldData.returnPercentage)})`);
      console.log(`${colorize('APY:', 'white')} ${worst.entryApy.toFixed(2)}% → ${(worst.yieldData.exitApy || worst.entryApy).toFixed(2)}%`);
      console.log(`${colorize('Hold Time:', 'white')} ${worst.yieldData.holdDays.toFixed(1)} days`);
    }
    
    // Monthly Performance
    printSection('Monthly Performance');
    Object.entries(analytics.monthlyPerformance).forEach(([month, data]) => {
      const returnPct = data.invested > 0 ? (data.returns / data.invested) * 100 : 0;
      console.log(`${colorize(month + ':', 'white')} ${data.positions} pos, ${formatCurrency(data.returns)} (${formatPercent(returnPct)})`);
    });
    
    return analytics;
    
  } catch (error) {
    console.error(colorize(`Error analyzing portfolio: ${error.message}`, 'red'));
    throw error;
  }
}

async function showActivePositions() {
  try {
    const activePositions = await dbService.getActivePositions();
    
    if (activePositions.length === 0) {
      console.log(colorize('\nNo active positions to analyze.', 'yellow'));
      return;
    }
    
    printHeader('ACTIVE POSITIONS ANALYSIS');
    
    for (const position of activePositions) {
      const yieldData = yieldCalculator.calculateYield(position);
      
      printSection(`${position.symbol} (${position.project})`);
      console.log(`${colorize('Pool ID:', 'white')} ${position.poolId}`);
      console.log(`${colorize('Entry Date:', 'white')} ${new Date(position.entryTimestamp).toLocaleDateString()}`);
      console.log(`${colorize('Entry APY:', 'white')} ${position.entryApy.toFixed(2)}%`);
      console.log(`${colorize('Hold Time:', 'white')} ${yieldData.holdDays.toFixed(1)} days`);
      console.log(`${colorize('Principal:', 'white')} ${formatCurrency(yieldData.principal)}`);
      console.log(`${colorize('Current Value:', 'white')} ${formatCurrency(yieldData.finalAmount)}`);
      console.log(`${colorize('Unrealized P&L:', 'white')} ${formatCurrency(yieldData.totalReturn)} (${formatPercent(yieldData.returnPercentage)})`);
      console.log(`${colorize('Daily Return:', 'white')} ${formatPercent(yieldData.dailyReturn)} per day`);
      console.log(`${colorize('Risk Score:', 'white')} ${position.entryRiskScore || 'N/A'}/10`);
      console.log(`${colorize('New Pool:', 'white')} ${position.isNew ? colorize('Yes', 'green') : 'No'}`);
    }
    
  } catch (error) {
    console.error(colorize(`Error analyzing active positions: ${error.message}`, 'red'));
  }
}

async function showProjections() {
  try {
    const activePositions = await dbService.getActivePositions();
    
    if (activePositions.length === 0) {
      console.log(colorize('\nNo active positions for projections.', 'yellow'));
      return;
    }
    
    printHeader('YIELD PROJECTIONS');
    
    const projectionPeriods = [7, 30, 90];
    
    for (const days of projectionPeriods) {
      const projections = await yieldCalculator.projectFutureYields(activePositions, days);
      
      printSection(`${days}-Day Projection`);
      console.log(`${colorize('Current Portfolio Value:', 'white')} ${formatCurrency(projections.totalCurrentValue)}`);
      console.log(`${colorize('Projected Value:', 'white')} ${formatCurrency(projections.totalProjectedValue)}`);
      console.log(`${colorize('Additional Return:', 'white')} ${formatCurrency(projections.totalAdditionalReturn)}`);
      console.log(`${colorize('Avg Daily Return:', 'white')} ${formatCurrency(projections.averageProjectedDailyReturn)}`);
    }
    
  } catch (error) {
    console.error(colorize(`Error generating projections: ${error.message}`, 'red'));
  }
}

async function main() {
  try {
    await dbService.connect();
    
    console.log(colorize('\n🚀 WildNet Yield Farming Analysis', 'bright'));
    console.log(colorize('Investment Simulation: $1000 per pool\n', 'cyan'));
    
    // Check if we have any data
    const positions = await dbService.getAllPositions();
    if (positions.length === 0) {
      console.log(colorize('No positions found. Run the workflow manager to start farming!', 'yellow'));
      return;
    }
    
    await showPortfolioSummary();
    await showActivePositions();
    await showProjections();
    
    console.log('\n' + colorize('Analysis complete! 🎉', 'green'));
    console.log(colorize('💡 Tip: Run this analysis regularly to track your farming performance.', 'cyan'));
    
  } catch (error) {
    console.error(colorize(`\n❌ Analysis failed: ${error.message}`, 'red'));
    process.exit(1);
  } finally {
    await dbService.disconnect();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colorize('WildNet Yield Analysis Tool', 'bright')}

Usage: node yield-analysis.js [options]

Options:
  --help, -h     Show this help message
  --summary, -s  Show only portfolio summary
  --active, -a   Show only active positions
  --proj, -p     Show only projections

Examples:
  node yield-analysis.js              # Full analysis
  node yield-analysis.js --summary    # Portfolio summary only
  node yield-analysis.js --active     # Active positions only
  `);
  process.exit(0);
}

if (args.includes('--summary') || args.includes('-s')) {
  dbService.connect()
    .then(() => showPortfolioSummary())
    .then(() => dbService.disconnect())
    .catch(console.error);
} else if (args.includes('--active') || args.includes('-a')) {
  dbService.connect()
    .then(() => showActivePositions())
    .then(() => dbService.disconnect())
    .catch(console.error);
} else if (args.includes('--proj') || args.includes('-p')) {
  dbService.connect()
    .then(() => showProjections())
    .then(() => dbService.disconnect())
    .catch(console.error);
} else {
  main();
}
