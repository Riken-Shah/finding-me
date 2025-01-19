import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';

const SESSION_ID_KEY = 'analytics_session_id';
const SESSION_START_KEY = 'analytics_session_start';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const BOUNCE_TIMEOUT = 30 * 1000; // 30 seconds
const MIN_ENGAGEMENT_TIME = 10 * 1000; // 10 seconds
const SIGNIFICANT_SCROLL_DEPTH = 25; // 25% scroll depth is considered significant

interface TrackEventOptions {
  element?: string;
  href?: string;
  scrollDepth?: string;
  section?: string;
  timeSpent?: number;
  event?: string;
  page?: string;
  // Performance metrics
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  // Engagement metrics
  interactions?: number;
  maxScrollDepth?: number;
}

interface PerformanceMetrics {
  ttfb?: number;           // Time to First Byte
  fcp?: number;           // First Contentful Paint
  lcp?: number;           // Largest Contentful Paint
  cls?: number;           // Cumulative Layout Shift
  fid?: number;           // First Input Delay
}

interface EngagementMetrics {
  timeOnPage: number;
  maxScrollDepth: number;
  interactions: number;
  startTime: number;
}

export function useAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionObserver = useRef<IntersectionObserver | null>(null);
  const sectionTimers = useRef<Record<string, number>>({});
  const metricsCollected = useRef<PerformanceMetrics>({});
  const hasTrackedInitialView = useRef(false);
  const bounceTimeout = useRef<NodeJS.Timeout>();
  const isEngaged = useRef(false);
  const pendingMetrics = useRef<{
    metrics: PerformanceMetrics;
    timeoutId?: NodeJS.Timeout;
  }>({ metrics: {} });
  const engagement = useRef<EngagementMetrics>({
    timeOnPage: 0,
    maxScrollDepth: 0,
    interactions: 0,
    startTime: Date.now()
  });

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

  const batchTrack = useCallback(async (events: TrackEventOptions[]) => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    try {
      await fetch('/api/analytics/tracking/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Error batch tracking analytics:', error);
    }
  }, [getSessionId]);

  const markEngaged = useCallback(() => {
    if (!isEngaged.current) {
      const timeOnPage = Date.now() - engagement.current.startTime;
      const isTimeEngaged = timeOnPage >= MIN_ENGAGEMENT_TIME;
      const isScrollEngaged = engagement.current.maxScrollDepth >= SIGNIFICANT_SCROLL_DEPTH;
      const isInteractionEngaged = engagement.current.interactions > 0;

      if (isTimeEngaged || isScrollEngaged || isInteractionEngaged) {
        isEngaged.current = true;
        if (bounceTimeout.current) {
          clearTimeout(bounceTimeout.current);
        }
        const sessionId = getSessionId();
        if (sessionId) {
          trackEvent('user_engaged', {
            timeSpent: timeOnPage,
            scrollDepth: engagement.current.maxScrollDepth.toString(),
            interactions: engagement.current.interactions
          });
        }
      }
    }
    engagement.current.interactions++;
  }, []);

  const debouncedTrackPerformance = useCallback(
    debounce((metrics: PerformanceMetrics) => {
      const sessionId = getSessionId();
      if (!sessionId) return;

      // Only send metrics if we have at least one value
      if (Object.keys(metrics).length > 0) {
        batchTrack([
          { event: 'performance', ...metrics }
        ]);
      }
    }, 2000),
    [batchTrack, getSessionId]
  );

  const updateMetrics = useCallback((newMetrics: Partial<PerformanceMetrics>) => {
    pendingMetrics.current.metrics = {
      ...pendingMetrics.current.metrics,
      ...newMetrics
    };

    // Clear existing timeout
    if (pendingMetrics.current.timeoutId) {
      clearTimeout(pendingMetrics.current.timeoutId);
    }

    // Set new timeout to track metrics
    pendingMetrics.current.timeoutId = setTimeout(() => {
      debouncedTrackPerformance(pendingMetrics.current.metrics);
      pendingMetrics.current = { metrics: {} };
    }, 1000);
  }, [debouncedTrackPerformance]);

  const trackPerformance = useCallback(() => {
    const performanceObservers: PerformanceObserver[] = [];

    // Get navigation timing metrics
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      updateMetrics({
        ttfb: navigation.responseStart - navigation.requestStart
      });
    }

    // First Contentful Paint
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      updateMetrics({
        fcp: fcp.startTime
      });
    }

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      updateMetrics({
        lcp: lastEntry.startTime
      });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    performanceObservers.push(lcpObserver);

    // Cumulative Layout Shift
    let cumulativeScore = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          cumulativeScore += (entry as any).value;
          updateMetrics({
            cls: cumulativeScore
          });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
    performanceObservers.push(clsObserver);

    // First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0] as PerformanceEventTiming;
      updateMetrics({
        fid: firstInput.processingStart - firstInput.startTime
      });
      markEngaged(); // First input definitely means user is engaged
      // Disconnect after first input
      fidObserver.disconnect();
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
    performanceObservers.push(fidObserver);

    // Cleanup function
    return () => {
      performanceObservers.forEach(observer => observer.disconnect());
    };
  }, [updateMetrics, markEngaged]);

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

  // Track page views and setup bounce tracking
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId || hasTrackedInitialView.current) return;

    hasTrackedInitialView.current = true;
    isEngaged.current = false;
    engagement.current = {
      timeOnPage: 0,
      maxScrollDepth: 0,
      interactions: 0,
      startTime: Date.now()
    };

    // Track initial page view and start session
    batchTrack([
      { event: 'session_start' },
      { event: 'pageview', page: pathname || '/' }
    ]);

    // Initialize performance tracking
    const cleanup = trackPerformance();

    // Setup bounce detection
    bounceTimeout.current = setTimeout(() => {
      if (!isEngaged.current) {
        trackEvent('bounce', {
          timeSpent: Date.now() - engagement.current.startTime,
          scrollDepth: engagement.current.maxScrollDepth.toString(),
          interactions: engagement.current.interactions
        });
      }
    }, BOUNCE_TIMEOUT);

    // Track user engagement signals
    const handleEngagement = debounce(() => markEngaged(), 1000);
    
    // Track scroll depth
    const handleScroll = debounce(() => {
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollTop = document.documentElement.scrollTop;
      const scrollPercentage = Math.round((scrollTop / docHeight) * 100);
      
      engagement.current.maxScrollDepth = Math.max(engagement.current.maxScrollDepth, scrollPercentage);

      if (scrollPercentage >= 25 && scrollPercentage < 50) {
        trackScroll(25);
        markEngaged();
      } else if (scrollPercentage >= 50 && scrollPercentage < 75) {
        trackScroll(50);
        markEngaged();
      } else if (scrollPercentage >= 75 && scrollPercentage < 100) {
        trackScroll(75);
        markEngaged();
      } else if (scrollPercentage === 100) {
        trackScroll(100);
        markEngaged();
      }
    }, 1000);

    // Track periodic time updates
    const timeUpdateInterval = setInterval(() => {
      engagement.current.timeOnPage = Date.now() - engagement.current.startTime;
    }, 1000);

    window.addEventListener('scroll', handleEngagement);
    window.addEventListener('mousemove', handleEngagement);
    window.addEventListener('touchstart', handleEngagement);
    window.addEventListener('click', handleEngagement);
    window.addEventListener('keydown', handleEngagement);
    window.addEventListener('scroll', handleScroll);

    // End session when user leaves
    const handleBeforeUnload = () => {
      clearInterval(timeUpdateInterval);
      const finalTimeOnPage = Date.now() - engagement.current.startTime;
      
      if (isEngaged.current) {
        trackEvent('session_end', {
          timeSpent: finalTimeOnPage,
          scrollDepth: engagement.current.maxScrollDepth.toString(),
          interactions: engagement.current.interactions
        });
      } else {
        trackEvent('bounce', {
          timeSpent: finalTimeOnPage,
          scrollDepth: engagement.current.maxScrollDepth.toString(),
          interactions: engagement.current.interactions
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (bounceTimeout.current) {
        clearTimeout(bounceTimeout.current);
      }
      clearInterval(timeUpdateInterval);
      window.removeEventListener('scroll', handleEngagement);
      window.removeEventListener('mousemove', handleEngagement);
      window.removeEventListener('touchstart', handleEngagement);
      window.removeEventListener('click', handleEngagement);
      window.removeEventListener('keydown', handleEngagement);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [pathname, getSessionId, trackPerformance, markEngaged]);

  // Initialize section tracking on pathname change
  useEffect(() => {
    initSectionTracking();
    return () => {
      if (sectionObserver.current) {
        sectionObserver.current.disconnect();
      }
    };
  }, [pathname, initSectionTracking]);

  return {
    trackEvent,
    trackPageView,
    trackScroll,
    trackClick
  };
} 