import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSocialSharingController } from "../service-impl";

/**
 * Store endpoint integration tests for the social-sharing module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. record-share: records a share event
 * 2. get-share-count: returns total shares for a target
 * 3. get-share-count-by-network: returns share breakdown by network
 * 4. generate-share-url: creates a share URL for a network
 */

type DataService = ReturnType<typeof createMockDataService>;
type TargetType = "product" | "collection" | "page" | "blog-post" | "custom";
type Network =
	| "twitter"
	| "facebook"
	| "pinterest"
	| "linkedin"
	| "whatsapp"
	| "email"
	| "copy-link";

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateRecordShare(
	data: DataService,
	body: {
		targetType: TargetType;
		targetId: string;
		network: Network;
		url: string;
	},
) {
	const controller = createSocialSharingController(data);
	const event = await controller.recordShare(body);
	return { event };
}

async function simulateGetShareCount(
	data: DataService,
	targetType: TargetType,
	targetId: string,
) {
	const controller = createSocialSharingController(data);
	const count = await controller.getShareCount(targetType, targetId);
	return { count };
}

async function simulateGetShareCountByNetwork(
	data: DataService,
	targetType: TargetType,
	targetId: string,
) {
	const controller = createSocialSharingController(data);
	const counts = await controller.getShareCountByNetwork(targetType, targetId);
	return { counts };
}

function simulateGenerateShareUrl(
	data: DataService,
	network: Network,
	targetUrl: string,
	message?: string,
) {
	const controller = createSocialSharingController(data);
	const url = controller.generateShareUrl(network, targetUrl, message);
	return { url };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: record share", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records a share event", async () => {
		const result = await simulateRecordShare(data, {
			targetType: "product",
			targetId: "prod_1",
			network: "twitter",
			url: "https://store.example.com/products/widget",
		});

		expect("event" in result).toBe(true);
		if ("event" in result) {
			expect(result.event.network).toBe("twitter");
			expect(result.event.targetId).toBe("prod_1");
		}
	});
});

describe("store endpoint: get share count", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns total share count for a target", async () => {
		const ctrl = createSocialSharingController(data);
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod_1",
			network: "twitter",
			url: "https://example.com/p/1",
		});
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod_1",
			network: "facebook",
			url: "https://example.com/p/1",
		});

		const result = await simulateGetShareCount(data, "product", "prod_1");

		expect(result.count).toBe(2);
	});

	it("returns zero for unshared target", async () => {
		const result = await simulateGetShareCount(data, "product", "prod_none");

		expect(result.count).toBe(0);
	});
});

describe("store endpoint: get share count by network", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns share breakdown by network", async () => {
		const ctrl = createSocialSharingController(data);
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod_1",
			network: "twitter",
			url: "https://example.com/p/1",
		});
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod_1",
			network: "twitter",
			url: "https://example.com/p/1",
		});
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod_1",
			network: "facebook",
			url: "https://example.com/p/1",
		});

		const result = await simulateGetShareCountByNetwork(
			data,
			"product",
			"prod_1",
		);

		expect(result.counts.twitter).toBe(2);
		expect(result.counts.facebook).toBe(1);
	});
});

describe("store endpoint: generate share url", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("generates a Twitter share URL", () => {
		const result = simulateGenerateShareUrl(
			data,
			"twitter",
			"https://store.example.com/products/widget",
			"Check this out!",
		);

		expect(result.url).toContain("twitter.com");
	});

	it("generates a Facebook share URL", () => {
		const result = simulateGenerateShareUrl(
			data,
			"facebook",
			"https://store.example.com/products/widget",
		);

		expect(result.url).toContain("facebook.com");
	});
});
