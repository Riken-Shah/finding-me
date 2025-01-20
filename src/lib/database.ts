/**
 * Helper to get D1 database instance that works in both production and development
 */
export async function getD1Database(context: any) {
  // For production (Cloudflare Pages)
  if (context?.env?.DB) {
    return context.env.DB;
  }
  
  // For development (Next.js dev server)
  if (process.env.DB) {
    return process.env.DB;
  }

  throw new Error('Database binding not found. Make sure the DB binding is configured in Cloudflare Pages.');
} 