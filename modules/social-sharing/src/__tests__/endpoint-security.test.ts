import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSocialSharingController } from "../service-impl";

/**
 * Security tests for social sharing module endpoints.
 *
 * These tests verify:
 * - Share event recording: correct data persistence
 * - Share counting: accurate per-target and per-network counts
 * - Settings access: CRUD operations scoped correctly
 * - URL generation: safe encoding of user-supplied data
 * - Pagination: boundaries handled safely
 */

describe("social sharing endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSocialSharingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSocialSharingController(mockData);
	});

	// ── Share Event Recording Safety ────────────────────────────────

	describe("share event recording safety", () => {
		it("each share event gets a unique ID", async () => {
			const e1 = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			const e2 = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			expect(e1.id).not.toBe(e2.id);
		});

		it("share events are persisted and retrievable", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/1",
			});

			const shares = await controller.listShares({
				targetType: "product",
				targetId: "prod-1",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].network).toBe("facebook");
		});
	});

	// ── Share Counting Accuracy ─────────────────────────────────────

	describe("share counting accuracy", () => {
		it("counts are isolated per target", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "twitter",
				url: "https://example.com/2",
			});

			expect(await controller.getShareCount("product", "prod-1")).toBe(1);
			expect(await controller.getShareCount("product", "prod-2")).toBe(1);
		});

		it("network breakdown is accurate", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/1",
			});

			const byNetwork = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(byNetwork.twitter).toBe(2);
			expect(byNetwork.facebook).toBe(1);
			expect(byNetwork.linkedin).toBeUndefined();
		});

		it("zero count for non-existent target", async () => {
			const count = await controller.getShareCount("product", "nonexistent");
			expect(count).toBe(0);
		});
	});

	// ── Settings Access ─────────────────────────────────────────────

	describe("settings access", () => {
		it("returns null before any settings are created", async () => {
			const settings = await controller.getSettings();
			expect(settings).toBeNull();
		});

		it("settings are created and retrievable", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook"],
			});

			const settings = await controller.getSettings();
			expect(settings).not.toBeNull();
			expect(settings?.enabledNetworks).toEqual(["twitter", "facebook"]);
		});

		it("settings update is idempotent on same values", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
			});
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
			});

			const settings = await controller.getSettings();
			expect(settings?.enabledNetworks).toEqual(["twitter"]);
		});

		it("partial update preserves unset fields", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
				defaultMessage: "Share this!",
			});

			await controller.updateSettings({
				hashtags: ["sale"],
			});

			const settings = await controller.getSettings();
			expect(settings?.enabledNetworks).toEqual(["twitter"]);
			expect(settings?.defaultMessage).toBe("Share this!");
			expect(settings?.hashtags).toEqual(["sale"]);
		});
	});

	// ── URL Generation Safety ───────────────────────────────────────

	describe("url generation safety", () => {
		it("properly encodes special characters in URLs", () => {
			const url = controller.generateShareUrl(
				"twitter",
				"https://example.com/path?q=hello world&a=1",
			);
			expect(url).toContain(
				encodeURIComponent("https://example.com/path?q=hello world&a=1"),
			);
		});

		it("properly encodes messages with special characters", () => {
			const url = controller.generateShareUrl(
				"twitter",
				"https://example.com",
				"Hello <script>alert('xss')</script>",
			);
			expect(url).not.toContain("<script>");
			expect(url).toContain(
				encodeURIComponent("Hello <script>alert('xss')</script>"),
			);
		});

		it("handles empty hashtags array gracefully", () => {
			const url = controller.generateShareUrl(
				"twitter",
				"https://example.com",
				"Test",
				[],
			);
			expect(url).not.toContain("hashtags=");
		});

		it("copy-link returns unmodified URL", () => {
			const raw = "https://example.com/products/1?ref=share";
			const url = controller.generateShareUrl("copy-link", raw);
			expect(url).toBe(raw);
		});
	});

	// ── Pagination Boundaries ───────────────────────────────────────

	describe("pagination boundaries", () => {
		it("skip beyond total returns empty array", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			const shares = await controller.listShares({ skip: 100 });
			expect(shares).toEqual([]);
		});

		it("take zero with data returns empty", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			const shares = await controller.listShares({ take: 0 });
			expect(shares).toEqual([]);
		});

		it("top shared with take zero returns empty", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			const top = await controller.getTopShared({ take: 0 });
			expect(top).toEqual([]);
		});
	});
});
