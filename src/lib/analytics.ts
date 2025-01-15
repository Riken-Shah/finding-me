import { Database } from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

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

interface SessionRow {
  session_id: string;
  start_time: number;
  end_time?: number;
  user_agent?: string;
  ip_address?: string;
  referrer?: string;
  device_type?: string;
}

interface PageViewRow {
  id: number;
  session_id: string;
  page: string;
  timestamp: number;
  time_spent?: number;
  scroll_depth?: number;
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
}

interface EventRow {
  id: number;
  session_id: string;
  event_name: string;
  element?: string;
  href?: string;
  timestamp: number;
}

interface CountMetricRow {
  count: number;
}

interface BounceRateRow {
  bounce_rate: number;
}

interface AvgTimeRow {
  avg_time: number;
}

interface PageViewMetricRow {
  page: string;
  views: number;
}

interface ClickMetricRow {
  element: string;
  clicks: number;
  ctr: number;
}

interface DeviceMetricRow {
  device_type: string;
  count: number;
}

interface CountryMetricRow {
  country: string;
  count: number;
}

interface ConversionRateRow {
  conversion_rate: number;
}

interface SectionViewRow {
  id: number;
  session_id: string;
  section: string;
  time_spent: number;
  timestamp: number;
}

export class Analytics {
  private db: Database;
  private dbPath: string;
  private initialized: Promise<void>;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'analytics.db');
    this.db = new Database(this.dbPath);
    this.initialized = this.initializeDatabase();
  }

  private async initializeDatabase() {
    const run = promisify<string, void>(this.db.run.bind(this.db));
    
    // Sessions table
    await run(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        start_time INTEGER,
        end_time INTEGER,
        user_agent TEXT,
        ip_address TEXT,
        referrer TEXT,
        device_type TEXT,
        country TEXT
      )
    `);

    // Page views table
    await run(`
      CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        page TEXT,
        timestamp INTEGER,
        time_spent INTEGER,
        scroll_depth INTEGER,
        ttfb INTEGER,
        fcp INTEGER,
        lcp INTEGER,
        cls INTEGER,
        fid INTEGER,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id)
      )
    `);

    // Events table
    await run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        event_name TEXT,
        element TEXT,
        href TEXT,
        timestamp INTEGER,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id)
      )
    `);
  }

  async handleTracking(data: TrackingData) {
    await this.initialized;

    if (!data.sessionId) {
      throw new Error('Missing required session ID');
    }

    const timestamp = data.timestamp || Date.now();
    const get = promisify<string, any[], SessionRow>(this.db.get.bind(this.db));
    const run = promisify<string, any[], void>(this.db.run.bind(this.db));

    // Check if session exists
    const existingSession = await get('SELECT * FROM sessions WHERE session_id = ?', [data.sessionId]);

    if (!existingSession && data.event !== 'session_start') {
      throw new Error('Invalid session');
    }

    // Handle session start
    if (data.event === 'session_start') {
      if (!existingSession) {
        await run(
          'INSERT INTO sessions (session_id, start_time, user_agent, ip_address, referrer, device_type, country) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [data.sessionId, timestamp, data.userAgent, data.ipAddress, data.referrer, data.deviceType, data.country]
        );
      }
      return { success: true };
    }

    // Handle session end
    if (data.event === 'session_end') {
      await run(
        'UPDATE sessions SET end_time = ? WHERE session_id = ?',
        [timestamp, data.sessionId]
      );
      return { success: true };
    }

    // Track page views
    if (data.page) {
      await run(
        'INSERT INTO page_views (session_id, page, timestamp, scroll_depth, ttfb, fcp, lcp, cls, fid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [data.sessionId, data.page, timestamp, data.scrollDepth ? parseInt(data.scrollDepth) : null, data.ttfb, data.fcp, data.lcp, data.cls, data.fid]
      );
    }

    // Track events
    if (data.event && !['session_start', 'session_end'].includes(data.event)) {
      await run(
        'INSERT INTO events (session_id, event_name, element, href, timestamp) VALUES (?, ?, ?, ?, ?)',
        [data.sessionId, data.event, data.element, data.href, timestamp]
      );
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
    await this.initialized;
    
    const all = promisify<string, any[], any[]>(this.db.all.bind(this.db));
    const timeCondition = this.getTimeframeCondition(timeframe, 'pv.timestamp');
    const sessionTimeCondition = this.getTimeframeCondition(timeframe, 's.start_time');
    
    // Get total visitors (unique sessions)
    const visitors = await all(`
      SELECT COUNT(DISTINCT session_id) as count 
      FROM sessions s
      ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
    `, []) as CountMetricRow[];
    
    // Get bounce rate (sessions with only one page view)
    const bounceRate = await all(`
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
    `, []) as BounceRateRow[];

    // Get average time spent (in seconds)
    const avgTimeSpent = await all(`
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
    `, []) as AvgTimeRow[];

    // Get top pages
    const topPages = await all(`
      SELECT page, COUNT(*) as views
      FROM page_views pv
      ${timeCondition ? `WHERE ${timeCondition}` : ''}
      GROUP BY page
      ORDER BY views DESC
      LIMIT 10
    `, []) as PageViewMetricRow[];

    // Get click-through rate for clickable elements
    const ctr = await all(`
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
    `, []) as ClickMetricRow[];

    // Get device breakdown
    const deviceBreakdown = await all(`
      SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(*) as count
      FROM sessions s
      ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
      GROUP BY device_type
      ORDER BY count DESC
    `, []) as DeviceMetricRow[];

    // Get country breakdown
    const countryBreakdown = await all(`
      SELECT COALESCE(country, 'unknown') as country, COUNT(*) as count
      FROM sessions s
      ${sessionTimeCondition ? `WHERE ${sessionTimeCondition}` : ''}
      GROUP BY country
      ORDER BY count DESC
    `, []) as CountryMetricRow[];

    // Calculate conversion rate
    const conversions = await all(`
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
    `, []) as ConversionRateRow[];

    return {
      totalVisitors: visitors[0]?.count || 0,
      bounceRate: bounceRate[0]?.bounce_rate || 0,
      avgTimeSpentSeconds: avgTimeSpent[0]?.avg_time || 0,
      topPages: topPages.map(row => ({ page: row.page, views: row.views })),
      clickThroughRates: ctr.map(row => ({ 
        element: row.element, 
        clicks: row.clicks,
        ctr: row.ctr 
      })),
      deviceBreakdown: deviceBreakdown.map(row => ({ 
        device_type: row.device_type || 'unknown',
        count: row.count
      })),
      countryBreakdown: countryBreakdown.map(row => ({ 
        country: row.country || 'unknown',
        count: row.count
      })),
      conversionRate: conversions[0]?.conversion_rate || 0
    };
  }

  async close() {
    await this.initialized;
    return new Promise<void>((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
} 