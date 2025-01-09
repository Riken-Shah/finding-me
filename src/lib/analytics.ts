import { getDB } from '@/lib/db';
import { RetentionMetrics, PageMetrics, DeviceMetrics, CTRMetrics, TrackingResponse } from '@/types/analytics';

export class Analytics {
  private db = getDB();

  async getSession(sessionId: string) {
    const query = `
      SELECT session_id
      FROM sessions
      WHERE session_id = ?
      AND created_at > datetime('now', '-24 hours')
    `;
    return await this.db.get(query, [sessionId]);
  }

  async createSession(sessionId: string) {
    const query = `
      INSERT INTO sessions (session_id, created_at)
      VALUES (?, datetime('now'))
    `;
    await this.db.run(query, [sessionId]);
  }

  async trackEvent(
    sessionId: string,
    event: string,
    page?: string,
    scrollDepth?: number,
    element?: string,
    href?: string
  ) {
    const query = `
      INSERT INTO events (session_id, event_type, page, scroll_depth, element, href, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    await this.db.run(query, [sessionId, event, page, scrollDepth, element, href]);
  }

  async handleTracking(params: {
    sessionId: string | null;
    event?: string;
    page?: string;
    scrollDepth?: string;
    element?: string;
    href?: string;
  }): Promise<TrackingResponse> {
    const { sessionId: requestedSessionId, event, page, scrollDepth, element, href } = params;

    // Validate required parameters
    if (event === 'pageview' && !page) {
      throw new Error('Missing required parameter: page');
    }
    if (event === 'scroll' && !scrollDepth) {
      throw new Error('Missing required parameter: scrollDepth');
    }
    if (event === 'click' && (!element || !href)) {
      throw new Error('Missing required parameters: element and href');
    }

    // Handle session
    let activeSessionId: string;
    let isNewSession: boolean;

    if (requestedSessionId) {
      const existingSession = await this.getSession(requestedSessionId);
      if (existingSession) {
        activeSessionId = existingSession.session_id;
        isNewSession = false;
      } else {
        activeSessionId = crypto.randomUUID();
        isNewSession = true;
        await this.createSession(activeSessionId);
      }
    } else {
      activeSessionId = crypto.randomUUID();
      isNewSession = true;
      await this.createSession(activeSessionId);
    }

    // Track event if provided
    if (event) {
      await this.trackEvent(
        activeSessionId,
        event,
        page,
        scrollDepth ? parseInt(scrollDepth) : undefined,
        element,
        href
      );
    }

    return {
      session_id: activeSessionId,
      is_new_session: isNewSession,
      event: event || undefined,
      page: page || undefined,
      scroll_depth: scrollDepth ? parseInt(scrollDepth) : undefined,
      element: element || undefined,
      href: href || undefined,
    };
  }

  async getRetentionMetrics(timePeriod: string): Promise<RetentionMetrics> {
    const timeFilter = this.getTimeFilter(timePeriod);
    const query = `
      WITH session_stats AS (
        SELECT
          session_id,
          COUNT(DISTINCT page) as pages_visited,
          MAX(julianday(created_at)) - MIN(julianday(created_at)) * 86400 as duration
        FROM events
        WHERE created_at ${timeFilter}
        GROUP BY session_id
      )
      SELECT
        COUNT(DISTINCT s.session_id) as total_sessions,
        SUM(CASE WHEN e2.session_id IS NOT NULL THEN 1 ELSE 0 END) as returning_sessions,
        AVG(s.duration) as avg_session_duration,
        AVG(CASE WHEN s.pages_visited = 1 THEN 1 ELSE 0 END) as bounce_rate
      FROM sessions s
      LEFT JOIN session_stats ss ON s.session_id = ss.session_id
      LEFT JOIN events e2 ON s.session_id = e2.session_id
      WHERE s.created_at ${timeFilter}
    `;
    const result = await this.db.get(query);
    return {
      total_sessions: result.total_sessions || 0,
      returning_sessions: result.returning_sessions || 0,
      avg_session_duration: result.avg_session_duration || 0,
      bounce_rate: result.bounce_rate || 0,
    };
  }

  async getPageMetrics(timePeriod: string): Promise<PageMetrics> {
    const timeFilter = this.getTimeFilter(timePeriod);
    const query = `
      WITH page_stats AS (
        SELECT
          page,
          COUNT(*) as views,
          COUNT(DISTINCT session_id) as unique_views,
          AVG(julianday(created_at) - julianday(LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at))) * 86400 as time_on_page
        FROM events
        WHERE created_at ${timeFilter} AND page IS NOT NULL
        GROUP BY page
      )
      SELECT
        SUM(views) as total_pageviews,
        SUM(unique_views) as unique_pageviews,
        AVG(time_on_page) as avg_time_on_page,
        json_group_array(
          json_object(
            'page', page,
            'views', views
          )
        ) as top_pages
      FROM page_stats
      ORDER BY views DESC
      LIMIT 10
    `;
    const result = await this.db.get(query);
    return {
      total_pageviews: result.total_pageviews || 0,
      unique_pageviews: result.unique_pageviews || 0,
      avg_time_on_page: result.avg_time_on_page || 0,
      top_pages: JSON.parse(result.top_pages || '[]'),
    };
  }

  async getDeviceMetrics(timePeriod: string): Promise<DeviceMetrics> {
    const timeFilter = this.getTimeFilter(timePeriod);
    const deviceQuery = `
      SELECT
        device,
        COUNT(DISTINCT session_id) as sessions
      FROM events
      WHERE created_at ${timeFilter} AND device IS NOT NULL
      GROUP BY device
      ORDER BY sessions DESC
    `;
    const browserQuery = `
      SELECT
        browser,
        COUNT(DISTINCT session_id) as sessions
      FROM events
      WHERE created_at ${timeFilter} AND browser IS NOT NULL
      GROUP BY browser
      ORDER BY sessions DESC
    `;
    const devices = await this.db.all(deviceQuery);
    const browsers = await this.db.all(browserQuery);
    return {
      devices,
      browsers,
    };
  }

  async getCTRMetrics(timePeriod: string): Promise<CTRMetrics> {
    const timeFilter = this.getTimeFilter(timePeriod);
    const query = `
      WITH click_stats AS (
        SELECT
          element,
          COUNT(*) as clicks
        FROM events
        WHERE created_at ${timeFilter} AND event_type = 'click' AND element IS NOT NULL
        GROUP BY element
      )
      SELECT
        SUM(clicks) as total_clicks,
        CAST(SUM(clicks) AS FLOAT) / (
          SELECT COUNT(*)
          FROM events
          WHERE created_at ${timeFilter} AND event_type = 'pageview'
        ) as click_through_rate,
        json_group_array(
          json_object(
            'element', element,
            'clicks', clicks
          )
        ) as top_clicked_elements
      FROM click_stats
      ORDER BY clicks DESC
      LIMIT 10
    `;
    const result = await this.db.get(query);
    return {
      total_clicks: result.total_clicks || 0,
      click_through_rate: result.click_through_rate || 0,
      top_clicked_elements: JSON.parse(result.top_clicked_elements || '[]'),
    };
  }

  private getTimeFilter(timePeriod: string): string {
    const periods: { [key: string]: string } = {
      '24h': "datetime('now', '-24 hours')",
      '7d': "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
    };
    return `> ${periods[timePeriod] || periods['24h']}`;
  }
} 