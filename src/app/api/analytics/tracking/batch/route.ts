import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics-d1';
import { getD1Database } from '@/lib/database';

export const runtime = 'edge';
export const preferredRegion = 'auto';

interface BatchRequestBody {
  events: Array<{
    element?: string;
    href?: string;
    scrollDepth?: string;
    section?: string;
    timeSpent?: number;
    event?: string;
    page?: string;
    ttfb?: number;
    fcp?: number;
    lcp?: number;
    cls?: number;
    fid?: number;
  }>;
}

interface RouteContext {
  params: { [key: string]: string | string[] };
}

export async function POST(
  request: NextRequest,
  context: RouteContext & { env?: { DB: D1Database } }
) {
  try {
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const db = await getD1Database(context);
    if (!db) {
      throw new Error('Failed to initialize database');
    }

    const analytics = new Analytics(db);
    const userAgent = request.headers.get('user-agent') || undefined;
    const referer = request.headers.get('referer') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0].trim() || request.ip || 'unknown';
    
    // Get geolocation data from Cloudflare headers
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    const city = request.headers.get('cf-ipcity') || 'Unknown';
    const latitude = request.headers.get('cf-iplatitude');
    const longitude = request.headers.get('cf-iplongitude');
    const deviceType = request.headers.get('x-device-type') || detectDeviceType(userAgent);

    const body = await request.json() as BatchRequestBody;
    if (!Array.isArray(body.events)) {
      return NextResponse.json({ error: 'Invalid events array' }, { status: 400 });
    }

    // Process all events in parallel
    const results = await Promise.all(body.events.map(event => 
      analytics.handleTracking({
        sessionId,
        ...event,
        timestamp: Date.now(),
        userAgent,
        ipAddress: ip,
        country,
        city,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        referrer: referer,
        deviceType
      })
    ));

    return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === 'Invalid session') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error processing batch events:', error);
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