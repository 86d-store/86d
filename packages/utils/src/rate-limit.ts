interface RateLimiterOptions {
	limit: number;
	window: number;
	/**
	 * Ceiling on distinct keys held at once. A key is created per caller, so an
	 * attacker who can vary the caller identity would otherwise grow this map
	 * for a whole window before the sweep runs.
	 */
	maxKeys?: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

interface RateLimiter {
	check(key: string): RateLimitResult;
	/** Keys currently tracked. Exposed so the bound can be asserted in tests. */
	size(): number;
}

const DEFAULT_MAX_KEYS = 100_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
	const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
	const hits = new Map<string, { count: number; resetAt: number }>();
	let lastSweep = Date.now();

	function sweep(now: number, force = false) {
		if (!force && now - lastSweep < options.window) return;
		lastSweep = now;
		for (const [key, entry] of hits) {
			if (now >= entry.resetAt) {
				hits.delete(key);
			}
		}
	}

	/** Drop the entries nearest expiry so the map stays bounded and service continues. */
	function evictOldest(count: number) {
		const byExpiry = [...hits.entries()].sort(
			(a, b) => a[1].resetAt - b[1].resetAt,
		);
		for (let i = 0; i < count && i < byExpiry.length; i += 1) {
			hits.delete(byExpiry[i][0]);
		}
	}

	function admitNewKey(now: number) {
		if (hits.size < maxKeys) return;
		sweep(now, true);
		if (hits.size >= maxKeys) evictOldest(Math.ceil(maxKeys / 10));
	}

	return {
		check(key: string): RateLimitResult {
			const now = Date.now();
			sweep(now);
			const entry = hits.get(key);

			if (!entry || now >= entry.resetAt) {
				admitNewKey(now);
				const resetAt = now + options.window;
				hits.set(key, { count: 1, resetAt });
				return { allowed: true, remaining: options.limit - 1, resetAt };
			}

			entry.count++;
			if (entry.count > options.limit) {
				return { allowed: false, remaining: 0, resetAt: entry.resetAt };
			}

			return {
				allowed: true,
				remaining: options.limit - entry.count,
				resetAt: entry.resetAt,
			};
		},
		size() {
			return hits.size;
		},
	};
}
