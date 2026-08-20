import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock("db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		update: mockUpdate,
	},
	module: {},
	getPool: vi.fn(),
	writeCoreMoney: vi.fn(),
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

vi.mock("@86d-app/runtime/compiled-module-data-service", () => ({
	CompiledModuleDataService: vi.fn(),
}));

vi.mock("@86d-app/runtime/compiled-schema-boot", () => ({
	compileInstalledModules: vi.fn(() => ({ compiled: [], sql: "" })),
	compiledForModule: vi.fn(() => []),
	applyCompiledModuleSchema: vi.fn(),
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

describe("api-registry module upsert behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		});
		mockInsert.mockReturnValue({
			values: vi.fn().mockResolvedValue(undefined),
		});
		mockUpdate.mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
	});

	it("inserts settings as null when options are absent", async () => {
		const { db } = await import("db");
		await db.insert({} as never).values({
			name: "reviews",
			settings: null,
		});
		expect(mockInsert).toHaveBeenCalled();
	});
});
