const { execSync } = require('child_process');
const path = require('path');

// Create development D1 database if it doesn't exist
try {
  console.log('Setting up development D1 database...');
  
  // Create the database
  execSync('pnpm wrangler d1 create analytics-db-dev', { stdio: 'inherit' });
} catch (error) {
  // Ignore if database already exists
  if (!error.message.includes('already exists')) {
    console.error('Error creating database:', error);
  }
}

// Apply migrations
try {
  console.log('Applying migrations...');
  execSync('pnpm wrangler d1 migrations apply analytics-db-dev --local', { stdio: 'inherit' });
} catch (error) {
  console.error('Error applying migrations:', error);
} 