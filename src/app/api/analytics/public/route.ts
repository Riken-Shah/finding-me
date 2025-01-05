import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import { rateLimit } from '@/utils/rate-limit';
import { 
  DBQueryResult,
  DBSessionStats,
  DBPageStats,
  DBTrafficSource,
  DBCountryStats,
  DBDeviceStats,
  DBEngagementStats,
  SessionMetrics,
  PageMetrics,
  TrafficMetrics,
  EngagementMetrics
} from '@/types/analytics';

export const runtime = 'edge';
export const preferredRegion = 'auto';

function getDB(): D1Database {
  // @ts-expect-error - Cloudflare bindings
  const context = process.env as EnvVars;
  const db = context.DB;
  if (!db) throw new Error('D1 database not found');

  // Log database info
  db.prepare(`
    SELECT 
      'website-analytics-dev' as db_name,
      (SELECT COUNT(*) FROM sessions) as session_count,
      (SELECT COUNT(*) FROM pageviews) as pageview_count,
      (SELECT COUNT(*) FROM events) as event_count
  `).first().then(dbInfo => {
    console.log('Database info (public):', dbInfo);
  }).catch(error => {
    console.error('Failed to get database info:', error);
  });

  return db;
}

export async function GET(request: NextRequest) {
  try {
    // Skip tracking if X-No-Track header is present
    const skipTracking = request.headers.get('X-No-Track') === '1';
    
    // Rate limiting
    const rateLimiter = rateLimit({
      interval: 60 * 1000,
      uniqueTokenPerInterval: 500
    });

    const ip = skipTracking ? 'dashboard' : (request.headers.get('cf-connecting-ip') || 'unknown');
    await rateLimiter.check(30, ip);

    const db = getDB();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    // Calculate date range
    const now = new Date();
    const daysToSubtract = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS

    console.log('Fetching analytics for period:', period, 'starting from:', startDateStr);

    // First, verify tables exist and get counts
    const tables = await db.prepare(`
      SELECT 
        t.name,
        CASE 
          WHEN t.name = 'sessions' THEN (SELECT COUNT(*) FROM sessions)
          WHEN t.name = 'pageviews' THEN (SELECT COUNT(*) FROM pageviews)
          WHEN t.name = 'events' THEN (SELECT COUNT(*) FROM events)
        END as count
      FROM sqlite_master t
      WHERE t.type='table' AND t.name IN ('sessions', 'pageviews', 'events')
    `).all();
    console.log('Tables and counts:', tables.results);

    // Check if there are any sessions
    const sessionCount = await db.prepare(`
      SELECT COUNT(*) as count, MIN(start_time) as earliest, MAX(start_time) as latest 
      FROM sessions
    `).first();
    console.log('Session stats:', sessionCount);

    // Session Metrics
    console.log('Querying session metrics...');
    const sessionStats = await db.prepare(`
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        ROUND(AVG(CASE 
          WHEN total_time_ms > 0 THEN total_time_ms 
          ELSE NULL 
        END)) as avg_duration,
        ROUND(SUM(CASE 
          WHEN is_bounce = 1 THEN 1 
          ELSE 0 
        END) * 100.0 / NULLIF(COUNT(*), 0), 2) as bounce_rate,
        COUNT(DISTINCT CASE 
          WHEN page_count = 1 THEN session_id 
          END) as new_users,
        COUNT(DISTINCT CASE 
          WHEN page_count > 1 THEN session_id 
          END) as returning_users
      FROM sessions
      WHERE datetime(start_time) >= datetime(?)
    `).bind(startDateStr).all() as DBQueryResult<DBSessionStats>;
    console.log('Session stats:', sessionStats.results);

    // Page Metrics
    console.log('Querying page metrics...');
    const pageStats = await db.prepare(`
      SELECT 
        p.page_path,
        COUNT(*) as views,
        COUNT(DISTINCT s.session_id) as unique_views,
        ROUND(AVG(CASE 
          WHEN p.time_on_page_ms > 0 THEN p.time_on_page_ms 
          ELSE NULL 
        END)) as avg_time,
        ROUND(SUM(CASE 
          WHEN p.is_exit = 1 THEN 1 
          ELSE 0 
        END) * 100.0 / NULLIF(COUNT(*), 0), 2) as exit_rate,
        ROUND(AVG(CASE 
          WHEN p.max_scroll_percentage > 0 THEN p.max_scroll_percentage 
          ELSE NULL 
        END), 2) as scroll_depth
      FROM pageviews p
      JOIN sessions s ON s.session_id = p.session_id
      WHERE datetime(p.timestamp) >= datetime(?)
      GROUP BY p.page_path
      ORDER BY views DESC
      LIMIT 10
    `).bind(startDateStr).all() as DBQueryResult<DBPageStats>;
    console.log('Page stats:', pageStats.results);

    // Traffic Sources
    const trafficSources = await db.prepare(`
      SELECT 
        COALESCE(referrer, 'direct') as source,
        COUNT(DISTINCT session_id) as sessions,
        ROUND(SUM(CASE 
          WHEN is_bounce = 1 THEN 1 
          ELSE 0 
        END) * 100.0 / NULLIF(COUNT(*), 0), 2) as bounce_rate,
        ROUND(AVG(CASE 
          WHEN total_time_ms > 0 THEN total_time_ms 
          ELSE NULL 
        END)) as avg_duration
      FROM sessions
      WHERE datetime(start_time) >= datetime(?)
      GROUP BY COALESCE(referrer, 'direct')
      ORDER BY sessions DESC
      LIMIT 10
    `).bind(startDateStr).all() as DBQueryResult<DBTrafficSource>;

    // Country Stats
    const countryStats = await db.prepare(`
      SELECT 
        country,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT session_id) as users
      FROM sessions
      WHERE start_time > ?
      AND country IS NOT NULL
      GROUP BY country
      ORDER BY sessions DESC
      LIMIT 10
    `).bind(startDateStr).all() as DBQueryResult<DBCountryStats>;

    // Device Stats
    const deviceStats = await db.prepare(`
      SELECT 
        device,
        COUNT(DISTINCT session_id) as sessions,
        ROUND(SUM(CASE 
          WHEN is_bounce = 1 THEN 1 
          ELSE 0 
        END) * 100.0 / NULLIF(COUNT(*), 0), 2) as bounce_rate
      FROM sessions
      WHERE datetime(start_time) >= datetime(?)
      GROUP BY device
      ORDER BY sessions DESC
    `).bind(startDateStr).all() as DBQueryResult<DBDeviceStats>;

    // Engagement Stats
    const engagementStats = await db.prepare(`
      WITH click_stats AS (
        SELECT 
          event_name as element_id,
          COUNT(*) as clicks,
          COUNT(DISTINCT session_id) as unique_clicks
        FROM events
        WHERE event_type = 'click'
        AND datetime(timestamp) >= datetime(?)
        GROUP BY event_name
      ),
      scroll_stats AS (
        SELECT ROUND(AVG(CASE 
          WHEN max_scroll_percentage > 0 THEN max_scroll_percentage 
          ELSE NULL 
        END), 2) as avg_scroll_depth
        FROM pageviews
        WHERE datetime(timestamp) >= datetime(?)
      ),
      session_stats AS (
        SELECT 
          ROUND(AVG(CASE 
            WHEN total_time_ms > 0 THEN total_time_ms 
            ELSE NULL 
          END)) as avg_session_duration,
          ROUND(AVG(CASE 
            WHEN page_count > 0 THEN page_count 
            ELSE NULL 
          END), 2) as pageviews_per_session
        FROM sessions
        WHERE datetime(start_time) >= datetime(?)
      )
      SELECT 
        cs.element_id,
        cs.clicks,
        cs.unique_clicks,
        COALESCE(ss.avg_scroll_depth, 0) as avg_scroll_depth,
        COALESCE(ses.avg_session_duration, 0) as avg_session_duration,
        COALESCE(ses.pageviews_per_session, 0) as pageviews_per_session
      FROM click_stats cs
      CROSS JOIN scroll_stats ss
      CROSS JOIN session_stats ses
      ORDER BY cs.clicks DESC
      LIMIT 10
    `).bind(startDateStr, startDateStr, startDateStr).all() as DBQueryResult<DBEngagementStats>;

    // Calculate scroll depth percentiles
    const scrollDepth = await db.prepare(`
      WITH scroll_percentiles AS (
        SELECT 
          ROUND(SUM(CASE WHEN max_scroll_percentage >= 25 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as p25,
          ROUND(SUM(CASE WHEN max_scroll_percentage >= 50 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as p50,
          ROUND(SUM(CASE WHEN max_scroll_percentage >= 75 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as p75,
          ROUND(SUM(CASE WHEN max_scroll_percentage = 100 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as p100
        FROM pageviews
        WHERE datetime(timestamp) >= datetime(?)
      )
      SELECT * FROM scroll_percentiles
    `).bind(startDateStr).all();

    const responseData = {
      sessions: sessionStats.results[0] || {
        total_sessions: 0,
        avg_duration: 0,
        bounce_rate: 0,
        new_users: 0,
        returning_users: 0
      },
      pages: {
        stats: pageStats.results || [],
        scrollDepth: {
          25: scrollDepth.results[0]?.p25 || 0,
          50: scrollDepth.results[0]?.p50 || 0,
          75: scrollDepth.results[0]?.p75 || 0,
          100: scrollDepth.results[0]?.p100 || 0
        }
      },
      traffic: {
        bySource: trafficSources.results || [],
        byCountry: countryStats.results || [],
        byDevice: deviceStats.results || []
      },
      engagement: engagementStats.results[0] || {
        element_id: '',
        clicks: 0,
        unique_clicks: 0,
        avg_scroll_depth: 0,
        avg_session_duration: 0,
        pageviews_per_session: 0
      }
    };

    console.log('Analytics response data:', responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 