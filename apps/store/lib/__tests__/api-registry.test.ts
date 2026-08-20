import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockModuleUpsert = vi.hoisted(() => vi.fn());
const mockModuleFindFirst = vi.hoisted(() => vi.fn());

vi.mock("db", () => ({
	db: {
		module: {
			upsert: mockModuleUpsert,
			findFirst: mockModuleFindFirst,
		},
	},
	Prisma: { JsonNull: null },
}));

vi.mock("env", () => ({
	default: { STORE_ID: "test-store-id" },
}));

vi.mock("utils/logger", () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../generated/api", () => ({
	modules: [],
	createApiRouter: vi.fn(),
	getModuleIdForPath: vi.fn(),
}));

vi.mock("@86d-app/runtime/registry", () => ({
	ModuleRegistry: vi.fn(),
}));

vi.mock("@86d-app/runtime/universal-data-service", () => ({
	UniversalDataService: vi.fn(),
}));

vi.mock("@86d-app/sdk/get-store-config", () => ({
	getStoreConfig: vi.fn().mockResolvedValue({ name: "Test Store" }),
}));

vi.mock("auth/actions", () => ({ getSession: vi.fn() }));
vi.mock("auth/store-access", () => ({ verifyStoreAdminAccess: vi.fn() }));
vi.mock("~/lib/template-path", () => ({
	resolveTemplatePath: vi.fn().mockReturnValue("/templates/brisa"),
}));
vi.mock("~/lib/notifications", () => ({
	registerNotificationHandlers: vi.fn(),
}));

// ── Import helpers ────────────────────────────────────────────────────────────

import { db, Prisma } from "db";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("api-registry upsertModuleRecord behavior", () => {
	const TEST_STORE_ID = "test-store-id";
	const MODULE_DB_ID = "module-db-uuid-1234";

	beforeEach(() => {
		vi.clearAllMocks();
		mockModuleUpsert.mockResolvedValue({ id: MODULE_DB_ID });
	});

	it("includes settings on CREATE using factory options", async () => {
		const factoryOptions = {
			guestCartExpiration: 604800000,
			maxItemsPerCart: 100,
		};

		await db.module.upsert({
			where: { storeId_name: { storeId: TEST_STORE_ID, name: "cart" } },
			create: {
				name: "cart",
				version: "1.0.0",
				storeId: TEST_STORE_ID,
				settings: JSON.stringify(factoryOptions),
			},
			update: { version: "1.0.0" },
		});

		expect(mockModuleUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					settings: JSON.stringify(factoryOptions),
				}),
			}),
		);
	});

	it("does NOT include settings in UPDATE (preserves user-configured settings)", async () => {
		const factoryOptions = { guestCartExpiration: 604800000 };

		await db.module.upsert({
			where: { storeId_name: { storeId: TEST_STORE_ID, name: "cart" } },
			create: {
				name: "cart",
				version: "1.0.0",
				storeId: TEST_STORE_ID,
				settings: JSON.stringify(factoryOptions),
			},
			update: { version: "1.0.0" },
		});

		const call = mockModuleUpsert.mock.calls[0][0] as {
			update: Record<string, unknown>;
		};
		expect(call.update).not.toHaveProperty("settings");
		expect(call.update).toEqual({ version: "1.0.0" });
	});

	it("uses Prisma.JsonNull for settings when options are absent on CREATE", async () => {
		await db.module.upsert({
			where: { storeId_name: { storeId: TEST_STORE_ID, name: "reviews" } },
			create: {
				name: "reviews",
				version: "0.0.1",
				storeId: TEST_STORE_ID,
				settings: Prisma.JsonNull,
			},
			update: { version: "0.0.1" },
		});

		expect(mockModuleUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({ settings: null }),
				update: expect.not.objectContaining({ settings: expect.anything() }),
			}),
		);
	});

	it("returns the module DB ID from upsert", async () => {
		const result = await db.module.upsert({
			where: { storeId_name: { storeId: TEST_STORE_ID, name: "products" } },
			create: {
				name: "products",
				version: "0.0.1",
				storeId: TEST_STORE_ID,
				settings: null,
			},
			update: { version: "0.0.1" },
		});

		expect(result.id).toBe(MODULE_DB_ID);
	});
});
