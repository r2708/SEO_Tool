#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SEO SaaS Platform - Starting All${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Redis is running
echo -e "${YELLOW}Checking Redis...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
    echo -e "${YELLOW}Starting Redis with Docker...${NC}"
    docker compose up -d redis
    sleep 2
fi

# Check if PostgreSQL is running (check connection instead of pg_isready)
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if psql -h localhost -U postgres -d seo_tool -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠ Cannot verify PostgreSQL with command line${NC}"
    echo -e "${YELLOW}If PostgreSQL is running in pgAdmin, you can continue${NC}"
    echo -e "${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
    read
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Starting Backend (Port 3001)...${NC}"
echo -e "${BLUE}========================================${NC}"

# Start backend in background
cd apps/backend
npm run dev > ../../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ../..

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
sleep 5

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Starting Frontend (Port 3000)...${NC}"
echo -e "${BLUE}========================================${NC}"

# Start frontend in background
cd apps/frontend
npm run dev > ../../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ../..

# Wait for frontend to be ready
echo -e "${YELLOW}Waiting for frontend to be ready...${NC}"
sleep 5

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Backend:${NC}  http://localhost:3001"
echo -e "${GREEN}Frontend:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Backend:  tail -f backend.log"
echo -e "  Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "  ./stop-all.sh"
echo -e "  or"
echo -e "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${GREEN}Press Ctrl+C to view logs (services will keep running)${NC}"
echo ""

# Save PIDs to file for stop script
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

# Follow logs
tail -f backend.log frontend.log
