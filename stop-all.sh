#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stopping SEO SaaS Platform${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Kill processes from PID files
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill -9 $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Backend stopped (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠ Backend was not running${NC}"
    fi
    rm .backend.pid
fi

if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill -9 $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Frontend stopped (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend was not running${NC}"
    fi
    rm .frontend.pid
fi

echo ""
echo -e "${YELLOW}Killing all Node.js processes on ports 3000 and 3001...${NC}"

# Kill any remaining node processes on ports 3000 and 3001
PIDS_3000=$(lsof -ti:3000 2>/dev/null)
PIDS_3001=$(lsof -ti:3001 2>/dev/null)

if [ ! -z "$PIDS_3000" ]; then
    echo "$PIDS_3000" | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed processes on port 3000${NC}"
fi

if [ ! -z "$PIDS_3001" ]; then
    echo "$PIDS_3001" | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed processes on port 3001${NC}"
fi

# Kill ALL node processes (nuclear option)
echo ""
echo -e "${YELLOW}Killing all remaining Node.js processes...${NC}"
pkill -9 node 2>/dev/null
echo -e "${GREEN}✓ All Node.js processes killed${NC}"

# Clean up log files
if [ -f backend.log ]; then
    rm backend.log
    echo -e "${GREEN}✓ Cleaned backend.log${NC}"
fi

if [ -f frontend.log ]; then
    rm frontend.log
    echo -e "${GREEN}✓ Cleaned frontend.log${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All services stopped successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}To start services again:${NC}"
echo -e "  ./start-all.sh"
echo ""
