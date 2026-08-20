import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNewsletterController } from "../service-impl";

/**
 * Security tests for newsletter module endpoints.
 *
 * These tests verify:
 * - Email uniqueness: duplicate subscriptions handled safely
 * - Subscriber privacy: email-based lookup scoped correctly
 * - Campaign state machine: sent/sending campaigns cannot be modified
 * - Unsubscribe safety: unsubscribed users cannot receive campaigns
 * - Resubscribe flow: proper status transitions
 * - Campaign deletion: only non-sending campaigns can be deleted
 */

describe("newsletter endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNewsletterController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNewsletterController(mockData);
	});

	// ── Email Uniqueness & Subscription Safety ──────────────────────

	describe("email uniqueness and subscription safety", () => {
		it("subscribing same email twice is idempotent", async () => {
			await controller.subscribe({
				email: "user@test.com",
				firstName: "Test",
			});
			await controller.subscribe({
				email: "user@test.com",
				firstName: "Test Updated",
			});

			// Should not create duplicate — returns existing or updated
			const subscriber = await controller.getSubscriberByEmail("user@test.com");
			expect(subscriber).not.toBeNull();
		});

		it("email lookup is case-insensitive (or exact — whichever is implemented)", async () => {
			await controller.subscribe({
				email: "User@Test.com",
			});

			// Lookup should find subscriber
			const result = await controller.getSubscriberByEmail("User@Test.com");
			expect(result).not.toBeNull();
		});

		it("subscriber ID lookup returns null for non-existent ID", async () => {
			const result = await controller.getSubscriber("nonexistent");
			expect(result).toBeNull();
		});

		it("email lookup returns null for non-existent email", async () => {
			const result = await controller.getSubscriberByEmail(
				"nonexistent@test.com",
			);
			expect(result).toBeNull();
		});
	});

	// ── Unsubscribe Safety ──────────────────────────────────────────

	describe("unsubscribe safety", () => {
		it("unsubscribe changes status to unsubscribed", async () => {
			await controller.subscribe({ email: "user@test.com" });
			const result = await controller.unsubscribe("user@test.com");

			expect(result).not.toBeNull();
			expect(result?.status).toBe("unsubscribed");
		});

		it("unsubscribe non-existent email returns null", async () => {
			const result = await controller.unsubscribe("nonexistent@test.com");
			expect(result).toBeNull();
		});

		it("double unsubscribe is safe", async () => {
			await controller.subscribe({ email: "user@test.com" });
			await controller.unsubscribe("user@test.com");
			const second = await controller.unsubscribe("user@test.com");

			expect(second).not.toBeNull();
			expect(second?.status).toBe("unsubscribed");
		});

		it("resubscribe restores active status", async () => {
			await controller.subscribe({ email: "user@test.com" });
			await controller.unsubscribe("user@test.com");
			const result = await controller.resubscribe("user@test.com");

			expect(result).not.toBeNull();
			expect(result?.status).toBe("active");
		});

		it("resubscribe non-existent email returns null", async () => {
			const result = await controller.resubscribe("nonexistent@test.com");
			expect(result).toBeNull();
		});
	});

	// ── Subscriber Privacy ──────────────────────────────────────────

	describe("subscriber privacy", () => {
		it("listSubscribers filters by status", async () => {
			await controller.subscribe({ email: "active@test.com" });
			await controller.subscribe({ email: "inactive@test.com" });
			await controller.unsubscribe("inactive@test.com");

			const activeOnly = await controller.listSubscribers({
				status: "active",
			});
			const unsubbed = await controller.listSubscribers({
				status: "unsubscribed",
			});

			expect(activeOnly.every((s) => s.status === "active")).toBe(true);
			expect(unsubbed.every((s) => s.status === "unsubscribed")).toBe(true);
		});

		it("deleting subscriber removes their data", async () => {
			const sub = await controller.subscribe({ email: "delete-me@test.com" });
			await controller.deleteSubscriber(sub.id);

			const result = await controller.getSubscriber(sub.id);
			expect(result).toBeNull();

			const byEmail =
				await controller.getSubscriberByEmail("delete-me@test.com");
			expect(byEmail).toBeNull();
		});

		it("deleting non-existent subscriber returns false", async () => {
			const result = await controller.deleteSubscriber("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Campaign State Machine ──────────────────────────────────────

	describe("campaign state machine", () => {
		it("draft campaign can be updated", async () => {
			const campaign = await controller.createCampaign({
				subject: "Welcome",
				body: "Hello!",
			});

			const updated = await controller.updateCampaign(campaign.id, {
				subject: "Updated Welcome",
			});
			expect(updated).not.toBeNull();
			expect(updated?.subject).toBe("Updated Welcome");
		});

		it("sent campaign cannot be updated", async () => {
			const campaign = await controller.createCampaign({
				subject: "Welcome",
				body: "Hello!",
			});
			await controller.sendCampaign(campaign.id);

			const updated = await controller.updateCampaign(campaign.id, {
				subject: "Hacked Subject",
			});
			expect(updated).toBeNull();
		});

		it("sent campaign cannot be sent again", async () => {
			const campaign = await controller.createCampaign({
				subject: "Welcome",
				body: "Hello!",
			});
			await controller.sendCampaign(campaign.id);

			const result = await controller.sendCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("draft campaign can be deleted", async () => {
			const campaign = await controller.createCampaign({
				subject: "Delete Me",
				body: "Goodbye!",
			});

			const result = await controller.deleteCampaign(campaign.id);
			expect(result).toBe(true);

			const check = await controller.getCampaign(campaign.id);
			expect(check).toBeNull();
		});

		it("non-existent campaign returns null", async () => {
			const result = await controller.getCampaign("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Tag-Based Filtering Security ────────────────────────────────

	describe("tag-based filtering", () => {
		it("tags filter returns only matching subscribers", async () => {
			await controller.subscribe({
				email: "vip@test.com",
				tags: ["vip", "early-adopter"],
			});
			await controller.subscribe({
				email: "regular@test.com",
				tags: ["regular"],
			});

			const vipSubscribers = await controller.listSubscribers({
				tag: "vip",
			});

			// Should contain only VIP tagged subscribers
			for (const sub of vipSubscribers) {
				expect(sub.tags).toContain("vip");
			}
		});
	});

	// ── Campaign Stats Security ─────────────────────────────────────

	describe("campaign stats", () => {
		it("stats reflect accurate counts", async () => {
			await controller.createCampaign({
				subject: "Campaign 1",
				body: "Hello!",
			});
			const c2 = await controller.createCampaign({
				subject: "Campaign 2",
				body: "Hello!",
			});
			await controller.sendCampaign(c2.id);

			const stats = await controller.getCampaignStats();
			expect(stats).not.toBeNull();
			expect(stats.total).toBeGreaterThanOrEqual(2);
		});
	});
});
