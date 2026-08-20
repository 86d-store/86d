import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductFeedsController } from "../service-impl";

/**
 * Store endpoint integration tests for the product-feeds module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. list-active-feeds: returns metadata for all active feeds (public, no auth)
 * 2. get-feed-by-slug: returns the generated feed content (public, no auth)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateListActiveFeeds(data: DataService) {
	const controller = createProductFeedsController(data);
	const feeds = await controller.listFeeds({ status: "active" });
	return {
		feeds: feeds.map((f) => ({
			name: f.name,
			slug: f.slug,
			channel: f.channel,
			format: f.format,
			itemCount: f.itemCount,
			lastGeneratedAt: f.lastGeneratedAt,
		})),
	};
}

async function simulateGetFeedBySlug(data: DataService, slug: string) {
	const controller = createProductFeedsController(data);
	const feed = await controller.getFeedBySlug(slug);
	if (!feed) {
		return { error: "Feed not found", status: 404 };
	}
	if (feed.status !== "active") {
		return { error: "Feed is not active", status: 404 };
	}
	const output = await controller.getFeedOutput(feed.id);
	if (!output) {
		return { error: "Feed has not been generated yet", status: 404 };
	}
	return { feed, output };
}

// ── Tests: list-active-feeds ───────────────────────────────────────────

describe("store endpoint: list-active-feeds", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an empty list when no feeds are configured", async () => {
		const result = await simulateListActiveFeeds(data);
		expect(result.feeds).toHaveLength(0);
	});

	it("returns only active feeds", async () => {
		const ctrl = createProductFeedsController(data);
		const active = await ctrl.createFeed({
			name: "Google Shopping",
			slug: "google-shopping",
			channel: "google-shopping",
		});
		await ctrl.updateFeed(active.id, { status: "active" });

		const draft = await ctrl.createFeed({
			name: "Facebook Shop",
			slug: "facebook-shop",
			channel: "facebook",
		});
		// Draft feed stays in draft status (default)
		await ctrl.updateFeed(draft.id, { status: "paused" });

		const result = await simulateListActiveFeeds(data);

		const slugs = result.feeds.map((f) => f.slug);
		expect(slugs).toContain("google-shopping");
		expect(slugs).not.toContain("facebook-shop");
	});

	it("returns feed metadata without the full content", async () => {
		const ctrl = createProductFeedsController(data);
		const feed = await ctrl.createFeed({
			name: "Pinterest Feed",
			slug: "pinterest",
			channel: "pinterest",
			format: "csv",
		});
		await ctrl.updateFeed(feed.id, { status: "active" });

		const result = await simulateListActiveFeeds(data);

		expect(result.feeds).toHaveLength(1);
		expect(result.feeds[0]).toMatchObject({
			name: "Pinterest Feed",
			slug: "pinterest",
			channel: "pinterest",
		});
	});
});

// ── Tests: get-feed-by-slug ────────────────────────────────────────────

describe("store endpoint: get-feed-by-slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 404 for a non-existent feed slug", async () => {
		const result = await simulateGetFeedBySlug(data, "nonexistent-slug");
		expect(result).toMatchObject({ error: "Feed not found", status: 404 });
	});

	it("returns 404 for a paused (inactive) feed", async () => {
		const ctrl = createProductFeedsController(data);
		const feed = await ctrl.createFeed({
			name: "Paused Feed",
			slug: "paused-feed",
			channel: "google-shopping",
		});
		await ctrl.updateFeed(feed.id, { status: "paused" });

		const result = await simulateGetFeedBySlug(data, "paused-feed");
		expect(result).toMatchObject({ status: 404 });
	});

	it("returns 404 when feed is active but has no generated output", async () => {
		const ctrl = createProductFeedsController(data);
		const feed = await ctrl.createFeed({
			name: "Ungenerated Feed",
			slug: "ungenerated",
			channel: "google-shopping",
		});
		await ctrl.updateFeed(feed.id, { status: "active" });

		const result = await simulateGetFeedBySlug(data, "ungenerated");
		expect(result).toMatchObject({
			error: "Feed has not been generated yet",
			status: 404,
		});
	});

	it("returns the feed content when the feed is active and generated", async () => {
		const ctrl = createProductFeedsController(data);
		// Use "custom" channel — no required fields, so any product data produces output
		const feed = await ctrl.createFeed({
			name: "Custom Feed",
			slug: "custom-feed",
			channel: "custom",
			format: "json",
			fieldMappings: [
				{ sourceField: "id", targetField: "id" },
				{ sourceField: "title", targetField: "title" },
				{ sourceField: "price", targetField: "price" },
			],
		});
		await ctrl.updateFeed(feed.id, { status: "active" });

		// Generate the feed with some product data
		await ctrl.generateFeed(feed.id, [
			{
				id: "prod_1",
				title: "Running Shoes",
				price: 8999,
			},
		]);

		const result = await simulateGetFeedBySlug(data, "custom-feed");

		expect("feed" in result && "output" in result).toBe(true);
		if ("feed" in result && result.output != null) {
			expect(result.feed.slug).toBe("custom-feed");
			expect(typeof result.output).toBe("string");
			expect(result.output.length).toBeGreaterThan(0);
		}
	});
});
