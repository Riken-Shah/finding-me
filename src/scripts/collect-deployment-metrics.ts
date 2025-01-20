import { D1Database } from '@cloudflare/workers-types';
import { getD1Database } from '../lib/database';

interface DeploymentMetrics {
  total_sessions: number;
  total_pageviews: number;
  engaged_sessions: number;
  avg_time_spent: number;
  avg_fcp: number;
  avg_lcp: number;
  avg_cls: number;
  bounced_sessions: number;
  bounce_rate: number;
  engagement_rate: number;
}

const METRICS_QUERY = `
  WITH PageMetrics AS (
    SELECT 
      COUNT(DISTINCT session_id) as total_sessions,
      COUNT(*) as total_pageviews,
      COUNT(DISTINCT CASE WHEN time_spent > 10 THEN session_id END) as engaged_sessions,
      AVG(time_spent) as avg_time_spent,
      AVG(CASE WHEN fcp IS NOT NULL THEN fcp END) as avg_fcp,
      AVG(CASE WHEN lcp IS NOT NULL THEN lcp END) as avg_lcp,
      AVG(CASE WHEN cls IS NOT NULL THEN cls END) as avg_cls
    FROM page_views
    WHERE timestamp BETWEEN ? AND ?
  ),
  BounceMetrics AS (
    SELECT 
      COUNT(DISTINCT s.session_id) as bounced_sessions
    FROM sessions s
    LEFT JOIN page_views pv ON s.session_id = pv.session_id
    WHERE s.start_time BETWEEN ? AND ?
    GROUP BY s.session_id
    HAVING COUNT(pv.id) = 1
  )
  SELECT 
    pm.*,
    bm.bounced_sessions,
    ROUND(CAST(bm.bounced_sessions AS FLOAT) / pm.total_sessions * 100, 2) as bounce_rate,
    ROUND(CAST(pm.engaged_sessions AS FLOAT) / pm.total_sessions * 100, 2) as engagement_rate
  FROM PageMetrics pm, BounceMetrics bm
`;

async function getMetricsForPeriod(db: D1Database, startTime: number, endTime: number): Promise<DeploymentMetrics> {
  const result = await db.prepare(METRICS_QUERY)
    .bind(startTime, endTime, startTime, endTime)
    .first<DeploymentMetrics>();
  
  if (!result) {
    throw new Error('Failed to fetch metrics');
  }
  
  return result;
}

async function calculateMetricChange(current: number, previous: number): Promise<number> {
  if (previous === 0) return 0;
  return Number(((current - previous) / previous * 100).toFixed(2));
}

interface MetricsChanges {
  sessions_change: number;
  pageviews_change: number;
  bounce_rate_change: number;
  engagement_rate_change: number;
}

async function calculateMetricChanges(
  currentMetrics: DeploymentMetrics,
  previousMetrics: DeploymentMetrics
): Promise<MetricsChanges> {
  return {
    sessions_change: await calculateMetricChange(currentMetrics.total_sessions, previousMetrics.total_sessions),
    pageviews_change: await calculateMetricChange(currentMetrics.total_pageviews, previousMetrics.total_pageviews),
    bounce_rate_change: Number((currentMetrics.bounce_rate - previousMetrics.bounce_rate).toFixed(2)),
    engagement_rate_change: Number((currentMetrics.engagement_rate - previousMetrics.engagement_rate).toFixed(2))
  };
}

interface DeploymentInfo {
  deployTime: number;
  buildTime: number;
  status: string;
  environment: string;
  commitSha: string;
  branch: string;
}

