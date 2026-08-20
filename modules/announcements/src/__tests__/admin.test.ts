import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementsControllers } from "../service-impl";

describe("announcements admin workflows", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	function makeParams(overrides: Record<string, unknown> = {}) {
		return {
			title: "Test Announcement",
			content: "Test content",
			...overrides,
		};
	}

	// ─── 1. Full announcement lifecycle ─────────────────────────────────

	describe("full announcement lifecycle", () => {
		it("creates an announcement with required fields only", async () => {
			const a = await controller.createAnnouncement(
				makeParams({ title: "Sale!", content: "Everything 50% off" }),
			);

			expect(a.id).toBeDefined();
			expect(a.title).toBe("Sale!");
			expect(a.content).toBe("Everything 50% off");
		});

		it("assigns correct defaults on creation", async () => {
			const a = await controller.createAnnouncement(makeParams());

			expect(a.type).toBe("bar");
			expect(a.position).toBe("top");
			expect(a.priority).toBe(0);
			expect(a.isActive).toBe(true);
			expect(a.isDismissible).toBe(true);
			expect(a.targetAudience).toBe("all");
			expect(a.impressions).toBe(0);
			expect(a.clicks).toBe(0);
			expect(a.dismissals).toBe(0);
			expect(a.startsAt).toBeUndefined();
			expect(a.endsAt).toBeUndefined();
		});

		it("generates unique IDs for each announcement", async () => {
			const a1 = await controller.createAnnouncement(makeParams());
			const a2 = await controller.createAnnouncement(makeParams());

			expect(a1.id).not.toBe(a2.id);
		});

		it("reads back a created announcement by ID", async () => {
			const created = await controller.createAnnouncement(
				makeParams({ title: "Readable" }),
			);
			const fetched = await controller.getAnnouncement(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.title).toBe("Readable");
		});

		it("updates an existing announcement", async () => {
			const created = await controller.createAnnouncement(
				makeParams({ title: "Original" }),
			);
			const updated = await controller.updateAnnouncement(created.id, {
				title: "Updated",
			});

			expect(updated.title).toBe("Updated");
			expect(updated.content).toBe("Test content");
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("deletes an announcement so it is no longer retrievable", async () => {
			const created = await controller.createAnnouncement(makeParams());
			await controller.deleteAnnouncement(created.id);

			const fetched = await controller.getAnnouncement(created.id);
			expect(fetched).toBeNull();
		});
	});

	// ─── 2. Scheduling workflows ────────────────────────────────────────

	describe("scheduling workflows", () => {
		it("excludes future-scheduled announcements from active list", async () => {
			const future = new Date(Date.now() + 86_400_000);
			await controller.createAnnouncement(
				makeParams({ startsAt: future, title: "Future" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.every((a) => a.title !== "Future")).toBe(true);
		});

		it("excludes expired announcements from active list", async () => {
			const past = new Date(Date.now() - 86_400_000);
			await controller.createAnnouncement(
				makeParams({ endsAt: past, title: "Expired" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.every((a) => a.title !== "Expired")).toBe(true);
		});

		it("includes announcement with no startsAt (immediately visible)", async () => {
			const farFuture = new Date(Date.now() + 86_400_000 * 365);
			await controller.createAnnouncement(
				makeParams({ endsAt: farFuture, title: "No Start" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.some((a) => a.title === "No Start")).toBe(true);
		});

		it("includes announcement with no endsAt (never expires)", async () => {
			const past = new Date(Date.now() - 86_400_000);
			await controller.createAnnouncement(
				makeParams({ startsAt: past, title: "No End" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.some((a) => a.title === "No End")).toBe(true);
		});

		it("includes announcement with neither startsAt nor endsAt", async () => {
			await controller.createAnnouncement(
				makeParams({ title: "Always Active" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.some((a) => a.title === "Always Active")).toBe(true);
		});

		it("includes announcement exactly at startsAt boundary", async () => {
			const now = new Date();
			await controller.createAnnouncement(
				makeParams({
					startsAt: new Date(now.getTime() - 1),
					title: "Boundary Start",
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active.some((a) => a.title === "Boundary Start")).toBe(true);
		});
	});

	// ─── 3. Audience targeting workflows ────────────────────────────────

	describe("audience targeting workflows", () => {
		beforeEach(async () => {
			await controller.createAnnouncement(
				makeParams({
					title: "For Everyone",
					targetAudience: "all",
					priority: 0,
				}),
			);
			await controller.createAnnouncement(
				makeParams({
					title: "Members Only",
					targetAudience: "authenticated",
					priority: 1,
				}),
			);
			await controller.createAnnouncement(
				makeParams({
					title: "Guests Only",
					targetAudience: "guest",
					priority: 2,
				}),
			);
		});

		it("returns all-audience announcements for authenticated users", async () => {
			const active = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			const titles = active.map((a) => a.title);

			expect(titles).toContain("For Everyone");
			expect(titles).toContain("Members Only");
			expect(titles).not.toContain("Guests Only");
		});

		it("returns all-audience announcements for guest users", async () => {
			const active = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			const titles = active.map((a) => a.title);

			expect(titles).toContain("For Everyone");
			expect(titles).toContain("Guests Only");
			expect(titles).not.toContain("Members Only");
		});

		it("returns only all-audience when filtering for 'all'", async () => {
			const active = await controller.getActiveAnnouncements({
				audience: "all",
			});
			// audience="all" filter: targetAudience must be "all" OR targetAudience matches
			// Since "all" !== "authenticated" and "all" !== "guest", only "all" matches
			const titles = active.map((a) => a.title);
			expect(titles).toContain("For Everyone");
		});

		it("returns all active announcements when no audience filter", async () => {
			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(3);
		});

		it("filters audience correctly with schedule windows", async () => {
			const past = new Date(Date.now() - 86_400_000);
			await controller.createAnnouncement(
				makeParams({
					title: "Expired Auth",
					targetAudience: "authenticated",
					endsAt: past,
				}),
			);

			const active = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			expect(active.every((a) => a.title !== "Expired Auth")).toBe(true);
		});
	});

	// ─── 4. Priority and ordering ───────────────────────────────────────

	describe("priority and ordering", () => {
		it("sorts announcements by priority ascending", async () => {
			await controller.createAnnouncement(makeParams({ priority: 3 }));
			await controller.createAnnouncement(makeParams({ priority: 1 }));
			await controller.createAnnouncement(makeParams({ priority: 2 }));

			const list = await controller.listAnnouncements();
			expect(list[0]?.priority).toBe(1);
			expect(list[1]?.priority).toBe(2);
			expect(list[2]?.priority).toBe(3);
		});

		it("sorts same-priority announcements newest first", async () => {
			const a1 = await controller.createAnnouncement(
				makeParams({ title: "First", priority: 0 }),
			);

			// Manually backdate a1 so a2 is definitively newer
			const older = new Date(Date.now() - 10_000);
			const a1Record = await controller.getAnnouncement(a1.id);
			if (a1Record) {
				a1Record.createdAt = older;
				await data.upsert(
					"announcement",
					a1.id,
					a1Record as Record<string, unknown>,
				);
			}

			const a2 = await controller.createAnnouncement(
				makeParams({ title: "Second", priority: 0 }),
			);

			const list = await controller.listAnnouncements();
			// Second was created later so should appear first among same priority
			const idx1 = list.findIndex((a) => a.id === a1.id);
			const idx2 = list.findIndex((a) => a.id === a2.id);
			expect(idx2).toBeLessThan(idx1);
		});

		it("reorders announcements by setting priority to array index", async () => {
			const a1 = await controller.createAnnouncement(
				makeParams({ title: "A", priority: 10 }),
			);
			const a2 = await controller.createAnnouncement(
				makeParams({ title: "B", priority: 20 }),
			);
			const a3 = await controller.createAnnouncement(
				makeParams({ title: "C", priority: 30 }),
			);

			// Reverse order: C=0, B=1, A=2
			await controller.reorderAnnouncements([a3.id, a2.id, a1.id]);

			const fetched1 = await controller.getAnnouncement(a1.id);
			const fetched2 = await controller.getAnnouncement(a2.id);
			const fetched3 = await controller.getAnnouncement(a3.id);

			expect(fetched3?.priority).toBe(0);
			expect(fetched2?.priority).toBe(1);
			expect(fetched1?.priority).toBe(2);
		});

		it("reorders a subset of announcements without affecting others", async () => {
			const a1 = await controller.createAnnouncement(
				makeParams({ title: "A", priority: 5 }),
			);
			const a2 = await controller.createAnnouncement(
				makeParams({ title: "B", priority: 10 }),
			);
			const a3 = await controller.createAnnouncement(
				makeParams({ title: "C", priority: 15 }),
			);

			// Only reorder a2 and a3
			await controller.reorderAnnouncements([a3.id, a2.id]);

			const fetchedA1 = await controller.getAnnouncement(a1.id);
			expect(fetchedA1?.priority).toBe(5); // unchanged
		});

		it("handles duplicate IDs in reorder (last index wins)", async () => {
			const a1 = await controller.createAnnouncement(
				makeParams({ title: "Dup", priority: 99 }),
			);

			await controller.reorderAnnouncements([a1.id, a1.id, a1.id]);

			const fetched = await controller.getAnnouncement(a1.id);
			expect(fetched?.priority).toBe(2); // last index = 2
		});
	});

	// ─── 5. Analytics tracking workflows ────────────────────────────────

	describe("analytics tracking workflows", () => {
		it("increments impression counter", async () => {
			const a = await controller.createAnnouncement(makeParams());
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);

			const fetched = await controller.getAnnouncement(a.id);
			expect(fetched?.impressions).toBe(3);
		});

		it("increments click counter", async () => {
			const a = await controller.createAnnouncement(makeParams());
			await controller.recordClick(a.id);
			await controller.recordClick(a.id);

			const fetched = await controller.getAnnouncement(a.id);
			expect(fetched?.clicks).toBe(2);
		});

		it("increments dismissal counter", async () => {
			const a = await controller.createAnnouncement(makeParams());
			await controller.recordDismissal(a.id);

			const fetched = await controller.getAnnouncement(a.id);
			expect(fetched?.dismissals).toBe(1);
		});

		it("aggregates stats across multiple announcements", async () => {
			const a1 = await controller.createAnnouncement(makeParams());
			const a2 = await controller.createAnnouncement(makeParams());

			await controller.recordImpression(a1.id);
			await controller.recordImpression(a1.id);
			await controller.recordImpression(a2.id);
			await controller.recordClick(a1.id);
			await controller.recordDismissal(a2.id);

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(3);
			expect(stats.totalClicks).toBe(1);
			expect(stats.totalDismissals).toBe(1);
		});

		it("calculates clickRate and dismissRate with proper rounding", async () => {
			const a = await controller.createAnnouncement(makeParams());

			// 3 impressions, 1 click, 1 dismissal
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordClick(a.id);
			await controller.recordDismissal(a.id);

			const stats = await controller.getStats();
			// clickRate = 1/3 = 0.3333
			expect(stats.clickRate).toBe(Math.round((1 / 3) * 10000) / 10000);
			// dismissRate = 1/3 = 0.3333
			expect(stats.dismissRate).toBe(Math.round((1 / 3) * 10000) / 10000);
		});

		it("preserves analytics counters on update", async () => {
			const a = await controller.createAnnouncement(makeParams());
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordClick(a.id);
			await controller.recordDismissal(a.id);

			const updated = await controller.updateAnnouncement(a.id, {
				title: "Updated Title",
			});

			expect(updated.impressions).toBe(2);
			expect(updated.clicks).toBe(1);
			expect(updated.dismissals).toBe(1);
			expect(updated.title).toBe("Updated Title");
		});
	});

	// ─── 6. Bulk management ─────────────────────────────────────────────

	describe("bulk management", () => {
		it("lists announcements filtered by activeOnly", async () => {
			await controller.createAnnouncement(makeParams({ title: "Active" }));
			const inactive = await controller.createAnnouncement(
				makeParams({ title: "Inactive" }),
			);
			await controller.updateAnnouncement(inactive.id, { isActive: false });

			const list = await controller.listAnnouncements({ activeOnly: true });
			expect(list).toHaveLength(1);
			expect(list[0]?.title).toBe("Active");
		});

		it("lists announcements filtered by type", async () => {
			await controller.createAnnouncement(
				makeParams({ title: "Bar", type: "bar" }),
			);
			await controller.createAnnouncement(
				makeParams({ title: "Banner", type: "banner" }),
			);
			await controller.createAnnouncement(
				makeParams({ title: "Popup", type: "popup" }),
			);

			const banners = await controller.listAnnouncements({ type: "banner" });
			expect(banners).toHaveLength(1);
			expect(banners[0]?.title).toBe("Banner");
		});

		it("paginates listing with limit and offset", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createAnnouncement(
					makeParams({ title: `Item ${i}`, priority: i }),
				);
			}

			const page1 = await controller.listAnnouncements({
				limit: 2,
				offset: 0,
			});
			const page2 = await controller.listAnnouncements({
				limit: 2,
				offset: 2,
			});
			const page3 = await controller.listAnnouncements({
				limit: 2,
				offset: 4,
			});

			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			expect(page3).toHaveLength(1);
		});

		it("combines multiple filters", async () => {
			await controller.createAnnouncement(
				makeParams({ title: "A", type: "bar", position: "top" }),
			);
			await controller.createAnnouncement(
				makeParams({ title: "B", type: "banner", position: "top" }),
			);
			await controller.createAnnouncement(
				makeParams({ title: "C", type: "bar", position: "bottom" }),
			);
			const inactive = await controller.createAnnouncement(
				makeParams({ title: "D", type: "bar", position: "top" }),
			);
			await controller.updateAnnouncement(inactive.id, { isActive: false });

			const result = await controller.listAnnouncements({
				activeOnly: true,
				type: "bar",
				position: "top",
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.title).toBe("A");
		});
	});

	// ─── 7. Stats dashboard ─────────────────────────────────────────────

	describe("stats dashboard", () => {
		it("reports correct mix of active, scheduled, and expired", async () => {
			const past = new Date(Date.now() - 86_400_000);
			const future = new Date(Date.now() + 86_400_000);

			// Active (no schedule constraints)
			await controller.createAnnouncement(makeParams({ title: "Active" }));

			// Scheduled (active but starts in the future)
			await controller.createAnnouncement(
				makeParams({ title: "Scheduled", startsAt: future }),
			);

			// Expired (endsAt in the past)
			await controller.createAnnouncement(
				makeParams({ title: "Expired", endsAt: past }),
			);

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(3);
			expect(stats.activeAnnouncements).toBe(1);
			expect(stats.scheduledAnnouncements).toBe(1);
			expect(stats.expiredAnnouncements).toBe(1);
		});

		it("updates stats after deletions", async () => {
			const a1 = await controller.createAnnouncement(
				makeParams({ title: "To Delete" }),
			);
			await controller.createAnnouncement(makeParams({ title: "Keep" }));

			await controller.deleteAnnouncement(a1.id);

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(1);
			expect(stats.activeAnnouncements).toBe(1);
		});

		it("returns zero rates when no impressions exist", async () => {
			await controller.createAnnouncement(makeParams());

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(0);
			expect(stats.clickRate).toBe(0);
			expect(stats.dismissRate).toBe(0);
		});

		it("handles large analytics numbers correctly", async () => {
			const a = await controller.createAnnouncement(makeParams());

			// Simulate large counts by recording many times
			for (let i = 0; i < 100; i++) {
				await controller.recordImpression(a.id);
			}
			for (let i = 0; i < 37; i++) {
				await controller.recordClick(a.id);
			}
			for (let i = 0; i < 12; i++) {
				await controller.recordDismissal(a.id);
			}

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(100);
			expect(stats.totalClicks).toBe(37);
			expect(stats.totalDismissals).toBe(12);
			expect(stats.clickRate).toBe(0.37);
			expect(stats.dismissRate).toBe(0.12);
		});

		it("returns empty stats with no announcements", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(0);
			expect(stats.activeAnnouncements).toBe(0);
			expect(stats.scheduledAnnouncements).toBe(0);
			expect(stats.expiredAnnouncements).toBe(0);
			expect(stats.totalImpressions).toBe(0);
			expect(stats.totalClicks).toBe(0);
			expect(stats.totalDismissals).toBe(0);
			expect(stats.clickRate).toBe(0);
			expect(stats.dismissRate).toBe(0);
		});
	});

	// ─── 8. Edge cases ──────────────────────────────────────────────────

	describe("edge cases", () => {
		it("throws when updating a non-existent announcement", async () => {
			await expect(
				controller.updateAnnouncement("non-existent-id", {
					title: "Nope",
				}),
			).rejects.toThrow("Announcement non-existent-id not found");
		});

		it("does not throw when deleting a non-existent announcement", async () => {
			await expect(
				controller.deleteAnnouncement("non-existent-id"),
			).resolves.toBeUndefined();
		});

		it("silently ignores recordImpression on non-existent ID", async () => {
			await expect(
				controller.recordImpression("ghost"),
			).resolves.toBeUndefined();
		});

		it("silently ignores recordClick on non-existent ID", async () => {
			await expect(controller.recordClick("ghost")).resolves.toBeUndefined();
		});

		it("silently ignores recordDismissal on non-existent ID", async () => {
			await expect(
				controller.recordDismissal("ghost"),
			).resolves.toBeUndefined();
		});

		it("handles reorder with an empty array", async () => {
			await controller.createAnnouncement(
				makeParams({ title: "Untouched", priority: 5 }),
			);

			await controller.reorderAnnouncements([]);

			const list = await controller.listAnnouncements();
			expect(list[0]?.priority).toBe(5);
		});

		it("handles reorder with all non-existent IDs", async () => {
			const a = await controller.createAnnouncement(
				makeParams({ priority: 7 }),
			);

			await controller.reorderAnnouncements(["fake-1", "fake-2", "fake-3"]);

			const fetched = await controller.getAnnouncement(a.id);
			expect(fetched?.priority).toBe(7); // unchanged
		});

		it("returns null for getAnnouncement with non-existent ID", async () => {
			const result = await controller.getAnnouncement("does-not-exist");
			expect(result).toBeNull();
		});
	});
});
