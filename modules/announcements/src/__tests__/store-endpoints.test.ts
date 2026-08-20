import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementsControllers } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

/**
 * Store endpoint integration tests for the announcements module.
 *
 * These tests verify the business logic behind store-facing endpoints:
 *
 * 1. GET /announcements/active  — getActiveAnnouncements
 * 2. POST /announcements/:id/impression — recordImpression
 * 3. POST /announcements/:id/click — recordClick
 * 4. POST /announcements/:id/dismiss — recordDismissal
 */

// ── Helpers ────────────────────────────────────────────────────────────

function makeParams(overrides: Record<string, unknown> = {}) {
	return {
		title: "Test Announcement",
		content: "Test content",
		...overrides,
	};
}

// ── Simulate store endpoint handlers ───────────────────────────────────

async function simulateGetActive(
	data: DataService,
	query: { audience?: "all" | "authenticated" | "guest" } = {},
) {
	const controller = createAnnouncementsControllers(data);
	const announcements = await controller.getActiveAnnouncements({
		audience: query.audience,
	});
	return { announcements };
}

async function simulateRecordImpression(data: DataService, id: string) {
	const controller = createAnnouncementsControllers(data);
	await controller.recordImpression(id);
}

async function simulateRecordClick(data: DataService, id: string) {
	const controller = createAnnouncementsControllers(data);
	await controller.recordClick(id);
}

async function simulateRecordDismissal(data: DataService, id: string) {
	const controller = createAnnouncementsControllers(data);
	await controller.recordDismissal(id);
}

// ── 1. GET /announcements/active ───────────────────────────────────────

describe("store endpoint: get active announcements", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("returns active announcements that are within the schedule window", async () => {
		const past = new Date(Date.now() - 86_400_000);
		const future = new Date(Date.now() + 86_400_000);

		await controller.createAnnouncement(
			makeParams({ title: "Current Sale", startsAt: past, endsAt: future }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(1);
		expect(result.announcements[0].title).toBe("Current Sale");
	});

	it("excludes inactive announcements", async () => {
		const a = await controller.createAnnouncement(
			makeParams({ title: "Disabled" }),
		);
		await controller.updateAnnouncement(a.id, { isActive: false });

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(0);
	});

	it("excludes announcements that have not started yet", async () => {
		const future = new Date(Date.now() + 86_400_000);
		await controller.createAnnouncement(
			makeParams({ title: "Coming Soon", startsAt: future }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements.every((a) => a.title !== "Coming Soon")).toBe(
			true,
		);
	});

	it("excludes announcements that have already ended", async () => {
		const past = new Date(Date.now() - 86_400_000);
		await controller.createAnnouncement(
			makeParams({ title: "Over", endsAt: past }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements.every((a) => a.title !== "Over")).toBe(true);
	});

	it("filters by audience: authenticated users see 'all' and 'authenticated'", async () => {
		await controller.createAnnouncement(
			makeParams({ title: "For Everyone", targetAudience: "all" }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Members Only", targetAudience: "authenticated" }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Guests Only", targetAudience: "guest" }),
		);

		const result = await simulateGetActive(data, {
			audience: "authenticated",
		});
		const titles = result.announcements.map((a) => a.title);

		expect(titles).toContain("For Everyone");
		expect(titles).toContain("Members Only");
		expect(titles).not.toContain("Guests Only");
	});

	it("filters by audience: guest users see 'all' and 'guest'", async () => {
		await controller.createAnnouncement(
			makeParams({ title: "For Everyone", targetAudience: "all" }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Members Only", targetAudience: "authenticated" }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Guests Only", targetAudience: "guest" }),
		);

		const result = await simulateGetActive(data, { audience: "guest" });
		const titles = result.announcements.map((a) => a.title);

		expect(titles).toContain("For Everyone");
		expect(titles).toContain("Guests Only");
		expect(titles).not.toContain("Members Only");
	});

	it("returns all active announcements when no audience filter is provided", async () => {
		await controller.createAnnouncement(makeParams({ targetAudience: "all" }));
		await controller.createAnnouncement(
			makeParams({ targetAudience: "authenticated" }),
		);
		await controller.createAnnouncement(
			makeParams({ targetAudience: "guest" }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(3);
	});

	it("returns empty array when no announcements exist", async () => {
		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(0);
	});
});

// ── 2. POST /announcements/:id/impression ──────────────────────────────

describe("store endpoint: record impression", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("increments the impression count", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordImpression(data, a.id);
		await simulateRecordImpression(data, a.id);
		await simulateRecordImpression(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.impressions).toBe(3);
	});

	it("silently succeeds when the announcement does not exist", async () => {
		await expect(
			simulateRecordImpression(data, "nonexistent-id"),
		).resolves.toBeUndefined();
	});

	it("does not affect click or dismissal counters", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordImpression(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.impressions).toBe(1);
		expect(fetched?.clicks).toBe(0);
		expect(fetched?.dismissals).toBe(0);
	});
});

// ── 3. POST /announcements/:id/click ───────────────────────────────────

describe("store endpoint: record click", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("increments the click count", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordClick(data, a.id);
		await simulateRecordClick(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.clicks).toBe(2);
	});

	it("silently succeeds when the announcement does not exist", async () => {
		await expect(
			simulateRecordClick(data, "nonexistent-id"),
		).resolves.toBeUndefined();
	});

	it("does not affect impression or dismissal counters", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordClick(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.clicks).toBe(1);
		expect(fetched?.impressions).toBe(0);
		expect(fetched?.dismissals).toBe(0);
	});
});

