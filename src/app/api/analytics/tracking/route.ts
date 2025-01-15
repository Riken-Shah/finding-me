import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const analytics = new Analytics();
    const userAgent = request.headers.get('user-agent') || undefined;
    const referer = request.headers.get('referer') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0].trim() || request.ip || 'unknown';
    
    // Get geolocation data from Cloudflare headers
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    const city = request.headers.get('cf-ipcity') || 'Unknown';
    const latitude = request.headers.get('cf-iplatitude');
    const longitude = request.headers.get('cf-iplongitude');

    const result = await analytics.handleTracking({
      sessionId: request.headers.get('x-session-id'),
      event: request.headers.get('x-event') || undefined,
      page: request.headers.get('x-page') || undefined,
      scrollDepth: request.headers.get('x-scroll-depth') || undefined,
      element: request.headers.get('x-element') || undefined,
      href: request.headers.get('x-href') || undefined,
      section: request.headers.get('x-section') || undefined,
      timeSpent: request.headers.get('x-time-spent') ? 
        parseInt(request.headers.get('x-time-spent')!) : undefined,
      timestamp: Date.now(),
      userAgent,
      ipAddress: ip,
      country,
      city,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      referrer: referer,
      deviceType: request.headers.get('x-device-type') || detectDeviceType(userAgent),
      // Performance metrics
      ttfb: request.headers.get('x-ttfb') ? 
        parseFloat(request.headers.get('x-ttfb')!) : undefined,
      fcp: request.headers.get('x-fcp') ? 
        parseFloat(request.headers.get('x-fcp')!) : undefined,
      lcp: request.headers.get('x-lcp') ? 
        parseFloat(request.headers.get('x-lcp')!) : undefined,
      cls: request.headers.get('x-cls') ? 
        parseFloat(request.headers.get('x-cls')!) : undefined,
      fid: request.headers.get('x-fid') ? 
        parseFloat(request.headers.get('x-fid')!) : undefined
    });

    await analytics.close();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === 'Invalid session') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error tracking analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Simple device type detection
function detectDeviceType(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile')) return 'mobile';
  if (ua.includes('tablet')) return 'tablet';
  if (ua.includes('ipad')) return 'tablet';
  return 'desktop';
} 