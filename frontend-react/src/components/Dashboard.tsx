import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Timeline as CyclesIcon,
  List as LogsIcon,
  Visibility as WatchlistIcon,
  ShowChart as SimulatorIcon,
  AttachMoney as PriceIcon
} from '@mui/icons-material';

import PortfolioOverview from './PortfolioOverview';
import CyclesViewer from './CyclesViewer';
import LogsViewer from './LogsViewer';
import Watchlist from './Watchlist';
import YieldSimulator from './YieldSimulator';
import CoinGeckoDataViewer from './CoinGeckoDataViewer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const Dashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          WildNet Yield Farming Bot
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Automated Solana DeFi pool detection and yield farming simulation
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="dashboard tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<DashboardIcon />} 
              label="Portfolio" 
              {...a11yProps(0)} 
            />
            <Tab 
              icon={<CyclesIcon />} 
              label="Detection Cycles" 
              {...a11yProps(1)} 
            />
            <Tab 
              icon={<LogsIcon />} 
              label="System Logs" 
              {...a11yProps(2)} 
            />
            <Tab 
              icon={<WatchlistIcon />} 
              label="Watchlist" 
              {...a11yProps(3)} 
            />
            <Tab 
              icon={<SimulatorIcon />} 
              label="Yield Simulator" 
              {...a11yProps(4)} 
            />
            <Tab 
              icon={<PriceIcon />} 
              label="Live Prices" 
              {...a11yProps(5)} 
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <PortfolioOverview />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CyclesViewer />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <LogsViewer />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Watchlist />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <YieldSimulator />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <CoinGeckoDataViewer />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default Dashboard;
