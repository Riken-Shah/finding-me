import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics-d1';

export const runtime = 'edge';
export const preferredRegion = 'auto';

interface RouteContext {
  params: { [key: string]: string | string[] };
}

// Helper to get D1 database instance
function getD1Database(context: any) {
  // For production (Cloudflare Pages)
  if (context?.env?.DB) {
    return context.env.DB;
  }
  
  // For development (Next.js dev server)
  if (process.env.NODE_ENV === 'development') {
    // @ts-expect-error - D1 binding
    return global.DB;
  }
  
  throw new Error('D1 database not available');
}

export async function GET(
  request: NextRequest,
  context: RouteContext & { env?: { DB: D1Database } }
) {
  try {
    const db = getD1Database(context);
    const analytics = new Analytics(db);
    const searchParams = request.nextUrl.searchParams;
    
    // Parse timeframe parameters
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    
    const timeframe = {
      ...(startTime && { startTime: parseInt(startTime) }),
      ...(endTime && { endTime: parseInt(endTime) })
    };

    const metrics = await analytics.getMetrics(
      Object.keys(timeframe).length > 0 ? timeframe : undefined
    );

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error getting analytics metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 