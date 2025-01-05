import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';

export const runtime = 'edge';
export const preferredRegion = 'auto';

interface Env {
  DB: D1Database;
}

function getDB(): D1Database {
  // @ts-expect-error - Cloudflare bindings
  const env = process.env as Env;
  if (!env?.DB) {
    console.error('DB connection error:', { env: process.env });
    throw new Error('D1 database not found in environment');
  }
  return env.DB;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    const now = new Date();
    const daysToSubtract = period === '24h' ? 1 : period === '7d' ? 7 : 30;
    const startDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    const startDateStr = startDate.toISOString();

    // Get retention metrics with more accurate bounce and returning visitor calculation
    const retentionMetrics = await db.prepare(`
      WITH session_stats AS (
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          SUM(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END) as bounce_sessions,
          SUM(CASE WHEN is_returning = 1 THEN 1 ELSE 0 END) as returning_sessions,
          AVG(CASE WHEN total_time_ms > 0 THEN total_time_ms ELSE 0 END) as avg_duration,
          AVG(page_count) as avg_pages
        FROM sessions
        WHERE start_time > ?
      )
      SELECT 
        total_sessions,
        ROUND(CAST(bounce_sessions AS FLOAT) / NULLIF(total_sessions, 0) * 100, 1) as bounce_rate,
        avg_duration / 1000 as avg_session_duration,
        ROUND(avg_pages, 1) as avg_pages_per_session,
        ROUND(CAST(returning_sessions AS FLOAT) / NULLIF(total_sessions, 0) * 100, 1) as returning_visitor_rate
      FROM session_stats
    `).bind(startDateStr).all();

    // Get time on page metrics with better time calculation
    const timeOnPageMetrics = await db.prepare(`
      WITH page_stats AS (
        SELECT 
          page_path,
          COUNT(*) as views,
          AVG(CASE 
            WHEN time_on_page_ms > 0 THEN time_on_page_ms 
            ELSE NULL 
          END) / 1000 as avg_time_on_page,
          AVG(CASE 
            WHEN max_scroll_percentage > 0 THEN max_scroll_percentage 
            ELSE NULL 
          END) as avg_scroll_depth
        FROM pageviews
        WHERE timestamp > ?
        GROUP BY page_path
      )
      SELECT 
        page_path,
        views,
        COALESCE(avg_time_on_page, 0) as avg_time_on_page,
        COALESCE(avg_scroll_depth, 0) as avg_scroll_depth
      FROM page_stats
      ORDER BY views DESC
      LIMIT 20
    `).bind(startDateStr).all();

    // Get navigation paths with entry and exit points
    const navigationPaths = await db.prepare(`
      WITH path_stats AS (
        SELECT 
          page_path,
          COUNT(*) as frequency,
          SUM(CASE WHEN entry_page = 1 THEN 1 ELSE 0 END) as entry_count,
          SUM(CASE WHEN exit_page = 1 THEN 1 ELSE 0 END) as exit_count
        FROM pageviews
        WHERE timestamp > ?
        GROUP BY page_path
      )
      SELECT 
        page_path as path,
        frequency,
        ROUND(CAST(entry_count AS FLOAT) / frequency * 100, 1) as entry_rate,
        ROUND(CAST(exit_count AS FLOAT) / frequency * 100, 1) as exit_rate
      FROM path_stats
      ORDER BY frequency DESC
      LIMIT 10
    `).bind(startDateStr).all();

    // Get device metrics with browser info
    const deviceMetrics = await db.prepare(`
      SELECT 
        COALESCE(device, 'Unknown') as device,
        COALESCE(browser, 'Unknown') as browser,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT CASE WHEN is_returning = 1 THEN session_id END) as returning_sessions,
        COUNT(DISTINCT CASE WHEN is_bounce = 0 THEN session_id END) as engaged_sessions
      FROM sessions
      WHERE start_time > ?
      GROUP BY device, browser
      ORDER BY sessions DESC
    `).bind(startDateStr).all();

    // Get geographic data with engagement metrics
    const geographicData = await db.prepare(`
      SELECT 
        COALESCE(country, 'Unknown') as country,
        COALESCE(city, 'Unknown') as city,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT CASE WHEN is_returning = 1 THEN session_id END) as returning_visitors,
        ROUND(AVG(CASE WHEN is_bounce = 1 THEN 100 ELSE 0 END), 1) as bounce_rate,
        COALESCE(latitude, 0) as lat,
        COALESCE(longitude, 0) as lng
      FROM sessions
      WHERE start_time > ?
      GROUP BY country, city, latitude, longitude
      HAVING (country != 'Unknown' OR city != 'Unknown')
        AND (latitude IS NOT NULL AND longitude IS NOT NULL)
      ORDER BY sessions DESC
      LIMIT 50
    `).bind(startDateStr).all();

    const response = {
      retention: retentionMetrics.results[0] || {
        total_sessions: 0,
        bounce_rate: 0,
        avg_session_duration: 0,
        avg_pages_per_session: 0,
        returning_visitor_rate: 0
      },
      timeOnPage: timeOnPageMetrics.results || [],
      navigationPaths: navigationPaths.results || [],
      deviceMetrics: deviceMetrics.results || [],
      geographicData: geographicData.results || [],
      ctr: [], // Currently not implemented
      exitRates: [], // Currently not implemented
      formSubmissions: [] // Currently not implemented
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
} 