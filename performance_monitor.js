/**
 * ===================================================================================
 * Bot Performance Monitor
 * ===================================================================================
 * 
 * This script analyzes the bot's performance by reading the portfolio and activity logs.
 * Run this to verify your bot is working and solving the problem statement.
 */

import fs from 'fs';
import logger from './logger.js';

const PORTFOLIO_FILE = 'active_portfolio.json';
const WATCHLIST_FILE = 'watchlist.json';
const LOG_FILE = 'bot_activity.log';

/**
 * Analyzes the current state of the bot and provides a performance report
 */
function analyzePerformance() {
    console.log('\n=== BOT PERFORMANCE ANALYSIS ===\n');
    

    const filesExist = checkRequiredFiles();
    if (!filesExist) return;
    

    const portfolio = analyzePortfolio();

    const watchlist = analyzeWatchlist();
    

    analyzeRecentActivity();
    
    provideRecommendations(portfolio, watchlist);
}

function checkRequiredFiles() {
    const requiredFiles = [PORTFOLIO_FILE, WATCHLIST_FILE, LOG_FILE];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
        console.log('❌ PROBLEM: Missing required files:', missingFiles.join(', '));
        console.log('💡 SOLUTION: Run the bot first with: node workflow_manager.js');
        return false;
    }
    
    console.log('✅ All required files exist');
    return true;
}

function analyzePortfolio() {
    try {
        const portfolio = JSON.parse(fs.readFileSync(PORTFOLIO_FILE));
        
        console.log('📊 PORTFOLIO STATUS:');
        console.log(`   Active Positions: ${portfolio.active?.length || 0}`);
        console.log(`   Exited Positions: ${portfolio.exited?.length || 0}`);
        
        if (portfolio.active?.length > 0) {
            console.log('\n🎯 ACTIVE INVESTMENTS:');
            portfolio.active.forEach((pos, i) => {
                const ageHours = ((Date.now() - pos.entryTimestamp) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   ${i+1}. ${pos.symbol} (APY: ${pos.entryApy?.toFixed(2)}%, Age: ${ageHours}h, Risk: ${pos.entryRiskScore})`);
            });
        }
        
        if (portfolio.exited?.length > 0) {
            console.log('\n📈 COMPLETED TRADES:');
            portfolio.exited.slice(-5).forEach((pos, i) => {
                const holdTimeHours = ((pos.exitTimestamp - pos.entryTimestamp) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   ${i+1}. ${pos.symbol} (Held: ${holdTimeHours}h, Entry APY: ${pos.entryApy?.toFixed(2)}%)`);
            });
        }
        
        return portfolio;
    } catch (error) {
        console.log('❌ Error reading portfolio:', error.message);
        return null;
    }
}

function analyzeWatchlist() {
    try {
        const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE));
        
        console.log(`\n👀 WATCHLIST STATUS: ${watchlist.length} pools being monitored`);
        
        if (watchlist.length > 0) {
            const now = Date.now();
            const mature = watchlist.filter(p => (now - p.firstSeenAt) >= (30 * 60 * 1000));
            const pending = watchlist.length - mature.length;
            
            console.log(`   Mature (ready for investment): ${mature.length}`);
            console.log(`   Pending (waiting for validation): ${pending}`);
            
            if (mature.length > 0) {
                console.log('\n🔍 TOP MATURE POOLS:');
                mature.slice(0, 3).forEach((pool, i) => {
                    const ageMinutes = ((now - pool.firstSeenAt) / (1000 * 60)).toFixed(0);
                    console.log(`   ${i+1}. ${pool.symbol || pool.name} (Age: ${ageMinutes} mins)`);
                });
            }
        }
        
        return watchlist;
    } catch (error) {
        console.log('❌ Error reading watchlist:', error.message);
        return [];
    }
}

function analyzeRecentActivity() {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            console.log('\n📝 No activity log found');
            return;
        }
        
        const logs = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = logs.split('\n').filter(line => line.trim());
        const recentLines = lines.slice(-20); // Last 20 log entries
        
        console.log('\n📝 RECENT ACTIVITY (last 20 entries):');
        recentLines.forEach(line => {
            if (line.includes('Workflow Cycle') || 
                line.includes('Entering new') || 
                line.includes('Exiting position') ||
                line.includes('Added') && line.includes('watchlist')) {
                console.log(`   ${line}`);
            }
        });
        
        // Check if bot is actively running
        const lastLogTime = recentLines.length > 0 ? 
            new Date(recentLines[recentLines.length - 1].match(/\[(.*?)\]/)?.[1]).getTime() : 0;
        const timeSinceLastLog = (Date.now() - lastLogTime) / (1000 * 60); // minutes
        
        if (timeSinceLastLog > 35) { // More than 35 minutes (bot runs every 30)
            console.log(`\n⚠️  WARNING: No recent activity (${timeSinceLastLog.toFixed(0)} minutes ago)`);
            console.log('   The bot might not be running. Check if workflow_manager.js is active.');
        } else {
            console.log(`\n✅ Bot is active (last activity: ${timeSinceLastLog.toFixed(0)} minutes ago)`);
        }
        
    } catch (error) {
        console.log('❌ Error reading activity log:', error.message);
    }
}

function provideRecommendations(portfolio, watchlist) {
    console.log('\n💡 RECOMMENDATIONS:');
    
    // Check if the system is working as expected
    const hasActivity = portfolio?.active?.length > 0 || portfolio?.exited?.length > 0;
    const hasWatchlist = watchlist?.length > 0;
    
    if (!hasActivity && !hasWatchlist) {
        console.log('   🚨 No investment activity detected. This could mean:');
        console.log('      - The bot just started (normal for first few cycles)');
        console.log('      - No pools meeting criteria were found');
        console.log('      - API issues preventing pool detection');
        console.log('   ✅ Let the bot run for 1-2 hours to see initial results');
    } else if (hasWatchlist && !hasActivity) {
        console.log('   ⏳ Bot is detecting pools but hasn\'t invested yet. This is normal because:');
        console.log('      - New pools need 30 minutes on watchlist before investment');
        console.log('      - Pools must meet strict criteria (APY > 30%, incentive-driven)');
        console.log('   ✅ Wait for pools to mature on the watchlist');
    } else if (hasActivity) {
        console.log('   🎉 SUCCESS! Your bot is actively managing investments');
        console.log('   ✅ The system is detecting, analyzing, and investing in pools');
        console.log('   ✅ Portfolio management is working (entries and exits)');
        
        if (portfolio.exited?.length > 0) {
            console.log('   📊 You have completed trades to analyze for profitability');
        }
    }
    
    console.log('TO VERIFY THE BOT IS SOLVING YOUR PROBLEM:');
    console.log('   1. Check that new pools are being added to watchlist regularly');
    console.log('   2. Verify investments are made in incentive-driven pools (high reward APY)');
    console.log('   3. Confirm positions are held for exactly 48 hours');
    console.log('   4. Monitor bot_activity.log for detailed operation logs');
    console.log('   5. Run this monitor script periodically: node performance_monitor.js');
}

// Run the analysis
analyzePerformance();