export async function collectAndSaveMetrics(deploymentInfo: DeploymentInfo, context?: any): Promise<void> {
  const db = await getD1Database(context);
  
  // Skip metrics collection if no database is available
  if (!db) {
    console.log('::group::Deployment Metrics');
    console.log('Skipping metrics collection - no database available');
    console.log(`Deploy Time: ${deploymentInfo.deployTime}`);
    console.log(`Build Time: ${deploymentInfo.buildTime}`);
    console.log(`Duration: ${deploymentInfo.deployTime - deploymentInfo.buildTime} seconds`);
    console.log(`Status: ${deploymentInfo.status}`);
    console.log(`Environment: ${deploymentInfo.environment}`);
    console.log(`Commit SHA: ${deploymentInfo.commitSha}`);
    console.log(`Branch: ${deploymentInfo.branch}`);
    console.log('::endgroup::');
    return;
  }
  
  // Calculate time ranges
  const currentEnd = Math.floor(Date.now() / 1000);
  const currentStart = currentEnd - 86400;
  const previousEnd = currentStart;
  const previousStart = previousEnd - 86400;
  
  // Get metrics for both periods
  const currentMetrics = await getMetricsForPeriod(db, currentStart, currentEnd);
  const previousMetrics = await getMetricsForPeriod(db, previousStart, previousEnd);
  
  // Calculate changes
  const changes = await calculateMetricChanges(currentMetrics, previousMetrics);
  
  // Save metrics
  await db.prepare(`
    INSERT INTO deployment_metrics (
      deploy_time,
      build_time,
      deployment_duration,
      status,
      environment,
      commit_sha,
      branch,
      total_sessions,
      total_pageviews,
      bounce_rate,
      engagement_rate,
      avg_time_spent,
      avg_fcp,
      avg_lcp,
      avg_cls,
      sessions_change,
      pageviews_change,
      bounce_rate_change,
      engagement_rate_change,
      metrics_start_time,
      metrics_end_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    deploymentInfo.deployTime,
    deploymentInfo.buildTime,
    deploymentInfo.deployTime - deploymentInfo.buildTime,
    deploymentInfo.status,
    deploymentInfo.environment,
    deploymentInfo.commitSha,
    deploymentInfo.branch,
    currentMetrics.total_sessions,
    currentMetrics.total_pageviews,
    currentMetrics.bounce_rate,
    currentMetrics.engagement_rate,
    currentMetrics.avg_time_spent,
    currentMetrics.avg_fcp,
    currentMetrics.avg_lcp,
    currentMetrics.avg_cls,
    changes.sessions_change,
    changes.pageviews_change,
    changes.bounce_rate_change,
    changes.engagement_rate_change,
    currentStart,
    currentEnd
  ).run();
  
  // Log summary
  console.log('::group::Deployment Metrics');
  console.log(`Deploy Time: ${deploymentInfo.deployTime}`);
  console.log(`Build Time: ${deploymentInfo.buildTime}`);
  console.log(`Duration: ${deploymentInfo.deployTime - deploymentInfo.buildTime} seconds`);
  console.log(`Status: ${deploymentInfo.status}`);
  console.log(`Environment: ${deploymentInfo.environment}`);
  console.log('');
  console.log('Website Performance Metrics (Last 24h vs Previous 24h):');
  console.log('----------------------------------------');
  console.log(`Sessions: ${currentMetrics.total_sessions} (${changes.sessions_change}% change)`);
  console.log(`Pageviews: ${currentMetrics.total_pageviews} (${changes.pageviews_change}% change)`);
  console.log(`Bounce Rate: ${currentMetrics.bounce_rate}% (${changes.bounce_rate_change}% change)`);
  console.log(`Engagement Rate: ${currentMetrics.engagement_rate}% (${changes.engagement_rate_change}% change)`);
  console.log(`Avg Time Spent: ${currentMetrics.avg_time_spent}s`);
  console.log('');
  console.log('Core Web Vitals:');
  console.log('----------------------------------------');
  console.log(`FCP: ${currentMetrics.avg_fcp}ms`);
  console.log(`LCP: ${currentMetrics.avg_lcp}ms`);
  console.log(`CLS: ${currentMetrics.avg_cls}`);
  console.log('::endgroup::');
} 