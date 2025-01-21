import { getD1Database } from '@/lib/database';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request, context: any) {
  try {
    const db = await getD1Database(context);
    
    // Get current deployment metrics
    const currentMetrics = await db
      .prepare(`
        SELECT *
        FROM deployment_metrics
        WHERE environment = 'production'
        ORDER BY deploy_time DESC
        LIMIT 1
      `)
      .first();

    // Get previous deployments metrics (last 10)
    const previousDeployments = await db
      .prepare(`
        SELECT *
        FROM deployment_metrics
        WHERE environment = 'production'
        AND deploy_time < ?
        ORDER BY deploy_time DESC
        LIMIT 10
      `)
      .bind(currentMetrics?.deploy_time || Date.now())
      .all();

    // Format the response
    const response = {
      current: currentMetrics ? {
        deploymentId: currentMetrics.id,
        deploymentDate: new Date(currentMetrics.deploy_time * 1000).toISOString(),
        totalVisitors: currentMetrics.total_visitors,
        bounceRate: currentMetrics.bounce_rate,
        avgTimeSpentSeconds: currentMetrics.avg_time_spent_seconds,
        conversionRate: currentMetrics.conversion_rate,
        performanceScore: {
          ttfb: 0, // These will come from page_views table in future
          fcp: 0,
          lcp: 0,
          cls: 0,
          fid: 0,
        },
      } : null,
      previous: previousDeployments?.results?.map((metrics: Record<string, any>) => ({
        deploymentId: metrics.id,
        deploymentDate: new Date(metrics.deploy_time * 1000).toISOString(),
        totalVisitors: metrics.total_visitors,
        bounceRate: metrics.bounce_rate,
        avgTimeSpentSeconds: metrics.avg_time_spent_seconds,
        conversionRate: metrics.conversion_rate,
        performanceScore: {
          ttfb: 0,
          fcp: 0,
          lcp: 0,
          cls: 0,
          fid: 0,
        },
      })) || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching deployment analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment analytics' },
      { status: 500 }
    );
  }
} 