import { describe, expect, it, vi } from "vitest";
import { getSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listSharesEndpoint } from "../admin/endpoints/list-shares";
import { statsEndpoint } from "../admin/endpoints/stats";
import { topEndpoint } from "../admin/endpoints/top";
import { updateSettingsEndpoint } from "../admin/endpoints/update-settings";
import type {
	ShareEvent,
	ShareSettings,
	SocialSharingController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeShareEvent(overrides: Partial<ShareEvent> = {}): ShareEvent {
	return {
		id: crypto.randomUUID(),
		targetType: "product",
		targetId: "prod-1",
		network: "twitter",
		url: "https://example.com/product/widget",
		createdAt: new Date(),
		...overrides,
	};
}

function makeSettings(overrides: Partial<ShareSettings> = {}): ShareSettings {
	return {
		id: "settings-1",
		enabledNetworks: ["twitter", "facebook"],
		hashtags: [],
		customTemplates: {},
		updatedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<SocialSharingController> = {},
): SocialSharingController {
	return {
		recordShare: vi.fn().mockResolvedValue(makeShareEvent()),
		getShareCount: vi.fn().mockResolvedValue(0),
		getShareCountByNetwork: vi.fn().mockResolvedValue({}),
		listShares: vi.fn().mockResolvedValue([]),
		getTopShared: vi.fn().mockResolvedValue([]),
		getSettings: vi.fn().mockResolvedValue(null),
		updateSettings: vi.fn().mockResolvedValue(makeSettings()),
		generateShareUrl: vi
			.fn()
			.mockReturnValue("https://twitter.com/share?url=..."),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SocialSharingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { "social-sharing": opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listSharesEndpoint);
const getSettingsHandler = extractHandler(getSettingsEndpoint);
const updateSettingsHandler = extractHandler(updateSettingsEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const topHandler = extractHandler(topEndpoint);

describe("admin GET /social-sharing", () => {
	it("returns empty shares list", async () => {
		const result = (await call(listHandler)) as {
			shares: ShareEvent[];
			total: number;
		};
		expect(result.shares).toHaveLength(0);
	});

	it("forwards network filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { network: "facebook" },
			controller: ctrl,
		});
		expect(ctrl.listShares).toHaveBeenCalledWith(
			expect.objectContaining({ network: "facebook" }),
		);
	});
});

describe("admin GET /social-sharing/settings", () => {
	it("returns null settings when not configured", async () => {
		const result = (await call(getSettingsHandler)) as {
			settings: ShareSettings | null;
		};
		expect(result.settings).toBeNull();
	});

	it("returns settings when configured", async () => {
		const settings = makeSettings({ enabledNetworks: ["twitter"] });
		const ctrl = makeController({
			getSettings: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(getSettingsHandler, { controller: ctrl })) as {
			settings: ShareSettings;
		};
		expect(result.settings.enabledNetworks).toContain("twitter");
	});
});

describe("admin PUT /social-sharing/settings/update", () => {
	it("saves and returns updated settings", async () => {
		const settings = makeSettings({ hashtags: ["sale"] });
		const ctrl = makeController({
			updateSettings: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(updateSettingsHandler, {
			body: { hashtags: ["sale"] },
			controller: ctrl,
		})) as { settings: ShareSettings };
		expect(result.settings.hashtags).toContain("sale");
	});

	it("calls controller with provided enabledNetworks", async () => {
		const ctrl = makeController();
		await call(updateSettingsHandler, {
			body: { enabledNetworks: ["linkedin", "email"] },
			controller: ctrl,
		});
		expect(ctrl.updateSettings).toHaveBeenCalledWith(
			expect.objectContaining({ enabledNetworks: ["linkedin", "email"] }),
		);
	});
});

describe("admin GET /social-sharing/stats", () => {
	it("returns zero total when no shares", async () => {
		const result = (await call(statsHandler)) as {
			stats: Record<string, number>;
			total: number;
		};
		expect(result.total).toBe(0);
	});

	it("aggregates share counts by network", async () => {
		const ctrl = makeController({
			listShares: vi
				.fn()
				.mockResolvedValue([
					makeShareEvent({ network: "twitter" }),
					makeShareEvent({ network: "facebook" }),
					makeShareEvent({ network: "twitter" }),
				]),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: Record<string, number>;
			total: number;
		};
		expect(result.total).toBe(3);
		expect(result.stats.twitter).toBe(2);
	});
});

describe("admin GET /social-sharing/top", () => {
	it("returns empty top list", async () => {
		const result = (await call(topHandler)) as {
			top: Array<{ targetType: string; targetId: string; count: number }>;
		};
		expect(result.top).toHaveLength(0);
	});

	it("forwards targetType filter to controller", async () => {
		const ctrl = makeController();
		await call(topHandler, {
			query: { targetType: "product" },
			controller: ctrl,
		});
		expect(ctrl.getTopShared).toHaveBeenCalledWith(
			expect.objectContaining({ targetType: "product" }),
		);
	});
});
