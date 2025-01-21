import { D1Database, D1Result } from '@cloudflare/workers-types';

export interface TrackingData {
  sessionId: string | null;
  event?: string;
  page?: string;
  scrollDepth?: string;
  element?: string;
  href?: string;
  section?: string;
  timeSpent?: number;
  timestamp?: number;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  referrer?: string;
  deviceType?: string;
  // Performance metrics
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
}

export interface MetricsTimeframe {
  startTime?: number;  // Unix timestamp in milliseconds
  endTime?: number;    // Unix timestamp in milliseconds
}

export interface AnalyticsMetrics {
  totalVisitors: number;
  bounceRate: number;
  avgTimeSpentSeconds: number;
  topPages: Array<{ page: string; views: number }>;
  clickThroughRates: Array<{ element: string; clicks: number; ctr: number }>;
  deviceBreakdown: Array<{ device_type: string; count: number }>;
  countryBreakdown: Array<{ country: string; count: number }>;
  conversionRate?: number;
}

interface PageViewResult {
  page: string;
  views: number;
}

interface ClickThroughResult {
  element: string;
  clicks: number;
  ctr: number;
}

interface DeviceBreakdownResult {
  device_type: string;
  count: number;
}

interface CountryBreakdownResult {
  country: string;
  count: number;
}

export class Analytics {
  constructor(private db: D1Database) {}

