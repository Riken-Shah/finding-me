import { D1Database } from '@cloudflare/workers-types';
import { getD1Database } from '../lib/database';
import { collectAndSaveMetrics } from './collect-deployment-metrics';

// Mock the database module
jest.mock('../lib/database', () => ({
  getD1Database: jest.fn()
}));

// Mock console.log to avoid cluttering test output
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});
afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Deployment Metrics Collection', () => {
  let mockDb: jest.Mocked<D1Database>;
  let mockPrepare: jest.Mock;
  let mockBind: jest.Mock;
  let mockFirst: jest.Mock;
  let mockRun: jest.Mock;
  let mockContext: { env: { DB: D1Database } };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock database and query chain
    mockRun = jest.fn().mockResolvedValue(undefined);
    mockFirst = jest.fn();
    mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
    mockPrepare = jest.fn().mockReturnValue({ bind: mockBind });
    
    mockDb = {
      prepare: mockPrepare,
    } as unknown as jest.Mocked<D1Database>;

    mockContext = {
      env: {
        DB: mockDb
      }
    };
    
    (getD1Database as jest.Mock).mockResolvedValue(mockDb);
  });

  const mockDeploymentInfo = {
    deployTime: 1000,
    buildTime: 900,
    status: 'success',
    environment: 'production',
    commitSha: 'abc123',
    branch: 'main'
  };

  const mockMetrics = {
    total_sessions: 100,
    total_pageviews: 500,
    engaged_sessions: 80,
    avg_time_spent: 120,
    avg_fcp: 1500,
    avg_lcp: 2500,
    avg_cls: 0.1,
    bounced_sessions: 20,
    bounce_rate: 20,
    engagement_rate: 80
  };

  describe('getMetricsForPeriod', () => {
    it('should fetch metrics for a given time period', async () => {
      // Setup mock responses for both current and previous periods
      mockFirst
        .mockResolvedValueOnce(mockMetrics)  // Current period
        .mockResolvedValueOnce(mockMetrics); // Previous period

      // Call collectAndSaveMetrics which internally calls getMetricsForPeriod
      await collectAndSaveMetrics(mockDeploymentInfo, mockContext);

      // Verify the query was prepared and executed correctly
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WITH PageMetrics'));
      expect(mockBind).toHaveBeenCalledWith(
        expect.any(Number), // currentStart
        expect.any(Number), // currentEnd
        expect.any(Number), // currentStart
        expect.any(Number)  // currentEnd
      );
    });

    it('should throw error when no metrics are found', async () => {
      // Setup mock to return null for current period
      mockFirst.mockResolvedValueOnce(null);

      // Expect the collection to fail
      await expect(collectAndSaveMetrics(mockDeploymentInfo, mockContext))
        .rejects
        .toThrow('Failed to fetch metrics');
    });
  });

  describe('calculateMetricChanges', () => {
    it('should calculate correct percentage changes', async () => {
      // Setup mock responses for current and previous periods
      mockFirst
        .mockResolvedValueOnce({
          ...mockMetrics,
          total_sessions: 100,
          total_pageviews: 500,
          bounce_rate: 20,
          engagement_rate: 80
        })
        .mockResolvedValueOnce({
          ...mockMetrics,
          total_sessions: 80,
          total_pageviews: 400,
          bounce_rate: 25,
          engagement_rate: 75
        });

      // Call the main function
      await collectAndSaveMetrics(mockDeploymentInfo, mockContext);

      // Verify the metrics were saved with correct changes
      expect(mockBind).toHaveBeenCalledWith(
        expect.any(Number), // deployTime
        expect.any(Number), // buildTime
        expect.any(Number), // duration
        'success',         // status
        'production',      // environment
        'abc123',         // commitSha
        'main',           // branch
        100,              // total_sessions
        500,              // total_pageviews
        20,               // bounce_rate
        80,               // engagement_rate
        expect.any(Number), // avg_time_spent
        expect.any(Number), // avg_fcp
        expect.any(Number), // avg_lcp
        expect.any(Number), // avg_cls
        25,               // sessions_change (25% increase)
        25,               // pageviews_change (25% increase)
        -5,               // bounce_rate_change (5% decrease)
        5,                // engagement_rate_change (5% increase)
        expect.any(Number), // metrics_start_time
        expect.any(Number)  // metrics_end_time
      );
    });

    it('should handle zero values in previous period', async () => {
      // Setup mock responses with zero values in previous period
      mockFirst
        .mockResolvedValueOnce({
          ...mockMetrics,
          total_sessions: 100,
          total_pageviews: 500
        })
        .mockResolvedValueOnce({
          ...mockMetrics,
          total_sessions: 0,
          total_pageviews: 0
        });

      // Call the main function
      await collectAndSaveMetrics(mockDeploymentInfo, mockContext);

      // Verify that changes are handled correctly when previous values are zero
      const bindCalls = mockBind.mock.calls;
      const lastBindCall = bindCalls[bindCalls.length - 1];
      
      expect(lastBindCall).toContain(0); // sessions_change should be 0
      expect(lastBindCall).toContain(0); // pageviews_change should be 0
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      (getD1Database as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      await expect(collectAndSaveMetrics(mockDeploymentInfo, mockContext))
        .rejects
        .toThrow('DB connection failed');
    });

    it('should handle query execution errors', async () => {
      mockFirst.mockRejectedValue(new Error('Query failed'));

      await expect(collectAndSaveMetrics(mockDeploymentInfo, mockContext))
        .rejects
        .toThrow('Query failed');
    });
  });
}); 