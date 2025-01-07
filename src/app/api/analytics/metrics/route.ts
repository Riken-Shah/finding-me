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
    const daysToSubtract = period === '24h' ? 1 : period === '7d' ? 7 : 30;
    const startDateStr = `-${daysToSubtract} days`;

    // Get retention metrics
    const retention = await db.prepare(`
      WITH session_stats AS (
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          SUM(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END) as bounced_sessions,
          AVG(CASE WHEN total_time_ms > 0 THEN total_time_ms ELSE NULL END) as avg_duration,
          AVG(CASE WHEN page_count > 0 THEN page_count ELSE NULL END) as avg_pages,
          SUM(CASE WHEN is_returning = 1 THEN 1 ELSE 0 END) as returning_sessions
        FROM sessions
        WHERE start_time > datetime('now', ?)
        AND end_time > start_time  /* Only count completed sessions */
      )
      SELECT 
        total_sessions,
        ROUND(CAST(bounced_sessions AS FLOAT) / NULLIF(total_sessions, 0) * 100, 2) as bounce_rate,
        ROUND(COALESCE(avg_duration, 0) / 1000, 2) as avg_session_duration,
        ROUND(COALESCE(avg_pages, 0), 2) as avg_pages_per_session,
        ROUND(CAST(returning_sessions AS FLOAT) / NULLIF(total_sessions, 0) * 100, 2) as returning_visitor_rate
      FROM session_stats
    `).bind(startDateStr).first();

    // Get time on page metrics with scroll depth
    const timeOnPageMetrics = await db.prepare(`
      WITH page_stats AS (
        SELECT 
          p.page_path,
          COUNT(*) as views,
          AVG(CASE 
            WHEN p.time_on_page_ms > 0 THEN p.time_on_page_ms 
            ELSE NULL 
          END) / 1000 as avg_time_on_page,
          MAX(CAST(JSON_EXTRACT(e.event_data, '$.max_scroll_depth') AS FLOAT)) as max_scroll_depth,
          AVG(CAST(JSON_EXTRACT(e.event_data, '$.scroll_depth') AS FLOAT)) as avg_scroll_depth
        FROM pageviews p
        LEFT JOIN events e ON e.session_id = p.session_id 
          AND e.page_path = p.page_path
          AND e.event_name = 'scroll'
        WHERE p.timestamp > datetime('now', ?)
        GROUP BY p.page_path
      )
      SELECT 
        page_path,
        views,
        COALESCE(avg_time_on_page, 0) as avg_time_on_page,
        COALESCE(max_scroll_depth, 0) as max_scroll_depth,
        COALESCE(avg_scroll_depth, 0) as avg_scroll_depth
      FROM page_stats
      ORDER BY views DESC
      LIMIT 20
    `).bind(startDateStr).all();

    // Get navigation paths with entry and exit points
    const navigationPaths = await db.prepare(`
      WITH path_stats AS (
        SELECT 
          p.page_path,
          COUNT(*) as frequency,
          SUM(CASE WHEN p.entry_page = 1 THEN 1 ELSE 0 END) as entry_count,
          SUM(CASE WHEN p.exit_page = 1 THEN 1 ELSE 0 END) as exit_count
        FROM pageviews p
        WHERE p.timestamp > datetime('now', ?)
        GROUP BY p.page_path
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
      WHERE start_time > datetime('now', ?)
      GROUP BY device, browser
      ORDER BY sessions DESC
    `).bind(startDateStr).all();

    // Get CTR metrics
    const ctrMetrics = await db.prepare(`
      WITH click_stats AS (
        SELECT 
          e.page_path,
          JSON_EXTRACT(e.event_data, '$.element_type') as element,
          JSON_EXTRACT(e.event_data, '$.target_url') as href,
          COUNT(*) as clicks,
          COUNT(DISTINCT e.session_id) as unique_clicks,
          AVG(CAST(JSON_EXTRACT(e.event_data, '$.click_x') AS FLOAT)) as avg_x,
          AVG(CAST(JSON_EXTRACT(e.event_data, '$.click_y') AS FLOAT)) as avg_y,
          MAX(CAST(JSON_EXTRACT(e.event_data, '$.viewport.width') AS INTEGER)) as viewport_width,
          MAX(CAST(JSON_EXTRACT(e.event_data, '$.viewport.height') AS INTEGER)) as viewport_height
        FROM events e
        WHERE e.event_name = 'click'
        AND e.timestamp > datetime('now', ?)
        GROUP BY e.page_path, 
          JSON_EXTRACT(e.event_data, '$.element_type'),
          JSON_EXTRACT(e.event_data, '$.target_url')
      ),
      page_stats AS (
        SELECT p.page_path, COUNT(DISTINCT p.session_id) as views
        FROM pageviews p
        WHERE p.timestamp > datetime('now', ?)
        GROUP BY p.page_path
      )
      SELECT 
        c.page_path,
        c.element,
        c.href,
        c.clicks,
        c.unique_clicks,
        p.views,
        ROUND(CAST(c.clicks AS FLOAT) / NULLIF(p.views, 0) * 100, 2) as ctr,
        ROUND(CAST(c.unique_clicks AS FLOAT) / NULLIF(p.views, 0) * 100, 2) as unique_ctr,
        ROUND(c.avg_x, 0) as avg_x,
        ROUND(c.avg_y, 0) as avg_y,
        c.viewport_width,
        c.viewport_height
      FROM click_stats c
      LEFT JOIN page_stats p ON c.page_path = p.page_path
      ORDER BY c.clicks DESC
      LIMIT 20
    `).bind(startDateStr, startDateStr).all();

    // Get geographic data with engagement metrics
    const geographicData = await db.prepare(`
      WITH geo_stats AS (
        SELECT 
          COALESCE(country, 'Unknown') as country,
          COALESCE(city, 'Unknown') as city,
          COALESCE(latitude, 0) as latitude,
          COALESCE(longitude, 0) as longitude,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(DISTINCT CASE WHEN is_returning = 1 THEN session_id END) as returning_visitors,
          SUM(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END) as bounced_sessions,
          AVG(CASE WHEN total_time_ms > 0 THEN total_time_ms ELSE NULL END) as avg_duration,
          AVG(CASE WHEN page_count > 0 THEN page_count ELSE NULL END) as avg_pages
        FROM sessions
        WHERE start_time > datetime('now', ?)
        AND (latitude IS NOT NULL OR longitude IS NOT NULL)
        GROUP BY country, city, latitude, longitude
        HAVING latitude != 0 OR longitude != 0
      )
      SELECT 
        country,
        city,
        sessions,
        returning_visitors,
        ROUND(CAST(bounced_sessions AS FLOAT) / NULLIF(sessions, 0) * 100, 1) as bounce_rate,
        ROUND(avg_duration / 1000, 1) as avg_session_duration,
        ROUND(avg_pages, 1) as avg_pages_per_session,
        CAST(latitude AS FLOAT) as lat,
        CAST(longitude AS FLOAT) as lng
      FROM geo_stats
      ORDER BY sessions DESC
      LIMIT 50
    `).bind(startDateStr).all();

    const response = {
      retention: retention || {
        total_sessions: 0,
        bounce_rate: 0,
        avg_session_duration: 0,
        avg_pages_per_session: 0,
        returning_visitor_rate: 0
      },
      timeOnPage: (timeOnPageMetrics?.results || timeOnPageMetrics || []).map(row => ({
        ...row,
        avg_time_on_page: row.avg_time_on_page || 0,
        max_scroll_depth: row.max_scroll_depth || 0,
        avg_scroll_depth: row.avg_scroll_depth || 0
      })),
      navigationPaths: (navigationPaths?.results || navigationPaths || []).map(row => ({
        ...row,
        entry_rate: row.entry_rate || 0,
        exit_rate: row.exit_rate || 0
      })),
      deviceMetrics: (deviceMetrics?.results || deviceMetrics || []).map(row => ({
        ...row,
        sessions: row.sessions || 0,
        returning_sessions: row.returning_sessions || 0,
        engaged_sessions: row.engaged_sessions || 0
      })),
      geographicData: (geographicData?.results || geographicData || []).map(row => ({
        ...row,
        sessions: row.sessions || 0,
        returning_visitors: row.returning_visitors || 0,
        bounce_rate: row.bounce_rate || 0,
        lat: row.lat ? Number(row.lat) : undefined,
        lng: row.lng ? Number(row.lng) : undefined
      })),
      ctr: (ctrMetrics?.results || ctrMetrics || []).map(row => ({
        ...row,
        clicks: row.clicks || 0,
        unique_clicks: row.unique_clicks || 0,
        views: row.views || 0,
        ctr: row.ctr || 0,
        unique_ctr: row.unique_ctr || 0
      })),
      exitRates: [], // Currently not implemented
      formSubmissions: [] // Currently not implemented
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
} 