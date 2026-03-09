#!/bin/bash
set -e

# Create test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE seo_tool_test;
    GRANT ALL PRIVILEGES ON DATABASE seo_tool_test TO $POSTGRES_USER;
EOSQL

echo "Test database 'seo_tool_test' created successfully"
