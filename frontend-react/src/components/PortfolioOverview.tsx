import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AccountBalance as PortfolioIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  AccessTime as TimeIcon,
  Visibility as WatchlistIcon,
  FiberNew as NewIcon
} from '@mui/icons-material';
import { formatCurrency, formatPercentage, formatTimeAgo, getRiskColor, getApyColor } from '../utils';
import { Position } from '../types';
import { apiService, yieldCalculator, priceService } from '../services';

// Component for individual position row with async yield calculation
const PositionRow: React.FC<{ position: Position }> = ({ position }) => {
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateYield = async () => {
      try {
        setLoading(true);
        const result = await yieldCalculator.simulatePosition(position);
        setSimulation(result);
      } catch (error) {
        console.warn(`Using fallback calculation for ${position.symbol}:`, error);
        const fallback = yieldCalculator.calculateYield(position);
        setSimulation(fallback);
      } finally {
        setLoading(false);
      }
    };

    calculateYield();
  }, [position]);

  const holdTime = formatTimeAgo(position.entryTimestamp);

  if (loading || !simulation) {
    return (
      <TableRow key={position.id}>
        <TableCell colSpan={7}>
          <Box display="flex" alignItems="center" justifyContent="center" py={1}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            <Typography variant="caption">Calculating with real prices...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow key={position.id} hover>
      <TableCell>
        <Typography variant="body2" fontWeight="bold">
          {position.symbol}
        </Typography>
        {position.isNew && (
          <Chip label="NEW" size="small" color="success" sx={{ ml: 1 }} />
        )}
        {position.detectionReason && (
          <Typography variant="caption" color="text.secondary" display="block">
            {position.detectionReason}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {position.project}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color={getApyColor(position.entryApy)}>
          {formatPercentage(position.entryApy)}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={position.entryRiskScore || 0}
          size="small"
          color={getRiskColor(position.entryRiskScore || 0) as any}
          variant="outlined"
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {holdTime}
        </Typography>
      </TableCell>
      <TableCell>
        <Box>
          <Typography 
            variant="body2" 
            color={simulation.totalReturn >= 0 ? 'success.main' : 'error.main'}
            fontWeight="bold"
          >
            {formatCurrency(simulation.totalReturn)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({formatPercentage(simulation.returnPercentage)})
          </Typography>
          {simulation.priceChange !== undefined && Math.abs(simulation.priceChange) > 0.01 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Farming: {formatCurrency(simulation.farmingRewards || 0)} | Price: {formatCurrency(simulation.priceChange)}
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          label={position.status}
          size="small"
          color="success"
          variant="filled"
        />
      </TableCell>
    </TableRow>
  );
};

interface PortfolioMetrics {
  totalValue: number;
  totalReturn: number;
  returnPercentage: number;
  winRate: number;
  activePositions: number;
  totalPositions: number;
  bestPerformer?: Position;
  worstPerformer?: Position;
}

interface WatchlistStats {
  totalPools: number;
  newPools: number;
  recentDiscoveries: any[];
}

const PortfolioOverview: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [watchlistStats, setWatchlistStats] = useState<WatchlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [allPositions, activePositions, watchlist] = await Promise.all([
        apiService.getPositions(),
        apiService.getActivePositions(),
        apiService.getWatchlist()
      ]);

      setPositions(allPositions);
      
      // Calculate watchlist stats
      const newPools = watchlist.filter(pool => pool.isNew).length;
      const recentDiscoveries = watchlist
        .filter(pool => pool.isNew)
        .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime())
        .slice(0, 3);
      
      setWatchlistStats({
        totalPools: watchlist.length,
        newPools,
        recentDiscoveries
      });
      
      // Calculate metrics with real prices
      const totalValue = await activePositions.reduce(async (sumPromise, pos) => {
        const sum = await sumPromise;
        try {
          const simulation = await yieldCalculator.simulatePosition(pos);
          return sum + simulation.currentValue;
        } catch (error) {
          console.warn(`Error calculating value for ${pos.symbol}:`, error);
          const fallbackSim = yieldCalculator.calculateYield(pos);
          return sum + fallbackSim.currentValue;
        }
      }, Promise.resolve(0));

      const totalReturn = await allPositions.reduce(async (sumPromise, pos) => {
        const sum = await sumPromise;
        if (pos.profitLoss !== null && pos.profitLoss !== undefined) {
          return sum + pos.profitLoss;
        }
        if (pos.status === 'active') {
          try {
            const simulation = await yieldCalculator.simulatePosition(pos);
            return sum + simulation.totalReturn;
          } catch (error) {
            console.warn(`Error calculating return for ${pos.symbol}:`, error);
            const fallbackSim = yieldCalculator.calculateYield(pos);
            return sum + fallbackSim.totalReturn;
          }
        }
        return sum;
      }, Promise.resolve(0));

      const principal = allPositions.length * 1000; // $1000 per position
      const returnPercentage = principal > 0 ? (totalReturn / principal) * 100 : 0;
      
      const exitedPositions = allPositions.filter(p => p.status === 'exited');
      const winRate = exitedPositions.length > 0 
        ? (exitedPositions.filter(p => (p.profitLoss || 0) > 0).length / exitedPositions.length) * 100 
        : 0;

      // Calculate best/worst performers (simplified for now due to async complexity)
      const bestPerformer = allPositions.find(p => p.profitLoss && p.profitLoss > 0) || allPositions[0];
      const worstPerformer = allPositions.find(p => p.profitLoss && p.profitLoss < 0) || allPositions[0];

      setMetrics({
        totalValue,
        totalReturn,
        returnPercentage,
        winRate,
        activePositions: activePositions.length,
        totalPositions: allPositions.length,
        bestPerformer,
        worstPerformer
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const activePositions = positions.filter(p => p.status === 'active');

  if (loading && !metrics) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Watchlist Summary */}
      {watchlistStats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                Pool Discovery Status
              </Typography>
              <WatchlistIcon color="info" />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {watchlistStats.totalPools}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pools Monitored
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {watchlistStats.newPools}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  New Discoveries
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {metrics?.activePositions || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Positions
                </Typography>
              </Box>
            </Box>

            {watchlistStats.recentDiscoveries.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Recent Discoveries:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {watchlistStats.recentDiscoveries.map((pool, index) => (
                    <Chip
                      key={index}
                      label={pool.symbol || pool.address?.substring(0, 8) + '...'}
                      size="small"
                      color="success"
                      icon={<NewIcon />}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Portfolio Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Portfolio Value
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(metrics?.totalValue || 0)}
                </Typography>
              </Box>
              <PortfolioIcon color="primary" />
            </Box>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Return
                </Typography>
                <Typography variant="h6" color={metrics?.totalReturn && metrics.totalReturn >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(metrics?.totalReturn || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatPercentage(metrics?.returnPercentage || 0)}
                </Typography>
              </Box>
              {metrics?.totalReturn && metrics.totalReturn >= 0 ? 
                <TrendingUpIcon color="success" /> : 
                <TrendingDownIcon color="error" />
              }
            </Box>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Win Rate
                </Typography>
                <Typography variant="h6">
                  {formatPercentage(metrics?.winRate || 0)}
                </Typography>
              </Box>
              <ShowChartIcon color="info" />
            </Box>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Active Positions
                </Typography>
                <Typography variant="h6">
                  {metrics?.activePositions || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  / {metrics?.totalPositions || 0} total
                </Typography>
              </Box>
              <TimeIcon color="warning" />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Active Positions Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2">
              Active Positions
            </Typography>
            <Tooltip title="Refresh data">
              <IconButton onClick={fetchData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {activePositions.length === 0 ? (
            <Alert severity="info">
              No active positions. The bot is monitoring for new opportunities.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pool</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Entry APY</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Hold Time</TableCell>
                    <TableCell>Current Return</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activePositions.map((position) => (
                    <PositionRow key={position.id} position={position} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Auto-refresh: 60s
            </Typography>
            {loading && <CircularProgress size={16} />}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PortfolioOverview;
