import { Analytics } from '@/lib/analytics';

// Mock Analytics class
jest.mock('@/lib/analytics');

describe('Analytics Tracking', () => {
  let analytics: jest.Mocked<Analytics>;

  beforeEach(() => {
    jest.clearAllMocks();
    analytics = new Analytics() as jest.Mocked<Analytics>;
    (Analytics as jest.MockedClass<typeof Analytics>).mockImplementation(() => analytics);
  });

  describe('Session Management', () => {
    it('should create a new session when no session ID is provided', async () => {
      analytics.getSession.mockResolvedValueOnce(null);
      analytics.createSession.mockResolvedValueOnce(undefined);

      const result = await analytics.handleTracking({
        sessionId: null,
      });

      expect(result.session_id).toBe('test-session-id');
      expect(result.is_new_session).toBe(true);
      expect(analytics.createSession).toHaveBeenCalledWith('test-session-id');
    });

    it('should use existing session when valid session ID is provided', async () => {
      const existingSessionId = 'existing-session-id';
      analytics.getSession.mockResolvedValueOnce({ session_id: existingSessionId });

      const result = await analytics.handleTracking({
        sessionId: existingSessionId,
      });

      expect(result.session_id).toBe(existingSessionId);
      expect(result.is_new_session).toBe(false);
      expect(analytics.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Event Tracking', () => {
    it('should track pageview events correctly', async () => {
      analytics.getSession.mockResolvedValueOnce(null);
      analytics.createSession.mockResolvedValueOnce(undefined);
      analytics.trackEvent.mockResolvedValueOnce(undefined);

      const result = await analytics.handleTracking({
        sessionId: null,
        event: 'pageview',
        page: '/blog',
      });

      expect(result.event).toBe('pageview');
      expect(result.page).toBe('/blog');
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-session-id',
        'pageview',
        '/blog',
        undefined,
        undefined,
        undefined
      );
    });

    it('should track scroll events correctly', async () => {
      analytics.getSession.mockResolvedValueOnce(null);
      analytics.createSession.mockResolvedValueOnce(undefined);
      analytics.trackEvent.mockResolvedValueOnce(undefined);

      const result = await analytics.handleTracking({
        sessionId: null,
        event: 'scroll',
        scrollDepth: '75',
      });

      expect(result.event).toBe('scroll');
      expect(result.scroll_depth).toBe(75);
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-session-id',
        'scroll',
        undefined,
        75,
        undefined,
        undefined
      );
    });

    it('should track click events correctly', async () => {
      analytics.getSession.mockResolvedValueOnce(null);
      analytics.createSession.mockResolvedValueOnce(undefined);
      analytics.trackEvent.mockResolvedValueOnce(undefined);

      const result = await analytics.handleTracking({
        sessionId: null,
        event: 'click',
        element: 'cta_button',
        href: '/signup',
      });

      expect(result.event).toBe('click');
      expect(result.element).toBe('cta_button');
      expect(result.href).toBe('/signup');
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-session-id',
        'click',
        undefined,
        undefined,
        'cta_button',
        '/signup'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      await expect(analytics.handleTracking({
        sessionId: null,
        event: 'pageview',
      })).rejects.toThrow('Missing required parameter: page');
    });

    it('should handle database errors gracefully', async () => {
      analytics.getSession.mockRejectedValueOnce(new Error('Database error'));

      await expect(analytics.handleTracking({
        sessionId: 'test-session-id',
      })).rejects.toThrow('Database error');
    });
  });
}); 