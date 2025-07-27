import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Slider,
  Grid,
  Paper
} from '@mui/material';
import { Calculate as CalculateIcon } from '@mui/icons-material';
import { yieldCalculator, formatCurrency, formatPercent } from '../services';
import { PRINCIPAL_USD } from '../types';

interface YieldSimulatorProps {}

const YieldSimulator: React.FC<YieldSimulatorProps> = () => {
  const [apy, setApy] = useState<number>(100);
  const [principal, setPrincipal] = useState<number>(PRINCIPAL_USD);
  const [holdDays, setHoldDays] = useState<number>(30);
  const [results, setResults] = useState<any[]>([]);

  const simulateYield = () => {
    const timeframes = [1, 7, 14, 30, 60, 90, 180, 365];
    const simResults = timeframes.map(days => {
      const result = yieldCalculator.simulateInvestment(apy, days, principal);
      return {
        days,
        ...result
      };
    });
    setResults(simResults);
  };

  const getRiskMessage = (apy: number) => {
    if (apy >= 200) return { severity: 'error', message: 'Extremely High Risk: APY >200% often indicates new/risky pools' };
    if (apy >= 100) return { severity: 'warning', message: 'High Risk: APY >100% suggests incentive-driven or new pools' };
    if (apy >= 50) return { severity: 'info', message: 'Medium Risk: Competitive DeFi yields' };
    return { severity: 'success', message: 'Lower Risk: Conservative yield farming' };
  };

  const riskInfo = getRiskMessage(apy);

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📊 Yield Simulator ($1000 Investment Strategy)
        </Typography>
        
        <Alert severity={riskInfo.severity as any} sx={{ mb: 3 }}>
          {riskInfo.message}
        </Alert>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 3,
          mb: 3
        }}>
          <Box>
            <Typography gutterBottom>APY (%)</Typography>
            <Slider
              value={apy}
              onChange={(_, value) => setApy(value as number)}
              min={1}
              max={500}
              valueLabelDisplay="on"
              marks={[
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
                { value: 200, label: '200%' },
                { value: 500, label: '500%' }
              ]}
            />
          </Box>
          
          <TextField
            label="Investment Amount ($)"
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            inputProps={{ min: 100, max: 100000, step: 100 }}
            fullWidth
          />
          
          <TextField
            label="Hold Period (days)"
            type="number"
            value={holdDays}
            onChange={(e) => setHoldDays(Number(e.target.value))}
            inputProps={{ min: 1, max: 365, step: 1 }}
            fullWidth
          />
        </Box>

        <Button
          variant="contained"
          startIcon={<CalculateIcon />}
          onClick={simulateYield}
          size="large"
          sx={{ mb: 3 }}
        >
          Calculate Yields
        </Button>

        {results.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time Period</TableCell>
                  <TableCell>Principal</TableCell>
                  <TableCell>Final Amount</TableCell>
                  <TableCell>Total Return</TableCell>
                  <TableCell>Return %</TableCell>
                  <TableCell>Daily Return</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.days}>
                    <TableCell>
                      <Typography fontWeight="bold">
                        {result.days} day{result.days !== 1 ? 's' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCurrency(result.principal)}</TableCell>
                    <TableCell>
                      <Typography color={result.totalReturn > 0 ? 'success.main' : 'error.main'}>
                        {formatCurrency(result.finalAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        color={result.totalReturn > 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {formatCurrency(result.totalReturn)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color={result.totalReturn > 0 ? 'success.main' : 'error.main'}>
                        {formatPercent(result.returnPercentage)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatPercent(result.dailyReturn)}/day
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {results.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              💡 Key Insights
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>30-day return:</strong> {formatCurrency(results.find(r => r.days === 30)?.totalReturn || 0)}
                </Typography>
              </Alert>
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Annual projection:</strong> {formatCurrency(results.find(r => r.days === 365)?.totalReturn || 0)}
                </Typography>
              </Alert>
            </Box>
          </Box>
        )}
        
        <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
          * Calculations use daily compounding. Actual returns may vary due to market conditions, 
          pool changes, impermanent loss, and other factors. This is for simulation purposes only.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default YieldSimulator;
