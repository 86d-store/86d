import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { NewsletterController } from "../service";
import { createNewsletterController } from "../service-impl";

/**
 * Store endpoint integration tests for the newsletter module.
 *
 * Both store endpoints are public (no auth required). Tests verify:
 *
 * 1. subscribe — creates subscriber, idempotent for active, reactivates unsubscribed
 * 2. unsubscribe — marks subscriber inactive, handles non-existent email
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateSubscribe(
	controller: NewsletterController,
	body: { email: string; firstName?: string; lastName?: string },
) {
	const subscriber = await controller.subscribe({
		email: body.email.toLowerCase().trim(),
		firstName: body.firstName,
		lastName: body.lastName,
		source: "store",
	});
	return { subscriber };
}

async function simulateUnsubscribe(
	controller: NewsletterController,
	body: { email: string },
) {
	const subscriber = await controller.unsubscribe(
		body.email.toLowerCase().trim(),
	);
	if (!subscriber) return { error: "Not found", status: 404 };
	return { subscriber };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: NewsletterController;

beforeEach(() => {
	data = createMockDataService();
	controller = createNewsletterController(data);
});

describe("subscribe (POST /newsletter/subscribe)", () => {
	it("creates a new subscriber", async () => {
		const result = await simulateSubscribe(controller, {
			email: "new@example.com",
		});
		expect(result.subscriber.email).toBe("new@example.com");
		expect(result.subscriber.status).toBe("active");
		expect(result.subscriber.source).toBe("store");
	});

	it("accepts first and last name", async () => {
		const result = await simulateSubscribe(controller, {
			email: "jane@example.com",
			firstName: "Jane",
			lastName: "Doe",
		});
		expect(result.subscriber.firstName).toBe("Jane");
		expect(result.subscriber.lastName).toBe("Doe");
	});

	it("is idempotent for already-active subscribers", async () => {
		const first = await simulateSubscribe(controller, {
			email: "same@example.com",
		});
		const second = await simulateSubscribe(controller, {
			email: "same@example.com",
		});
		expect(first.subscriber.id).toBe(second.subscriber.id);
		expect(second.subscriber.status).toBe("active");
	});

	it("reactivates an unsubscribed email", async () => {
		await controller.subscribe({ email: "reactivate@example.com" });
		await controller.unsubscribe("reactivate@example.com");

		const result = await simulateSubscribe(controller, {
			email: "reactivate@example.com",
		});
		expect(result.subscriber.status).toBe("active");
	});

	it("normalizes email to lowercase", async () => {
		const result = await simulateSubscribe(controller, {
			email: "  Test@Example.COM  ",
		});
		expect(result.subscriber.email).toBe("test@example.com");
	});
});

describe("unsubscribe (POST /newsletter/unsubscribe)", () => {
	it("unsubscribes an active subscriber", async () => {
		await controller.subscribe({ email: "active@example.com" });

		const result = await simulateUnsubscribe(controller, {
			email: "active@example.com",
		});
		expect("subscriber" in result).toBe(true);
		if ("subscriber" in result) {
			expect(result.subscriber.status).toBe("unsubscribed");
			expect(result.subscriber.unsubscribedAt).toBeDefined();
		}
	});

	it("returns 404 for non-existent email", async () => {
		const result = await simulateUnsubscribe(controller, {
			email: "nobody@example.com",
		});
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("cross-endpoint lifecycle", () => {
	it("subscribe → unsubscribe → resubscribe", async () => {
		// Subscribe
		const sub = await simulateSubscribe(controller, {
			email: "lifecycle@example.com",
			firstName: "Test",
		});
		expect(sub.subscriber.status).toBe("active");

		// Unsubscribe
		const unsub = await simulateUnsubscribe(controller, {
			email: "lifecycle@example.com",
		});
		if ("subscriber" in unsub) {
			expect(unsub.subscriber.status).toBe("unsubscribed");
		}

		// Resubscribe
		const resub = await simulateSubscribe(controller, {
			email: "lifecycle@example.com",
		});
		expect(resub.subscriber.status).toBe("active");
		expect(resub.subscriber.id).toBe(sub.subscriber.id);
	});
});
