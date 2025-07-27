/**
 * Data Migration Script - JSON to PostgreSQL
 * Migrates existing portfolio and watchlist data from JSON files to database
 */

import fs from 'fs';
import { dbService } from './services/database.js';
import logger from './logger.js';

async function migrateData() {
  logger.info('🔄 Starting data migration from JSON to PostgreSQL...');

  try {
    // Connect to database
    await dbService.connect();

    // Read existing JSON files
    let portfolioData = { active: [], exited: [] };
    let watchlistData = [];

    if (fs.existsSync('./active_portfolio.json')) {
      try {
        portfolioData = JSON.parse(fs.readFileSync('./active_portfolio.json', 'utf-8'));
        logger.info(`📁 Found portfolio data: ${portfolioData.active?.length || 0} active, ${portfolioData.exited?.length || 0} exited`);
      } catch (e) {
        logger.warn(`Could not read portfolio data: ${e.message}`);
      }
    }

    if (fs.existsSync('./watchlist.json')) {
      try {
        watchlistData = JSON.parse(fs.readFileSync('./watchlist.json', 'utf-8'));
        logger.info(`📁 Found watchlist data: ${watchlistData.length} entries`);
      } catch (e) {
        logger.warn(`Could not read watchlist data: ${e.message}`);
      }
    }

    // Create initial detection cycle for migration
    const cycle = await dbService.startDetectionCycle();
    await dbService.addLog(cycle.id, 'info', 'Starting data migration from JSON files');

    let migratedActive = 0;
    let migratedExited = 0;
    let migratedWatchlist = 0;

    // Migrate active positions
    if (portfolioData.active && portfolioData.active.length > 0) {
      logger.info('📈 Migrating active positions...');
      for (const pos of portfolioData.active) {
        try {
          await dbService.addPosition(cycle.id, {
            poolId: pos.poolId,
            symbol: pos.symbol,
            project: pos.project,
            entryApy: pos.entryApy,
            entryRewardApy: pos.entryRewardApy || null,
            entryTvl: pos.entryTvl || null,
            entryRisk: pos.entryRisk || pos.entryRiskScore || null,
            isNew: pos.isNew || false,
            detectionReason: pos.detectionReason || 'Migrated from JSON'
          });
          migratedActive++;
        } catch (error) {
          logger.warn(`Failed to migrate active position ${pos.symbol}: ${error.message}`);
        }
      }
    }

    // Migrate exited positions (create them as exited)
    if (portfolioData.exited && portfolioData.exited.length > 0) {
      logger.info('📉 Migrating exited positions...');
      for (const pos of portfolioData.exited) {
        try {
          // First create the position
          const newPos = await dbService.addPosition(cycle.id, {
            poolId: pos.poolId,
            symbol: pos.symbol,
            project: pos.project,
            entryApy: pos.entryApy,
            entryRewardApy: pos.entryRewardApy || null,
            entryTvl: pos.entryTvl || null,
            entryRisk: pos.entryRisk || pos.entryRiskScore || null,
            isNew: pos.isNew || false,
            detectionReason: pos.detectionReason || 'Migrated from JSON'
          });

          // Then exit it immediately
          await dbService.exitPosition(pos.poolId, {
            reason: pos.exitReason || 'migrated_exit',
            profitLoss: pos.profitLoss || 0
          });
          
          migratedExited++;
        } catch (error) {
          logger.warn(`Failed to migrate exited position ${pos.symbol}: ${error.message}`);
        }
      }
    }

    // Migrate watchlist
    if (watchlistData.length > 0) {
      logger.info('👀 Migrating watchlist...');
      for (const pool of watchlistData) {
        try {
          await dbService.addToWatchlist({
            poolId: pool.poolId,
            symbol: pool.symbol,
            project: pool.project,
            isNew: pool.isNew || false
          });
          migratedWatchlist++;
        } catch (error) {
          logger.warn(`Failed to migrate watchlist entry ${pool.symbol}: ${error.message}`);
        }
      }
    }

    // Update cycle stats
    await dbService.updateCycleStats(cycle.id, {
      totalPoolsFound: migratedWatchlist,
      newPoolsFound: 0,
      activePositions: migratedActive,
      watchlistSize: migratedWatchlist
    });

    // Create migration completion log
    await dbService.addLog(cycle.id, 'info', 'Data migration completed successfully', {
      migratedActive,
      migratedExited,
      migratedWatchlist,
      totalMigrated: migratedActive + migratedExited + migratedWatchlist
    });

    logger.info('✅ Data migration completed successfully!');
    logger.info(`📊 Migration Summary:`);
    logger.info(`   • Active Positions: ${migratedActive}`);
    logger.info(`   • Exited Positions: ${migratedExited}`);
    logger.info(`   • Watchlist Entries: ${migratedWatchlist}`);
    logger.info(`   • Total Migrated: ${migratedActive + migratedExited + migratedWatchlist}`);

    // Create backup of original files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (fs.existsSync('./active_portfolio.json')) {
      fs.copyFileSync('./active_portfolio.json', `./backup_portfolio_${timestamp}.json`);
      logger.info('📄 Created backup: backup_portfolio_' + timestamp + '.json');
    }
    if (fs.existsSync('./watchlist.json')) {
      fs.copyFileSync('./watchlist.json', `./backup_watchlist_${timestamp}.json`);
      logger.info('📄 Created backup: backup_watchlist_' + timestamp + '.json');
    }

  } catch (error) {
    logger.error(`❌ Migration failed: ${error.message}`);
    console.error(error);
  } finally {
    await dbService.disconnect();
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData().then(() => {
    logger.info('🎉 Migration script completed');
    process.exit(0);
  }).catch((error) => {
    logger.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}

export { migrateData };
