import { Analytics, TrackingData } from './analytics';
import fs from 'fs';
import path from 'path';

describe('Analytics', () => {
  let analytics: Analytics;
  const testDbPath = path.join(process.cwd(), 'analytics.db');

  beforeEach(async () => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    analytics = new Analytics();
    // Wait for initialization to complete
    await analytics.handleTracking({
      sessionId: 'test-init',
      event: 'session_start'
    });
  });

  afterEach(async () => {
    await analytics.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
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

      const result = await analytics.handleTracking(sessionData);
      expect(result.success).toBe(true);
    });

    it('should throw error for missing session ID', async () => {
      const sessionData: TrackingData = {
        sessionId: null,
        event: 'session_start'
      };

      await expect(analytics.handleTracking(sessionData)).rejects.toThrow('Missing required session ID');
    });

    it('should handle session end', async () => {
      // First create a session
      await analytics.handleTracking({
        sessionId: 'test-session-2',
        event: 'session_start'
      });

      // Then end it
      const result = await analytics.handleTracking({
        sessionId: 'test-session-2',
        event: 'session_end'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Page View Tracking', () => {
    it('should track page views', async () => {
      // Create session first
      await analytics.handleTracking({
        sessionId: 'test-session-3',
        event: 'session_start'
      });

      // Track page view
      const result = await analytics.handleTracking({
        sessionId: 'test-session-3',
        page: '/home',
        scrollDepth: '75'
      });

      expect(result.success).toBe(true);
    });

    it('should reject page view for invalid session', async () => {
      await expect(analytics.handleTracking({
        sessionId: 'invalid-session',
        page: '/home'
      })).rejects.toThrow('Invalid session');
    });
  });

  describe('Event Tracking', () => {
    it('should track click events', async () => {
      // Create session first
      await analytics.handleTracking({
        sessionId: 'test-session-4',
        event: 'session_start'
      });

      // Track click event
      const result = await analytics.handleTracking({
        sessionId: 'test-session-4',
        event: 'click',
        element: 'button-signup',
        href: '/signup'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Metrics', () => {
    const baseTime = Date.now();
    
    beforeEach(async () => {
      // Create test data across different time periods
      
      // Day 1 - Session 1
      await analytics.handleTracking({
        sessionId: 'day1-session1',
        event: 'session_start',
        timestamp: baseTime - (24 * 60 * 60 * 1000), // 24 hours ago
        userAgent: 'Mozilla/5.0',
        deviceType: 'desktop'
      });

      await analytics.handleTracking({
        sessionId: 'day1-session1',
        page: '/home',
        timestamp: baseTime - (24 * 60 * 60 * 1000) + 1000
      });

      // Day 1 - Session 2 (bounce)
      await analytics.handleTracking({
        sessionId: 'day1-session2',
        event: 'session_start',
        timestamp: baseTime - (23 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0',
        deviceType: 'mobile'
      });

      await analytics.handleTracking({
        sessionId: 'day1-session2',
        page: '/home',
        timestamp: baseTime - (23 * 60 * 60 * 1000) + 1000
      });

      // Current Day - Session 1
      await analytics.handleTracking({
        sessionId: 'current-session1',
        event: 'session_start',
        timestamp: baseTime - 3000,
        userAgent: 'Mozilla/5.0',
        deviceType: 'tablet'
      });

      await analytics.handleTracking({
        sessionId: 'current-session1',
        page: '/home',
        timestamp: baseTime - 2000
      });

      await analytics.handleTracking({
        sessionId: 'current-session1',
        event: 'click',
        element: 'signup-button',
        href: '/signup',
        timestamp: baseTime - 1500
      });

      await analytics.handleTracking({
        sessionId: 'current-session1',
        page: '/signup',
        timestamp: baseTime - 1000
      });

      await analytics.handleTracking({
        sessionId: 'current-session1',
        event: 'conversion',
        timestamp: baseTime - 500
      });
    });

    it('should calculate metrics for all time', async () => {
      const metrics = await analytics.getMetrics();

      expect(metrics.totalVisitors).toBe(4); // Including test-init session
      expect(metrics.bounceRate).toBe(50); // 2 out of 4 sessions bounced (test-init and day1-session2)
      expect(metrics.avgTimeSpentSeconds).toBeGreaterThan(0);
      expect(metrics.topPages).toHaveLength(2); // /home and /signup
      expect(metrics.deviceBreakdown).toHaveLength(4); // desktop, mobile, tablet, undefined (test-init)
      expect(metrics.clickThroughRates).toHaveLength(1); // signup-button
      expect(metrics.conversionRate).toBeGreaterThan(0);
    });

    it('should calculate metrics for specific timeframe', async () => {
      const metrics = await analytics.getMetrics({
        startTime: baseTime - (12 * 60 * 60 * 1000), // Last 12 hours
        endTime: baseTime
      });

      expect(metrics.totalVisitors).toBe(1); // Only current-session1
      expect(metrics.topPages).toHaveLength(2); // /home and /signup
      expect(metrics.deviceBreakdown).toHaveLength(1); // Only tablet
    });
  });
}); 