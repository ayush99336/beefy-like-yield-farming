# WildNet Yield Farming React Frontend

A modern React TypeScript frontend for tracking yield farming performance with real-time data and investment simulation.

## Features

### 📊 Real-time Portfolio Analytics
- **Portfolio Value**: Current total value of all positions
- **Total Returns**: Aggregate P&L with percentage returns  
- **Win Rate**: Percentage of profitable positions
- **Average Hold Time**: How long positions are typically held

### 💰 Yield Calculation Engine ($1000 per pool simulation)
- **Investment Simulation**: Each pool entry simulates a $1000 investment
- **Real-time APY Tracking**: Fetches current APY from DeFiLlama API
- **Compound Interest**: Daily compounding for accurate returns
- **Entry vs Current APY**: Tracks APY changes over time

### 🧮 Investment Simulator
- Test different APY scenarios (1% - 500%)
- Simulate various time periods (1 day to 1 year)
- Risk assessment based on APY levels
- Custom investment amounts

## Quick Start

```bash
# Start backend services first
npm run docker:up    # PostgreSQL
npm run server       # API server (port 3000)
npm start           # Workflow manager

# Start React frontend
npm run react-dashboard    # Runs on port 3001
```

Open http://localhost:3001 to view the dashboard.

## Investment Strategy

Each pool position represents a **$1000 simulated investment** with:
- Daily compounding calculation
- Real-time APY tracking
- Entry vs current APY comparison
- Profit/loss calculation based on hold time

## Risk Assessment
- **1-50% APY**: Lower risk, conservative yields
- **50-100% APY**: Medium risk, competitive DeFi  
- **100-200% APY**: High risk, incentive-driven pools
- **200%+ APY**: Extreme risk, new/experimental pools

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
