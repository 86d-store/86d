import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const secretCanary = "sk_live_remote_settings_must_not_be_applied";

const mocks = vi.hoisted(() => ({
	moduleOptions: undefined as
		| Record<string, Record<string, unknown>>
		| undefined,
	registerNotificationHandlers: vi.fn(),
	registerWebhookHandlers: vi.fn(),
}));

vi.mock("db", () => ({
	db: {
		module: { upsert: vi.fn() },
	},
	Prisma: { JsonNull: null },
}));

vi.mock("env", () => ({
	default: { STORE_ID: "test-store-id" },
}));

vi.mock("utils/logger", () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../generated/api", () => ({ modules: [] }));

vi.mock("@86d-app/runtime/registry", () => ({
	ModuleRegistry: vi.fn(
		function ModuleRegistryMock(_modules, storeId, config, moduleOptions) {
			mocks.moduleOptions = moduleOptions;
			return {
				isReady: () => false,
				boot: () => config.resolveStoreId(storeId),
				getEventBus: () => ({}),
			};
		},
	),
}));

vi.mock("@86d-app/runtime/universal-data-service", () => ({
	UniversalDataService: vi.fn(),
}));

vi.mock("@86d-app/sdk/get-store-config", () => ({
	getStoreConfig: vi.fn().mockResolvedValue({
		name: "Managed Store",
		moduleOptions: {
			"@86d-app/stripe": { secretKey: secretCanary },
		},
		notificationSettings: {
			fromAddress: `Attacker <${secretCanary}@example.com>`,
			adminEmail: `${secretCanary}@example.com`,
			events: { "order.placed": false },
		},
	}),
	loadFromTemplate: vi.fn().mockReturnValue({
		name: "Standalone Template",
		moduleOptions: {
			"@86d-app/cart": { maxItemsPerCart: 25 },
		},
		notificationSettings: {
			fromAddress: "Store <orders@example.com>",
			adminEmail: "owner@example.com",
			events: { "payment.failed": false },
		},
	}),
}));

// api-registry.ts:76 also calls loadFromTemplate; the pre-split whole-module mock
// covered it in the same factory.
vi.mock("@86d-app/sdk/load-from-template", () => ({
	loadFromTemplate: vi.fn().mockReturnValue({
		name: "Standalone Template",
		moduleOptions: {
			"@86d-app/cart": { maxItemsPerCart: 25 },
		},
		notificationSettings: {
			fromAddress: "Store <orders@example.com>",
			adminEmail: "owner@example.com",
			events: { "payment.failed": false },
		},
	}),
}));

vi.mock("~/lib/template-path", () => ({
	resolveTemplatePath: vi.fn().mockReturnValue("/templates/brisa/config.json"),
}));

vi.mock("~/lib/notifications", () => ({
	registerNotificationHandlers: mocks.registerNotificationHandlers,
}));

vi.mock("~/lib/webhook-subscriber", () => ({
	registerWebhookHandlers: mocks.registerWebhookHandlers,
}));

vi.mock("emails", () => ({ default: { emails: { send: vi.fn() } } }));

vi.mock("lib/notification-settings", () => ({
	NOTIFICATION_EVENT_TYPES: ["order.placed", "payment.failed"],
	parseNotificationSettings: (value: unknown) => value,
	isEventEnabled: (
		settings: { events?: Record<string, boolean> },
		eventType: string,
	) => settings.events?.[eventType] !== false,
}));

describe("Store Runtime remote config containment", () => {
	const originalResendApiKey = process.env.RESEND_API_KEY;

	beforeAll(() => {
		process.env.RESEND_API_KEY = "configured-for-test";
	});

	afterAll(() => {
		if (originalResendApiKey === undefined) {
			delete process.env.RESEND_API_KEY;
		} else {
			process.env.RESEND_API_KEY = originalResendApiKey;
		}
	});

	it("uses only Store-owned template settings when booting modules and notifications", async () => {
		const { ensureBooted } = await import("../api-registry");

		await ensureBooted();

		expect(mocks.moduleOptions).toEqual({
			"@86d-app/cart": { maxItemsPerCart: 25 },
		});
		expect(JSON.stringify(mocks.moduleOptions)).not.toContain(secretCanary);

		expect(mocks.registerNotificationHandlers).toHaveBeenCalledOnce();
		const [, , notificationConfig, enabledEvents] =
			mocks.registerNotificationHandlers.mock.calls[0] ?? [];
		expect(notificationConfig).toEqual({
			storeName: "Managed Store",
			fromAddress: "Store <orders@example.com>",
			adminEmail: "owner@example.com",
		});
		expect(enabledEvents).toEqual(new Set(["order.placed"]));
		expect(JSON.stringify(notificationConfig)).not.toContain(secretCanary);
	});

	it("has no production path from a remote config DTO into Store-owned settings", () => {
		const remoteDtoSource = readFileSync(
			resolve(
				import.meta.dirname,
				"../../../../packages/sdk/src/fetch-from-api.ts",
			),
			"utf8",
		);
		const registrySource = readFileSync(
			resolve(import.meta.dirname, "../api-registry.ts"),
			"utf8",
		);

		expect(remoteDtoSource).not.toMatch(
			/\b(moduleOptions|notificationSettings|providerSecrets|webhookSettings)\b/,
		);
		expect(registrySource).not.toMatch(
			/\bconfig\.(moduleOptions|notificationSettings)\b/,
		);
	});
});
