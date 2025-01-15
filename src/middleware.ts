import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';

declare global {
  var DB: D1Database;
}

export async function middleware(request: NextRequest) {
  return NextResponse.next();
} 