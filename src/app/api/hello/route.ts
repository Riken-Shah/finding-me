import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'auto';

export async function GET() {
  const responseText = 'Hello World';
  return NextResponse.json({ message: responseText });
}
