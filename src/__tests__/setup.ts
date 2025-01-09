import { NextResponse } from 'next/server';

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-session-id',
  },
});

// Mock NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  return {
    ...originalModule,
    NextResponse: {
      json: (data: any, init?: ResponseInit) => {
        const response = new originalModule.NextResponse(JSON.stringify(data), init);
        Object.defineProperty(response, 'status', {
          get: () => init?.status || 200,
        });
        return response;
      },
    },
  };
}); 