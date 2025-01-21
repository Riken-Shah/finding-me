interface Env {
    AI: Ai;
  }

  import { NextRequest, NextResponse } from 'next/server';
  import {getRequestContext } from "@cloudflare/next-on-pages"


export const runtime = 'edge';
export const preferredRegion = 'auto';

interface RouteContext {
  params: { [key: string]: string | string[] };
}

export async function GET(
  request: NextRequest,
) {
    const ai = (getRequestContext().env as Env).AI;
    console.log(ai);
  try {
    const input = { prompt: "What is the origin of the phrase Hello, World" };
  
    const answer = await ai.run(
      "@cf/qwen/qwen1.5-0.5b-chat",
      input,
    );
  
    return NextResponse.json(answer);
  } catch (error) {
    console.error('Error getting analytics metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
