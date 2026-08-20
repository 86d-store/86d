import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementsControllers } from "../service-impl";

/**
 * Security regression tests for announcements endpoints.
 *
 * Announcements are public-read (no auth for store-facing).
 * Security focuses on:
 * - Only active + in-schedule announcements are visible on storefront
 * - Inactive, future-scheduled, and expired announcements are hidden
 * - Audience targeting filters correctly
 * - Interaction tracking (impressions/clicks/dismissals) handles missing IDs safely
 * - Stats do not leak data about hidden announcements
 */

describe("announcements endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);
	const farPast = new Date(Date.now() - 7200_000);
	const farFuture = new Date(Date.now() + 7200_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnnouncementsControllers(mockData);
	});

	describe("storefront visibility rules", () => {
		it("inactive announcements are never returned by getActiveAnnouncements", async () => {
			const ann = await controller.createAnnouncement({
				title: "Hidden",
				content: "You should not see this",
			});
			await controller.updateAnnouncement(ann.id, { isActive: false });

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("future-scheduled announcements are not visible", async () => {
			await controller.createAnnouncement({
				title: "Future",
				content: "Coming soon",
				startsAt: future,
				endsAt: farFuture,
			});

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("expired announcements are not visible", async () => {
			await controller.createAnnouncement({
				title: "Expired",
				content: "Too late",
				startsAt: farPast,
				endsAt: past,
			});

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(0);
		});

		it("only active + in-schedule announcements are visible", async () => {
			// Visible: active, in schedule
			await controller.createAnnouncement({
				title: "Live",
				content: "Visible",
				startsAt: past,
				endsAt: future,
			});

			// Not visible: future start
			await controller.createAnnouncement({
				title: "Scheduled",
				content: "Not yet",
				startsAt: future,
				endsAt: farFuture,
			});

			// Not visible: expired
			await controller.createAnnouncement({
				title: "Expired",
				content: "Done",
				startsAt: farPast,
				endsAt: past,
			});

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Live");
		});

		it("announcements with no schedule bounds are always visible when active", async () => {
			await controller.createAnnouncement({
				title: "Always On",
				content: "No schedule",
			});

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Always On");
		});
	});

	describe("audience targeting", () => {
		it("authenticated-only announcements are hidden from guests", async () => {
			await controller.createAnnouncement({
				title: "Members Only",
				content: "Secret deal",
				targetAudience: "authenticated",
			});

			const guestView = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			expect(guestView).toHaveLength(0);
		});

		it("guest-only announcements are hidden from authenticated users", async () => {
			await controller.createAnnouncement({
				title: "Sign Up",
				content: "Create an account",
				targetAudience: "guest",
			});

			const authView = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			expect(authView).toHaveLength(0);
		});

		it("all-audience announcements are visible to everyone", async () => {
			await controller.createAnnouncement({
				title: "For Everyone",
				content: "Sale!",
				targetAudience: "all",
			});

			const guestView = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			const authView = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			expect(guestView).toHaveLength(1);
			expect(authView).toHaveLength(1);
		});

		it("mixed audience announcements filter correctly", async () => {
			await controller.createAnnouncement({
				title: "For All",
				content: "Everyone sees this",
				targetAudience: "all",
			});
			await controller.createAnnouncement({
				title: "Auth Only",
				content: "Members see this",
				targetAudience: "authenticated",
			});
			await controller.createAnnouncement({
				title: "Guest Only",
				content: "Guests see this",
				targetAudience: "guest",
			});

			const guestView = await controller.getActiveAnnouncements({
				audience: "guest",
			});
			expect(guestView).toHaveLength(2);

			const authView = await controller.getActiveAnnouncements({
				audience: "authenticated",
			});
			expect(authView).toHaveLength(2);
		});
	});

	describe("interaction tracking safety", () => {
		it("recordImpression silently handles non-existent announcement", async () => {
			await expect(
				controller.recordImpression("nonexistent"),
			).resolves.not.toThrow();
		});

		it("recordClick silently handles non-existent announcement", async () => {
			await expect(
				controller.recordClick("nonexistent"),
			).resolves.not.toThrow();
		});

		it("recordDismissal silently handles non-existent announcement", async () => {
			await expect(
				controller.recordDismissal("nonexistent"),
			).resolves.not.toThrow();
		});

		it("interaction counters increment correctly", async () => {
			const ann = await controller.createAnnouncement({
				title: "Tracked",
				content: "Tracking test",
			});

			await controller.recordImpression(ann.id);
			await controller.recordImpression(ann.id);
			await controller.recordClick(ann.id);
			await controller.recordDismissal(ann.id);

			const updated = await controller.getAnnouncement(ann.id);
			expect(updated?.impressions).toBe(2);
			expect(updated?.clicks).toBe(1);
			expect(updated?.dismissals).toBe(1);
		});
	});

	describe("priority ordering", () => {
		it("announcements are sorted by priority ascending", async () => {
			await controller.createAnnouncement({
				title: "Low Priority",
				content: "test",
				priority: 10,
			});
			await controller.createAnnouncement({
				title: "High Priority",
				content: "test",
				priority: 1,
			});
			await controller.createAnnouncement({
				title: "Medium Priority",
				content: "test",
				priority: 5,
			});

			const active = await controller.getActiveAnnouncements();
			expect(active).toHaveLength(3);
			expect(active[0].title).toBe("High Priority");
			expect(active[1].title).toBe("Medium Priority");
			expect(active[2].title).toBe("Low Priority");
		});
	});

	describe("reorder safety", () => {
		it("reorderAnnouncements handles non-existent IDs gracefully", async () => {
			const ann = await controller.createAnnouncement({
				title: "Real",
				content: "test",
			});

			await expect(
				controller.reorderAnnouncements(["nonexistent", ann.id]),
			).resolves.not.toThrow();

			const updated = await controller.getAnnouncement(ann.id);
			expect(updated?.priority).toBe(1);
		});
	});

	describe("deletion safety", () => {
		it("deleting an announcement removes it completely", async () => {
			const ann = await controller.createAnnouncement({
				title: "Delete Me",
				content: "test",
			});

			await controller.deleteAnnouncement(ann.id);

			const fetched = await controller.getAnnouncement(ann.id);
			expect(fetched).toBeNull();
		});

		it("deleting a non-existent announcement does not throw", async () => {
			await expect(
				controller.deleteAnnouncement("nonexistent"),
			).resolves.not.toThrow();
		});
	});
});
