import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createNewsletterController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// newsletter.subscribed
// ---------------------------------------------------------------------------

describe("newsletter.subscribed event", () => {
	it("emits when a new subscriber is added", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		const sub = await ctrl.subscribe({
			email: "test@example.com",
			source: "website",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("newsletter.subscribed");
		expect(events.emitted[0].payload).toEqual({
			subscriberId: sub.id,
			email: "test@example.com",
			source: "website",
		});
	});

	it("does not emit for idempotent subscribe (already active)", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({ email: "test@example.com" });
		events.emitted.length = 0;

		// Subscribe again — idempotent, returns existing
		await ctrl.subscribe({ email: "test@example.com" });

		expect(
			events.emitted.filter((e) => e.type === "newsletter.subscribed"),
		).toHaveLength(0);
	});

	it("does not emit when reactivating from unsubscribed", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({ email: "test@example.com" });
		await ctrl.unsubscribe("test@example.com");
		events.emitted.length = 0;

		// Re-subscribe reactivates — no new subscriber event
		await ctrl.subscribe({ email: "test@example.com" });

		expect(
			events.emitted.filter((e) => e.type === "newsletter.subscribed"),
		).toHaveLength(0);
	});

	it("includes source in payload", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({
			email: "user@test.com",
			source: "checkout",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.source).toBe("checkout");
	});

	it("handles undefined source gracefully", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({ email: "user@test.com" });

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.source).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// newsletter.unsubscribed
// ---------------------------------------------------------------------------

describe("newsletter.unsubscribed event", () => {
	it("emits when a subscriber unsubscribes", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		const sub = await ctrl.subscribe({ email: "test@example.com" });
		events.emitted.length = 0;

		await ctrl.unsubscribe("test@example.com");

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("newsletter.unsubscribed");
		expect(events.emitted[0].payload).toEqual({
			subscriberId: sub.id,
			email: "test@example.com",
		});
	});

	it("does not emit when email does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.unsubscribe("nonexistent@example.com");

		expect(
			events.emitted.filter((e) => e.type === "newsletter.unsubscribed"),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// newsletter.campaign.sent
// ---------------------------------------------------------------------------

describe("newsletter.campaign.sent event", () => {
	it("emits when a campaign is sent", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		// Add some subscribers
		await ctrl.subscribe({ email: "a@test.com" });
		await ctrl.subscribe({ email: "b@test.com" });

		const campaign = await ctrl.createCampaign({
			subject: "Hello",
			body: "<p>Content</p>",
		});
		events.emitted.length = 0;

		const sent = await ctrl.sendCampaign(campaign.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("newsletter.campaign.sent");
		expect(events.emitted[0].payload).toEqual({
			campaignId: sent?.id,
			subject: "Hello",
			recipientCount: 2,
		});
	});

	it("does not emit when campaign is already sent", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		const campaign = await ctrl.createCampaign({
			subject: "Test",
			body: "Body",
		});
		await ctrl.sendCampaign(campaign.id);
		events.emitted.length = 0;

		// Try to send again — returns null
		const result = await ctrl.sendCampaign(campaign.id);

		expect(result).toBeNull();
		expect(
			events.emitted.filter((e) => e.type === "newsletter.campaign.sent"),
		).toHaveLength(0);
	});

	it("emits with zero recipients when no active subscribers", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		const campaign = await ctrl.createCampaign({
			subject: "Empty",
			body: "No one",
		});
		events.emitted.length = 0;

		await ctrl.sendCampaign(campaign.id);

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.recipientCount).toBe(0);
	});

	it("counts only active subscribers in recipientCount", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({ email: "active@test.com" });
		await ctrl.subscribe({ email: "will-unsub@test.com" });
		await ctrl.unsubscribe("will-unsub@test.com");

		const campaign = await ctrl.createCampaign({
			subject: "Partial",
			body: "Body",
		});
		events.emitted.length = 0;

		await ctrl.sendCampaign(campaign.id);

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.recipientCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createNewsletterController(createMockDataService());

		await ctrl.subscribe({ email: "test@example.com" });
		await ctrl.unsubscribe("test@example.com");
		const campaign = await ctrl.createCampaign({
			subject: "Test",
			body: "Body",
		});
		await expect(ctrl.sendCampaign(campaign.id)).resolves.toBeUndefined();

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createNewsletterController(createMockDataService(), events);

		await ctrl.subscribe({ email: "user@test.com", source: "footer" });
		await ctrl.unsubscribe("user@test.com");
		const campaign = await ctrl.createCampaign({
			subject: "Test",
			body: "Body",
		});
		// Re-subscribe before sending
		await ctrl.subscribe({ email: "other@test.com" });
		await ctrl.sendCampaign(campaign.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"newsletter.subscribed",
			"newsletter.unsubscribed",
			"newsletter.subscribed",
			"newsletter.campaign.sent",
		]);
	});
});
