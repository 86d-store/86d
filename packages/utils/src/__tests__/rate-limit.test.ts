import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("allows requests within the limit", () => {
		const limiter = createRateLimiter({ limit: 3, window: 60_000 });
		const r1 = limiter.check("user1");
		expect(r1.allowed).toBe(true);
		expect(r1.remaining).toBe(2);
	});

	it("tracks remaining count accurately", () => {
		const limiter = createRateLimiter({ limit: 3, window: 60_000 });
		expect(limiter.check("user1").remaining).toBe(2);
		expect(limiter.check("user1").remaining).toBe(1);
		expect(limiter.check("user1").remaining).toBe(0);
	});

	it("blocks requests exceeding the limit", () => {
		const limiter = createRateLimiter({ limit: 2, window: 60_000 });
		limiter.check("user1");
		limiter.check("user1");
		const r3 = limiter.check("user1");
		expect(r3.allowed).toBe(false);
		expect(r3.remaining).toBe(0);
	});

	it("tracks different keys independently", () => {
		const limiter = createRateLimiter({ limit: 1, window: 60_000 });
		expect(limiter.check("user1").allowed).toBe(true);
		expect(limiter.check("user2").allowed).toBe(true);
		expect(limiter.check("user1").allowed).toBe(false);
		expect(limiter.check("user2").allowed).toBe(false);
	});

	it("resets after window expires", () => {
		const limiter = createRateLimiter({ limit: 1, window: 60_000 });
		expect(limiter.check("user1").allowed).toBe(true);
		expect(limiter.check("user1").allowed).toBe(false);

		vi.advanceTimersByTime(60_001);

		expect(limiter.check("user1").allowed).toBe(true);
	});

	it("returns resetAt timestamp in the future", () => {
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const limiter = createRateLimiter({ limit: 5, window: 30_000 });
		const result = limiter.check("user1");
		expect(result.resetAt).toBe(Date.now() + 30_000);
	});

	it("preserves resetAt for subsequent requests within window", () => {
		const limiter = createRateLimiter({ limit: 5, window: 60_000 });
		const r1 = limiter.check("user1");
		vi.advanceTimersByTime(5_000);
		const r2 = limiter.check("user1");
		expect(r2.resetAt).toBe(r1.resetAt);
	});

	it("sweeps expired entries", () => {
		const limiter = createRateLimiter({ limit: 1, window: 10_000 });
		limiter.check("user1");
		limiter.check("user2");

		vi.advanceTimersByTime(10_001);

		// After window expires, both should be allowed again (entries swept)
		expect(limiter.check("user1").allowed).toBe(true);
		expect(limiter.check("user2").allowed).toBe(true);
	});

	it("handles limit of 1", () => {
		const limiter = createRateLimiter({ limit: 1, window: 1_000 });
		const r1 = limiter.check("key");
		expect(r1.allowed).toBe(true);
		expect(r1.remaining).toBe(0);

		const r2 = limiter.check("key");
		expect(r2.allowed).toBe(false);
	});

	it("handles high request volume", () => {
		const limiter = createRateLimiter({ limit: 100, window: 60_000 });
		for (let i = 0; i < 100; i++) {
			expect(limiter.check("key").allowed).toBe(true);
		}
		expect(limiter.check("key").allowed).toBe(false);
	});

	describe("key bound", () => {
		it("stays bounded when every caller presents a new identity", () => {
			const limiter = createRateLimiter({
				limit: 5,
				window: 600_000,
				maxKeys: 100,
			});
			for (let i = 0; i < 5_000; i += 1) limiter.check(`spoofed-${i}`);
			expect(limiter.size()).toBeLessThanOrEqual(100);
		});

		it("keeps limiting a real caller after an eviction sweep", () => {
			const limiter = createRateLimiter({
				limit: 3,
				window: 600_000,
				maxKeys: 50,
			});
			for (let i = 0; i < 4; i += 1) limiter.check("steady");
			expect(limiter.check("steady").allowed).toBe(false);
		});
	});
});
