/**
 * Helper to get D1 database instance that works in both production and development
 */
export async function getD1Database(context: any) {
  // For production (Cloudflare Pages)
  if (context?.env?.DB) {
    return context.env.DB;
  }
  
  // For development (Next.js dev server)
    return process.env.DB;
} 