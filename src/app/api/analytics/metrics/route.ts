import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics';
import { MetricsResponse } from '@/types/analytics';

export async function GET(request: NextRequest) {
  try {
    const analytics = new Analytics();
    const timePeriod = request.headers.get('x-time-period') || '24h';

    const [retention, pages, devices, ctr] = await Promise.all([
      analytics.getRetentionMetrics(timePeriod),
      analytics.getPageMetrics(timePeriod),
      analytics.getDeviceMetrics(timePeriod),
      analytics.getCTRMetrics(timePeriod),
    ]);

    const response: MetricsResponse = {
      retention,
      pages,
      devices,
      ctr,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 