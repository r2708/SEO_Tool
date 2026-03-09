#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Testing Frontend-Backend Connection..."
echo ""

# Test 1: Check if backend is running
echo -e "${YELLOW}Test 1: Checking if backend is running on port 3001...${NC}"
if curl -s http://localhost:3001/api/auth/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not responding${NC}"
    echo "Try: cd apps/backend && npm run dev"
fi

echo ""

# Test 2: Check if frontend is running
echo -e "${YELLOW}Test 2: Checking if frontend is running on port 3000...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not responding${NC}"
    echo "Try: cd apps/frontend && npm run dev"
fi

echo ""

# Test 3: Test API endpoint
echo -e "${YELLOW}Test 3: Testing backend API endpoint...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/auth/health 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Backend API is accessible${NC}"
    echo "Response code: $HTTP_CODE"
else
    echo -e "${RED}✗ Backend API is not accessible${NC}"
    echo "Response code: $HTTP_CODE"
fi

echo ""
echo "Connection test complete!"
