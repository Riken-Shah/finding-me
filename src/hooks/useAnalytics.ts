import { useCallback } from 'react';

interface ClickEvent {
  element: string;
  href?: string;
  x: number;
  y: number;
  viewport_width: number;
  viewport_height: number;
}

interface ScrollEvent {
  percent: number;
  direction: 'up' | 'down';
  viewport_height: number;
  document_height: number;
}

interface EnrichedEventData {
  timestamp: string;
  page_path: string;
  page_title: string;
  referrer: string;
  user_agent: string;
  screen_width: number;
  screen_height: number;
  [key: string]: unknown;
}

interface ClickEventData extends EnrichedEventData {
  element_type: string;
  target_url?: string;
  click_x: number;
  click_y: number;
  viewport: {
    width: number;
    height: number;
  };
}

interface ScrollEventData extends EnrichedEventData {
  scroll_depth: number;
  scroll_direction: 'up' | 'down';
  viewport: {
    height: number;
  };
  document: {
    height: number;
  };
  max_scroll_depth: number;
}

export function useAnalytics() {
  const trackEvent = useCallback(async <T extends EnrichedEventData>(
    event_name: string,
    event_data: Omit<T, keyof EnrichedEventData>
  ) => {
    try {
      const enrichedData: T = {
        ...event_data as T,
        timestamp: new Date().toISOString(),
        page_path: window.location.pathname,
        page_title: document.title,
        referrer: document.referrer,
        user_agent: navigator.userAgent,
        screen_width: window.screen.width,
        screen_height: window.screen.height
      } as T;

      const response = await fetch(`/api/analytics/track?page=${window.location.pathname}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name,
          event_data: enrichedData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to track event');
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, []);

  const trackClick = useCallback((data: ClickEvent) => {
    const clickData: Omit<ClickEventData, keyof EnrichedEventData> = {
      element_type: data.element,
      target_url: data.href,
      click_x: data.x,
      click_y: data.y,
      viewport: {
        width: data.viewport_width,
        height: data.viewport_height
      }
    };
    trackEvent<ClickEventData>('click', clickData);
  }, [trackEvent]);

  const trackScroll = useCallback((data: ScrollEvent) => {
    const maxScrollDepth = Math.max(
      Number(sessionStorage.getItem('max_scroll_depth') || '0'),
      data.percent
    );
    const scrollData: Omit<ScrollEventData, keyof EnrichedEventData> = {
      scroll_depth: data.percent,
      scroll_direction: data.direction,
      viewport: {
        height: data.viewport_height
      },
      document: {
        height: data.document_height
      },
      max_scroll_depth: maxScrollDepth
    };
    sessionStorage.setItem('max_scroll_depth', maxScrollDepth.toString());
    trackEvent<ScrollEventData>('scroll', scrollData);
  }, [trackEvent]);

  return {
    trackClick,
    trackScroll
  };
} 