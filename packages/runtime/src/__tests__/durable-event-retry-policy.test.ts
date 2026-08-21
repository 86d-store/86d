import { describe, expect, it } from "vitest";
import { durableEventRetryDelayMs } from "../durable-event-dispatcher";

describe("durable event retry delay policy", () => {
	it("follows 1/2/4/8/16/32/60 seconds with a 60s cap", () => {
		const expected = [1, 2, 4, 8, 16, 32, 60, 60, 60].map(
			(seconds) => seconds * 1_000,
		);
		for (let attempt = 1; attempt <= expected.length; attempt++) {
			expect(durableEventRetryDelayMs(attempt)).toBe(expected[attempt - 1]);
		}
	});
});
