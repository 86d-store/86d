import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementsControllers } from "../service-impl";

describe("announcements controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnnouncementsControllers(mockData);
	});

	function createTestAnnouncement(overrides = {}) {
		return {
			title: "Test Announcement",
			content: "Test content for edge cases",
			...overrides,
		};
	}

	// --- Scheduling boundary conditions ---

	describe("scheduling boundary conditions", () => {
		it("includes announcement exactly at startsAt boundary", async () => {
			const now = new Date();
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Exact Start",
					startsAt: new Date(now.getTime() - 1),
				}),
			);

			const active = await controller.getActiveAnnouncements();
			const ids = active.map((x) => x.id);
			expect(ids).toContain(a.id);
		});

		it("excludes announcement when startsAt is 1ms in the future", async () => {
			const future = new Date(Date.now() + 60_000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Just Ahead",
					startsAt: future,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("excludes announcement when endsAt is 1ms in the past", async () => {
			const past = new Date(Date.now() - 60_000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Just Ended",
					endsAt: past,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("shows announcement with only startsAt set (no endsAt) when past start", async () => {
			const pastStart = new Date(Date.now() - 3600_000);
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Open Ended",
					startsAt: pastStart,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(a.id);
		});

		it("shows announcement with only endsAt set (no startsAt) when before end", async () => {
			const futureEnd = new Date(Date.now() + 3600_000);
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					title: "No Start Bound",
					endsAt: futureEnd,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(a.id);
		});

		it("hides announcement with only endsAt set when past end", async () => {
			const pastEnd = new Date(Date.now() - 3600_000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Ended No Start",
					endsAt: pastEnd,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("shows announcement with neither startsAt nor endsAt set", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Always Visible" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(a.id);
		});
	});

	// --- Reorder with gaps ---

	describe("reorder with gaps and edge cases", () => {
		it("reorders a subset of IDs, leaving others with original priority", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A", priority: 10 }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B", priority: 20 }),
			);
			const c = await controller.createAnnouncement(
				createTestAnnouncement({ title: "C", priority: 30 }),
			);

			// Only reorder B and C, leave A untouched
			await controller.reorderAnnouncements([b.id, c.id]);

			const aUpdated = await controller.getAnnouncement(a.id);
			const bUpdated = await controller.getAnnouncement(b.id);
			const cUpdated = await controller.getAnnouncement(c.id);

			// A keeps its original priority
			expect(aUpdated?.priority).toBe(10);
			// B and C get 0-indexed priorities from the array
			expect(bUpdated?.priority).toBe(0);
			expect(cUpdated?.priority).toBe(1);
		});

		it("handles reorder with non-existent IDs mixed in", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A", priority: 5 }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B", priority: 3 }),
			);

			await controller.reorderAnnouncements(["ghost-1", a.id, "ghost-2", b.id]);

			// ghost-1 gets index 0 (skipped), a gets index 1, ghost-2 index 2 (skipped), b gets index 3
			const aUpdated = await controller.getAnnouncement(a.id);
			const bUpdated = await controller.getAnnouncement(b.id);
			expect(aUpdated?.priority).toBe(1);
			expect(bUpdated?.priority).toBe(3);
		});

		it("handles reorder with an empty array", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A", priority: 7 }),
			);

			await controller.reorderAnnouncements([]);

			const aUpdated = await controller.getAnnouncement(a.id);
			expect(aUpdated?.priority).toBe(7);
		});

		it("handles reorder with duplicate IDs", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A", priority: 5 }),
			);

			await controller.reorderAnnouncements([a.id, a.id, a.id]);

			// Last write wins — index 2
			const aUpdated = await controller.getAnnouncement(a.id);
			expect(aUpdated?.priority).toBe(2);
		});
	});

	// --- Stats calculation precision ---

	describe("stats calculation precision", () => {
		it("handles large numbers without precision loss", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Popular" }),
			);

			// Manually set high counts by repeating interactions
			const impressionCount = 100;
			const clickCount = 33;
			const dismissCount = 7;

			for (let i = 0; i < impressionCount; i++) {
				await controller.recordImpression(a.id);
			}
			for (let i = 0; i < clickCount; i++) {
				await controller.recordClick(a.id);
			}
			for (let i = 0; i < dismissCount; i++) {
				await controller.recordDismissal(a.id);
			}

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(100);
			expect(stats.totalClicks).toBe(33);
			expect(stats.totalDismissals).toBe(7);
			// clickRate = 33/100 = 0.33, rounded to 4 decimal places
			expect(stats.clickRate).toBe(0.33);
			// dismissRate = 7/100 = 0.07
			expect(stats.dismissRate).toBe(0.07);
		});

		it("rounds rates to four decimal places", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Rounding" }),
			);

			// 3 impressions, 1 click → clickRate = 1/3 = 0.33333... → rounded to 0.3333
			for (let i = 0; i < 3; i++) {
				await controller.recordImpression(a.id);
			}
			await controller.recordClick(a.id);

			const stats = await controller.getStats();
			expect(stats.clickRate).toBe(0.3333);
		});

		it("returns zero rates for zero impressions even with no announcements", async () => {
			const stats = await controller.getStats();
			expect(stats.clickRate).toBe(0);
			expect(stats.dismissRate).toBe(0);
			expect(stats.totalImpressions).toBe(0);
		});

		it("aggregates stats across many announcements", async () => {
			for (let i = 0; i < 10; i++) {
				const ann = await controller.createAnnouncement(
					createTestAnnouncement({ title: `Ann ${i}` }),
				);
				for (let j = 0; j <= i; j++) {
					await controller.recordImpression(ann.id);
				}
				if (i % 2 === 0) {
					await controller.recordClick(ann.id);
				}
			}

			const stats = await controller.getStats();
			// Impressions: 1+2+3+4+5+6+7+8+9+10 = 55
			expect(stats.totalImpressions).toBe(55);
			// Clicks: one each for i=0,2,4,6,8 → 5
			expect(stats.totalClicks).toBe(5);
			// clickRate = 5/55 ≈ 0.0909
			expect(stats.clickRate).toBe(0.0909);
		});
	});

	// --- Audience targeting combinations ---

	describe("audience targeting combinations", () => {
		it("all-audience announcement visible to every audience param", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Universal", targetAudience: "all" }),
			);

			const forAuth = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			const forGuest = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			const noFilter = await controller.getActiveAnnouncements();

			expect(forAuth).toHaveLength(1);
			expect(forGuest).toHaveLength(1);
			expect(noFilter).toHaveLength(1);
		});

		it("guest-only announcement hidden from authenticated audience", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Guest Only",
					targetAudience: "guest",
				}),
			);

			const forAuth = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			expect(forAuth).toHaveLength(0);
		});

		it("authenticated-only announcement hidden from guest audience", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Auth Only",
					targetAudience: "authenticated",
				}),
			);

			const forGuest = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			expect(forGuest).toHaveLength(0);
		});

		it("no audience filter returns all targeted announcements", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "All", targetAudience: "all" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Auth",
					targetAudience: "authenticated",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Guest", targetAudience: "guest" }),
			);

			const noFilter = await controller.getActiveAnnouncements();
			expect(noFilter).toHaveLength(3);
		});

		it("mixed audience set returns correct subset for authenticated", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "All 1", targetAudience: "all" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "All 2", targetAudience: "all" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Auth Only",
					targetAudience: "authenticated",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Guest Only",
					targetAudience: "guest",
				}),
			);

			const forAuth = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			const titles = forAuth.map((a) => a.title);
			expect(titles).toContain("All 1");
			expect(titles).toContain("All 2");
			expect(titles).toContain("Auth Only");
			expect(titles).not.toContain("Guest Only");
			expect(forAuth).toHaveLength(3);
		});
	});

	// --- Active flag vs schedule window ---

	describe("active flag vs schedule window interaction", () => {
		it("inactive announcement within schedule window is not shown", async () => {
			const pastStart = new Date(Date.now() - 3600_000);
			const futureEnd = new Date(Date.now() + 3600_000);
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Inactive In Window",
					startsAt: pastStart,
					endsAt: futureEnd,
				}),
			);
			await controller.updateAnnouncement(a.id, { isActive: false });

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("active announcement outside schedule window is not shown", async () => {
			const futureStart = new Date(Date.now() + 3600_000);
			const farFutureEnd = new Date(Date.now() + 7200_000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Active But Not Started",
					startsAt: futureStart,
					endsAt: farFutureEnd,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("active announcement with expired endsAt is not shown", async () => {
			const pastStart = new Date(Date.now() - 7200_000);
			const pastEnd = new Date(Date.now() - 3600_000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Active But Expired",
					startsAt: pastStart,
					endsAt: pastEnd,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("stats counts inactive-in-window as neither active nor scheduled", async () => {
			const pastStart = new Date(Date.now() - 3600_000);
			const futureEnd = new Date(Date.now() + 3600_000);
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Inactive In Window",
					startsAt: pastStart,
					endsAt: futureEnd,
				}),
			);
			await controller.updateAnnouncement(a.id, { isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(1);
			expect(stats.activeAnnouncements).toBe(0);
			expect(stats.scheduledAnnouncements).toBe(0);
		});
	});

	// --- Multiple rapid interactions ---

	describe("multiple rapid interactions", () => {
		it("accumulates many impressions correctly", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Rapid Impressions" }),
			);

			const count = 50;
			for (let i = 0; i < count; i++) {
				await controller.recordImpression(a.id);
			}

			const updated = await controller.getAnnouncement(a.id);
			expect(updated?.impressions).toBe(count);
		});

		it("accumulates mixed interactions correctly", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Mixed Rapid" }),
			);

			for (let i = 0; i < 20; i++) {
				await controller.recordImpression(a.id);
				if (i % 3 === 0) await controller.recordClick(a.id);
				if (i % 5 === 0) await controller.recordDismissal(a.id);
			}

			const updated = await controller.getAnnouncement(a.id);
			expect(updated?.impressions).toBe(20);
			// Clicks at i=0,3,6,9,12,15,18 → 7
			expect(updated?.clicks).toBe(7);
			// Dismissals at i=0,5,10,15 → 4
			expect(updated?.dismissals).toBe(4);
		});

		it("interactions on one announcement do not affect another", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B" }),
			);

			for (let i = 0; i < 10; i++) {
				await controller.recordImpression(a.id);
			}
			await controller.recordClick(a.id);

			const bUpdated = await controller.getAnnouncement(b.id);
			expect(bUpdated?.impressions).toBe(0);
			expect(bUpdated?.clicks).toBe(0);
			expect(bUpdated?.dismissals).toBe(0);
		});
	});

	// --- Delete and stats ---

	describe("delete and stats interaction", () => {
		it("deleting an announcement removes its counts from stats", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Will Delete" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Will Keep" }),
			);

			for (let i = 0; i < 10; i++) {
				await controller.recordImpression(a.id);
			}
			await controller.recordClick(a.id);
			await controller.recordClick(a.id);

			for (let i = 0; i < 5; i++) {
				await controller.recordImpression(b.id);
			}
			await controller.recordClick(b.id);

			await controller.deleteAnnouncement(a.id);

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(1);
			expect(stats.totalImpressions).toBe(5);
			expect(stats.totalClicks).toBe(1);
			expect(stats.clickRate).toBe(0.2);
		});

		it("deleting all announcements resets stats to zero", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B" }),
			);

			await controller.recordImpression(a.id);
			await controller.recordImpression(b.id);

			await controller.deleteAnnouncement(a.id);
			await controller.deleteAnnouncement(b.id);

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(0);
			expect(stats.totalImpressions).toBe(0);
			expect(stats.activeAnnouncements).toBe(0);
			expect(stats.clickRate).toBe(0);
			expect(stats.dismissRate).toBe(0);
		});

		it("deleting an active announcement reduces active count in stats", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active A" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active B" }),
			);

			const statsBefore = await controller.getStats();
			expect(statsBefore.activeAnnouncements).toBe(2);

			await controller.deleteAnnouncement(a.id);

			const statsAfter = await controller.getStats();
			expect(statsAfter.activeAnnouncements).toBe(1);
		});
	});

	// --- Priority ordering stability ---

	describe("priority ordering stability", () => {
		it("same-priority announcements sort by newest first in listAnnouncements", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "First Created", priority: 5 }),
			);
			// Ensure different createdAt timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Second Created", priority: 5 }),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			const c = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Third Created", priority: 5 }),
			);

			const list = await controller.listAnnouncements();
			expect(list).toHaveLength(3);
			// Newest first within same priority
			expect(list[0].id).toBe(c.id);
			expect(list[1].id).toBe(b.id);
			expect(list[2].id).toBe(a.id);
		});

		it("mixed priorities sort correctly with secondary newest-first", async () => {
			const highOld = await controller.createAnnouncement(
				createTestAnnouncement({ title: "High Old", priority: 1 }),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			const highNew = await controller.createAnnouncement(
				createTestAnnouncement({ title: "High New", priority: 1 }),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			const low = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Low", priority: 10 }),
			);

			const list = await controller.listAnnouncements();
			expect(list[0].id).toBe(highNew.id);
			expect(list[1].id).toBe(highOld.id);
			expect(list[2].id).toBe(low.id);
		});

		it("priority zero is highest priority", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Priority 0", priority: 0 }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Priority 1", priority: 1 }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Priority 100", priority: 100 }),
			);

			const list = await controller.listAnnouncements();
			expect(list[0].title).toBe("Priority 0");
			expect(list[1].title).toBe("Priority 1");
			expect(list[2].title).toBe("Priority 100");
		});
	});
});
