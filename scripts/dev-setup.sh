#!/bin/bash

# Kill any existing wrangler processes
pkill -f wrangler || true

# Initialize local D1 database
echo "Initializing local D1 database..."
npx wrangler d1 execute website-analytics-dev --local --file=./migrations/0000_initial.sql

# Build Next.js app
echo "Building Next.js app..."
npm run build

# Build and start the development server with local D1
echo "Starting development server..."
npx wrangler pages dev .vercel/output/static --d1 DB=website-analytics-dev --persist-to=.wrangler/state --port 8789 --compatibility-date=2024-01-01 