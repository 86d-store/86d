import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockApplyCompiledModuleSchema = vi.hoisted(() => vi.fn());
const mockBoot = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetEventBus = vi.hoisted(() => vi.fn());
const applyGate = vi.hoisted(() => ({
	release: undefined as (() => void) | undefined,
}));

vi.mock("db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		update: mockUpdate,
	},
	module: {},
	getPool: vi.fn(() => ({})),
	writeCoreMoney: vi.fn(),
}));

vi.mock("db/core-money", () => ({
	writeCoreMoney: vi.fn(),
}));

vi.mock("db/schema/apply-disposable-ddl", () => ({
	createPostgresTransactionalExecutor: vi.fn(() => ({
		transaction: vi.fn(),
	})),
}));

vi.mock("db/schema/tables", () => ({
	module: {
		id: "id",
		cuid: "cuid",
		name: "name",
		version: "version",
		storeId: "storeId",
		settings: "settings",
	},
}));

vi.mock("env", () => ({
	default: { STORE_ID: "test-store-id" },
}));

vi.mock("env/process-env", () => ({
	getProcessEnv: vi.fn(),
}));

vi.mock("utils/logger", () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../generated/api", () => ({
	modules: [],
	createApiRouter: vi.fn(),
	getModuleIdForPath: vi.fn(),
}));

vi.mock("@86d-store/runtime/registry", () => ({
	ModuleRegistry: vi.fn(function ModuleRegistry() {
		return {
			isReady: () => false,
			boot: mockBoot,
			getEventBus: mockGetEventBus,
		};
	}),
}));

vi.mock("@86d-store/runtime/compiled-module-data-service", () => ({
	CompiledModuleDataService: vi.fn(),
}));

vi.mock("@86d-store/runtime/compiled-schema-boot", () => ({
	compileInstalledModules: vi.fn(() => ({ compiled: [], sql: "" })),
	compiledForModule: vi.fn(() => []),
	applyCompiledModuleSchema: mockApplyCompiledModuleSchema,
}));

vi.mock("@86d-store/sdk/get-store-config", () => ({
	getStoreConfig: vi.fn().mockResolvedValue({ name: "Test Store" }),
}));
vi.mock("@86d-store/sdk/load-from-template", () => ({
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
vi.mock("~/lib/webhook-subscriber", () => ({
	registerWebhookHandlers: vi.fn(),
}));

describe("api-registry module upsert behavior", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		applyGate.release = undefined;
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

	afterEach(() => {
		// Release any deferred apply gate so a timed-out concurrent test cannot
		// leave shared mocks rejecting into the next case.
		applyGate.release?.();
		applyGate.release = undefined;
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
		mockApplyCompiledModuleSchema.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					applyGate.release = resolve;
				}),
		);
		const { ensureBooted } = await import("../api-registry");

		const boots = [ensureBooted(), ensureBooted(), ensureBooted()];
		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(1);
		expect(applyGate.release).toBeTypeOf("function");
		if (!applyGate.release) {
			throw new Error("Compiled schema application did not start.");
		}
		applyGate.release();
		applyGate.release = undefined;
		await Promise.all(boots);

		expect(mockBoot).toHaveBeenCalledTimes(1);
	}, 30_000);

	it("retries compiled-schema application after a failed transaction", async () => {
		mockApplyCompiledModuleSchema
			.mockRejectedValueOnce(new Error("DDL transaction failed"))
			.mockResolvedValueOnce(undefined);
		const { ensureBooted } = await import("../api-registry");

		await expect(ensureBooted()).rejects.toThrow("DDL transaction failed");
		await expect(ensureBooted()).resolves.toBeDefined();

		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(2);
	}, 30_000);
});
