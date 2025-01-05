// Event types for tracking
export type EventType = 'click' | 'scroll' | 'engagement';

export interface EventData {
  // Click events
  elementId?: string;
  elementText?: string;
  elementType?: string;
  // Scroll events
  scrollDepth?: number;
  scrollDirection?: 'up' | 'down';
  // Engagement events
  timeSpent?: number;
}

// Analytics Metrics Types
export interface SessionMetrics {
  totalSessions: number;
  averageDuration: number;
  bounceRate: number;
  newUsers: number;
  returningUsers: number;
}

export interface PageMetrics {
  pageViews: number;
  uniquePageViews: number;
  averageTimeOnPage: number;
  exitRate: number;
  scrollDepth: {
    25: number;
    50: number;
    75: number;
    100: number;
  };
}

export interface TrafficMetrics {
  bySource: Array<{
    source: string;
    sessions: number;
    bounceRate: number;
    avgDuration: number;
  }>;
  byCountry: Array<{
    country: string;
    sessions: number;
    users: number;
  }>;
  byDevice: Array<{
    device: string;
    sessions: number;
    bounceRate: number;
  }>;
}

export interface EngagementMetrics {
  clicksByElement: Array<{
    elementId: string;
    clicks: number;
    uniqueClicks: number;
  }>;
  scrollDepthAvg: number;
  avgSessionDuration: number;
  pageviewsPerSession: number;
}

// Database Query Result Types
export interface DBQueryResult<T> {
  results: T[];
}

export interface DBSessionStats {
  total_sessions: number;
  avg_duration: number;
  bounce_rate: number;
  new_users: number;
  returning_users: number;
}

export interface DBPageStats {
  page_path: string;
  views: number;
  unique_views: number;
  avg_time: number;
  exit_rate: number;
  scroll_depth: number;
}

export interface DBTrafficSource {
  source: string;
  sessions: number;
  bounce_rate: number;
  avg_duration: number;
}

export interface DBCountryStats {
  country: string;
  sessions: number;
  users: number;
}

export interface DBDeviceStats {
  device: string;
  sessions: number;
  bounce_rate: number;
}

export interface DBEngagementStats {
  element_id: string;
  clicks: number;
  unique_clicks: number;
  avg_scroll_depth: number;
  avg_session_duration: number;
  pageviews_per_session: number;
} 