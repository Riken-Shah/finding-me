import { NextRequest, NextResponse } from 'next/server';
import { Analytics } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  try {
    const analytics = new Analytics();
    const result = await analytics.handleTracking({
      sessionId: request.headers.get('x-session-id'),
      event: request.headers.get('x-event') || undefined,
      page: request.headers.get('x-page') || undefined,
      scrollDepth: request.headers.get('x-scroll-depth') || undefined,
      element: request.headers.get('x-element') || undefined,
      href: request.headers.get('x-href') || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Error tracking analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 