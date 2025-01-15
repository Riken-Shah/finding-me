import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

const SESSION_ID_KEY = 'analytics_session_id';
const SESSION_START_KEY = 'analytics_session_start';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface TrackEventOptions {
  element?: string;
  href?: string;
  scrollDepth?: string;
  section?: string;
  timeSpent?: number;
  event?: string;
}

interface PerformanceMetrics {
  ttfb?: number;           // Time to First Byte
  fcp?: number;           // First Contentful Paint
  lcp?: number;           // Largest Contentful Paint
  cls?: number;           // Cumulative Layout Shift
  fid?: number;           // First Input Delay
}

export function useAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionObserver = useRef<IntersectionObserver | null>(null);
  const sectionTimers = useRef<Record<string, number>>({});

  const getSessionId = useCallback(() => {
    if (typeof window === 'undefined') return null;

    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    const lastStart = localStorage.getItem(SESSION_START_KEY);

    // Check if session has expired
    if (sessionId && lastStart) {
      const timeSinceLastStart = Date.now() - parseInt(lastStart);
      if (timeSinceLastStart > SESSION_TIMEOUT) {
        sessionId = null;
      }
    }

    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    return sessionId;
  }, []);

  const track = useCallback(async (options: TrackEventOptions = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const headers = new Headers({
      'x-session-id': sessionId,
    });

    if (options.element) headers.set('x-element', options.element);
    if (options.href) headers.set('x-href', options.href);
    if (options.scrollDepth) headers.set('x-scroll-depth', options.scrollDepth);

    try {
      await fetch('/api/analytics/tracking', { headers });
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }
  }, [getSessionId]);

  const trackPageView = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const headers = new Headers({
      'x-session-id': sessionId,
      'x-page': pathname || '/',
      'x-event': 'pageview'
    });

    try {
      await fetch('/api/analytics/tracking', { headers });
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }, [getSessionId, pathname]);

  const trackEvent = useCallback(async (event: string, options: TrackEventOptions = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const headers = new Headers({
      'x-session-id': sessionId,
      'x-event': event,
    });

    if (options.element) headers.set('x-element', options.element);
    if (options.href) headers.set('x-href', options.href);

    try {
      await fetch('/api/analytics/tracking', { headers });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }, [getSessionId]);

  const trackScroll = useCallback(async (depth: number) => {
    await track({ scrollDepth: depth.toString() });
  }, [track]);

  const trackPerformance = useCallback(async () => {
    const metrics: PerformanceMetrics = {};
    
    // Get navigation timing metrics
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      metrics.ttfb = navigation.responseStart - navigation.requestStart;
    }

    // First Contentful Paint
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      metrics.fcp = fcp.startTime;
    }

    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      metrics.lcp = lastEntry.startTime;
      track({ event: 'performance', ...metrics });
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift
    new PerformanceObserver((entryList) => {
      let cumulativeScore = 0;
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          cumulativeScore += (entry as any).value;
        }
      }
      metrics.cls = cumulativeScore;
      track({ event: 'performance', ...metrics });
    }).observe({ entryTypes: ['layout-shift'] });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0] as PerformanceEventTiming;
      metrics.fid = firstInput.processingStart - firstInput.startTime;
      track({ event: 'performance', ...metrics });
    }).observe({ entryTypes: ['first-input'] });
  }, []);

  const initSectionTracking = useCallback(() => {
    // Cleanup previous observer
    if (sectionObserver.current) {
      sectionObserver.current.disconnect();
    }

    sectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const sectionId = entry.target.id;
          if (!sectionId) return;

          if (entry.isIntersecting) {
            // Section came into view
            sectionTimers.current[sectionId] = Date.now();
          } else if (sectionTimers.current[sectionId]) {
            // Section went out of view - track time spent
            const timeSpent = Date.now() - sectionTimers.current[sectionId];
            track({
              event: 'section_view',
              section: sectionId,
              timeSpent
            });
            delete sectionTimers.current[sectionId];
          }
        });
      },
      {
        threshold: 0.5 // 50% visibility
      }
    );

    // Observe all sections
    document.querySelectorAll('[data-section]').forEach(section => {
      sectionObserver.current?.observe(section);
    });
  }, [track]);

  const trackClick = useCallback(async ({ element, href, x, y, viewport_width, viewport_height }: {
    element?: string;
    href?: string;
    x?: number;
    y?: number;
    viewport_width?: number;
    viewport_height?: number;
  }) => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const headers = new Headers({
      'x-session-id': sessionId,
      'x-event': 'click',
    });

    if (element) headers.set('x-element', element);
    if (href) headers.set('x-href', href);
    if (x !== undefined) headers.set('x-click-x', x.toString());
    if (y !== undefined) headers.set('x-click-y', y.toString());
    if (viewport_width !== undefined) headers.set('x-viewport-width', viewport_width.toString());
    if (viewport_height !== undefined) headers.set('x-viewport-height', viewport_height.toString());

    try {
      await fetch('/api/analytics/tracking', { headers });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }, [getSessionId]);

  // Track page views
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    // Start session
    trackEvent('session_start');

    // Track initial page view
    trackPageView();

    // Track scroll depth
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollTop = document.documentElement.scrollTop;
      const scrollPercentage = Math.round((scrollTop / docHeight) * 100);
      
      // Track at 25%, 50%, 75%, and 100%
      if (scrollPercentage >= 25 && scrollPercentage < 50) {
        trackScroll(25);
      } else if (scrollPercentage >= 50 && scrollPercentage < 75) {
        trackScroll(50);
      } else if (scrollPercentage >= 75 && scrollPercentage < 100) {
        trackScroll(75);
      } else if (scrollPercentage === 100) {
        trackScroll(100);
      }
    };

    window.addEventListener('scroll', handleScroll);

    // End session when user leaves
    const handleBeforeUnload = () => {
      trackEvent('session_end');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getSessionId, trackEvent, trackPageView, trackScroll]);

  useEffect(() => {
    // Track page load performance
    trackPerformance();
    
    // Initialize section tracking
    initSectionTracking();

    // Cleanup
    return () => {
      if (sectionObserver.current) {
        sectionObserver.current.disconnect();
      }
    };
  }, [pathname]);

  return {
    trackEvent,
    trackPageView,
    trackScroll,
    trackClick
  };
} 