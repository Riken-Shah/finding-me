import { NextRequest } from 'next/server';
import { Analytics } from '@/lib/analytics';
import { GET } from '@/app/api/analytics/metrics/route';
import { MetricsResponse } from '@/types/analytics';

// Mock Analytics class
jest.mock('@/lib/analytics');

describe('Analytics Metrics', () => {
  let analytics: jest.Mocked<Analytics>;

  beforeEach(() => {
    jest.clearAllMocks();
    analytics = new Analytics() as jest.Mocked<Analytics>;
    (Analytics as jest.MockedClass<typeof Analytics>).mockImplementation(() => analytics);
  });

  describe('Retention Metrics', () => {
    it('should return correct retention metrics', async () => {
      const mockRetentionMetrics = {
        total_sessions: 100,
        returning_sessions: 40,
        avg_session_duration: 300,
        bounce_rate: 0.25,
      };

      analytics.getRetentionMetrics.mockResolvedValueOnce(mockRetentionMetrics);

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
        headers: {
          'x-time-period': '7d',
        },
      });

      const response = await GET(request);
      const data = await response.json() as MetricsResponse;

      expect(data.retention).toEqual(mockRetentionMetrics);
      expect(analytics.getRetentionMetrics).toHaveBeenCalledWith('7d');
    });
  });

  describe('Page Metrics', () => {
    it('should return correct page metrics', async () => {
      const mockPageMetrics = {
        total_pageviews: 1000,
        unique_pageviews: 800,
        avg_time_on_page: 180,
        top_pages: [
          { page: '/blog', views: 300 },
          { page: '/about', views: 200 },
        ],
      };

      analytics.getPageMetrics.mockResolvedValueOnce(mockPageMetrics);

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
        headers: {
          'x-time-period': '7d',
        },
      });

      const response = await GET(request);
      const data = await response.json() as MetricsResponse;

      expect(data.pages).toEqual(mockPageMetrics);
      expect(analytics.getPageMetrics).toHaveBeenCalledWith('7d');
    });
  });

  describe('Device Metrics', () => {
    it('should return correct device metrics', async () => {
      const mockDeviceMetrics = {
        devices: [
          { device: 'desktop', sessions: 600 },
          { device: 'mobile', sessions: 400 },
        ],
        browsers: [
          { browser: 'chrome', sessions: 500 },
          { browser: 'safari', sessions: 300 },
        ],
      };

      analytics.getDeviceMetrics.mockResolvedValueOnce(mockDeviceMetrics);

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
        headers: {
          'x-time-period': '7d',
        },
      });

      const response = await GET(request);
      const data = await response.json() as MetricsResponse;

      expect(data.devices).toEqual(mockDeviceMetrics);
      expect(analytics.getDeviceMetrics).toHaveBeenCalledWith('7d');
    });
  });

  describe('CTR Metrics', () => {
    it('should return correct CTR metrics', async () => {
      const mockCTRMetrics = {
        total_clicks: 500,
        click_through_rate: 0.05,
        top_clicked_elements: [
          { element: 'cta_button', clicks: 200 },
          { element: 'nav_link', clicks: 150 },
        ],
      };

      analytics.getCTRMetrics.mockResolvedValueOnce(mockCTRMetrics);

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
        headers: {
          'x-time-period': '7d',
        },
      });

      const response = await GET(request);
      const data = await response.json() as MetricsResponse;

      expect(data.ctr).toEqual(mockCTRMetrics);
      expect(analytics.getCTRMetrics).toHaveBeenCalledWith('7d');
    });
  });

  describe('Time Period Handling', () => {
    it('should use default time period when not specified', async () => {
      const mockRetentionMetrics = {
        total_sessions: 0,
        returning_sessions: 0,
        avg_session_duration: 0,
        bounce_rate: 0,
      };

      const mockPageMetrics = {
        total_pageviews: 0,
        unique_pageviews: 0,
        avg_time_on_page: 0,
        top_pages: [],
      };

      const mockDeviceMetrics = {
        devices: [],
        browsers: [],
      };

      const mockCTRMetrics = {
        total_clicks: 0,
        click_through_rate: 0,
        top_clicked_elements: [],
      };

      analytics.getRetentionMetrics.mockResolvedValueOnce(mockRetentionMetrics);
      analytics.getPageMetrics.mockResolvedValueOnce(mockPageMetrics);
      analytics.getDeviceMetrics.mockResolvedValueOnce(mockDeviceMetrics);
      analytics.getCTRMetrics.mockResolvedValueOnce(mockCTRMetrics);

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
      });

      await GET(request);

      expect(analytics.getRetentionMetrics).toHaveBeenCalledWith('24h');
      expect(analytics.getPageMetrics).toHaveBeenCalledWith('24h');
      expect(analytics.getDeviceMetrics).toHaveBeenCalledWith('24h');
      expect(analytics.getCTRMetrics).toHaveBeenCalledWith('24h');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      analytics.getRetentionMetrics.mockRejectedValueOnce(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/analytics/metrics', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
}); 