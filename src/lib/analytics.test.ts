import { Analytics, TrackingData } from './analytics-d1';
import { D1Database, D1Result } from '@cloudflare/workers-types';
import { jest } from '@jest/globals';

type D1PreparedStatement = {
  bind: (...args: any[]) => D1PreparedStatement;
  first: <T = unknown>(colName?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: () => Promise<D1Result>;
};

// Create a type that combines D1Database with Jest mock methods
type MockD1Database = {
  prepare: jest.Mock<() => D1PreparedStatement>;
  bind: jest.Mock<() => D1PreparedStatement>;
  first: jest.Mock<() => Promise<any>>;
  all: jest.Mock<() => Promise<D1Result<any>>>;
  run: jest.Mock<() => Promise<D1Result>>;
};

const mockD1Meta = {
  duration: 0,
  size_after: 0,
  rows_read: 0,
  rows_written: 0,
  last_row_id: 0,
  changed_db: false,
  changes: 0
};

// Mock D1 database
const mockDb: MockD1Database = {
  prepare: jest.fn<() => D1PreparedStatement>().mockReturnThis(),
  bind: jest.fn<() => D1PreparedStatement>().mockReturnThis(),
  first: jest.fn<() => Promise<any>>(),
  all: jest.fn<() => Promise<D1Result<any>>>().mockResolvedValue({ results: [], success: true, meta: mockD1Meta }),
  run: jest.fn<() => Promise<D1Result>>().mockResolvedValue({ success: true, meta: mockD1Meta, results: [] }),
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
      // Reset all mocks before each test
      jest.clearAllMocks();
    });

    it('should calculate metrics for all time', async () => {
      // Setup mocks for this test
      mockDb.first
        .mockResolvedValueOnce({ count: 4 })
        .mockResolvedValueOnce({ bounce_rate: 50 })
        .mockResolvedValueOnce({ avg_time: 120 })
        .mockResolvedValueOnce({ conversion_rate: 25 });

      mockDb.all
        .mockResolvedValueOnce({ 
          results: [
            { page: '/home', views: 10 },
            { page: '/about', views: 5 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { element: 'signup-button', clicks: 5, ctr: 25 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { device_type: 'desktop', count: 2 },
            { device_type: 'mobile', count: 1 },
            { device_type: 'tablet', count: 1 },
            { device_type: 'unknown', count: 1 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { country: 'US', count: 2 },
            { country: 'UK', count: 2 }
          ],
          success: true,
          meta: mockD1Meta
        });

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
      // Setup mocks for this test
      mockDb.first
        .mockResolvedValueOnce({ count: 4 })
        .mockResolvedValueOnce({ bounce_rate: 50 })
        .mockResolvedValueOnce({ avg_time: 120 })
        .mockResolvedValueOnce({ conversion_rate: 25 });

      mockDb.all
        .mockResolvedValueOnce({ 
          results: [
            { page: '/home', views: 10 },
            { page: '/about', views: 5 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { element: 'signup-button', clicks: 5, ctr: 25 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { device_type: 'desktop', count: 2 },
            { device_type: 'mobile', count: 1 },
            { device_type: 'tablet', count: 1 },
            { device_type: 'unknown', count: 1 }
          ],
          success: true,
          meta: mockD1Meta
        })
        .mockResolvedValueOnce({ 
          results: [
            { country: 'US', count: 2 },
            { country: 'UK', count: 2 }
          ],
          success: true,
          meta: mockD1Meta
        });

      const metrics = await analytics.getMetrics({
        startTime: baseTime - (12 * 60 * 60 * 1000), // Last 12 hours
        endTime: baseTime
      });

      expect(metrics.totalVisitors).toBe(4);
      expect(metrics.topPages).toHaveLength(2);
      expect(metrics.deviceBreakdown).toHaveLength(4);
      expect(metrics.countryBreakdown).toHaveLength(2);
    });

    describe('Bounce Rate', () => {
      it('should calculate bounce rate correctly', async () => {
        // Mock data for bounce rate calculation
        mockDb.first
          .mockResolvedValueOnce({ count: 10 }) // Total visitors
          .mockResolvedValueOnce({ bounce_rate: 40 }) // 40% bounce rate
          .mockResolvedValueOnce({ avg_time: 0 }) // Not used in this test
          .mockResolvedValueOnce({ conversion_rate: 0 }); // Not used in this test

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.bounceRate).toBe(40);
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('WITH session_page_counts'));
      });

      it('should handle zero visitors for bounce rate', async () => {
        // Mock data for bounce rate calculation with no visitors
        mockDb.first
          .mockResolvedValueOnce({ count: 0 }) // No visitors
          .mockResolvedValueOnce({ bounce_rate: 0 }) // 0% bounce rate
          .mockResolvedValueOnce({ avg_time: 0 }) // Not used in this test
          .mockResolvedValueOnce({ conversion_rate: 0 }); // Not used in this test

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.bounceRate).toBe(0);
      });
    });

    describe('Average Time Spent', () => {
      it('should calculate average time spent correctly', async () => {
        // Mock data for average time spent calculation
        mockDb.first
          .mockResolvedValueOnce({ count: 5 }) // Total visitors
          .mockResolvedValueOnce({ bounce_rate: 0 }) // Not used in this test
          .mockResolvedValueOnce({ avg_time: 180 }) // 3 minutes average
          .mockResolvedValueOnce({ conversion_rate: 0 }); // Not used in this test

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.avgTimeSpentSeconds).toBe(180);
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT AVG(time_spent)'));
      });

      it('should handle sessions with only one pageview', async () => {
        // Mock data for average time calculation with single pageview sessions
        mockDb.first
          .mockResolvedValueOnce({ count: 3 }) // Total visitors
          .mockResolvedValueOnce({ bounce_rate: 0 }) // Not used in this test
          .mockResolvedValueOnce({ avg_time: 0 }) // 0 seconds for single pageview sessions
          .mockResolvedValueOnce({ conversion_rate: 0 }); // Not used in this test

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.avgTimeSpentSeconds).toBe(0);
      });
    });

    describe('Conversion Rate', () => {
      it('should calculate conversion rate correctly', async () => {
        // Mock data for conversion rate calculation
        mockDb.first
          .mockResolvedValueOnce({ count: 100 }) // Total visitors
          .mockResolvedValueOnce({ bounce_rate: 0 }) // Not used in this test
          .mockResolvedValueOnce({ avg_time: 0 }) // Not used in this test
          .mockResolvedValueOnce({ conversion_rate: 15.5 }); // 15.5% conversion rate

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.conversionRate).toBe(15.5);
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('event_name = \'conversion\''));
      });

      it('should handle zero visitors for conversion rate', async () => {
        // Mock data for conversion rate calculation with no visitors
        mockDb.first
          .mockResolvedValueOnce({ count: 0 }) // No visitors
          .mockResolvedValueOnce({ bounce_rate: 0 }) // Not used in this test
          .mockResolvedValueOnce({ avg_time: 0 }) // Not used in this test
          .mockResolvedValueOnce({ conversion_rate: 0 }); // 0% conversion rate

        mockDb.all
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // top pages
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // ctr
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }) // devices
          .mockResolvedValueOnce({ results: [], success: true, meta: mockD1Meta }); // countries

        const metrics = await analytics.getMetrics();
        expect(metrics.conversionRate).toBe(0);
      });
    });
  });
}); 