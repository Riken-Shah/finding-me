interface TrackEventOptions {
  sessionId: string;
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
}

interface ApiErrorResponse {
  error: string;
}

export async function trackEvent(options: TrackEventOptions) {
  const headers = new Headers({
    'x-session-id': options.sessionId,
    'Content-Type': 'application/json',
  });

  if (options.element) headers.set('x-element', options.element);
  if (options.href) headers.set('x-href', options.href);
  if (options.scrollDepth) headers.set('x-scroll-depth', options.scrollDepth);
  if (options.event) headers.set('x-event', options.event);
  if (options.page) headers.set('x-page', options.page);
  if (options.section) headers.set('x-section', options.section);
  if (options.timeSpent) headers.set('x-time-spent', options.timeSpent.toString());
  
  // Add performance metrics if available
  if (options.ttfb) headers.set('x-ttfb', options.ttfb.toString());
  if (options.fcp) headers.set('x-fcp', options.fcp.toString());
  if (options.lcp) headers.set('x-lcp', options.lcp.toString());
  if (options.cls) headers.set('x-cls', options.cls.toString());
  if (options.fid) headers.set('x-fid', options.fid.toString());

  try {
    // Use absolute URL for edge runtime
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/analytics/tracking`, { 
      method: 'POST',
      headers,
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const errorData = await response.json() as ApiErrorResponse;
      throw new Error(errorData.error || 'Failed to track event');
    }

    return await response.json();
  } catch (error) {
    console.error('Error tracking event:', error);
    throw error;
  }
} 