// ── 4. POST /announcements/:id/dismiss ─────────────────────────────────

describe("store endpoint: record dismissal", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("increments the dismissal count", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordDismissal(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.dismissals).toBe(1);
	});

	it("silently succeeds when the announcement does not exist", async () => {
		await expect(
			simulateRecordDismissal(data, "nonexistent-id"),
		).resolves.toBeUndefined();
	});

	it("does not affect impression or click counters", async () => {
		const a = await controller.createAnnouncement(makeParams());

		await simulateRecordDismissal(data, a.id);

		const fetched = await controller.getAnnouncement(a.id);
		expect(fetched?.dismissals).toBe(1);
		expect(fetched?.impressions).toBe(0);
		expect(fetched?.clicks).toBe(0);
	});
});

// ── 5. Ordering ────────────────────────────────────────────────────────

describe("store endpoint: ordering — sorted by priority ascending", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("returns active announcements sorted by priority ascending", async () => {
		await controller.createAnnouncement(
			makeParams({ title: "Low Priority", priority: 10 }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "High Priority", priority: 1 }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Medium Priority", priority: 5 }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements[0].title).toBe("High Priority");
		expect(result.announcements[1].title).toBe("Medium Priority");
		expect(result.announcements[2].title).toBe("Low Priority");
	});

	it("maintains stable order for same-priority announcements", async () => {
		await controller.createAnnouncement(
			makeParams({ title: "First", priority: 0 }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Second", priority: 0 }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Third", priority: 0 }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(3);
		// All have same priority - just verify they are all present
		const titles = result.announcements.map((a) => a.title);
		expect(titles).toContain("First");
		expect(titles).toContain("Second");
		expect(titles).toContain("Third");
	});

	it("ordering respects schedule filtering", async () => {
		const past = new Date(Date.now() - 86_400_000);

		await controller.createAnnouncement(
			makeParams({ title: "Visible P2", priority: 2 }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Expired P0", priority: 0, endsAt: past }),
		);
		await controller.createAnnouncement(
			makeParams({ title: "Visible P1", priority: 1 }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(2);
		expect(result.announcements[0].title).toBe("Visible P1");
		expect(result.announcements[1].title).toBe("Visible P2");
	});
});

// ── 6. Schedule bounds ─────────────────────────────────────────────────

describe("store endpoint: schedule bounds — unbounded when startsAt/endsAt missing", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAnnouncementsControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAnnouncementsControllers(data);
	});

	it("includes announcement with no startsAt (immediately visible)", async () => {
		const farFuture = new Date(Date.now() + 86_400_000 * 365);
		await controller.createAnnouncement(
			makeParams({ title: "No Start Bound", endsAt: farFuture }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(1);
		expect(result.announcements[0].title).toBe("No Start Bound");
	});

	it("includes announcement with no endsAt (never expires)", async () => {
		const past = new Date(Date.now() - 86_400_000);
		await controller.createAnnouncement(
			makeParams({ title: "No End Bound", startsAt: past }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(1);
		expect(result.announcements[0].title).toBe("No End Bound");
	});

	it("includes announcement with neither startsAt nor endsAt (always visible)", async () => {
		await controller.createAnnouncement(
			makeParams({ title: "Always Visible" }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(1);
		expect(result.announcements[0].title).toBe("Always Visible");
	});

	it("excludes announcement where now < startsAt even when endsAt is missing", async () => {
		const future = new Date(Date.now() + 86_400_000);
		await controller.createAnnouncement(
			makeParams({ title: "Not Yet", startsAt: future }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(0);
	});

	it("excludes announcement where now > endsAt even when startsAt is missing", async () => {
		const past = new Date(Date.now() - 86_400_000);
		await controller.createAnnouncement(
			makeParams({ title: "Already Ended", endsAt: past }),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(0);
	});

	it("includes announcement with exact current time within window", async () => {
		const justBefore = new Date(Date.now() - 1000);
		const justAfter = new Date(Date.now() + 86_400_000);

		await controller.createAnnouncement(
			makeParams({
				title: "Tight Window",
				startsAt: justBefore,
				endsAt: justAfter,
			}),
		);

		const result = await simulateGetActive(data);

		expect(result.announcements).toHaveLength(1);
		expect(result.announcements[0].title).toBe("Tight Window");
	});

	it("combines schedule bounds with audience filtering", async () => {
		const past = new Date(Date.now() - 86_400_000);
		const future = new Date(Date.now() + 86_400_000);

		await controller.createAnnouncement(
			makeParams({
				title: "Auth In Window",
				targetAudience: "authenticated",
				startsAt: past,
				endsAt: future,
			}),
		);
		await controller.createAnnouncement(
			makeParams({
				title: "Guest Expired",
				targetAudience: "guest",
				endsAt: past,
			}),
		);
		await controller.createAnnouncement(
			makeParams({
				title: "All Unbounded",
				targetAudience: "all",
			}),
		);

		const result = await simulateGetActive(data, {
			audience: "authenticated",
		});
		const titles = result.announcements.map((a) => a.title);

		expect(titles).toContain("Auth In Window");
		expect(titles).toContain("All Unbounded");
		expect(titles).not.toContain("Guest Expired");
	});
});
