import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsletterEmailProvider } from "../email-provider";
import { createNewsletterController } from "../service-impl";

describe("createNewsletterController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNewsletterController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNewsletterController(mockData);
	});

	// ── subscribe ────────────────────────────────────────────────────────

	describe("subscribe", () => {
		it("creates a new subscriber", async () => {
			const sub = await controller.subscribe({
				email: "alice@example.com",
			});
			expect(sub.id).toBeDefined();
			expect(sub.email).toBe("alice@example.com");
			expect(sub.status).toBe("active");
			expect(sub.tags).toEqual([]);
			expect(sub.metadata).toEqual({});
			expect(sub.subscribedAt).toBeInstanceOf(Date);
		});

		it("creates subscriber with optional fields", async () => {
			const sub = await controller.subscribe({
				email: "bob@example.com",
				firstName: "Bob",
				lastName: "Smith",
				source: "footer",
				tags: ["vip"],
				metadata: { campaign: "spring2024" },
			});
			expect(sub.firstName).toBe("Bob");
			expect(sub.lastName).toBe("Smith");
			expect(sub.source).toBe("footer");
			expect(sub.tags).toEqual(["vip"]);
			expect(sub.metadata).toEqual({ campaign: "spring2024" });
		});

		it("returns existing active subscriber idempotently", async () => {
			const first = await controller.subscribe({
				email: "alice@example.com",
			});
			const second = await controller.subscribe({
				email: "alice@example.com",
			});
			expect(second.id).toBe(first.id);
			expect(second.status).toBe("active");
		});

		it("reactivates an unsubscribed subscriber", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			await controller.unsubscribe("alice@example.com");
			const resubscribed = await controller.subscribe({
				email: "alice@example.com",
			});
			expect(resubscribed.status).toBe("active");
		});

		it("reactivates a bounced subscriber", async () => {
			const sub = await controller.subscribe({
				email: "bounced@example.com",
			});
			await controller.updateSubscriber(sub.id, { status: "bounced" });
			const resubscribed = await controller.subscribe({
				email: "bounced@example.com",
			});
			expect(resubscribed.status).toBe("active");
			expect(resubscribed.id).toBe(sub.id);
		});

		it("treats different email casing as separate subscribers", async () => {
			const lower = await controller.subscribe({
				email: "test@example.com",
			});
			const upper = await controller.subscribe({
				email: "TEST@example.com",
			});
			expect(lower.id).not.toBe(upper.id);
		});

		it("assigns a unique id to each subscriber", async () => {
			const a = await controller.subscribe({ email: "a@test.com" });
			const b = await controller.subscribe({ email: "b@test.com" });
			expect(a.id).not.toBe(b.id);
		});

		it("sets createdAt and updatedAt timestamps", async () => {
			const sub = await controller.subscribe({
				email: "time@test.com",
			});
			expect(sub.createdAt).toBeInstanceOf(Date);
			expect(sub.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── unsubscribe ──────────────────────────────────────────────────────

	describe("unsubscribe", () => {
		it("marks subscriber as unsubscribed", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			const result = await controller.unsubscribe("alice@example.com");
			expect(result?.status).toBe("unsubscribed");
			expect(result?.unsubscribedAt).toBeInstanceOf(Date);
		});

		it("returns null for non-existent email", async () => {
			const result = await controller.unsubscribe("nobody@example.com");
			expect(result).toBeNull();
		});

		it("unsubscribing an already-unsubscribed subscriber updates timestamp", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			const first = await controller.unsubscribe("alice@example.com");
			const second = await controller.unsubscribe("alice@example.com");
			expect(second?.status).toBe("unsubscribed");
			expect(second?.unsubscribedAt).toBeInstanceOf(Date);
			expect(second?.unsubscribedAt?.getTime()).toBeGreaterThanOrEqual(
				first?.unsubscribedAt?.getTime() ?? 0,
			);
		});
	});

	// ── resubscribe ──────────────────────────────────────────────────────

	describe("resubscribe", () => {
		it("reactivates an unsubscribed subscriber", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			await controller.unsubscribe("alice@example.com");
			const result = await controller.resubscribe("alice@example.com");
			expect(result?.status).toBe("active");
		});

		it("returns null for non-existent email", async () => {
			const result = await controller.resubscribe("nobody@example.com");
			expect(result).toBeNull();
		});

		it("resubscribing an already-active subscriber keeps status active", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			const result = await controller.resubscribe("alice@example.com");
			expect(result?.status).toBe("active");
		});

		it("clears unsubscribedAt on resubscription", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			await controller.unsubscribe("alice@example.com");
			const result = await controller.resubscribe("alice@example.com");
			expect(result?.unsubscribedAt).toBeUndefined();
		});
	});

	// ── getSubscriber ────────────────────────────────────────────────────

	describe("getSubscriber", () => {
		it("returns subscriber by id", async () => {
			const sub = await controller.subscribe({
				email: "alice@example.com",
			});
			const found = await controller.getSubscriber(sub.id);
			expect(found?.email).toBe("alice@example.com");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getSubscriber("missing");
			expect(found).toBeNull();
		});
	});

	// ── getSubscriberByEmail ─────────────────────────────────────────────

	describe("getSubscriberByEmail", () => {
		it("returns subscriber by email", async () => {
			await controller.subscribe({ email: "alice@example.com" });
			const found = await controller.getSubscriberByEmail("alice@example.com");
			expect(found?.email).toBe("alice@example.com");
		});

		it("returns null for non-existent email", async () => {
			const found = await controller.getSubscriberByEmail("nobody@example.com");
			expect(found).toBeNull();
		});
	});

	// ── updateSubscriber ─────────────────────────────────────────────────

	describe("updateSubscriber", () => {
		it("updates subscriber fields", async () => {
			const sub = await controller.subscribe({
				email: "alice@example.com",
			});
			const updated = await controller.updateSubscriber(sub.id, {
				firstName: "Alice",
				lastName: "Wonderland",
				tags: ["premium", "newsletter"],
				metadata: { preference: "weekly" },
			});
			expect(updated?.firstName).toBe("Alice");
			expect(updated?.lastName).toBe("Wonderland");
			expect(updated?.tags).toEqual(["premium", "newsletter"]);
			expect(updated?.metadata).toEqual({ preference: "weekly" });
		});

		it("can update status", async () => {
			const sub = await controller.subscribe({
				email: "bob@example.com",
			});
			const updated = await controller.updateSubscriber(sub.id, {
				status: "bounced",
			});
			expect(updated?.status).toBe("bounced");
		});

		it("returns null for non-existent subscriber", async () => {
			const result = await controller.updateSubscriber("missing", {
				firstName: "Ghost",
			});
			expect(result).toBeNull();
		});

		it("preserves fields not being updated", async () => {
			const sub = await controller.subscribe({
				email: "carol@example.com",
				firstName: "Carol",
			});
			const updated = await controller.updateSubscriber(sub.id, {
				lastName: "Danvers",
			});
			expect(updated?.firstName).toBe("Carol");
			expect(updated?.lastName).toBe("Danvers");
		});

		it("can set tags to empty array", async () => {
			const sub = await controller.subscribe({
				email: "tags@test.com",
				tags: ["vip", "premium"],
			});
			const updated = await controller.updateSubscriber(sub.id, {
				tags: [],
			});
			expect(updated?.tags).toEqual([]);
		});

		it("can set metadata to empty object", async () => {
			const sub = await controller.subscribe({
				email: "meta@test.com",
				metadata: { key: "value" },
			});
			const updated = await controller.updateSubscriber(sub.id, {
				metadata: {},
			});
			expect(updated?.metadata).toEqual({});
		});

		it("updates updatedAt timestamp", async () => {
			const sub = await controller.subscribe({
				email: "ts@test.com",
			});
			const updated = await controller.updateSubscriber(sub.id, {
				firstName: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				sub.updatedAt.getTime(),
			);
		});
	});

	// ── deleteSubscriber ─────────────────────────────────────────────────

	describe("deleteSubscriber", () => {
		it("deletes an existing subscriber", async () => {
			const sub = await controller.subscribe({
				email: "alice@example.com",
			});
			const result = await controller.deleteSubscriber(sub.id);
			expect(result).toBe(true);
			const found = await controller.getSubscriber(sub.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent subscriber", async () => {
			const result = await controller.deleteSubscriber("missing");
			expect(result).toBe(false);
		});
	});

	// ── listSubscribers ──────────────────────────────────────────────────

	describe("listSubscribers", () => {
		it("lists all subscribers without filters", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });
			const all = await controller.listSubscribers();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });
			await controller.unsubscribe("b@test.com");
			const active = await controller.listSubscribers({
				status: "active",
			});
			expect(active).toHaveLength(1);
		});

		it("filters by tag", async () => {
			await controller.subscribe({
				email: "a@test.com",
				tags: ["vip"],
			});
			await controller.subscribe({
				email: "b@test.com",
				tags: ["regular"],
			});
			const vips = await controller.listSubscribers({ tag: "vip" });
			expect(vips).toHaveLength(1);
			expect(vips[0].email).toBe("a@test.com");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({ email: `u${i}@test.com` });
			}
			const page = await controller.listSubscribers({
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no subscribers exist", async () => {
			const result = await controller.listSubscribers();
			expect(result).toEqual([]);
		});

		it("filters by unsubscribed status", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });
			await controller.subscribe({ email: "c@test.com" });
			await controller.unsubscribe("b@test.com");
			await controller.unsubscribe("c@test.com");
			const unsubs = await controller.listSubscribers({
				status: "unsubscribed",
			});
			expect(unsubs).toHaveLength(2);
		});

		it("combines status and tag filters", async () => {
			await controller.subscribe({
				email: "a@test.com",
				tags: ["vip"],
			});
			await controller.subscribe({
				email: "b@test.com",
				tags: ["vip"],
			});
			await controller.unsubscribe("b@test.com");
			const activeVips = await controller.listSubscribers({
				status: "active",
				tag: "vip",
			});
			expect(activeVips).toHaveLength(1);
			expect(activeVips[0].email).toBe("a@test.com");
		});

		it("returns all when tag matches no subscribers", async () => {
			await controller.subscribe({
				email: "a@test.com",
				tags: ["regular"],
			});
			const result = await controller.listSubscribers({
				tag: "nonexistent",
			});
			expect(result).toEqual([]);
		});

		it("handles subscriber with multiple tags", async () => {
			await controller.subscribe({
				email: "multi@test.com",
				tags: ["vip", "early-adopter", "newsletter"],
			});
			const byVip = await controller.listSubscribers({ tag: "vip" });
			const byEarly = await controller.listSubscribers({
				tag: "early-adopter",
			});
			expect(byVip).toHaveLength(1);
			expect(byEarly).toHaveLength(1);
		});
	});

	// ── full lifecycle ──────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("subscribe → unsubscribe → delete → re-subscribe creates new record", async () => {
			const first = await controller.subscribe({
				email: "lifecycle@test.com",
			});
			await controller.unsubscribe("lifecycle@test.com");
			await controller.deleteSubscriber(first.id);

			const found = await controller.getSubscriber(first.id);
			expect(found).toBeNull();

			const second = await controller.subscribe({
				email: "lifecycle@test.com",
			});
			expect(second.status).toBe("active");
			expect(second.id).not.toBe(first.id);
		});

		it("subscribe → update → getByEmail returns updated data", async () => {
			const created = await controller.subscribe({
				email: "flow@test.com",
				firstName: "Original",
			});
			await controller.updateSubscriber(created.id, {
				firstName: "Updated",
				tags: ["premium"],
			});
			const result = await controller.getSubscriberByEmail("flow@test.com");
			expect(result?.firstName).toBe("Updated");
			expect(result?.tags).toEqual(["premium"]);
		});
	});

	// ── createCampaign ──────────────────────────────────────────────────

	describe("createCampaign", () => {
		it("creates a draft campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Welcome Email",
				body: "Hello subscribers!",
			});
			expect(campaign.id).toBeDefined();
			expect(campaign.subject).toBe("Welcome Email");
			expect(campaign.body).toBe("Hello subscribers!");
			expect(campaign.status).toBe("draft");
			expect(campaign.recipientCount).toBe(0);
			expect(campaign.sentCount).toBe(0);
			expect(campaign.failedCount).toBe(0);
			expect(campaign.tags).toEqual([]);
			expect(campaign.scheduledAt).toBeUndefined();
			expect(campaign.sentAt).toBeUndefined();
			expect(campaign.createdAt).toBeInstanceOf(Date);
			expect(campaign.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a scheduled campaign when scheduledAt is provided", async () => {
			const scheduledAt = new Date("2026-04-01T10:00:00Z");
			const campaign = await controller.createCampaign({
				subject: "Spring Sale",
				body: "Big discounts!",
				scheduledAt,
			});
			expect(campaign.status).toBe("scheduled");
			expect(campaign.scheduledAt).toEqual(scheduledAt);
		});

		it("creates a campaign with tags", async () => {
			const campaign = await controller.createCampaign({
				subject: "Tagged Email",
				body: "Content",
				tags: ["promo", "seasonal"],
			});
			expect(campaign.tags).toEqual(["promo", "seasonal"]);
		});

		it("assigns unique ids", async () => {
			const a = await controller.createCampaign({
				subject: "A",
				body: "a",
			});
			const b = await controller.createCampaign({
				subject: "B",
				body: "b",
			});
			expect(a.id).not.toBe(b.id);
		});
	});

	// ── getCampaign ─────────────────────────────────────────────────────

	describe("getCampaign", () => {
		it("returns campaign by id", async () => {
			const created = await controller.createCampaign({
				subject: "Test",
				body: "Content",
			});
			const found = await controller.getCampaign(created.id);
			expect(found?.subject).toBe("Test");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getCampaign("missing");
			expect(found).toBeNull();
		});
	});

	// ── updateCampaign ──────────────────────────────────────────────────

	describe("updateCampaign", () => {
		it("updates campaign subject and body", async () => {
			const campaign = await controller.createCampaign({
				subject: "Original",
				body: "Original body",
			});
			const updated = await controller.updateCampaign(campaign.id, {
				subject: "Updated Subject",
				body: "Updated body",
			});
			expect(updated?.subject).toBe("Updated Subject");
			expect(updated?.body).toBe("Updated body");
		});

		it("updates campaign tags", async () => {
			const campaign = await controller.createCampaign({
				subject: "Test",
				body: "Content",
			});
			const updated = await controller.updateCampaign(campaign.id, {
				tags: ["new-tag"],
			});
			expect(updated?.tags).toEqual(["new-tag"]);
		});

		it("sets status to scheduled when scheduledAt is provided", async () => {
			const campaign = await controller.createCampaign({
				subject: "Test",
				body: "Content",
			});
			expect(campaign.status).toBe("draft");
			const updated = await controller.updateCampaign(campaign.id, {
				scheduledAt: new Date("2026-06-01T10:00:00Z"),
			});
			expect(updated?.status).toBe("scheduled");
		});

		it("returns null for non-existent campaign", async () => {
			const result = await controller.updateCampaign("missing", {
				subject: "Nope",
			});
			expect(result).toBeNull();
		});

		it("returns null when trying to update a sent campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Test",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);
			const result = await controller.updateCampaign(campaign.id, {
				subject: "Too late",
			});
			expect(result).toBeNull();
		});

		it("preserves fields not being updated", async () => {
			const campaign = await controller.createCampaign({
				subject: "Keep me",
				body: "Original body",
				tags: ["keep"],
			});
			const updated = await controller.updateCampaign(campaign.id, {
				subject: "Changed",
			});
			expect(updated?.body).toBe("Original body");
			expect(updated?.tags).toEqual(["keep"]);
		});
	});

	// ── deleteCampaign ──────────────────────────────────────────────────

	describe("deleteCampaign", () => {
		it("deletes an existing draft campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Delete me",
				body: "Content",
			});
			const result = await controller.deleteCampaign(campaign.id);
			expect(result).toBe(true);
			const found = await controller.getCampaign(campaign.id);
			expect(found).toBeNull();
		});

		it("deletes a sent campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Sent one",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);
			const result = await controller.deleteCampaign(campaign.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent campaign", async () => {
			const result = await controller.deleteCampaign("missing");
			expect(result).toBe(false);
		});
	});

	// ── listCampaigns ───────────────────────────────────────────────────

	describe("listCampaigns", () => {
		it("lists all campaigns", async () => {
			await controller.createCampaign({ subject: "A", body: "a" });
			await controller.createCampaign({ subject: "B", body: "b" });
			const all = await controller.listCampaigns();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createCampaign({ subject: "Draft", body: "d" });
			const scheduled = await controller.createCampaign({
				subject: "Scheduled",
				body: "s",
				scheduledAt: new Date("2026-06-01"),
			});
			expect(scheduled.status).toBe("scheduled");
			const drafts = await controller.listCampaigns({ status: "draft" });
			expect(drafts).toHaveLength(1);
			expect(drafts[0].subject).toBe("Draft");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createCampaign({
					subject: `C${i}`,
					body: `b${i}`,
				});
			}
			const page = await controller.listCampaigns({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no campaigns exist", async () => {
			const result = await controller.listCampaigns();
			expect(result).toEqual([]);
		});
	});

	// ── sendCampaign ────────────────────────────────────────────────────

	describe("sendCampaign", () => {
		it("sends a draft campaign to active subscribers", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });
			await controller.subscribe({ email: "c@test.com" });
			await controller.unsubscribe("c@test.com"); // not active

			const campaign = await controller.createCampaign({
				subject: "Send me",
				body: "Hello!",
			});
			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.status).toBe("sent");
			expect(sent?.recipientCount).toBe(2);
			// No email provider configured — delivery count is 0 (graceful degradation)
			expect(sent?.sentCount).toBe(0);
			expect(sent?.sentAt).toBeInstanceOf(Date);
		});

		it("sends a scheduled campaign", async () => {
			await controller.subscribe({ email: "a@test.com" });

			const campaign = await controller.createCampaign({
				subject: "Scheduled",
				body: "Content",
				scheduledAt: new Date("2026-04-01"),
			});
			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.status).toBe("sent");
		});

		it("returns null for already-sent campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Already sent",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);
			const result = await controller.sendCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent campaign", async () => {
			const result = await controller.sendCampaign("missing");
			expect(result).toBeNull();
		});

		it("sets recipientCount to 0 when no active subscribers", async () => {
			const campaign = await controller.createCampaign({
				subject: "No one",
				body: "Content",
			});
			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.recipientCount).toBe(0);
			expect(sent?.sentCount).toBe(0);
		});
	});

	// ── getCampaignStats ────────────────────────────────────────────────

	describe("getCampaignStats", () => {
		it("returns zeroes when no campaigns exist", async () => {
			const stats = await controller.getCampaignStats();
			expect(stats.total).toBe(0);
			expect(stats.draft).toBe(0);
			expect(stats.scheduled).toBe(0);
			expect(stats.sending).toBe(0);
			expect(stats.sent).toBe(0);
			expect(stats.totalRecipients).toBe(0);
			expect(stats.totalSent).toBe(0);
			expect(stats.totalFailed).toBe(0);
		});

		it("counts campaigns by status", async () => {
			await controller.createCampaign({ subject: "D1", body: "d" });
			await controller.createCampaign({ subject: "D2", body: "d" });
			await controller.createCampaign({
				subject: "S1",
				body: "s",
				scheduledAt: new Date("2026-06-01"),
			});

			const stats = await controller.getCampaignStats();
			expect(stats.total).toBe(3);
			expect(stats.draft).toBe(2);
			expect(stats.scheduled).toBe(1);
			expect(stats.sent).toBe(0);
		});

		it("aggregates sent and recipient counts", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });

			const c1 = await controller.createCampaign({
				subject: "C1",
				body: "b",
			});
			await controller.sendCampaign(c1.id);

			const c2 = await controller.createCampaign({
				subject: "C2",
				body: "b",
			});
			await controller.sendCampaign(c2.id);

			const stats = await controller.getCampaignStats();
			expect(stats.sent).toBe(2);
			expect(stats.totalRecipients).toBe(4);
			// No email provider — sentCount is 0 per campaign
			expect(stats.totalSent).toBe(0);
		});
	});
});

