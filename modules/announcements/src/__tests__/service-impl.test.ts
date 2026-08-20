import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementsControllers } from "../service-impl";

describe("createAnnouncementsControllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnnouncementsControllers(mockData);
	});

	// --- Helper ---

	function createTestAnnouncement(overrides = {}) {
		return {
			title: "Free Shipping",
			content: "Free shipping on all orders over $50!",
			...overrides,
		};
	}

	// --- createAnnouncement ---

	describe("createAnnouncement", () => {
		it("creates an announcement with required fields", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());

			expect(a.title).toBe("Free Shipping");
			expect(a.content).toBe("Free shipping on all orders over $50!");
			expect(a.type).toBe("bar");
			expect(a.position).toBe("top");
			expect(a.isActive).toBe(true);
			expect(a.isDismissible).toBe(true);
			expect(a.targetAudience).toBe("all");
			expect(a.priority).toBe(0);
			expect(a.impressions).toBe(0);
			expect(a.clicks).toBe(0);
			expect(a.dismissals).toBe(0);
			expect(a.id).toBeTruthy();
			expect(a.createdAt).toBeInstanceOf(Date);
			expect(a.updatedAt).toBeInstanceOf(Date);
		});

		it("creates an announcement with optional fields", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					type: "banner",
					position: "bottom",
					linkUrl: "https://store.com/sale",
					linkText: "Shop Now",
					backgroundColor: "#ff0000",
					textColor: "#ffffff",
					iconName: "Tag",
					priority: 5,
					isDismissible: false,
					targetAudience: "authenticated",
					startsAt: new Date("2026-01-01"),
					endsAt: new Date("2026-12-31"),
				}),
			);

			expect(a.type).toBe("banner");
			expect(a.position).toBe("bottom");
			expect(a.linkUrl).toBe("https://store.com/sale");
			expect(a.linkText).toBe("Shop Now");
			expect(a.backgroundColor).toBe("#ff0000");
			expect(a.textColor).toBe("#ffffff");
			expect(a.iconName).toBe("Tag");
			expect(a.priority).toBe(5);
			expect(a.isDismissible).toBe(false);
			expect(a.targetAudience).toBe("authenticated");
			expect(a.startsAt).toEqual(new Date("2026-01-01"));
			expect(a.endsAt).toEqual(new Date("2026-12-31"));
		});

		it("assigns unique IDs", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B" }),
			);

			expect(a.id).not.toBe(b.id);
		});

		it("defaults metadata to empty object", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			expect(a.metadata).toEqual({});
		});

		it("defaults type to bar", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			expect(a.type).toBe("bar");
		});

		it("defaults position to top", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			expect(a.position).toBe("top");
		});

		it("creates popup type", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ type: "popup" }),
			);
			expect(a.type).toBe("popup");
		});

		it("creates guest-targeted announcement", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ targetAudience: "guest" }),
			);
			expect(a.targetAudience).toBe("guest");
		});
	});

	// --- getAnnouncement ---

	describe("getAnnouncement", () => {
		it("returns an announcement by ID", async () => {
			const created = await controller.createAnnouncement(
				createTestAnnouncement(),
			);
			const found = await controller.getAnnouncement(created.id);

			expect(found).not.toBeNull();
			expect(found?.title).toBe("Free Shipping");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getAnnouncement("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- listAnnouncements ---

	describe("listAnnouncements", () => {
		it("returns all announcements sorted by priority then createdAt", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Low Priority", priority: 10 }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "High Priority", priority: 1 }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Medium Priority", priority: 5 }),
			);

			const list = await controller.listAnnouncements();

			expect(list).toHaveLength(3);
			expect(list[0].title).toBe("High Priority");
			expect(list[1].title).toBe("Medium Priority");
			expect(list[2].title).toBe("Low Priority");
		});

		it("filters by activeOnly", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active" }),
			);
			const inactive = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Inactive" }),
			);
			await controller.updateAnnouncement(inactive.id, { isActive: false });

			const active = await controller.listAnnouncements({
				activeOnly: true,
			});
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("filters by type", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Bar", type: "bar" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Banner", type: "banner" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Popup", type: "popup" }),
			);

			const bars = await controller.listAnnouncements({ type: "bar" });
			expect(bars).toHaveLength(1);
			expect(bars[0].title).toBe("Bar");
		});

		it("filters by position", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Top", position: "top" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Bottom", position: "bottom" }),
			);

			const topOnly = await controller.listAnnouncements({
				position: "top",
			});
			expect(topOnly).toHaveLength(1);
			expect(topOnly[0].title).toBe("Top");
		});

		it("supports limit and offset", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createAnnouncement(
					createTestAnnouncement({ title: `Ann ${i}` }),
				);
			}

			const page = await controller.listAnnouncements({
				limit: 2,
				offset: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no announcements exist", async () => {
			const list = await controller.listAnnouncements();
			expect(list).toEqual([]);
		});

		it("combines multiple filters", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Match",
					type: "bar",
					position: "top",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "No Match Type",
					type: "banner",
					position: "top",
				}),
			);

			const results = await controller.listAnnouncements({
				type: "bar",
				position: "top",
			});
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Match");
		});
	});

	// --- getActiveAnnouncements ---

	describe("getActiveAnnouncements", () => {
		it("returns only active announcements", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active" }),
			);
			const inactive = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Inactive" }),
			);
			await controller.updateAnnouncement(inactive.id, { isActive: false });

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("excludes announcements not yet started", async () => {
			const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Future",
					startsAt: futureStart,
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Now" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Now");
		});

		it("excludes expired announcements", async () => {
			const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Expired",
					endsAt: pastEnd,
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Current" }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Current");
		});

		it("includes announcements within schedule window", async () => {
			const pastStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "In Window",
					startsAt: pastStart,
					endsAt: futureEnd,
				}),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("In Window");
		});

		it("filters by authenticated audience", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For All",
					targetAudience: "all",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For Auth",
					targetAudience: "authenticated",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For Guest",
					targetAudience: "guest",
				}),
			);

			const authAnnouncements = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			const titles = authAnnouncements.map((a) => a.title);
			expect(titles).toContain("For All");
			expect(titles).toContain("For Auth");
			expect(titles).not.toContain("For Guest");
		});

		it("filters by guest audience", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For All",
					targetAudience: "all",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For Guest",
					targetAudience: "guest",
				}),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "For Auth",
					targetAudience: "authenticated",
				}),
			);

			const guestAnnouncements = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			const titles = guestAnnouncements.map((a) => a.title);
			expect(titles).toContain("For All");
			expect(titles).toContain("For Guest");
			expect(titles).not.toContain("For Auth");
		});

		it("returns sorted by priority ascending", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Low", priority: 10 }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "High", priority: 1 }),
			);

			const active = await controller.getActiveAnnouncements();
			expect(active[0].title).toBe("High");
			expect(active[1].title).toBe("Low");
		});

		it("returns empty array when nothing is active", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			await controller.updateAnnouncement(a.id, { isActive: false });

			const active = await controller.getActiveAnnouncements();
			expect(active).toEqual([]);
		});
	});

	// --- updateAnnouncement ---

	describe("updateAnnouncement", () => {
		it("updates title", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				title: "New Title",
			});

			expect(updated.title).toBe("New Title");
			expect(updated.content).toBe("Free shipping on all orders over $50!");
		});

		it("updates content", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				content: "Updated content",
			});

			expect(updated.content).toBe("Updated content");
		});

		it("updates type and position", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				type: "popup",
				position: "bottom",
			});

			expect(updated.type).toBe("popup");
			expect(updated.position).toBe("bottom");
		});

		it("updates link fields", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				linkUrl: "https://store.com/deals",
				linkText: "View Deals",
			});

			expect(updated.linkUrl).toBe("https://store.com/deals");
			expect(updated.linkText).toBe("View Deals");
		});

		it("updates colors", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				backgroundColor: "#000000",
				textColor: "#ffffff",
			});

			expect(updated.backgroundColor).toBe("#000000");
			expect(updated.textColor).toBe("#ffffff");
		});

		it("updates scheduling", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const startsAt = new Date("2026-06-01");
			const endsAt = new Date("2026-06-30");

			const updated = await controller.updateAnnouncement(a.id, {
				startsAt,
				endsAt,
			});

			expect(updated.startsAt).toEqual(startsAt);
			expect(updated.endsAt).toEqual(endsAt);
		});

		it("updates active status", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				isActive: false,
			});

			expect(updated.isActive).toBe(false);
		});

		it("updates dismissible flag", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				isDismissible: false,
			});

			expect(updated.isDismissible).toBe(false);
		});

		it("updates target audience", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const updated = await controller.updateAnnouncement(a.id, {
				targetAudience: "guest",
			});

			expect(updated.targetAudience).toBe("guest");
		});

		it("updates the updatedAt timestamp", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			const originalUpdatedAt = a.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));
			const updated = await controller.updateAnnouncement(a.id, {
				title: "Updated",
			});

			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("preserves analytics counters on update", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());

			// Simulate some analytics
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordClick(a.id);

			const updated = await controller.updateAnnouncement(a.id, {
				title: "Updated",
			});

			expect(updated.impressions).toBe(2);
			expect(updated.clicks).toBe(1);
			expect(updated.dismissals).toBe(0);
		});

		it("throws for non-existent announcement", async () => {
			await expect(
				controller.updateAnnouncement("non-existent", { title: "X" }),
			).rejects.toThrow("Announcement non-existent not found");
		});

		it("preserves fields not included in update", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({
					linkUrl: "https://store.com",
					backgroundColor: "#ff0000",
				}),
			);

			const updated = await controller.updateAnnouncement(a.id, {
				title: "Updated Title",
			});

			expect(updated.linkUrl).toBe("https://store.com");
			expect(updated.backgroundColor).toBe("#ff0000");
			expect(updated.content).toBe("Free shipping on all orders over $50!");
		});
	});

	// --- deleteAnnouncement ---

	describe("deleteAnnouncement", () => {
		it("deletes an announcement", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());
			await controller.deleteAnnouncement(a.id);

			const found = await controller.getAnnouncement(a.id);
			expect(found).toBeNull();
		});

		it("does not affect other announcements", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B" }),
			);

			await controller.deleteAnnouncement(a.id);

			const found = await controller.getAnnouncement(b.id);
			expect(found).not.toBeNull();
			expect(found?.title).toBe("B");
		});
	});

	// --- reorderAnnouncements ---

	describe("reorderAnnouncements", () => {
		it("assigns priority based on array position", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A", priority: 5 }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B", priority: 10 }),
			);
			const c = await controller.createAnnouncement(
				createTestAnnouncement({ title: "C", priority: 1 }),
			);

			// Reorder: C first, then A, then B
			await controller.reorderAnnouncements([c.id, a.id, b.id]);

			const cUpdated = await controller.getAnnouncement(c.id);
			const aUpdated = await controller.getAnnouncement(a.id);
			const bUpdated = await controller.getAnnouncement(b.id);

			expect(cUpdated?.priority).toBe(0);
			expect(aUpdated?.priority).toBe(1);
			expect(bUpdated?.priority).toBe(2);
		});

		it("skips non-existent IDs gracefully", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);

			// Include a non-existent ID — should not throw
			await controller.reorderAnnouncements(["non-existent", a.id]);

			const aUpdated = await controller.getAnnouncement(a.id);
			expect(aUpdated?.priority).toBe(1);
		});

		it("updates order reflected in listAnnouncements", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "First" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Second" }),
			);

			await controller.reorderAnnouncements([b.id, a.id]);

			const list = await controller.listAnnouncements();
			expect(list[0].title).toBe("Second");
			expect(list[1].title).toBe("First");
		});
	});

	// --- recordImpression ---

	describe("recordImpression", () => {
		it("increments impression count", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());

			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);
			await controller.recordImpression(a.id);

			const updated = await controller.getAnnouncement(a.id);
			expect(updated?.impressions).toBe(3);
		});

		it("does nothing for non-existent ID", async () => {
			// Should not throw
			await controller.recordImpression("non-existent");
		});
	});

	// --- recordClick ---

	describe("recordClick", () => {
		it("increments click count", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());

			await controller.recordClick(a.id);
			await controller.recordClick(a.id);

			const updated = await controller.getAnnouncement(a.id);
			expect(updated?.clicks).toBe(2);
		});

		it("does nothing for non-existent ID", async () => {
			await controller.recordClick("non-existent");
		});
	});

	// --- recordDismissal ---

	describe("recordDismissal", () => {
		it("increments dismissal count", async () => {
			const a = await controller.createAnnouncement(createTestAnnouncement());

			await controller.recordDismissal(a.id);

			const updated = await controller.getAnnouncement(a.id);
			expect(updated?.dismissals).toBe(1);
		});

		it("does nothing for non-existent ID", async () => {
			await controller.recordDismissal("non-existent");
		});
	});

	// --- getStats ---

	describe("getStats", () => {
		it("returns zeroes when no announcements exist", async () => {
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

		it("counts active announcements correctly", async () => {
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active 1" }),
			);
			await controller.createAnnouncement(
				createTestAnnouncement({ title: "Active 2" }),
			);
			const inactive = await controller.createAnnouncement(
				createTestAnnouncement({ title: "Inactive" }),
			);
			await controller.updateAnnouncement(inactive.id, { isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalAnnouncements).toBe(3);
			expect(stats.activeAnnouncements).toBe(2);
		});

		it("counts scheduled announcements", async () => {
			const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Scheduled",
					startsAt: futureStart,
				}),
			);

			const stats = await controller.getStats();
			expect(stats.scheduledAnnouncements).toBe(1);
		});

		it("counts expired announcements", async () => {
			const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await controller.createAnnouncement(
				createTestAnnouncement({
					title: "Expired",
					endsAt: pastEnd,
				}),
			);

			const stats = await controller.getStats();
			expect(stats.expiredAnnouncements).toBe(1);
		});

		it("aggregates analytics correctly", async () => {
			const a = await controller.createAnnouncement(
				createTestAnnouncement({ title: "A" }),
			);
			const b = await controller.createAnnouncement(
				createTestAnnouncement({ title: "B" }),
			);

			// A: 10 impressions, 2 clicks, 1 dismissal
			for (let i = 0; i < 10; i++) {
				await controller.recordImpression(a.id);
			}
			await controller.recordClick(a.id);
			await controller.recordClick(a.id);
			await controller.recordDismissal(a.id);

			// B: 5 impressions, 1 click, 0 dismissals
			for (let i = 0; i < 5; i++) {
				await controller.recordImpression(b.id);
			}
			await controller.recordClick(b.id);

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(15);
			expect(stats.totalClicks).toBe(3);
			expect(stats.totalDismissals).toBe(1);
			expect(stats.clickRate).toBe(0.2); // 3/15
			expect(stats.dismissRate).toBeCloseTo(0.0667, 3); // 1/15
		});

		it("returns zero rates when no impressions", async () => {
			await controller.createAnnouncement(createTestAnnouncement());

			const stats = await controller.getStats();
			expect(stats.clickRate).toBe(0);
			expect(stats.dismissRate).toBe(0);
		});
	});
});
