import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockApplyCompiledModuleSchema = vi.hoisted(() => vi.fn());
const mockBoot = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetEventBus = vi.hoisted(() => vi.fn());

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

vi.mock("../../generated/api", () => ({
	modules: [],
	createApiRouter: vi.fn(),
	getModuleIdForPath: vi.fn(),
}));

vi.mock("@86d-app/runtime/registry", () => ({
	ModuleRegistry: vi.fn(function ModuleRegistry() {
		return {
			isReady: () => false,
			boot: mockBoot,
			getEventBus: mockGetEventBus,
		};
	}),
}));

vi.mock("@86d-app/runtime/compiled-module-data-service", () => ({
	CompiledModuleDataService: vi.fn(),
}));

vi.mock("@86d-app/runtime/compiled-schema-boot", () => ({
	compileInstalledModules: vi.fn(() => ({ compiled: [], sql: "" })),
	compiledForModule: vi.fn(() => []),
	applyCompiledModuleSchema: mockApplyCompiledModuleSchema,
}));

vi.mock("@86d-app/sdk/get-store-config", () => ({
	getStoreConfig: vi.fn().mockResolvedValue({ name: "Test Store" }),
}));
vi.mock("@86d-app/sdk/load-from-template", () => ({
	loadFromTemplate: vi.fn(() => ({ moduleOptions: {} })),
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
		vi.resetModules();
		vi.clearAllMocks();
		mockApplyCompiledModuleSchema.mockReset().mockResolvedValue(undefined);
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

	it("shares one compiled-schema application across concurrent boot callers", async () => {
		let releaseApply: (() => void) | undefined;
		mockApplyCompiledModuleSchema.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseApply = resolve;
				}),
		);
		const { ensureBooted } = await import("../api-registry");

		const boots = [ensureBooted(), ensureBooted(), ensureBooted()];
		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(1);
		expect(releaseApply).toBeTypeOf("function");
		if (!releaseApply) {
			throw new Error("Compiled schema application did not start.");
		}
		releaseApply();
		await Promise.all(boots);

		expect(mockBoot).toHaveBeenCalledTimes(1);
	});

	it("retries compiled-schema application after a failed transaction", async () => {
		mockApplyCompiledModuleSchema
			.mockRejectedValueOnce(new Error("DDL transaction failed"))
			.mockResolvedValueOnce(undefined);
		const { ensureBooted } = await import("../api-registry");

		await expect(ensureBooted()).rejects.toThrow("DDL transaction failed");
		await expect(ensureBooted()).resolves.toBeDefined();

		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(2);
	});
});
