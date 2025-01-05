import { useEffect, useCallback, useRef } from 'react';

// Check if current page is analytics
const isAnalyticsPage = () => {
  return window.location.pathname.includes('/analytics');
};

// Types for API responses
interface AnalyticsResponse {
  success: boolean;
  session_id: string;
}

// Sequential request queue management
type QueuedRequest = {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  const request = requestQueue[0];
  
  try {
    await request.execute();
    request.resolve();
  } catch (error) {
    request.reject(error as Error);
  } finally {
    requestQueue.shift();
    isProcessingQueue = false;
    processQueue();
  }
}

function queueRequest(execute: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ execute, resolve, reject });
    processQueue();
  });
}

// Session management
function setSessionId(sessionId: string) {
    // Store in local storage
    localStorage.setItem('sessionId', sessionId);
}

function getSessionId(): string | null {
    // Retrieve from local storage
    return localStorage.getItem('sessionId');
}       

// Add this near the top with other state management
let storedCookie: string | null = null;

// Add this near other state management
let useQueryParam = true;

// Track pageview with retries and session management
async function trackPageview(page: string, retryCount = 0) {
  if (isAnalyticsPage()) return;
  
  const execute = async () => {
    try {
      const url = new URL(`/api/analytics/track`, window.location.origin);
      url.searchParams.set('page', page);
      
      // Include session_id if available
      if (getSessionId()) {
        url.searchParams.set('session_id', getSessionId()!  );
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as AnalyticsResponse;
      if (data.session_id) {
        setSessionId(data.session_id);  // Update the session ID from response
      }
    } catch (error) {
      console.error('Failed to track pageview:', error);
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return trackPageview(page, retryCount + 1);
      }
      throw error;
    }
  };

  return queueRequest(execute);
}

// Track event with retries and session management
async function trackEvent(name: string, data: Record<string, unknown> = {}, retryCount = 0) {
  if (isAnalyticsPage()) return;

  const execute = async () => {
    try {
      const url = new URL(`/api/analytics/track`, window.location.origin);
      url.searchParams.set('page', window.location.pathname);
      
      // Include session_id if available
       if (getSessionId()) {
        url.searchParams.set('session_id', getSessionId()!);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: name,
          event_data: data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json() as AnalyticsResponse;
      if (responseData.session_id) {
        setSessionId(responseData.session_id);  // Update the session ID from response
      }
    } catch (error) {
      console.error('Failed to track event:', error);
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return trackEvent(name, data, retryCount + 1);
      }
      throw error;
    }
  };

  return queueRequest(execute);
}

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useAnalytics() {
  const pageLoadTime = useRef(Date.now());

  // Track pageview on mount and cleanup on unmount
  useEffect(() => {
    if (isAnalyticsPage()) return;
    
    const startTime = Date.now();
    trackPageview(window.location.pathname);

    return () => {
      // Track time spent on page when unmounting
      const timeSpent = Date.now() - startTime;
      trackEvent('page_exit', { 
        path: window.location.pathname,
        timeSpent,
        totalTimeOnSite: Date.now() - pageLoadTime.current
      });
    };
  }, []);

  // Track scroll depth with debouncing
  useEffect(() => {
    if (isAnalyticsPage()) return;

    let maxScroll = 0;
    const scrollMilestones = new Set([25, 50, 75, 100]);

    const handleScroll = debounce(() => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((window.scrollY / docHeight) * 100);

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        trackEvent('update_scroll_depth', { 
          depth: scrollPercent,
          path: window.location.pathname
        });

        scrollMilestones.forEach(milestone => {
          if (scrollPercent >= milestone) {
            trackEvent('scroll_milestone', { 
              depth: milestone,
              timeToReach: Date.now() - pageLoadTime.current
            });
            scrollMilestones.delete(milestone);
          }
        });
      }
    }, 100);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track time spent on sections
  useEffect(() => {
    if (isAnalyticsPage()) return;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target;
          const sectionId = section.id || 'unknown';
          
          if (entry.isIntersecting) {
            console.log('Entering section:', sectionId);
            const startTime = Date.now();
            
            // Store the start time on the section element
            (section as any).viewStartTime = startTime;
            
            trackEvent('section_enter', { 
              sectionId,
              scrollPercentage: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
            });
          } else if ((section as any).viewStartTime) {
            const timeSpent = Date.now() - (section as any).viewStartTime;
            console.log('Leaving section:', sectionId, 'Time spent:', timeSpent);
            
            trackEvent('section_exit', { 
              sectionId,
              timeSpent,
              scrollPercentage: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
            });
            
            // Clear the start time
            delete (section as any).viewStartTime;
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
      console.log('Observing section:', section.id || 'unknown');
      sectionObserver.observe(section);
    });

    return () => sectionObserver.disconnect();
  }, []);

  // Utility function to track clicks
  const trackClick = useCallback((element: string, data: Record<string, unknown> = {}) => {
    if (isAnalyticsPage()) return;

    console.log('Tracking click:', element, data);
    trackEvent('click', { 
      element,
      path: window.location.pathname,
      ...data 
    });
  }, []);

  return { trackClick };
} 