import { describe, expect, it, vi } from "vitest";
import { getPickupSettingsEndpoint } from "../admin/endpoints/get-pickup-settings";
import { updatePickupSettingsEndpoint } from "../admin/endpoints/update-pickup-settings";
import type { SettingsController, StoreSetting } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeController(
	values: Record<string, string | null> = {},
): SettingsController {
	return {
		get: vi.fn().mockResolvedValue(null),
		getValue: vi.fn().mockImplementation((key: string) => {
			return Promise.resolve(values[key] ?? null);
		}),
		set: vi.fn().mockResolvedValue({} as StoreSetting),
		setBulk: vi.fn().mockResolvedValue([]),
		getByGroup: vi.fn().mockResolvedValue([]),
		getAll: vi.fn().mockResolvedValue([]),
		getPublic: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue(true),
	} as SettingsController;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		body?: Record<string, unknown>;
		controller?: SettingsController;
	} = {},
) {
	return handler({
		query: {},
		params: {},
		body: opts.body ?? {},
		context: {
			controllers: { settings: opts.controller ?? makeController() },
		},
	});
}

const getHandler = extractHandler(getPickupSettingsEndpoint);
const updateHandler = extractHandler(updatePickupSettingsEndpoint);

describe("pickup settings - item issue report", () => {
	describe("GET /admin/settings/pickup", () => {
		it("returns default disabled item issue report when not configured", async () => {
			const result = (await call(getHandler, {
				controller: makeController({
					"pickup.prep_time_minutes": "15",
					"general.timezone": "America/Chicago",
				}),
			})) as { settings: Record<string, unknown> };

			expect(result.settings.itemIssueReportEnabled).toBe(false);
			expect(result.settings.itemIssueReportWindowHours).toBeNull();
			expect(result.settings.itemIssueReportResolution).toBeNull();
		});

		it("returns configured item issue report settings", async () => {
			const result = (await call(getHandler, {
				controller: makeController({
					"pickup.prep_time_minutes": "15",
					"general.timezone": "America/Chicago",
					"pickup.item_issue_report_enabled": "true",
					"pickup.item_issue_report_window_hours": "24",
					"pickup.item_issue_report_resolution": "remake_or_refund",
				}),
			})) as { settings: Record<string, unknown> };

			expect(result.settings.itemIssueReportEnabled).toBe(true);
			expect(result.settings.itemIssueReportWindowHours).toBe(24);
			expect(result.settings.itemIssueReportResolution).toBe(
				"remake_or_refund",
			);
		});

		it("reports missing required fields when item issue enabled without config", async () => {
			const result = (await call(getHandler, {
				controller: makeController({
					"pickup.prep_time_minutes": "15",
					"general.timezone": "America/Chicago",
					"pickup.item_issue_report_enabled": "true",
				}),
			})) as { settings: { missingRequired: string[]; isConfigured: boolean } };

			expect(result.settings.isConfigured).toBe(false);
			expect(result.settings.missingRequired).toContain(
				"itemIssueReportWindowHours",
			);
			expect(result.settings.missingRequired).toContain(
				"itemIssueReportResolution",
			);
		});

		it("is configured when item issue enabled with all required fields", async () => {
			const result = (await call(getHandler, {
				controller: makeController({
					"pickup.prep_time_minutes": "15",
					"general.timezone": "America/Chicago",
					"pickup.item_issue_report_enabled": "true",
					"pickup.item_issue_report_window_hours": "24",
					"pickup.item_issue_report_resolution": "remake_or_refund",
				}),
			})) as { settings: { missingRequired: string[]; isConfigured: boolean } };

			expect(result.settings.isConfigured).toBe(true);
			expect(result.settings.missingRequired).toHaveLength(0);
		});

		it("parses all resolution types correctly", async () => {
			for (const resolution of ["remake", "refund", "remake_or_refund"]) {
				const result = (await call(getHandler, {
					controller: makeController({
						"pickup.prep_time_minutes": "15",
						"general.timezone": "America/Chicago",
						"pickup.item_issue_report_resolution": resolution,
					}),
				})) as { settings: { itemIssueReportResolution: string | null } };

				expect(result.settings.itemIssueReportResolution).toBe(resolution);
			}
		});
	});

	describe("POST /admin/settings/pickup", () => {
		it("requires window hours when enabling item issue report", async () => {
			const ctrl = makeController();
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportResolution: "remake_or_refund",
					},
					controller: ctrl,
				}),
			).rejects.toThrow("itemIssueReportWindowHours is required");
		});

		it("requires resolution when enabling item issue report", async () => {
			const ctrl = makeController();
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportWindowHours: 24,
					},
					controller: ctrl,
				}),
			).rejects.toThrow("itemIssueReportResolution is required");
		});

		it("updates all item issue report fields when valid", async () => {
			const ctrl = makeController();
			const result = (await call(updateHandler, {
				body: {
					itemIssueReportEnabled: true,
					itemIssueReportWindowHours: 24,
					itemIssueReportResolution: "remake_or_refund",
				},
				controller: ctrl,
			})) as { success: boolean; updated: number };

			expect(result.success).toBe(true);
			expect(result.updated).toBe(3);
			expect(ctrl.setBulk).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						key: "pickup.item_issue_report_enabled",
						value: "true",
					}),
					expect.objectContaining({
						key: "pickup.item_issue_report_window_hours",
						value: "24",
					}),
					expect.objectContaining({
						key: "pickup.item_issue_report_resolution",
						value: "remake_or_refund",
					}),
				]),
			);
		});

		it("allows disabling item issue report without other fields", async () => {
			const ctrl = makeController();
			const result = (await call(updateHandler, {
				body: {
					itemIssueReportEnabled: false,
				},
				controller: ctrl,
			})) as { success: boolean; updated: number };

			expect(result.success).toBe(true);
			expect(result.updated).toBe(1);
		});

		it("validates resolution enum values", async () => {
			const ctrl = makeController();
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportWindowHours: 24,
						itemIssueReportResolution: "invalid_value",
					},
					controller: ctrl,
				}),
			).rejects.toThrow();
		});

		it("validates window hours is positive and within range", async () => {
			const ctrl = makeController();

			// Zero is invalid
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportWindowHours: 0,
						itemIssueReportResolution: "remake",
					},
					controller: ctrl,
				}),
			).rejects.toThrow();

			// Negative is invalid
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportWindowHours: -1,
						itemIssueReportResolution: "remake",
					},
					controller: ctrl,
				}),
			).rejects.toThrow();

			// Over 168 hours (7 days) is invalid
			await expect(
				call(updateHandler, {
					body: {
						itemIssueReportEnabled: true,
						itemIssueReportWindowHours: 200,
						itemIssueReportResolution: "remake",
					},
					controller: ctrl,
				}),
			).rejects.toThrow();
		});
	});
});
