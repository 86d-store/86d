import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockApplyCompiledModuleSchema = vi.hoisted(() => vi.fn());
const mockBoot = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetEventBus = vi.hoisted(() => vi.fn());
const mockGetProcessEnv = vi.hoisted(() => vi.fn());

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

vi.mock("env/process-env", () => ({
	getProcessEnv: mockGetProcessEnv,
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
		const { ensureBooted, BootFailureError, resetBootStateForTest } =
			await import("../api-registry");
		resetBootStateForTest();

		const err = await ensureBooted().catch((e) => e);
		expect(err).toBeInstanceOf(BootFailureError);
		expect(err.cause.message).toBe("DDL transaction failed");

		resetBootStateForTest();
		mockApplyCompiledModuleSchema.mockResolvedValueOnce(undefined);
		await expect(ensureBooted()).resolves.toBeDefined();

		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(2);
	});
});

describe("api-registry boot failure backoff", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockApplyCompiledModuleSchema.mockReset();
		mockBoot.mockReset().mockResolvedValue(undefined);
		mockGetProcessEnv.mockReturnValue(undefined);
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

	afterEach(async () => {
		const { resetBootStateForTest } = await import("../api-registry");
		resetBootStateForTest();
	});

	it("throws BootFailureError with retryAfterSeconds when boot fails", async () => {
		mockApplyCompiledModuleSchema.mockReset();
		mockApplyCompiledModuleSchema.mockRejectedValueOnce(
			new Error("Connection refused"),
		);

		const { ensureBooted, BootFailureError, resetBootStateForTest } =
			await import("../api-registry");
		resetBootStateForTest();

		const err = await ensureBooted().catch((e) => e);
		expect(err).toBeInstanceOf(BootFailureError);
		expect(err.retryAfterSeconds).toBe(10);
		expect(err.cause.message).toBe("Connection refused");
	});

	it("throttles retry attempts during backoff period", async () => {
		vi.useFakeTimers();

		mockApplyCompiledModuleSchema.mockRejectedValue(
			new Error("Database unavailable"),
		);
		const { ensureBooted, BootFailureError, resetBootStateForTest } =
			await import("../api-registry");
		resetBootStateForTest();

		await expect(ensureBooted()).rejects.toThrow();

		mockApplyCompiledModuleSchema.mockResolvedValue(undefined);
		vi.advanceTimersByTime(5000);

		const err = await ensureBooted().catch((e) => e);
		expect(err).toBeInstanceOf(BootFailureError);
		expect(err.message).toContain("retry throttled");
		expect(err.retryAfterSeconds).toBeGreaterThan(0);
		expect(err.retryAfterSeconds).toBeLessThanOrEqual(5);

		expect(mockApplyCompiledModuleSchema).toHaveBeenCalledTimes(1);

		vi.useRealTimers();
	});

	it("allows retry after backoff period expires", async () => {
		vi.useFakeTimers();

		mockApplyCompiledModuleSchema.mockRejectedValueOnce(
			new Error("Temporary failure"),
		);
		const { ensureBooted, resetBootStateForTest } = await import(
			"../api-registry"
		);
		resetBootStateForTest();

		await expect(ensureBooted()).rejects.toThrow();

		mockApplyCompiledModuleSchema.mockResolvedValue(undefined);
		mockBoot.mockResolvedValue(undefined);
		vi.advanceTimersByTime(11000);

		await expect(ensureBooted()).resolves.toBeDefined();

		vi.useRealTimers();
	});

	it("respects BOOT_FAILURE_BACKOFF_SECONDS environment variable", async () => {
		mockGetProcessEnv.mockImplementation((name: string) => {
			if (name === "BOOT_FAILURE_BACKOFF_SECONDS") return "30";
			return undefined;
		});
		mockApplyCompiledModuleSchema.mockRejectedValueOnce(new Error("Failure"));
		const { ensureBooted, BootFailureError, resetBootStateForTest } =
			await import("../api-registry");
		resetBootStateForTest();

		const err = await ensureBooted().catch((e) => e);
		expect(err).toBeInstanceOf(BootFailureError);
		expect(err.retryAfterSeconds).toBe(30);
	});

	it("uses default backoff when BOOT_FAILURE_BACKOFF_SECONDS is invalid", async () => {
		mockGetProcessEnv.mockImplementation((name: string) => {
			if (name === "BOOT_FAILURE_BACKOFF_SECONDS") return "invalid";
			return undefined;
		});
		mockApplyCompiledModuleSchema.mockRejectedValueOnce(new Error("Failure"));
		const { ensureBooted, BootFailureError, resetBootStateForTest } =
			await import("../api-registry");
		resetBootStateForTest();

		const err = await ensureBooted().catch((e) => e);
		expect(err).toBeInstanceOf(BootFailureError);
		expect(err.retryAfterSeconds).toBe(10);
	});
});