// ── sendCampaign with email provider ────────────────────────────────────────

describe("createNewsletterController with email provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockProvider: NewsletterEmailProvider;
	let controller: ReturnType<typeof createNewsletterController>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockProvider = {
			sendBatch: vi.fn(),
		};
		controller = createNewsletterController(mockData, undefined, mockProvider);
	});

	it("calls sendBatch with all active subscribers", async () => {
		vi.mocked(mockProvider.sendBatch).mockResolvedValue({ sent: 2, failed: 0 });
		await controller.subscribe({ email: "a@test.com" });
		await controller.subscribe({ email: "b@test.com" });
		const campaign = await controller.createCampaign({
			subject: "Hello",
			body: "<p>World</p>",
		});

		await controller.sendCampaign(campaign.id);

		expect(mockProvider.sendBatch).toHaveBeenCalledOnce();
		const [emails, campaignId] = vi.mocked(mockProvider.sendBatch).mock
			.calls[0];
		expect(emails).toHaveLength(2);
		expect(emails[0].subject).toBe("Hello");
		expect(campaignId).toBe(campaign.id);
	});

	it("records sent and failed counts from provider response", async () => {
		vi.mocked(mockProvider.sendBatch).mockResolvedValue({ sent: 1, failed: 1 });
		await controller.subscribe({ email: "good@test.com" });
		await controller.subscribe({ email: "bad@test.com" });
		const campaign = await controller.createCampaign({
			subject: "Test",
			body: "Body",
		});

		const result = await controller.sendCampaign(campaign.id);

		expect(result?.sentCount).toBe(1);
		expect(result?.failedCount).toBe(1);
		expect(result?.recipientCount).toBe(2);
	});

	it("does not call sendBatch when no active subscribers", async () => {
		const campaign = await controller.createCampaign({
			subject: "Empty list",
			body: "Content",
		});

		const result = await controller.sendCampaign(campaign.id);

		expect(mockProvider.sendBatch).not.toHaveBeenCalled();
		expect(result?.sentCount).toBe(0);
		expect(result?.recipientCount).toBe(0);
	});

	it("marks campaign as sent even if provider returns all failed", async () => {
		vi.mocked(mockProvider.sendBatch).mockResolvedValue({ sent: 0, failed: 2 });
		await controller.subscribe({ email: "x@test.com" });
		await controller.subscribe({ email: "y@test.com" });
		const campaign = await controller.createCampaign({
			subject: "Bad batch",
			body: "Content",
		});

		const result = await controller.sendCampaign(campaign.id);

		expect(result?.status).toBe("sent");
		expect(result?.sentCount).toBe(0);
		expect(result?.failedCount).toBe(2);
	});

	it("reflects totalSent from provider in stats", async () => {
		vi.mocked(mockProvider.sendBatch).mockResolvedValue({ sent: 3, failed: 0 });
		await controller.subscribe({ email: "a@test.com" });
		await controller.subscribe({ email: "b@test.com" });
		await controller.subscribe({ email: "c@test.com" });
		const campaign = await controller.createCampaign({
			subject: "Stats test",
			body: "Content",
		});
		await controller.sendCampaign(campaign.id);

		const stats = await controller.getCampaignStats();
		expect(stats.totalSent).toBe(3);
		expect(stats.totalFailed).toBe(0);
	});
});
