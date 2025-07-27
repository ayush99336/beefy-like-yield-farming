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
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper,
  TablePagination
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { formatDate, formatTimeAgo } from '../utils';
import { apiService } from '../services';

interface Log {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
  cycleId?: number;
  cycle?: {
    id: number;
    cycleTimestamp: string;
    totalPoolsFound: number;
    newPoolsFound: number;
    activePositions: number;
    watchlistSize: number;
  };
}

const LogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getLogs();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLevelFilterChange = (event: SelectChangeEvent) => {
    setLevelFilter(event.target.value);
    setPage(0); // Reset to first page when filtering
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warn':
        return <WarningIcon color="warning" />;
      case 'info':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getLevelColor = (level: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  };

  const filteredLogs = logs.filter(log => 
    levelFilter === 'all' || log.level === levelFilter
  );

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const formatDetails = (details: any) => {
    if (!details) return null;
    
    if (typeof details === 'object') {
      return (
        <Box sx={{ mt: 1 }}>
          {Object.entries(details).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block" color="text.secondary">
              <strong>{key}:</strong> {String(value)}
            </Typography>
          ))}
        </Box>
      );
    }
    
    return (
      <Typography variant="caption" color="text.secondary">
        {String(details)}
      </Typography>
    );
  };

  if (loading && logs.length === 0) {
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
          <Typography variant="h6" component="h2">
            System Logs
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={levelFilter}
                onChange={handleLevelFilterChange}
                displayEmpty
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh logs">
              <IconButton onClick={fetchLogs} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell width="140px">Time</TableCell>
                <TableCell width="80px">Level</TableCell>
                <TableCell>Message</TableCell>
                <TableCell width="100px">Cycle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Tooltip title={formatDate(log.timestamp)}>
                      <Typography variant="caption">
                        {formatTimeAgo(log.timestamp)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getLevelIcon(log.level)}
                      <Chip 
                        label={log.level.toUpperCase()} 
                        size="small" 
                        color={getLevelColor(log.level)}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.message}
                    </Typography>
                    {formatDetails(log.details)}
                  </TableCell>
                  <TableCell>
                    {log.cycleId && (
                      <Chip 
                        label={`#${log.cycleId}`} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />

        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Showing {filteredLogs.length} logs • Auto-refresh: 30s
          </Typography>
          {loading && <CircularProgress size={16} />}
        </Box>
      </CardContent>
    </Card>
  );
};

export default LogsViewer;
