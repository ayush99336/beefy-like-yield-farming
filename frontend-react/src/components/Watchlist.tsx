import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  TrendingUp as TrendingUpIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { WatchlistPool } from '../types';
import { apiService, defiLlamaService } from '../services';
import { formatCurrency, formatPercentage, formatDate } from '../utils';

const Watchlist: React.FC = () => {
  const [watchlistPools, setWatchlistPools] = useState<WatchlistPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(7);

  const loadWatchlist = async () => {
    try {
      setLoading(true);
      const data = await apiService.getWatchlist();
      setWatchlistPools(data);
      setError(null);
    } catch (err) {
      setError('Failed to load watchlist');
      console.error('Error loading watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshWatchlist = async () => {
    setRefreshing(true);
    await loadWatchlist();
    setRefreshing(false);
  };

  const handleCleanup = async () => {
    try {
      await apiService.cleanupWatchlist(cleanupDays);
      setCleanupDialogOpen(false);
      await refreshWatchlist();
    } catch (err) {
      setError('Failed to cleanup watchlist');
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'watching': return 'info';
      case 'invested': return 'success';
      case 'ignored': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string): React.ReactElement | undefined => {
    switch (status) {
      case 'watching': return <VisibilityIcon fontSize="small" />;
      case 'invested': return <TrendingUpIcon fontSize="small" />;
      case 'ignored': return <VisibilityOffIcon fontSize="small" />;
      default: return undefined;
    }
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        👀 Pool Watchlist
        <Tooltip title="Refresh watchlist">
          <IconButton onClick={refreshWatchlist} disabled={refreshing}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Watchlist Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Pools
            </Typography>
            <Typography variant="h4">
              {watchlistPools.length}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Watching
            </Typography>
            <Typography variant="h4" color="info.main">
              {watchlistPools.filter(p => p.status === 'watching').length}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Invested
            </Typography>
            <Typography variant="h4" color="success.main">
              {watchlistPools.filter(p => p.status === 'invested').length}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              New Pools
            </Typography>
            <Typography variant="h4" color="warning.main">
              {watchlistPools.filter(p => p.isNew).length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={() => setCleanupDialogOpen(true)}
        >
          Cleanup Old Entries
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refreshWatchlist}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Watchlist Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pool</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>First Seen</TableCell>
              <TableCell>Last Checked</TableCell>
              <TableCell>New Pool</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {watchlistPools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 4 }}>
                    No pools in watchlist. Start the bot to detect new pools!
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              watchlistPools.map((pool) => (
                <TableRow key={pool.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {pool.symbol}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {pool.poolId.slice(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {pool.project}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={getStatusIcon(pool.status)}
                      label={pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
                      color={getStatusColor(pool.status)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(pool.firstSeen)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(pool.lastChecked)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {pool.isNew && (
                      <Chip
                        size="small"
                        label="New"
                        color="warning"
                        variant="filled"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View pool details">
                      <IconButton size="small">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Cleanup Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)}>
        <DialogTitle>Cleanup Old Watchlist Entries</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Remove watchlist entries older than the specified number of days.
          </Typography>
          <TextField
            label="Days"
            type="number"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(parseInt(e.target.value) || 7)}
            fullWidth
            variant="outlined"
            inputProps={{ min: 1, max: 365 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCleanup} variant="contained" color="warning">
            Cleanup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Watchlist;
