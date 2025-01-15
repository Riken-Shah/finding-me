import { Analytics, TrackingData } from './analytics-d1';
import { D1Database, D1Result } from '@cloudflare/workers-types';

// Create a type that combines D1Database with Jest mock methods
type MockD1Database = {
  prepare: jest.Mock<D1PreparedStatement>;
  bind: jest.Mock;
  first: jest.Mock;
  all: jest.Mock;
  run: jest.Mock;
};

type D1PreparedStatement = {
  bind: (...args: any[]) => D1PreparedStatement;
  first: <T = unknown>(colName?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: () => Promise<D1Result>;
};

// Mock D1 database
const mockDb: MockD1Database = {
  prepare: jest.fn().mockReturnThis(),
  bind: jest.fn().mockReturnThis(),
  first: jest.fn(),
  all: jest.fn().mockReturnValue({ results: [] }),
  run: jest.fn().mockResolvedValue({ success: true }),
};

describe('Analytics', () => {
  let analytics: Analytics;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    analytics = new Analytics(mockDb as unknown as D1Database);
  });

  describe('Session Tracking', () => {
    it('should create a new session', async () => {
      const sessionData: TrackingData = {
        sessionId: 'test-session-1',
        event: 'session_start',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        referrer: 'https://google.com',
        deviceType: 'desktop'
      };

      mockDb.first.mockResolvedValueOnce(null); // No existing session
      const result = await analytics.handleTracking(sessionData);
      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sessions'));
    });

    it('should throw error for missing session ID', async () => {
      const sessionData: TrackingData = {
        sessionId: null,
        event: 'session_start'
      };

      await expect(analytics.handleTracking(sessionData)).rejects.toThrow('Missing required session ID');
    });

    it('should handle session end', async () => {
      const sessionData: TrackingData = {
        sessionId: 'test-session-2',
        event: 'session_end'
      };

      mockDb.first.mockResolvedValueOnce({ session_id: 'test-session-2' }); // Session exists
      const result = await analytics.handleTracking(sessionData);

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE sessions SET end_time'));
    });
  });

  describe('Page View Tracking', () => {
    it('should track page views', async () => {
      mockDb.first.mockResolvedValueOnce({ session_id: 'test-session-3' }); // Session exists
      const result = await analytics.handleTracking({
        sessionId: 'test-session-3',
        page: '/home',
        scrollDepth: '75'
      });

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO page_views'));
    });

    it('should reject page view for invalid session', async () => {
      mockDb.first.mockResolvedValueOnce(null); // No existing session
      await expect(analytics.handleTracking({
        sessionId: 'invalid-session',
        page: '/home'
      })).rejects.toThrow('Invalid session');
    });
  });

  describe('Event Tracking', () => {
    it('should track click events', async () => {
      mockDb.first.mockResolvedValueOnce({ session_id: 'test-session-4' }); // Session exists
      const result = await analytics.handleTracking({
        sessionId: 'test-session-4',
        event: 'click',
        element: 'button-signup',
        href: '/signup'
      });

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events'));
    });
  });

  describe('Metrics', () => {
    const baseTime = Date.now();
    
    beforeEach(() => {
      // Mock metrics data
      mockDb.first
        // Mock visitors count
        .mockResolvedValueOnce({ count: 4 })
        // Mock bounce rate
        .mockResolvedValueOnce({ bounce_rate: 50 })
        // Mock avg time spent
        .mockResolvedValueOnce({ avg_time: 120 })
        // Mock conversion rate
        .mockResolvedValueOnce({ conversion_rate: 25 });

      mockDb.all
        // Mock top pages
        .mockResolvedValueOnce({ results: [
          { page: '/home', views: 10 },
          { page: '/about', views: 5 }
        ]})
        // Mock click through rates
        .mockResolvedValueOnce({ results: [
          { element: 'signup-button', clicks: 5, ctr: 25 }
        ]})
        // Mock device breakdown
        .mockResolvedValueOnce({ results: [
          { device_type: 'desktop', count: 2 },
          { device_type: 'mobile', count: 1 },
          { device_type: 'tablet', count: 1 },
          { device_type: 'unknown', count: 1 }
        ]})
        // Mock country breakdown
        .mockResolvedValueOnce({ results: [
          { country: 'US', count: 2 },
          { country: 'UK', count: 2 }
        ]});
    });

    it('should calculate metrics for all time', async () => {
      const metrics = await analytics.getMetrics();

      expect(metrics.totalVisitors).toBe(4);
      expect(metrics.bounceRate).toBe(50);
      expect(metrics.avgTimeSpentSeconds).toBe(120);
      expect(metrics.topPages).toHaveLength(2);
      expect(metrics.deviceBreakdown).toHaveLength(4);
      expect(metrics.clickThroughRates).toHaveLength(1);
      expect(metrics.conversionRate).toBe(25);

      // Additional assertions to verify the actual data
      expect(metrics.topPages[0]).toEqual({ page: '/home', views: 10 });
      expect(metrics.deviceBreakdown[0]).toEqual({ device_type: 'desktop', count: 2 });
      expect(metrics.clickThroughRates[0]).toEqual({ element: 'signup-button', clicks: 5, ctr: 25 });
    });

    it('should calculate metrics for specific timeframe', async () => {
      const metrics = await analytics.getMetrics({
        startTime: baseTime - (12 * 60 * 60 * 1000), // Last 12 hours
        endTime: baseTime
      });

      expect(metrics.totalVisitors).toBe(4);
      expect(metrics.topPages).toHaveLength(2);
      expect(metrics.deviceBreakdown).toHaveLength(4);
      expect(metrics.countryBreakdown).toHaveLength(2);
    });
  });
}); 