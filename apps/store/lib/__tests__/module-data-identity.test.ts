import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockModuleUpsert = vi.hoisted(() => vi.fn());
const capturedRegistryConfig = vi.hoisted(
	() => ({ value: undefined }) as { value: RegistryConfig | undefined },
);
const dataServiceConstructions = vi.hoisted(
	() => [] as Array<Record<string, unknown>>,
);

vi.mock("db", () => ({
	db: { module: { upsert: mockModuleUpsert } },
	Prisma: { JsonNull: null },
}));

vi.mock("env", () => ({
	default: { STORE_ID: "11111111-1111-4111-8111-111111111111" },
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
	ModuleRegistry: class {
		constructor(_modules: unknown, _storeId: string, config: RegistryConfig) {
			capturedRegistryConfig.value = config;
		}
		isReady() {
			return true;
		}
		async boot() {
			return undefined;
		}
		getEventBus() {
			return undefined;
		}
	},
}));

vi.mock("@86d-app/runtime/universal-data-service", () => ({
	UniversalDataService: class {
		readonly config: Record<string, unknown>;
		constructor(config: Record<string, unknown>) {
			this.config = config;
			dataServiceConstructions.push(config);
		}
		async transaction() {
			return undefined;
		}
	},
}));

vi.mock("@86d-app/sdk/get-store-config", () => ({
	getStoreConfig: vi.fn().mockResolvedValue({ name: "Test Store" }),
}));

vi.mock("@86d-app/sdk/load-from-template", () => ({
	loadFromTemplate: vi.fn().mockReturnValue({}),
}));

vi.mock("~/lib/template-path", () => ({
	resolveTemplatePath: vi.fn().mockReturnValue("/templates/brisa"),
}));

// ── Types ─────────────────────────────────────────────────────────────────────

type ModuleIdentity = {
	storeId: string;
	moduleId: string;
	moduleDbId: string;
};

type RegistryConfig = {
	createDataService: (params: ModuleIdentity) => unknown;
	createTransactionRunner?: (params: ModuleIdentity) => unknown;
};

// ── Import under test ─────────────────────────────────────────────────────────

import { ensureBooted } from "../api-registry";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const MODULE_DB_ID = "22222222-2222-4222-8222-222222222222";

async function registryConfig(): Promise<RegistryConfig> {
	await ensureBooted();
	const config = capturedRegistryConfig.value;
	if (!config) throw new Error("ModuleRegistry config was not captured.");
	return config;
}

describe("Module data identity", () => {
	beforeEach(() => {
		dataServiceConstructions.length = 0;
		mockModuleUpsert.mockResolvedValue({ id: MODULE_DB_ID });
	});

	it("gives the data service the logical Module ID, not the persisted UUID", async () => {
		const config = await registryConfig();

		config.createDataService({
			storeId: STORE_ID,
			moduleId: "inventory",
			moduleDbId: MODULE_DB_ID,
		});

		expect(dataServiceConstructions).toHaveLength(1);
		expect(dataServiceConstructions[0]).toMatchObject({
			storeId: STORE_ID,
			moduleId: "inventory",
			moduleDbId: MODULE_DB_ID,
		});
	});

	it("supplies a transaction runner bound to the same Module identity", async () => {
		const config = await registryConfig();
		const identity = {
			storeId: STORE_ID,
			moduleId: "orders",
			moduleDbId: "44444444-4444-4444-8444-444444444444",
		};

		expect(config.createTransactionRunner).toBeTypeOf("function");
		const data = config.createDataService(identity);
		const runner = config.createTransactionRunner?.(identity);

		// One owner-scoped service backs both seams, so owner state and its
		// durable events commit through a single database transaction.
		expect(runner).toBe(data);
		expect(dataServiceConstructions).toHaveLength(1);
		expect(dataServiceConstructions[0]).toMatchObject(identity);
	});

	it("keeps each Module's data seam separate", async () => {
		const config = await registryConfig();

		const auditLog = config.createDataService({
			storeId: STORE_ID,
			moduleId: "audit-log",
			moduleDbId: "33333333-3333-4333-8333-333333333333",
		});
		const products = config.createDataService({
			storeId: STORE_ID,
			moduleId: "products",
			moduleDbId: "55555555-5555-4555-8555-555555555555",
		});

		expect(auditLog).not.toBe(products);
		expect(dataServiceConstructions.map((c) => c.moduleId)).toEqual([
			"audit-log",
			"products",
		]);
	});
});
