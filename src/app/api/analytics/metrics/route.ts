import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  try {
    const analytics = new Analytics();
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

    await analytics.close();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error getting analytics metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 