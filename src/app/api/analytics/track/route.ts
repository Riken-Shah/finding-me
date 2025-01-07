import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';

export const runtime = 'edge';
export const preferredRegion = 'auto';

interface Env {
  DB: D1Database;
}

interface AnalyticsEvent {
  event_name: string;
  event_data: {
    element?: string;
    href?: string;
    x?: number;
    y?: number;
    viewport_width?: number;
    viewport_height?: number;
    section_id?: string;
    visible_time_ms?: number;
    section_height?: number;
    visible_percentage?: number;
    [key: string]: unknown;
  };
}

function getDB(): D1Database {
  // @ts-expect-error - Cloudflare bindings
  const env = process.env as Env;
  if (!env?.DB) {
    console.error('DB connection error:', { 
      env: process.env,
      bindings: Object.keys(process.env),
      isDev: process.env.NODE_ENV === 'development',
      isProd: process.env.NODE_ENV === 'production'
    });
    throw new Error('D1 database not found in environment');
  }
  return env.DB;
}

function createSessionCookie(sessionId: string): string {
  return `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`; // 30 days
}

// Helper function to get or create a session
async function getOrCreateSession(db: D1Database, request: NextRequest): Promise<string> {
  const sessionId = request.nextUrl.searchParams.get('session_id') || request.cookies.get('session_id')?.value;
  const userAgent = request.headers.get('user-agent') || '';
  const device = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
  const browser = getBrowser(userAgent);
  const os = getOS(userAgent);
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  const city = request.headers.get('cf-ipcity') || 'Unknown';
  const referrer = request.headers.get('referer') || '';

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
  const previousSessions = await db.prepare(`
    SELECT COUNT(*) as count
    FROM sessions s
    WHERE start_time > datetime('now', '-30 days')
    AND (
      s.session_id = ?
      OR (
        s.browser = ? 
        AND s.device = ? 
        AND s.os = ?
      )
    )
  `).bind(
    sessionId || '',
    browser,
    device,
    os
  ).first() as { count: number };

  const isReturning = previousSessions?.count > 0;
  console.log('Previous sessions found:', previousSessions?.count, 'Is returning:', isReturning);

  // Create new session
  const newSessionId = crypto.randomUUID();
  console.log('Creating new session:', newSessionId);

  // Insert new session with more accurate returning visitor detection
  await db.prepare(`
    INSERT INTO sessions (
      session_id, start_time, end_time, page_count, is_bounce, is_returning,
      device, browser, os, country, city, referrer,
      total_time_ms
    ) VALUES (
      ?, 
      datetime('now'), 
      datetime('now'), 
      1,  /* page_count starts at 1 */
      1,  /* is_bounce starts as true */
      ?,  /* is_returning based on previous sessions */
      ?, ?, ?, ?, ?, ?,
      0   /* total_time_ms starts at 0 */
    )
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

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('X-No-Track') === '1') {
      return NextResponse.json({ success: true });
    }

    const db = getDB();
    const { searchParams } = new URL(request.url);
    const data = await request.json() as AnalyticsEvent;
    
    const currentSessionId = await getOrCreateSession(db, request);
    const pagePath = searchParams.get('page') || '/';

    // Track event with enhanced data
    try {
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
        JSON.stringify({
          ...data.event_data,
          element: data.event_data.element || 'unknown',
          href: data.event_data.href || null,
          x: data.event_data.x || 0,
          y: data.event_data.y || 0,
          viewport_width: data.event_data.viewport_width || 0,
          viewport_height: data.event_data.viewport_height || 0,
          section_id: data.event_data.section_id || null,
          visible_time_ms: data.event_data.visible_time_ms || 0,
          section_height: data.event_data.section_height || 0,
          visible_percentage: data.event_data.visible_percentage || 0
        }),
        pagePath,
        currentSessionId,
        data.event_name === 'click' ? 'click' : 
        data.event_name === 'scroll' ? 'scroll' :
        data.event_name === 'section_view' ? 'section_view' : 
        'engagement'
      ).run();

      // Update session with latest activity
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

      // Set cookie directly without using the cookie package
      response.headers.set('Set-Cookie', createSessionCookie(currentSessionId));
      return response;
    } catch (dbError) {
      console.error('Database operation failed:', {
        error: dbError,
        event: data.event_name,
        session: currentSessionId,
        path: pagePath
      });
      throw new Error('Database operation failed');
    }
  } catch (error) {
    console.error('Analytics error:', {
      error,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      env: {
        isDev: process.env.NODE_ENV === 'development',
        isProd: process.env.NODE_ENV === 'production',
        hasDB: Boolean(process.env.DB)
      }
    });
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to track event',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { 
      status: 500 
    });
  }
} 