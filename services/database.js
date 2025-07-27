import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export class DatabaseService {
  
  constructor() {
    this.prisma = prisma;
  }

  // =================== CONNECTION MANAGEMENT ===================
  
  async connect() {
    try {
      await this.prisma.$connect();
      console.log(' Database connected successfully');
    } catch (error) {
      console.error(' Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  // =================== DETECTION CYCLES ===================
  
  async startDetectionCycle() {
    try {
      const cycle = await this.prisma.detectionCycle.create({
        data: {
          totalPoolsFound: 0,
          newPoolsFound: 0,
          activePositions: 0,
          watchlistSize: 0
        }
      });
      return cycle;
    } catch (error) {
      console.error('Error creating detection cycle:', error);
      throw error;
    }
  }
  
  async updateCycleStats(cycleId, stats) {
    try {
      const cycle = await this.prisma.detectionCycle.update({
        where: { id: cycleId },
        data: {
          totalPoolsFound: stats.totalPoolsFound,
          newPoolsFound: stats.newPoolsFound,
          activePositions: stats.activePositions,
          watchlistSize: stats.watchlistSize
        }
      });
      return cycle;
    } catch (error) {
      console.error('Error updating cycle stats:', error);
      throw error;
    }
  }

  async getRecentCycles(limit = 20) {
    return await this.prisma.detectionCycle.findMany({
      orderBy: { cycleTimestamp: 'desc' },
      take: limit,
      include: {
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 5
        },
        positions: {
          take: 10
        }
      }
    });
  }

  // =================== POSITIONS ===================
  
  async getActivePositions() {
    return await this.prisma.position.findMany({
      where: { status: 'active' },
      orderBy: { entryTimestamp: 'desc' },
      include: { detectionCycle: true }
    });
  }
  
  async addPosition(cycleId, position) {
    try {
      const newPosition = await this.prisma.position.create({
        data: {
          poolId: position.poolId,
          symbol: position.symbol,
          project: position.project,
          entryApy: position.entryApy,
          entryRewardApy: position.entryRewardApy || null,
          entryTvl: position.entryTvl || null,
          entryRiskScore: position.entryRisk || null,
          isNew: position.isNew || false,
          detectionReason: position.detectionReason || 'Standard criteria',
          cycleId: cycleId
        }
      });
      return newPosition;
    } catch (error) {
      console.error('Error adding position:', error);
      throw error;
    }
  }
  
  async exitPosition(poolId, exitData) {
    try {
      const position = await this.prisma.position.updateMany({
        where: { 
          poolId: poolId,
          status: 'active'
        },
        data: {
          status: 'exited',
          exitTimestamp: new Date(),
          exitReason: exitData.reason,
          exitApy: exitData.exitApy || null,
          profitLoss: exitData.profitLoss || 0
        }
      });
      return position;
    } catch (error) {
      console.error('Error exiting position:', error);
      throw error;
    }
  }

  async getExitedPositions(limit = 50) {
    return await this.prisma.position.findMany({
      where: { status: 'exited' },
      orderBy: { exitTimestamp: 'desc' },
      take: limit,
      include: { detectionCycle: true }
    });
  }
  
  async getAllPositions() {
    return await this.prisma.position.findMany({
      orderBy: { entryTimestamp: 'desc' },
      include: { detectionCycle: true }
    });
  }

  async getPositionByPoolId(poolId) {
    return await this.prisma.position.findFirst({
      where: { 
        poolId,
        status: 'active'
      }
    });
  }

  // =================== WATCHLIST ===================
  
  async getWatchlist() {
    return await this.prisma.watchlistPool.findMany({
      where: { status: 'watching' },
      orderBy: { firstSeen: 'desc' }
    });
  }
  
  async addToWatchlist(pool) {
    try {
      const watchlistPool = await this.prisma.watchlistPool.upsert({
        where: { poolId: pool.poolId },
        update: {
          lastChecked: new Date()
        },
        create: {
          poolId: pool.poolId,
          symbol: pool.symbol,
          project: pool.project,
          isNew: pool.isNew || false
        }
      });
      return watchlistPool;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }
  
  async updateWatchlistStatus(poolId, status) {
    try {
      const pool = await this.prisma.watchlistPool.update({
        where: { poolId },
        data: { 
          status,
          lastChecked: new Date()
        }
      });
      return pool;
    } catch (error) {
      console.error('Error updating watchlist status:', error);
      throw error;
    }
  }

  async cleanOldWatchlistEntries(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const deleted = await this.prisma.watchlistPool.deleteMany({
      where: {
        firstSeen: {
          lt: cutoffDate
        },
        status: 'watching'
      }
    });
    
    return deleted.count;
  }

  // =================== LOGS ===================
  
  async addLog(cycleId, level, message, details = null) {
    try {
      const log = await this.prisma.log.create({
        data: {
          level,
          message,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
          cycleId
        }
      });
      return log;
    } catch (error) {
      console.error('Error adding log:', error);
      throw error;
    }
  }
  
  async getLogs(limit = 100, level = null) {
    const where = level ? { level } : {};
    
    return await this.prisma.log.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { cycle: true }
    });
  }

  // =================== ANALYTICS & METRICS ===================
  
  async getYieldMetrics() {
    try {
      const [
        totalPositions,
        activePositions,
        exitedPositions,
        yieldAggregates
      ] = await Promise.all([
        this.prisma.position.count(),
        this.prisma.position.findMany({ where: { status: 'active' } }),
        this.prisma.position.findMany({ where: { status: 'exited' } }),
        this.prisma.position.aggregate({
          _avg: {
            entryApy: true,
            exitApy: true,
            profitLoss: true
          },
          _sum: {
            profitLoss: true
          }
        })
      ]);

      return {
        totalPositions,
        activeCount: activePositions.length,
        exitedCount: exitedPositions.length,
        averageEntryApy: yieldAggregates._avg.entryApy || 0,
        averageExitApy: yieldAggregates._avg.exitApy || 0,
        averageProfitLoss: yieldAggregates._avg.profitLoss || 0,
        totalProfitLoss: yieldAggregates._sum.profitLoss || 0,
        activePositions,
        exitedPositions
      };
    } catch (error) {
      console.error('Error getting yield metrics:', error);
      throw error;
    }
  }

  async getPerformanceMetrics() {
    try {
      const [
        totalPositions,
        activePositions,
        completedPositions,
        averageMetrics,
        newPoolsData,
        totalWatchlist
      ] = await Promise.all([
        this.prisma.position.count(),
        this.prisma.position.count({ where: { status: 'active' } }),
        this.prisma.position.count({ where: { status: 'exited' } }),
        this.prisma.position.aggregate({
          _avg: {
            entryApy: true,
            profitLoss: true
          }
        }),
        this.prisma.position.findMany({
          where: { isNew: true },
          select: { id: true }
        }),
        this.prisma.watchlistPool.count()
      ]);

      // Calculate average hold time in hours for completed positions
      const completedWithTimes = await this.prisma.position.findMany({
        where: { 
          status: 'exited',
          exitTimestamp: { not: null }
        },
        select: {
          entryTimestamp: true,
          exitTimestamp: true
        }
      });

      const avgHoldHours = completedWithTimes.length > 0 
        ? completedWithTimes.reduce((sum, pos) => {
            const holdTime = pos.exitTimestamp.getTime() - pos.entryTimestamp.getTime();
            return sum + (holdTime / (1000 * 60 * 60));
          }, 0) / completedWithTimes.length
        : 0;

      return {
        totalPositions,
        activePositions,
        completedPositions,
        averageEntryApy: averageMetrics._avg.entryApy || 0,
        averageProfitLoss: averageMetrics._avg.profitLoss || 0,
        avgHoldHours,
        newPoolsPercentage: totalPositions > 0 ? (newPoolsData.length / totalPositions) * 100 : 0,
        totalWatchlist
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }
  
  async getDashboardData() {
    try {
      const [activePositions, recentExits, recentLogs, metrics, recentCycles] = await Promise.all([
        this.getActivePositions(),
        this.getExitedPositions(10),
        this.getLogs(20),
        this.getPerformanceMetrics(),
        this.getRecentCycles(5)
      ]);
      
      return {
        activePositions,
        recentExits,
        recentLogs,
        metrics,
        recentCycles
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // =================== HEALTH CHECK ===================
  
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
