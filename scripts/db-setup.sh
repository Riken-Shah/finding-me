#!/bin/bash

# Run migrations in order
echo "Running migrations..."

# Run experiments migration
echo "Running experiments migration..."
wrangler d1 execute DB --file=migrations/0001_experiments.sql

# Run events migration
echo "Running events migration..."
wrangler d1 execute DB --file=migrations/0002_events.sql

echo "Migrations completed successfully!" 