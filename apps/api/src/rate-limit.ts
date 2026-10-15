type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
};

export function createRateLimiter(options: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return {
    allow(key: string): boolean {
      const now = (options.now ?? Date.now)();
      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < options.windowMs);
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
