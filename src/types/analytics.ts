import { NextResponse } from 'next/server';

export interface RetentionMetrics {
  total_sessions: number;
  returning_sessions: number;
  avg_session_duration: number;
  bounce_rate: number;
}

export interface PageMetrics {
  total_pageviews: number;
  unique_pageviews: number;
  avg_time_on_page: number;
  top_pages: Array<{
    page: string;
    views: number;
  }>;
}

export interface DeviceMetrics {
  devices: Array<{
    device: string;
    sessions: number;
  }>;
  browsers: Array<{
    browser: string;
    sessions: number;
  }>;
}

export interface CTRMetrics {
  total_clicks: number;
  click_through_rate: number;
  top_clicked_elements: Array<{
    element: string;
    clicks: number;
  }>;
}

export interface TrackingResponse {
  session_id: string;
  is_new_session: boolean;
  event?: string;
  page?: string;
  scroll_depth?: number;
  element?: string;
  href?: string;
  error?: string;
}

export interface MetricsResponse {
  retention: RetentionMetrics;
  pages: PageMetrics;
  devices: DeviceMetrics;
  ctr: CTRMetrics;
  error?: string;
}

export type AnalyticsResponseData = TrackingResponse | MetricsResponse;

export interface AnalyticsResponse {
  data: AnalyticsResponseData;
  headers: Headers;
  json: () => Promise<AnalyticsResponseData>;
} 