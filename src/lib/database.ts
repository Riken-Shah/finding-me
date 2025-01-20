/**
 * Helper to get D1 database instance that works in both production and development
 */
export async function getD1Database(context: any) {
  // For production (Cloudflare Pages)
  if (context?.env?.DB) {
    return context.env.DB;
  }
  
  // For development with Wrangler
  try {
    const { D1Database } = await import('@cloudflare/workers-types');
    const { unstable_dev } = await import('wrangler');
    
    const worker = await unstable_dev('src/worker.ts', {
      config: './wrangler.toml',
      experimental: { disableExperimentalWarning: true }
    });
    
    const env = worker.env;
    if (env.DB) {
      return env.DB;
    }
  } catch (error) {
    console.log('Failed to initialize D1 database with Wrangler:', error);
  }

  // For CI/CD environments, skip database operations
  if (process.env.GITHUB_ACTIONS || process.env.CI) {
    console.log('Running in CI environment - skipping database operations');
    return null;
  }

  throw new Error('Database binding not found. Make sure the DB binding is configured in Cloudflare Pages.');
} 