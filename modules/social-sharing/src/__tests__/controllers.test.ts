import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSocialSharingController } from "../service-impl";

describe("social sharing controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSocialSharingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSocialSharingController(mockData);
	});

	// ── recordShare ─────────────────────────────────────────────────

	describe("recordShare", () => {
		it("creates a share event with all fields", async () => {
			const event = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/products/1",
				referrer: "https://google.com",
				sessionId: "session-abc",
			});

			expect(event.id).toBeDefined();
			expect(event.targetType).toBe("product");
			expect(event.targetId).toBe("prod-1");
			expect(event.network).toBe("twitter");
			expect(event.url).toBe("https://example.com/products/1");
			expect(event.referrer).toBe("https://google.com");
			expect(event.sessionId).toBe("session-abc");
			expect(event.createdAt).toBeInstanceOf(Date);
		});

		it("creates a share event without optional fields", async () => {
			const event = await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "facebook",
				url: "https://example.com/collections/1",
			});

			expect(event.id).toBeDefined();
			expect(event.referrer).toBeUndefined();
			expect(event.sessionId).toBeUndefined();
		});

		it("creates unique IDs for each share event", async () => {
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

		it("persists share events in the data store", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			expect(mockData.size("shareEvent")).toBe(1);
		});
	});

	// ── getShareCount ───────────────────────────────────────────────

	describe("getShareCount", () => {
		it("returns zero when no shares exist", async () => {
			const count = await controller.getShareCount("product", "prod-1");
			expect(count).toBe(0);
		});

		it("counts shares for a specific target", async () => {
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
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "twitter",
				url: "https://example.com/2",
			});

			const count = await controller.getShareCount("product", "prod-1");
			expect(count).toBe(2);
		});

		it("does not count shares for different target types", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "id-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "page",
				targetId: "id-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			const count = await controller.getShareCount("product", "id-1");
			expect(count).toBe(1);
		});
	});

	// ── getShareCountByNetwork ──────────────────────────────────────

	describe("getShareCountByNetwork", () => {
		it("returns empty object when no shares exist", async () => {
			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts).toEqual({});
		});

		it("returns counts grouped by network", async () => {
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

			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts.twitter).toBe(2);
			expect(counts.facebook).toBe(1);
		});

		it("does not include other targets in counts", async () => {
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

			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts.twitter).toBe(1);
		});
	});

	// ── listShares ──────────────────────────────────────────────────

	describe("listShares", () => {
		it("returns all shares when no filters", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "facebook",
				url: "https://example.com/page",
			});

			const shares = await controller.listShares();
			expect(shares).toHaveLength(2);
		});

		it("filters by targetType", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "facebook",
				url: "https://example.com/page",
			});

			const shares = await controller.listShares({
				targetType: "product",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].targetType).toBe("product");
		});

		it("filters by network", async () => {
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

			const shares = await controller.listShares({ network: "twitter" });
			expect(shares).toHaveLength(1);
			expect(shares[0].network).toBe("twitter");
		});

		it("filters by targetId", async () => {
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

			const shares = await controller.listShares({ targetId: "prod-1" });
			expect(shares).toHaveLength(1);
			expect(shares[0].targetId).toBe("prod-1");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/${i}`,
				});
			}

			const page = await controller.listShares({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("skip beyond total returns empty", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});

			const shares = await controller.listShares({ skip: 100 });
			expect(shares).toEqual([]);
		});

		it("combines multiple filters", async () => {
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
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "twitter",
				url: "https://example.com/page",
			});

			const shares = await controller.listShares({
				targetType: "product",
				network: "twitter",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].targetId).toBe("prod-1");
			expect(shares[0].network).toBe("twitter");
		});
	});

	// ── getTopShared ────────────────────────────────────────────────

	describe("getTopShared", () => {
		it("returns empty when no shares exist", async () => {
			const top = await controller.getTopShared();
			expect(top).toEqual([]);
		});

		it("returns items sorted by share count descending", async () => {
			// prod-1 gets 3 shares
			for (let i = 0; i < 3; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: "prod-1",
					network: "twitter",
					url: "https://example.com/1",
				});
			}
			// prod-2 gets 1 share
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "facebook",
				url: "https://example.com/2",
			});
			// page-1 gets 2 shares
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "linkedin",
				url: "https://example.com/page",
			});
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "twitter",
				url: "https://example.com/page",
			});

			const top = await controller.getTopShared();
			expect(top[0].targetId).toBe("prod-1");
			expect(top[0].count).toBe(3);
			expect(top[1].targetId).toBe("page-1");
			expect(top[1].count).toBe(2);
			expect(top[2].targetId).toBe("prod-2");
			expect(top[2].count).toBe(1);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/${i}`,
				});
			}

			const top = await controller.getTopShared({ take: 2 });
			expect(top).toHaveLength(2);
		});

		it("filters by targetType", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/1",
			});
			await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "twitter",
				url: "https://example.com/page",
			});

			const top = await controller.getTopShared({
				targetType: "product",
			});
			expect(top).toHaveLength(1);
			expect(top[0].targetType).toBe("product");
		});
	});

	// ── settings CRUD ───────────────────────────────────────────────

	describe("settings", () => {
		it("returns null when no settings exist", async () => {
			const settings = await controller.getSettings();
			expect(settings).toBeNull();
		});

		it("creates settings on first update", async () => {
			const settings = await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook"],
				defaultMessage: "Check this out!",
				hashtags: ["shop", "deals"],
			});

			expect(settings.enabledNetworks).toEqual(["twitter", "facebook"]);
			expect(settings.defaultMessage).toBe("Check this out!");
			expect(settings.hashtags).toEqual(["shop", "deals"]);
			expect(settings.updatedAt).toBeInstanceOf(Date);
		});

		it("retrieves settings after creation", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
			});

			const settings = await controller.getSettings();
			expect(settings).not.toBeNull();
			expect(settings?.enabledNetworks).toEqual(["twitter"]);
		});

		it("merges partial updates with existing settings", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook"],
				defaultMessage: "Original message",
				hashtags: ["tag1"],
			});

			const updated = await controller.updateSettings({
				hashtags: ["tag2", "tag3"],
			});

			expect(updated.enabledNetworks).toEqual(["twitter", "facebook"]);
			expect(updated.defaultMessage).toBe("Original message");
			expect(updated.hashtags).toEqual(["tag2", "tag3"]);
		});

		it("updates customTemplates", async () => {
			await controller.updateSettings({
				customTemplates: {
					twitter: "Check out {title} at {url}",
					facebook: "I found {title}!",
				},
			});

			const settings = await controller.getSettings();
			expect(settings?.customTemplates).toEqual({
				twitter: "Check out {title} at {url}",
				facebook: "I found {title}!",
			});
		});

		it("overwrites settings completely when all fields provided", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
				defaultMessage: "Old",
				hashtags: ["old"],
				customTemplates: { twitter: "old template" },
			});

			const updated = await controller.updateSettings({
				enabledNetworks: ["facebook", "linkedin"],
				defaultMessage: "New",
				hashtags: ["new"],
				customTemplates: { facebook: "new template" },
			});

			expect(updated.enabledNetworks).toEqual(["facebook", "linkedin"]);
			expect(updated.defaultMessage).toBe("New");
			expect(updated.hashtags).toEqual(["new"]);
			expect(updated.customTemplates).toEqual({
				facebook: "new template",
			});
		});
	});

	// ── generateShareUrl ────────────────────────────────────────────

	describe("generateShareUrl", () => {
		const targetUrl = "https://example.com/products/cool-thing";

		it("generates Twitter intent URL", () => {
			const url = controller.generateShareUrl("twitter", targetUrl);
			expect(url).toContain("https://twitter.com/intent/tweet");
			expect(url).toContain(`url=${encodeURIComponent(targetUrl)}`);
		});

		it("generates Twitter URL with message and hashtags", () => {
			const url = controller.generateShareUrl(
				"twitter",
				targetUrl,
				"Check this out",
				["cool", "deal"],
			);
			expect(url).toContain("text=Check%20this%20out");
			expect(url).toContain("hashtags=cool%2Cdeal");
		});

		it("generates Facebook sharer URL", () => {
			const url = controller.generateShareUrl("facebook", targetUrl);
			expect(url).toBe(
				`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
			);
		});

		it("generates Pinterest pin URL", () => {
			const url = controller.generateShareUrl("pinterest", targetUrl);
			expect(url).toContain("https://pinterest.com/pin/create/button/");
			expect(url).toContain(`url=${encodeURIComponent(targetUrl)}`);
		});

		it("generates Pinterest URL with description", () => {
			const url = controller.generateShareUrl(
				"pinterest",
				targetUrl,
				"Amazing product",
			);
			expect(url).toContain("description=Amazing%20product");
		});

		it("generates LinkedIn share URL", () => {
			const url = controller.generateShareUrl("linkedin", targetUrl);
			expect(url).toBe(
				`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(targetUrl)}`,
			);
		});

		it("generates WhatsApp URL without message", () => {
			const url = controller.generateShareUrl("whatsapp", targetUrl);
			expect(url).toContain("https://api.whatsapp.com/send");
			expect(url).toContain(encodeURIComponent(targetUrl));
		});

		it("generates WhatsApp URL with message", () => {
			const url = controller.generateShareUrl(
				"whatsapp",
				targetUrl,
				"Look at this",
			);
			expect(url).toContain("https://api.whatsapp.com/send");
			expect(url).toContain("Look%20at%20this");
			expect(url).toContain(encodeURIComponent(targetUrl));
		});

		it("generates email mailto URL", () => {
			const url = controller.generateShareUrl("email", targetUrl);
			expect(url).toContain("mailto:");
			expect(url).toContain(`body=${encodeURIComponent(targetUrl)}`);
		});

		it("generates email URL with custom subject", () => {
			const url = controller.generateShareUrl(
				"email",
				targetUrl,
				"Must see this",
			);
			expect(url).toContain("subject=Must%20see%20this");
		});

		it("returns raw URL for copy-link", () => {
			const url = controller.generateShareUrl("copy-link", targetUrl);
			expect(url).toBe(targetUrl);
		});
	});

	// ── data store consistency ───────────────────────────────────────

	describe("data store consistency", () => {
		it("share event count matches data store size", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/${i}`,
				});
			}

			expect(mockData.size("shareEvent")).toBe(5);
			const all = await controller.listShares();
			expect(all).toHaveLength(5);
		});

		it("concurrent shares produce distinct records", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/${i}`,
				}),
			);
			const events = await Promise.all(promises);
			const ids = new Set(events.map((e) => e.id));
			expect(ids.size).toBe(10);
		});
	});
});
