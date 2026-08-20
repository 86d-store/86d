import { describe, expect, it, vi } from "vitest";
import { deleteSettingEndpoint } from "../admin/endpoints/delete-setting";
import { getSettingEndpoint } from "../admin/endpoints/get-setting";
import { getSettingsEndpoint } from "../admin/endpoints/get-settings";
import { updateBulkEndpoint } from "../admin/endpoints/update-bulk";
import { updateSettingEndpoint } from "../admin/endpoints/update-setting";
import type {
	SettingGroup,
	SettingsController,
	StoreSetting,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeSetting(overrides: Partial<StoreSetting> = {}): StoreSetting {
	return {
		id: crypto.randomUUID(),
		key: "general.store_name",
		value: "My Store",
		group: "general" as SettingGroup,
		updatedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<SettingsController> = {},
): SettingsController {
	return {
		get: vi.fn().mockResolvedValue(null),
		getValue: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(makeSetting()),
		setBulk: vi.fn().mockResolvedValue([]),
		getByGroup: vi.fn().mockResolvedValue([]),
		getAll: vi.fn().mockResolvedValue([]),
		getPublic: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue(false),
		...overrides,
	} as SettingsController;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SettingsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { settings: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const getSettingHandler = extractHandler(getSettingEndpoint);
const getSettingsHandler = extractHandler(getSettingsEndpoint);
const updateSettingHandler = extractHandler(updateSettingEndpoint);
const updateBulkHandler = extractHandler(updateBulkEndpoint);
const deleteSettingHandler = extractHandler(deleteSettingEndpoint);

// ── getSettingEndpoint ────────────────────────────────────────────────────────

describe("admin GET /settings/:key", () => {
	it("returns error when setting not found", async () => {
		const result = (await call(getSettingHandler, {
			params: { key: "general.store_name" },
		})) as { error: string };
		expect(result.error).toBe("Setting not found");
	});

	it("returns setting when found", async () => {
		const setting = makeSetting({ key: "general.store_name", value: "Acme" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(setting),
		});
		const result = (await call(getSettingHandler, {
			params: { key: "general.store_name" },
			controller: ctrl,
		})) as { setting: StoreSetting };
		expect(result.setting.key).toBe("general.store_name");
		expect(result.setting.value).toBe("Acme");
		expect(ctrl.get).toHaveBeenCalledWith("general.store_name");
	});
});

// ── getSettingsEndpoint ───────────────────────────────────────────────────────

describe("admin GET /settings", () => {
	it("returns all settings when no group filter", async () => {
		const settings = [
			makeSetting({ key: "general.store_name" }),
			makeSetting({ key: "commerce.currency", group: "commerce" }),
		];
		const ctrl = makeController({
			getAll: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(getSettingsHandler, {
			controller: ctrl,
		})) as { settings: StoreSetting[] };
		expect(result.settings).toHaveLength(2);
		expect(ctrl.getAll).toHaveBeenCalled();
	});

	it("returns settings filtered by group", async () => {
		const settings = [makeSetting({ key: "social.facebook", group: "social" })];
		const ctrl = makeController({
			getByGroup: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(getSettingsHandler, {
			query: { group: "social" },
			controller: ctrl,
		})) as { settings: StoreSetting[] };
		expect(result.settings).toHaveLength(1);
		expect(ctrl.getByGroup).toHaveBeenCalledWith("social");
	});
});

// ── updateSettingEndpoint ─────────────────────────────────────────────────────

describe("admin POST /settings/update", () => {
	it("creates or updates a setting and returns it", async () => {
		const setting = makeSetting({
			key: "commerce.currency",
			value: "eur",
			group: "commerce",
		});
		const ctrl = makeController({
			set: vi.fn().mockResolvedValue(setting),
		});
		const result = (await call(updateSettingHandler, {
			body: { key: "commerce.currency", value: "eur", group: "commerce" },
			controller: ctrl,
		})) as { setting: StoreSetting };
		expect(result.setting.key).toBe("commerce.currency");
		expect(result.setting.value).toBe("eur");
		expect(ctrl.set).toHaveBeenCalledWith(
			"commerce.currency",
			"eur",
			"commerce",
		);
	});

	it("updates setting without a group", async () => {
		const setting = makeSetting({
			key: "general.store_name",
			value: "New Name",
		});
		const ctrl = makeController({
			set: vi.fn().mockResolvedValue(setting),
		});
		const result = (await call(updateSettingHandler, {
			body: { key: "general.store_name", value: "New Name" },
			controller: ctrl,
		})) as { setting: StoreSetting };
		expect(result.setting.value).toBe("New Name");
		expect(ctrl.set).toHaveBeenCalledWith(
			"general.store_name",
			"New Name",
			undefined,
		);
	});
});

// ── updateBulkEndpoint ────────────────────────────────────────────────────────

describe("admin POST /settings/update-bulk", () => {
	it("upserts multiple settings and returns them", async () => {
		const settings = [
			makeSetting({ key: "general.store_name", value: "Shop" }),
			makeSetting({
				key: "commerce.currency",
				value: "gbp",
				group: "commerce",
			}),
		];
		const ctrl = makeController({
			setBulk: vi.fn().mockResolvedValue(settings),
		});
		const result = (await call(updateBulkHandler, {
			body: {
				settings: [
					{ key: "general.store_name", value: "Shop" },
					{ key: "commerce.currency", value: "gbp", group: "commerce" },
				],
			},
			controller: ctrl,
		})) as { settings: StoreSetting[]; updated: number };
		expect(result.settings).toHaveLength(2);
		expect(result.updated).toBe(2);
		expect(ctrl.setBulk).toHaveBeenCalled();
	});

	it("returns zero updated when bulk call returns empty", async () => {
		const ctrl = makeController({
			setBulk: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(updateBulkHandler, {
			body: { settings: [{ key: "general.store_name", value: "X" }] },
			controller: ctrl,
		})) as { settings: StoreSetting[]; updated: number };
		expect(result.updated).toBe(0);
	});
});

// ── deleteSettingEndpoint ─────────────────────────────────────────────────────

describe("admin POST /settings/:key/delete", () => {
	it("returns error when setting not found", async () => {
		const result = (await call(deleteSettingHandler, {
			params: { key: "general.unknown" },
		})) as { error: string };
		expect(result.error).toBe("Setting not found");
	});

	it("deletes setting and returns success", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteSettingHandler, {
			params: { key: "general.store_name" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("general.store_name");
	});
});
