import { describe, expect, it, vi } from "vitest";
import { runDurableEventWorker } from "../durable-event-worker";

describe("runDurableEventWorker", () => {
	it("drains independently until the durable queue is idle", async () => {
		const drain = vi
			.fn()
			.mockResolvedValueOnce({
				claimed: 2,
				succeeded: 1,
				failed: 1,
				deadLettered: 0,
			})
			.mockResolvedValueOnce({
				claimed: 1,
				succeeded: 0,
				failed: 0,
				deadLettered: 1,
			})
			.mockResolvedValueOnce({
				claimed: 0,
				succeeded: 0,
				failed: 0,
				deadLettered: 0,
			});

		await expect(
			runDurableEventWorker({ drain, maxBatches: 10 }),
		).resolves.toEqual({
			batches: 3,
			claimed: 3,
			succeeded: 1,
			failed: 1,
			deadLettered: 1,
			exhausted: false,
		});
		expect(drain).toHaveBeenCalledTimes(3);
	});

	it("stops at a bounded batch limit so a scheduler invocation terminates", async () => {
		const drain = vi.fn().mockResolvedValue({
			claimed: 20,
			succeeded: 20,
			failed: 0,
			deadLettered: 0,
		});

		const result = await runDurableEventWorker({ drain, maxBatches: 2 });

		expect(result).toMatchObject({
			batches: 2,
			claimed: 40,
			succeeded: 40,
			exhausted: true,
		});
		expect(drain).toHaveBeenCalledTimes(2);
	});

	it("rejects invalid batch bounds before touching the queue", async () => {
		const drain = vi.fn();

		await expect(
			runDurableEventWorker({ drain, maxBatches: 0 }),
		).rejects.toThrow("maxBatches");
		expect(drain).not.toHaveBeenCalled();
	});
});
