import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayCircle as PlayIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { formatDate, formatTimeAgo } from '../utils';
import { apiService } from '../services';

interface DetectionCycle {
  id: number;
  cycleTimestamp: string;
  totalPoolsFound: number;
  newPoolsFound: number;
  activePositions: number;
  watchlistSize: number;
  logs?: Array<{
    id: number;
    timestamp: string;
    level: string;
    message: string;
    details?: any;
  }>;
}

const CyclesViewer: React.FC = () => {
  const [cycles, setCycles] = useState<DetectionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getCycles();
      setCycles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCycles, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (cycle: DetectionCycle): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    if (cycle.newPoolsFound > 0) return 'success';
    if (cycle.totalPoolsFound > 0) return 'info';
    return 'default';
  };

  const getCycleStatus = (cycle: DetectionCycle) => {
    if (cycle.newPoolsFound > 0) return 'New Pools Found';
    if (cycle.totalPoolsFound > 0) return 'Pools Analyzed';
    return 'No Pools';
  };

  if (loading && cycles.length === 0) {
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
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <TimelineIcon color="primary" />
            <Typography variant="h6" component="h2">
              Detection Cycles
            </Typography>
          </Box>
          <Tooltip title="Refresh cycles">
            <IconButton onClick={fetchCycles} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {cycles.length === 0 && !loading ? (
          <Alert severity="info">
            No detection cycles found. The workflow manager may not have started yet.
          </Alert>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="80px">Cycle</TableCell>
                  <TableCell width="140px">Time</TableCell>
                  <TableCell width="120px">Status</TableCell>
                  <TableCell width="100px">Pools Found</TableCell>
                  <TableCell width="100px">New Pools</TableCell>
                  <TableCell width="100px">Active Pos.</TableCell>
                  <TableCell width="100px">Watchlist</TableCell>
                  <TableCell>Performance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PlayIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="bold">
                          #{cycle.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={formatDate(cycle.cycleTimestamp)}>
                        <Typography variant="caption">
                          {formatTimeAgo(cycle.cycleTimestamp)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getCycleStatus(cycle)}
                        size="small"
                        color={getStatusColor(cycle)}
                        variant={cycle.newPoolsFound > 0 ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {cycle.totalPoolsFound}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color={cycle.newPoolsFound > 0 ? 'success.main' : 'text.secondary'}>
                          {cycle.newPoolsFound}
                        </Typography>
                        {cycle.newPoolsFound > 0 && <TrendingUpIcon fontSize="small" color="success" />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {cycle.activePositions}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {cycle.watchlistSize}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            Discovery Rate
                          </Typography>
                          <Typography variant="caption">
                            {cycle.totalPoolsFound > 0 ? Math.round((cycle.newPoolsFound / cycle.totalPoolsFound) * 100) : 0}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={cycle.totalPoolsFound > 0 ? (cycle.newPoolsFound / cycle.totalPoolsFound) * 100 : 0}
                          sx={{ height: 4, borderRadius: 2 }}
                          color={cycle.newPoolsFound > 0 ? 'success' : 'inherit'}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {cycles.length} cycles recorded • Auto-refresh: 30s
          </Typography>
          {loading && <CircularProgress size={16} />}
        </Box>
      </CardContent>
    </Card>
  );
};

export default CyclesViewer;
