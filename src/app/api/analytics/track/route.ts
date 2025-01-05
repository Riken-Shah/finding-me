import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import cookie from 'cookie';

export const runtime = 'edge';
export const preferredRegion = 'auto';

type EventPayload = {
  event_name: string;
  event_data: Record<string, unknown>;
};

interface Env {
  DB: D1Database;
}

function getDB(): D1Database {
  // @ts-expect-error - Cloudflare bindings
  const env = process.env as Env;
  if (!env?.DB) {
    throw new Error('D1 database not found in environment');
  }
  return env.DB;
}

// Helper function to get or create a session
async function getOrCreateSession(db: D1Database, request: NextRequest): Promise<string> {
  const sessionId = request.nextUrl.searchParams.get('session_id') || request.cookies.get('session_id')?.value;
  const now = new Date();

  // Check if session exists and is still valid (within 30 minutes)
  console.log('Checking session:', sessionId);
  if (sessionId) {
    const existingSession = await db.prepare(`
      SELECT session_id, start_time, page_count, is_returning
      FROM sessions 
      WHERE session_id = ?
      AND start_time > datetime('now', '-30 minutes')
    `).bind(sessionId).first();

    if (existingSession) {
      console.log('Using existing session:', existingSession.session_id);
      // Update session
      await db.prepare(`
        UPDATE sessions 
        SET page_count = page_count + 1,
            is_bounce = 0,
            end_time = CURRENT_TIMESTAMP,
            total_time_ms = ROUND((JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(start_time)) * 86400000)
        WHERE session_id = ?
      `).bind(sessionId).run();

      return sessionId;
    }
  }

  // Check for previous sessions in the last 30 days
  const userAgent = request.headers.get('user-agent') || '';
  const device = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
  const browser = getBrowser(userAgent);

  const previousSessions = await db.prepare(`
    SELECT COUNT(*) as count
    FROM sessions
    WHERE start_time > datetime('now', '-30 days')
    AND (
      session_id = ?
      OR (browser = ? AND device = ?)
      OR EXISTS (
        SELECT 1 FROM sessions 
        WHERE browser = ? AND device = ?
        AND start_time > datetime('now', '-30 days')
      )
    )
  `).bind(sessionId || '', browser, device, browser, device).first();

  const isReturning = previousSessions && (previousSessions.count as number) > 0;
  console.log('Previous sessions found:', previousSessions?.count, 'Is returning:', isReturning);

  // Create new session
  const newSessionId = crypto.randomUUID();
  console.log('Creating new session:', newSessionId);

  const os = getOS(userAgent);
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  const city = 'Unknown'; // TODO: Implement city detection
  const referrer = request.headers.get('referer') || '';

  await db.prepare(`
    INSERT INTO sessions (
      session_id, start_time, end_time, page_count, is_bounce, is_returning,
      device, browser, os, country, city, referrer,
      total_time_ms
    ) VALUES (?, datetime('now'), datetime('now'), 1, 1, ?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(
    newSessionId,
    isReturning ? 1 : 0,
    device,
    browser,
    os,
    country,
    city,
    referrer
  ).run();

  return newSessionId;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const pagePath = searchParams.get('page') || '/';

    // Log database info
    const dbInfo = await db.prepare(`
      SELECT 
        'website-analytics-dev' as db_name,
        (SELECT COUNT(*) FROM sessions) as session_count,
        (SELECT COUNT(*) FROM pageviews) as pageview_count,
        (SELECT COUNT(*) FROM events) as event_count
    `).first();
    console.log('Database info (track):', dbInfo);

    const currentSessionId = await getOrCreateSession(db, request);

    // Record pageview
    await db.prepare(`
      INSERT INTO pageviews (
        session_id, page_path, timestamp,
        entry_page, exit_page,
        time_on_page_ms, max_scroll_percentage
      ) VALUES (?, ?, datetime('now'), ?, 1, 0, 0)
    `).bind(
      currentSessionId,
      pagePath,
      !request.cookies.get('session_id')?.value ? 1 : 0 // entry_page is 1 for new sessions
    ).run();

    // Mark previous page as non-exit if this isn't the first page
    if (request.cookies.get('session_id')?.value) {
      await db.prepare(`
        UPDATE pageviews 
        SET exit_page = 0
        WHERE session_id = ?
        AND exit_page = 1
      `).bind(currentSessionId).run();

      // Update session engagement
      await db.prepare(`
        UPDATE sessions 
        SET is_bounce = 0,
            end_time = CURRENT_TIMESTAMP,
            total_time_ms = ROUND((JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(start_time)) * 86400000)
        WHERE session_id = ?
      `).bind(currentSessionId).run();
    }

    const response = NextResponse.json({ 
      session_id: currentSessionId,
      is_new_session: !request.cookies.get('session_id')?.value
    });
    response.headers.set('Set-Cookie', createSessionCookie(currentSessionId));
    return response;
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to track analytics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('X-No-Track') === '1') {
      return NextResponse.json({ success: true });
    }

    const db = getDB();
    const { searchParams } = new URL(request.url);
    const data = (await request.json()) as EventPayload;
    
    const currentSessionId = await getOrCreateSession(db, request);
    const pagePath = searchParams.get('page') || '/';

    // Track event
    await db.prepare(`
      INSERT INTO events (
        event_name, 
        event_data, 
        page_path, 
        session_id, 
        event_type,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      data.event_name,
      JSON.stringify(data.event_data),
      pagePath,
      currentSessionId,
      data.event_name === 'click' ? 'click' : 
      data.event_name.startsWith('scroll') ? 'scroll' : 
      'engagement'
    ).run();

    // Update session time
    await db.prepare(`
      UPDATE sessions 
      SET end_time = CURRENT_TIMESTAMP,
          total_time_ms = ROUND((JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(start_time)) * 86400000)
      WHERE session_id = ?
    `).bind(currentSessionId).run();

    const response = NextResponse.json({ 
      success: true,
      session_id: currentSessionId
    });
    response.headers.set('Set-Cookie', createSessionCookie(currentSessionId));
    return response;
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}

// Helper functions for user agent parsing
function getBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

function getOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Unknown';
}

function createSessionCookie(session_id: string): string {
  return cookie.serialize('session_id', session_id, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  });
} 