import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNewsletterController } from "../service-impl";

describe("newsletter controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNewsletterController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNewsletterController(mockData);
	});

	// ── subscribe idempotency and reactivation ────────────────────────

	describe("subscribe idempotency and reactivation", () => {
		it("idempotent subscribe does not overwrite firstName or tags", async () => {
			const first = await controller.subscribe({
				email: "alice@test.com",
				firstName: "Alice",
				tags: ["vip"],
			});
			const second = await controller.subscribe({
				email: "alice@test.com",
				firstName: "Bob",
				tags: ["regular"],
			});
			// Idempotent — returns the original record unchanged
			expect(second.id).toBe(first.id);
			expect(second.firstName).toBe("Alice");
			expect(second.tags).toEqual(["vip"]);
		});

		it("reactivating an unsubscribed email via subscribe clears unsubscribedAt", async () => {
			await controller.subscribe({ email: "bounce@test.com" });
			const unsub = await controller.unsubscribe("bounce@test.com");
			expect(unsub?.unsubscribedAt).toBeInstanceOf(Date);

			const reactivated = await controller.subscribe({
				email: "bounce@test.com",
			});
			expect(reactivated.status).toBe("active");
			expect(reactivated.unsubscribedAt).toBeUndefined();
		});

		it("reactivating a bounced subscriber via subscribe preserves original metadata", async () => {
			const sub = await controller.subscribe({
				email: "bounced@test.com",
				metadata: { source: "landing-page" },
				tags: ["early-adopter"],
			});
			await controller.updateSubscriber(sub.id, { status: "bounced" });

			const reactivated = await controller.subscribe({
				email: "bounced@test.com",
			});
			expect(reactivated.status).toBe("active");
			expect(reactivated.metadata).toEqual({ source: "landing-page" });
			expect(reactivated.tags).toEqual(["early-adopter"]);
		});
	});

	// ── subscribe -> unsubscribe -> resubscribe cycle ─────────────────

	describe("full subscribe -> unsubscribe -> resubscribe cycle", () => {
		it("completes a full cycle and preserves subscriber identity", async () => {
			const original = await controller.subscribe({
				email: "cycle@test.com",
				firstName: "Cycle",
			});
			expect(original.status).toBe("active");

			const unsub = await controller.unsubscribe("cycle@test.com");
			expect(unsub?.status).toBe("unsubscribed");
			expect(unsub?.unsubscribedAt).toBeInstanceOf(Date);
			expect(unsub?.id).toBe(original.id);

			const resub = await controller.resubscribe("cycle@test.com");
			expect(resub?.status).toBe("active");
			expect(resub?.unsubscribedAt).toBeUndefined();
			expect(resub?.id).toBe(original.id);
			expect(resub?.firstName).toBe("Cycle");
		});

		it("subscribe after unsubscribe reactivates via subscribe path", async () => {
			await controller.subscribe({ email: "path@test.com" });
			await controller.unsubscribe("path@test.com");

			// Use subscribe() instead of resubscribe() — both should reactivate
			const reactivated = await controller.subscribe({
				email: "path@test.com",
			});
			expect(reactivated.status).toBe("active");
		});
	});

	// ── unsubscribe sets timestamp ────────────────────────────────────

	describe("unsubscribe timestamp behavior", () => {
		it("sets unsubscribedAt to approximately current time", async () => {
			await controller.subscribe({ email: "ts@test.com" });
			const before = new Date();
			const unsub = await controller.unsubscribe("ts@test.com");
			const after = new Date();

			const unsubTime = unsub?.unsubscribedAt?.getTime() ?? 0;
			expect(unsubTime).toBeGreaterThanOrEqual(before.getTime());
			expect(unsubTime).toBeLessThanOrEqual(after.getTime());
		});

		it("updates updatedAt when unsubscribing", async () => {
			const sub = await controller.subscribe({ email: "upd@test.com" });
			const unsub = await controller.unsubscribe("upd@test.com");

			expect(unsub?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				sub.updatedAt.getTime(),
			);
		});
	});

	// ── updateSubscriber partial updates ──────────────────────────────

	describe("updateSubscriber partial updates", () => {
		it("updating only firstName preserves email, tags, metadata, and status", async () => {
			const sub = await controller.subscribe({
				email: "partial@test.com",
				firstName: "Original",
				lastName: "Name",
				tags: ["vip"],
				metadata: { key: "value" },
			});

			const updated = await controller.updateSubscriber(sub.id, {
				firstName: "Changed",
			});

			expect(updated?.firstName).toBe("Changed");
			expect(updated?.lastName).toBe("Name");
			expect(updated?.email).toBe("partial@test.com");
			expect(updated?.tags).toEqual(["vip"]);
			expect(updated?.metadata).toEqual({ key: "value" });
			expect(updated?.status).toBe("active");
		});

		it("updating only status does not change other fields", async () => {
			const sub = await controller.subscribe({
				email: "status@test.com",
				firstName: "Keep",
				tags: ["keep-tag"],
			});

			const updated = await controller.updateSubscriber(sub.id, {
				status: "bounced",
			});

			expect(updated?.status).toBe("bounced");
			expect(updated?.firstName).toBe("Keep");
			expect(updated?.tags).toEqual(["keep-tag"]);
		});

		it("sequential partial updates accumulate correctly", async () => {
			const sub = await controller.subscribe({ email: "seq@test.com" });

			await controller.updateSubscriber(sub.id, { firstName: "First" });
			await controller.updateSubscriber(sub.id, { lastName: "Last" });
			await controller.updateSubscriber(sub.id, {
				tags: ["tag1", "tag2"],
			});

			const final = await controller.getSubscriber(sub.id);
			expect(final?.firstName).toBe("First");
			expect(final?.lastName).toBe("Last");
			expect(final?.tags).toEqual(["tag1", "tag2"]);
		});
	});

	// ── deleteSubscriber edge cases ───────────────────────────────────

	describe("deleteSubscriber edge cases", () => {
		it("returns false for non-existent subscriber", async () => {
			const result = await controller.deleteSubscriber("non-existent-id");
			expect(result).toBe(false);
		});

		it("double deletion returns false on second attempt", async () => {
			const sub = await controller.subscribe({ email: "double@test.com" });
			expect(await controller.deleteSubscriber(sub.id)).toBe(true);
			expect(await controller.deleteSubscriber(sub.id)).toBe(false);
		});

		it("deleting subscriber removes it from listSubscribers", async () => {
			const sub = await controller.subscribe({ email: "gone@test.com" });
			await controller.subscribe({ email: "stays@test.com" });

			await controller.deleteSubscriber(sub.id);

			const all = await controller.listSubscribers();
			expect(all).toHaveLength(1);
			expect(all[0].email).toBe("stays@test.com");
		});

		it("deleting subscriber makes getSubscriberByEmail return null", async () => {
			const sub = await controller.subscribe({
				email: "lookup@test.com",
			});
			await controller.deleteSubscriber(sub.id);

			const found = await controller.getSubscriberByEmail("lookup@test.com");
			expect(found).toBeNull();
		});
	});

	// ── tag filtering in listSubscribers ──────────────────────────────

	describe("tag filtering in listSubscribers", () => {
		it("filters subscribers with overlapping tags correctly", async () => {
			await controller.subscribe({
				email: "a@test.com",
				tags: ["vip", "newsletter"],
			});
			await controller.subscribe({
				email: "b@test.com",
				tags: ["newsletter", "promo"],
			});
			await controller.subscribe({
				email: "c@test.com",
				tags: ["promo"],
			});

			const newsletter = await controller.listSubscribers({
				tag: "newsletter",
			});
			expect(newsletter).toHaveLength(2);

			const promo = await controller.listSubscribers({ tag: "promo" });
			expect(promo).toHaveLength(2);

			const vip = await controller.listSubscribers({ tag: "vip" });
			expect(vip).toHaveLength(1);
			expect(vip[0].email).toBe("a@test.com");
		});

		it("tag filter with status filter narrows results correctly", async () => {
			await controller.subscribe({
				email: "active-vip@test.com",
				tags: ["vip"],
			});
			await controller.subscribe({
				email: "inactive-vip@test.com",
				tags: ["vip"],
			});
			await controller.unsubscribe("inactive-vip@test.com");

			const activeVips = await controller.listSubscribers({
				status: "active",
				tag: "vip",
			});
			expect(activeVips).toHaveLength(1);
			expect(activeVips[0].email).toBe("active-vip@test.com");
		});

		it("tag filter with pagination returns correct subset", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({
					email: `tagged${i}@test.com`,
					tags: ["common"],
				});
			}
			await controller.subscribe({
				email: "other@test.com",
				tags: ["different"],
			});

			const page = await controller.listSubscribers({
				tag: "common",
				take: 3,
			});
			expect(page).toHaveLength(3);
		});
	});

	// ── campaign lifecycle: draft -> scheduled -> sent ─────────────────

	describe("campaign lifecycle", () => {
		it("draft campaign transitions to sent via sendCampaign", async () => {
			await controller.subscribe({ email: "recipient@test.com" });

			const campaign = await controller.createCampaign({
				subject: "Draft to Sent",
				body: "Hello!",
			});
			expect(campaign.status).toBe("draft");

			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.status).toBe("sent");
			expect(sent?.sentAt).toBeInstanceOf(Date);
			expect(sent?.recipientCount).toBe(1);
		});

		it("scheduled campaign can be sent before schedule time", async () => {
			await controller.subscribe({ email: "r@test.com" });

			const campaign = await controller.createCampaign({
				subject: "Scheduled",
				body: "Content",
				scheduledAt: new Date("2099-12-31"),
			});
			expect(campaign.status).toBe("scheduled");

			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.status).toBe("sent");
		});

		it("draft can be updated to scheduled by setting scheduledAt", async () => {
			const campaign = await controller.createCampaign({
				subject: "Start Draft",
				body: "Content",
			});
			expect(campaign.status).toBe("draft");

			const updated = await controller.updateCampaign(campaign.id, {
				scheduledAt: new Date("2099-06-01"),
			});
			expect(updated?.status).toBe("scheduled");
		});
	});

	// ── cannot edit/send/delete campaigns in sending/sent state ───────

	describe("campaign state restrictions", () => {
		it("cannot update a sent campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Original",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);

			const result = await controller.updateCampaign(campaign.id, {
				subject: "Changed",
			});
			expect(result).toBeNull();
		});

		it("cannot send an already-sent campaign again", async () => {
			const campaign = await controller.createCampaign({
				subject: "Once",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);

			const result = await controller.sendCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot delete a sending campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Sending",
				body: "Content",
			});
			// Manually set status to "sending" via the data store
			const raw = await mockData.get("campaign", campaign.id);
			if (raw) {
				(raw as Record<string, unknown>).status = "sending";
				await mockData.upsert(
					"campaign",
					campaign.id,
					raw as Record<string, Record<string, unknown>>,
				);
			}

			const result = await controller.deleteCampaign(campaign.id);
			expect(result).toBe(false);
		});

		it("cannot update a sending campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Sending",
				body: "Content",
			});
			const raw = await mockData.get("campaign", campaign.id);
			if (raw) {
				(raw as Record<string, unknown>).status = "sending";
				await mockData.upsert(
					"campaign",
					campaign.id,
					raw as Record<string, Record<string, unknown>>,
				);
			}

			const result = await controller.updateCampaign(campaign.id, {
				subject: "Nope",
			});
			expect(result).toBeNull();
		});

		it("cannot send a sending campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Already Sending",
				body: "Content",
			});
			const raw = await mockData.get("campaign", campaign.id);
			if (raw) {
				(raw as Record<string, unknown>).status = "sending";
				await mockData.upsert(
					"campaign",
					campaign.id,
					raw as Record<string, Record<string, unknown>>,
				);
			}

			const result = await controller.sendCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("can delete a sent campaign", async () => {
			const campaign = await controller.createCampaign({
				subject: "Finished",
				body: "Content",
			});
			await controller.sendCampaign(campaign.id);

			const result = await controller.deleteCampaign(campaign.id);
			expect(result).toBe(true);
		});
	});

	// ── sendCampaign counts only active subscribers ───────────────────

	describe("sendCampaign active subscriber counting", () => {
		it("excludes unsubscribed and bounced subscribers from recipient count", async () => {
			await controller.subscribe({ email: "active1@test.com" });
			await controller.subscribe({ email: "active2@test.com" });
			await controller.subscribe({
				email: "unsub@test.com",
			});
			const sub4 = await controller.subscribe({
				email: "bounced@test.com",
			});
			await controller.unsubscribe("unsub@test.com");
			await controller.updateSubscriber(sub4.id, { status: "bounced" });

			const campaign = await controller.createCampaign({
				subject: "Targeted",
				body: "Content",
			});
			const sent = await controller.sendCampaign(campaign.id);

			expect(sent?.recipientCount).toBe(2);
			// No email provider configured — delivered 0 emails (graceful degradation)
			expect(sent?.sentCount).toBe(0);
		});

		it("reports zero recipients when all subscribers are inactive", async () => {
			await controller.subscribe({ email: "gone1@test.com" });
			await controller.subscribe({ email: "gone2@test.com" });
			await controller.unsubscribe("gone1@test.com");
			await controller.unsubscribe("gone2@test.com");

			const campaign = await controller.createCampaign({
				subject: "No Audience",
				body: "Content",
			});
			const sent = await controller.sendCampaign(campaign.id);

			expect(sent?.recipientCount).toBe(0);
			expect(sent?.sentCount).toBe(0);
		});

		it("reflects subscriber changes between campaign creation and send", async () => {
			await controller.subscribe({ email: "early@test.com" });

			const campaign = await controller.createCampaign({
				subject: "Delayed Send",
				body: "Content",
			});

			// Add more subscribers after campaign creation
			await controller.subscribe({ email: "late1@test.com" });
			await controller.subscribe({ email: "late2@test.com" });

			const sent = await controller.sendCampaign(campaign.id);
			expect(sent?.recipientCount).toBe(3);
		});
	});

	// ── campaign stats aggregation with mixed statuses ────────────────

	describe("campaign stats aggregation", () => {
		it("aggregates stats across draft, scheduled, and sent campaigns", async () => {
			await controller.subscribe({ email: "a@test.com" });
			await controller.subscribe({ email: "b@test.com" });

			// Create 2 drafts
			await controller.createCampaign({ subject: "D1", body: "d" });
			await controller.createCampaign({ subject: "D2", body: "d" });

			// Create 1 scheduled
			await controller.createCampaign({
				subject: "S1",
				body: "s",
				scheduledAt: new Date("2099-01-01"),
			});

			// Create and send 2 campaigns
			const c1 = await controller.createCampaign({
				subject: "Sent1",
				body: "s",
			});
			await controller.sendCampaign(c1.id);
			const c2 = await controller.createCampaign({
				subject: "Sent2",
				body: "s",
			});
			await controller.sendCampaign(c2.id);

			const stats = await controller.getCampaignStats();
			expect(stats.total).toBe(5);
			expect(stats.draft).toBe(2);
			expect(stats.scheduled).toBe(1);
			expect(stats.sent).toBe(2);
			expect(stats.sending).toBe(0);
			expect(stats.totalRecipients).toBe(4);
			// No email provider — sentCount is 0 per campaign
			expect(stats.totalSent).toBe(0);
			expect(stats.totalFailed).toBe(0);
		});

		it("deleting a campaign removes it from stats", async () => {
			await controller.subscribe({ email: "user@test.com" });

			const c1 = await controller.createCampaign({
				subject: "Keep",
				body: "k",
			});
			await controller.sendCampaign(c1.id);

			const c2 = await controller.createCampaign({
				subject: "Delete",
				body: "d",
			});
			await controller.sendCampaign(c2.id);

			await controller.deleteCampaign(c2.id);

			const stats = await controller.getCampaignStats();
			expect(stats.total).toBe(1);
			expect(stats.sent).toBe(1);
			expect(stats.totalRecipients).toBe(1);
			// No email provider — sentCount is 0
			expect(stats.totalSent).toBe(0);
		});

		it("returns all zeroes when no campaigns exist", async () => {
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
	});

	// ── concurrent and boundary conditions ────────────────────────────

	describe("concurrent and boundary conditions", () => {
		it("concurrent subscribes with different emails produce distinct records", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.subscribe({ email: `concurrent${i}@test.com` }),
			);
			const subscribers = await Promise.all(promises);
			const ids = new Set(subscribers.map((s) => s.id));
			expect(ids.size).toBe(10);
		});

		it("listCampaigns with skip beyond total returns empty array", async () => {
			await controller.createCampaign({ subject: "Only", body: "one" });
			const result = await controller.listCampaigns({ skip: 100 });
			expect(result).toEqual([]);
		});

		it("listSubscribers with skip beyond total returns empty array", async () => {
			await controller.subscribe({ email: "only@test.com" });
			const result = await controller.listSubscribers({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── data store consistency ─────────────────────────────────────────

	describe("data store consistency", () => {
		it("subscriber count in store matches listSubscribers length", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({ email: `s${i}@test.com` });
			}
			await controller.unsubscribe("s0@test.com");
			await controller.deleteSubscriber(
				(await controller.getSubscriberByEmail("s1@test.com"))?.id ?? "",
			);

			expect(mockData.size("subscriber")).toBe(4);
			const all = await controller.listSubscribers();
			expect(all).toHaveLength(4);
		});

		it("campaign count in store matches listCampaigns length", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.createCampaign({
					subject: `C${i}`,
					body: `b${i}`,
				});
			}
			const campaigns = await controller.listCampaigns();
			expect(campaigns).toHaveLength(4);
			expect(mockData.size("campaign")).toBe(4);
		});
	});
});
