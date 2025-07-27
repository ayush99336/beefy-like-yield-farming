import React, { useState, useEffect, useCallback } from 'react';
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
  AttachMoney as PriceIcon
} from '@mui/icons-material';
import { formatCurrency } from '../utils';
import { priceService } from '../services';

interface TokenPrice {
  symbol: string;
  price: number;
  priceChange24h?: number;
  loading: boolean;
  error?: string;
}

const CoinGeckoDataViewer: React.FC = () => {
  const [tokenPrices, setTokenPrices] = useState<TokenPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tokens from your watchlist - memoized to prevent re-renders
  const watchlistTokens = React.useMemo(() => 
    ['WSOL', 'USDT', 'DUCK', 'MEOW', 'FOXSY', 'KRAI', 'COM', 'SOL'], 
    []
  );

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Fetching real-time prices from CoinGecko...');
      console.log('🔍 Requesting prices for tokens:', watchlistTokens);
      
      // Fetch all tokens in a single request to minimize API calls
      const prices = await priceService.getMultipleTokenPrices(watchlistTokens);
      
      console.log('🔍 Raw price response:', prices);
      
      const priceData: TokenPrice[] = watchlistTokens.map(symbol => {
        const price = prices[symbol];
        const hasValidPrice = price && price !== 1 && price > 0;
        
        console.log(`Token ${symbol}: price=${price}, hasValidPrice=${hasValidPrice}`);
        
        return {
          symbol,
          price: price || 0,
          loading: false,
          error: !hasValidPrice ? 'Price not available' : undefined
        };
      });

      setTokenPrices(priceData);
      setLastUpdate(new Date());
      
      console.log('✅ CoinGecko prices processed:', priceData.length, 'tokens');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token prices';
      setError(errorMessage);
      console.error('❌ CoinGecko fetch error:', err);
      
      // Set fallback data
      const fallbackData: TokenPrice[] = watchlistTokens.map(symbol => ({
        symbol,
        price: 1,
        loading: false,
        error: errorMessage
      }));
      setTokenPrices(fallbackData);
      
    } finally {
      setLoading(false);
    }
  }, [watchlistTokens]);

  useEffect(() => {
    fetchPrices();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchPrices, 120000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    }
    return formatCurrency(price);
  };

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center">
              <PriceIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                Live Token Prices (CoinGecko)
              </Typography>
            </Box>
            <Tooltip title="Refresh prices">
              <IconButton onClick={fetchPrices} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error} - Using fallback prices
            </Alert>
          )}

          {/* Test Button for debugging */}
          <Box mb={2}>
            <Tooltip title="Test CoinGecko API directly">
              <IconButton 
                onClick={async () => {
                  try {
                    console.log('🧪 Direct API test...');
                    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,tether&vs_currencies=usd');
                    const data = await response.json();
                    console.log('🧪 Direct API response:', data);
                    alert(`Direct API test: ${JSON.stringify(data)}`);
                  } catch (err) {
                    console.error('🧪 Direct API failed:', err);
                    alert(`Direct API failed: ${err}`);
                  }
                }}
                color="secondary"
              >
                🧪
              </IconButton>
            </Tooltip>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Watchlist tokens from your Solana pools
            </Typography>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Price Grid */}
      <Box 
        display="grid" 
        gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" 
        gap={2} 
        sx={{ mb: 3 }}
      >
        {tokenPrices.map((token) => (
          <Card key={token.symbol}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {token.symbol}
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatPrice(token.price)}
                  </Typography>
                  {token.error && (
                    <Chip 
                      label="Fallback" 
                      size="small" 
                      color="warning" 
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                <PriceIcon color={token.error ? 'warning' : 'success'} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Detailed Price Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h3" gutterBottom>
            Price Details
          </Typography>
          
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Token</TableCell>
                    <TableCell>Price (USD)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Data Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tokenPrices.map((token) => (
                    <TableRow key={token.symbol} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {token.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold">
                          {formatPrice(token.price)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={token.error ? 'Fallback' : 'Live'}
                          size="small"
                          color={token.error ? 'warning' : 'success'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {token.error ? 'Default price' : 'CoinGecko API'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Prices refresh every 2 minutes | Powered by CoinGecko
            </Typography>
            {loading && <CircularProgress size={16} />}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CoinGeckoDataViewer;
