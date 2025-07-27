#!/bin/bash

echo "🚀 WildNet Yield Farming Bot - Status Report"
echo "============================================="
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check if API is running
echo "🌐 API Health Check:"
curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null || echo "API not responding"
echo ""

# Get current portfolio summary
echo "💼 Portfolio Summary:"
curl -s http://localhost:3000/api/portfolio/summary | jq '{
  "Active Positions": .activePositionsCount,
  "Average APY": (.averageApy | tostring + "%"),
  "Average Risk": (.averageRisk | tostring + "/10"),
  "Total Positions": .metrics.totalPositions
}' 2>/dev/null || echo "Could not fetch portfolio data"
echo ""

# Get recent logs
echo "📋 Recent Activity (Last 5 logs):"
curl -s http://localhost:3000/api/logs?limit=5 | jq -r '.[] | "\(.timestamp | strptime("%Y-%m-%dT%H:%M:%S.%fZ") | strftime("%H:%M:%S")) [\(.level | ascii_upcase)] \(.message)"' 2>/dev/null || echo "Could not fetch logs"
echo ""

echo "🌍 Access Points:"
echo "  • Frontend Dashboard: http://localhost:8080/dashboard.html"
echo "  • API Dashboard: http://localhost:3000/api/dashboard"
echo "  • PostgreSQL Admin: http://localhost:5050 (if pgadmin is running)"
echo "  • Prisma Studio: Run 'npm run db:studio'"
echo ""

echo "🔧 Available Commands:"
echo "  • npm start          - Start yield farming bot"
echo "  • npm run server     - Start API server only"
echo "  • npm run dashboard  - Start frontend dashboard"
echo "  • npm run docker:up  - Start PostgreSQL"
echo "  • npm run db:studio  - Open database GUI"
