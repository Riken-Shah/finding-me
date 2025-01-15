import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics-d1';
import { getD1Database } from '@/lib/database';

export const runtime = 'edge';
export const preferredRegion = 'auto';

interface RouteContext {
  params: { [key: string]: string | string[] };
}

export async function GET(
  request: NextRequest,
  context: RouteContext & { env?: { DB: D1Database } }
) {
  try {
    const db = await getD1Database(context);
    if (!db) {
      throw new Error('Failed to initialize database');
    }
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