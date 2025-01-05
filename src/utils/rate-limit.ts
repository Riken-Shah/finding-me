export type RateLimiterOptions = {
  interval: number;
  uniqueTokenPerInterval: number;
};

export class RateLimiter {
  private tokenMap = new Map<string, number>();
  private interval: number;

  constructor(private options: RateLimiterOptions) {
    this.interval = options.interval;
    // Clean up tokens periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.tokenMap.clear(), this.interval);
    }
  }

  async check(limit: number, identifier: string): Promise<void> {
    const current = this.tokenMap.get(identifier) || 0;
    
    if (current >= limit) {
      const error = new Error('Rate limit exceeded') as Error & { code: string };
      error.code = 'RATE_LIMIT_EXCEEDED';
      throw error;
    }
    
    this.tokenMap.set(identifier, current + 1);
  }
}

export function rateLimit(options: RateLimiterOptions) {
  return new RateLimiter(options);
} 