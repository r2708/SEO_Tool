#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Port Cleanup Utility${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Checking ports 3000 and 3001...${NC}"

# Check what's running on ports
PIDS_3000=$(lsof -ti:3000 2>/dev/null)
PIDS_3001=$(lsof -ti:3001 2>/dev/null)

if [ -z "$PIDS_3000" ] && [ -z "$PIDS_3001" ]; then
    echo -e "${GREEN}✓ Ports 3000 and 3001 are already free${NC}"
    exit 0
fi

if [ ! -z "$PIDS_3000" ]; then
    echo -e "${YELLOW}Found processes on port 3000:${NC}"
    lsof -i:3000 2>/dev/null
    echo ""
fi

if [ ! -z "$PIDS_3001" ]; then
    echo -e "${YELLOW}Found processes on port 3001:${NC}"
    lsof -i:3001 2>/dev/null
    echo ""
fi

echo -e "${RED}Killing all processes on ports 3000 and 3001...${NC}"

# Kill processes multiple times to ensure they're dead
for i in {1..3}; do
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
done

# Final check
REMAINING_3000=$(lsof -ti:3000 2>/dev/null)
REMAINING_3001=$(lsof -ti:3001 2>/dev/null)

echo ""
if [ -z "$REMAINING_3000" ] && [ -z "$REMAINING_3001" ]; then
    echo -e "${GREEN}✓ Ports 3000 and 3001 are now free${NC}"
    echo ""
    echo -e "${BLUE}You can now run:${NC}"
    echo -e "  ./start-all.sh"
else
    echo -e "${RED}✗ Failed to free ports${NC}"
    echo -e "${YELLOW}Try running:${NC}"
    echo -e "  sudo lsof -ti:3000,3001 | xargs sudo kill -9"
fi

echo ""