  async handleTracking(data: TrackingData) {
    if (!data.sessionId) {
      throw new Error('Missing required session ID');
    }

    const timestamp = data.timestamp || Date.now();

    // Check if session exists
    const existingSession = await this.db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .bind(data.sessionId)
      .first();

    if (!existingSession && data.event !== 'session_start') {
      throw new Error('Invalid session');
    }

    // Handle session start
    if (data.event === 'session_start') {
      if (!existingSession) {
        await this.db
          .prepare(`
            INSERT INTO sessions (
              session_id, start_time, user_agent, ip_address, 
              referrer, device_type, country, city, latitude, longitude
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            data.sessionId,
            timestamp,
            data.userAgent || null,
            data.ipAddress || null,
            data.referrer || null,
            data.deviceType || null,
            data.country || null,
            data.city || null,
            data.latitude || null,
            data.longitude || null
          )
          .run();
      }
      return { success: true };
    }

    // Handle session end
    if (data.event === 'session_end') {
      await this.db
        .prepare('UPDATE sessions SET end_time = ? WHERE session_id = ?')
        .bind(timestamp, data.sessionId)
        .run();

      // Update the last page view with time spent
      if (data.timeSpent) {
        await this.db
          .prepare(`
            UPDATE page_views 
            SET time_spent = ? 
            WHERE session_id = ? 
            AND id = (
              SELECT id 
              FROM page_views 
              WHERE session_id = ? 
              ORDER BY timestamp DESC 
              LIMIT 1
            )
          `)
          .bind(data.timeSpent, data.sessionId, data.sessionId)
          .run();
      }
      return { success: true };
    }

    // Track page views with performance metrics
    if (data.page) {
      // First, update the previous page view with time spent if available
      if (data.timeSpent) {
        await this.db
          .prepare(`
            UPDATE page_views 
            SET time_spent = ? 
            WHERE session_id = ? 
            AND id = (
              SELECT id 
              FROM page_views 
              WHERE session_id = ? 
              ORDER BY timestamp DESC 
              LIMIT 1
            )
          `)
          .bind(data.timeSpent, data.sessionId, data.sessionId)
          .run();
      }

      // Then insert the new page view
      await this.db
        .prepare(`
          INSERT INTO page_views (
            session_id, page, timestamp, scroll_depth, time_spent,
            ttfb, fcp, lcp, cls, fid
          ) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          data.sessionId,
          data.page,
          timestamp,
          data.scrollDepth ? parseInt(data.scrollDepth) : null,
          data.timeSpent || null,
          data.ttfb || null,
          data.fcp || null,
          data.lcp || null,
          data.cls || null,
          data.fid || null
        )
        .run();
    }

    // Track events
    if (data.event && !['session_start', 'session_end'].includes(data.event)) {
      await this.db
        .prepare(`
          INSERT INTO events (
            session_id, event_name, element, href, timestamp
          ) 
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          data.sessionId,
          data.event,
          data.element || null,
          data.href || null,
          timestamp
        )
        .run();

      // If this is a performance event, update the latest page view with metrics
      if (data.event === 'performance') {
        await this.db
          .prepare(`
            UPDATE page_views 
            SET 
              ttfb = COALESCE(?, ttfb),
              fcp = COALESCE(?, fcp),
              lcp = COALESCE(?, lcp),
              cls = COALESCE(?, cls),
              fid = COALESCE(?, fid)
            WHERE session_id = ? 
            AND id = (
              SELECT id 
              FROM page_views 
              WHERE session_id = ? 
              ORDER BY timestamp DESC 
              LIMIT 1
            )
          `)
          .bind(
            data.ttfb || null,
            data.fcp || null,
            data.lcp || null,
            data.cls || null,
            data.fid || null,
            data.sessionId,
            data.sessionId
          )
          .run();
      }
    }

    return { success: true };
  }

  private getTimeframeCondition(timeframe?: MetricsTimeframe, field: string = 'timestamp'): string {
    if (!timeframe) return '';
    const conditions = [];
    if (timeframe.startTime) {
      conditions.push(`${field} >= ${timeframe.startTime}`);
    }
    if (timeframe.endTime) {
      conditions.push(`${field} <= ${timeframe.endTime}`);
    }
    return conditions.length ? conditions.join(' AND ') : '';
  }

  async getMetrics(timeframe?: MetricsTimeframe): Promise<AnalyticsMetrics> {
    const timeCondition = this.getTimeframeCondition(timeframe, 'pv.timestamp');
    const sessionTimeCondition = this.getTimeframeCondition(timeframe, 's.start_time');
    
    // Get total visitors (unique sessions)
    const visitors = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT session_id) as count 
        FROM sessions s
        ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
      `)
      .first<{ count: number }>();
    
    // Get bounce rate (sessions with only one page view)
    const bounceRate = await this.db
      .prepare(`
        WITH session_page_counts AS (
          SELECT 
            s.session_id,
            COUNT(pv.id) as page_count
          FROM sessions s
          LEFT JOIN page_views pv ON s.session_id = pv.session_id
          ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
          ${timeCondition ? `AND ${timeCondition}` : ''}
          GROUP BY s.session_id
        )
        SELECT 
          ROUND(
            CAST(
              SUM(CASE WHEN page_count = 1 OR page_count IS NULL THEN 1 ELSE 0 END) AS FLOAT
            ) / 
            NULLIF(COUNT(*), 0) * 100,
            2
          ) as bounce_rate
        FROM session_page_counts
      `)
      .first<{ bounce_rate: number }>();

    // Get average time spent (in seconds)
    const avgTimeSpent = await this.db
      .prepare(`
        SELECT AVG(time_spent) / 1000 as avg_time
        FROM (
          SELECT 
            session_id,
            MAX(timestamp) - MIN(timestamp) as time_spent
          FROM page_views pv
          ${timeCondition ? `WHERE ${timeCondition}` : ''}
          GROUP BY session_id
          HAVING COUNT(*) > 1
        )
      `)
      .first<{ avg_time: number }>();

    // Get top pages
    const topPages = await this.db
      .prepare(`
        SELECT page, COUNT(*) as views
        FROM page_views pv
        ${timeCondition ? `WHERE ${timeCondition}` : ''}
        GROUP BY page
        ORDER BY views DESC
        LIMIT 10
      `)
      .all<PageViewResult>();

    // Get click-through rate for clickable elements
    const ctr = await this.db
      .prepare(`
        SELECT 
          e.element,
          COUNT(*) as clicks,
          ROUND(
            CAST(COUNT(*) AS FLOAT) / 
            NULLIF(
              (SELECT COUNT(DISTINCT session_id) 
               FROM sessions s
               ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
              ), 0
            ) * 100,
            2
          ) as ctr
        FROM events e
        JOIN sessions s ON e.session_id = s.session_id
        WHERE e.event_name = 'click'
        ${sessionTimeCondition ? `AND ${sessionTimeCondition}` : ''}
        GROUP BY e.element
        ORDER BY clicks DESC
        LIMIT 10
      `)
      .all<ClickThroughResult>();

    // Get device breakdown
    const deviceBreakdown = await this.db
      .prepare(`
        SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(*) as count
        FROM sessions s
        ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
        GROUP BY device_type
        ORDER BY count DESC
      `)
      .all<DeviceBreakdownResult>();

    // Get country breakdown
    const countryBreakdown = await this.db
      .prepare(`
        SELECT COALESCE(country, 'unknown') as country, COUNT(*) as count
        FROM sessions s
        ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
        GROUP BY country
        ORDER BY count DESC
      `)
      .all<CountryBreakdownResult>();

    // Calculate conversion rate
    const conversions = await this.db
      .prepare(`
        SELECT 
          ROUND(
            CAST(
              (SELECT COUNT(DISTINCT e.session_id) 
               FROM events e
               JOIN sessions s ON e.session_id = s.session_id
               WHERE e.event_name = 'conversion'
               ${sessionTimeCondition ? `AND ${sessionTimeCondition}` : ''}
              ) AS FLOAT
            ) / 
            NULLIF(
              (SELECT COUNT(DISTINCT session_id) 
               FROM sessions s
               ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
              ), 0
            ) * 100,
            2
          ) as conversion_rate
      `)
      .first<{ conversion_rate: number }>();

    return {
      totalVisitors: visitors?.count || 0,
      bounceRate: bounceRate?.bounce_rate || 0,
      avgTimeSpentSeconds: avgTimeSpent?.avg_time || 0,
      topPages: topPages?.results || [],
      clickThroughRates: ctr?.results || [],
      deviceBreakdown: deviceBreakdown?.results || [],
      countryBreakdown: countryBreakdown?.results || [],
      conversionRate: conversions?.conversion_rate || 0
    };
  }
} 