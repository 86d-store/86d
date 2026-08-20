import {
	DEFAULT_CONFIG,
	type RemoteStoreConfigV2,
	type StoreCommerceAvailability,
} from "@86d-app/sdk/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const sdkBoundary = vi.hoisted(() => ({
	getStoreConfig: vi.fn(),
}));

vi.mock("@86d-app/sdk/get-store-config", async (importOriginal) => {
	const sdk =
		await importOriginal<typeof import("@86d-app/sdk/get-store-config")>();
	return { ...sdk, getStoreConfig: sdkBoundary.getStoreConfig };
});

import {
	evaluateManagedCommerceConfig,
	isManagedStoreRuntime,
	resolveStoreCommerceGate,
} from "../store-commerce-availability";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function managedConfig(
	commerceAvailability: StoreCommerceAvailability,
): RemoteStoreConfigV2 {
	const {
		billing: _billing,
		moduleOptions: _moduleOptions,
		notificationSettings: _notificationSettings,
		...presentation
	} = DEFAULT_CONFIG;
	return {
		...presentation,
		theme: "brisa",
		favicon: "/assets/favicon.svg",
		modules: ["@86d-app/cart"],
		contractVersion: 2,
		entitlement: null,
		commerceAvailability,
	};
}

afterEach(() => {
	vi.unstubAllEnvs();
	sdkBoundary.getStoreConfig.mockReset();
});

describe("managed Store Runtime detection", () => {
	it.each([
		["86D_STORE_ID", "store_123"],
		["86D_WORKLOAD_CREDENTIAL", "workload-secret"],
	])("treats %s as an explicit managed signal", (name, value) => {
		expect(isManagedStoreRuntime({ [name]: value })).toBe(true);
	});

	it("keeps a standalone Store with only local identity independent of 86d.app", () => {
		expect(isManagedStoreRuntime({ STORE_ID: "local-store" })).toBe(false);
	});

	it("ignores blank or whitespace-only managed settings", () => {
		expect(
			isManagedStoreRuntime({
				"86D_STORE_ID": " ",
				"86D_WORKLOAD_CREDENTIAL": "\t",
			}),
		).toBe(false);
	});
});

describe("Store-scoped commerce availability", () => {
	it("allows an active Store only until its exact recheck deadline", () => {
		const config = managedConfig({
			version: 1,
			available: true,
			reason: "entitlement_active",
			evaluatedAt: "2026-08-13T11:59:00.000Z",
			recheckAt: "2026-08-13T12:00:01.000Z",
		});

		expect(evaluateManagedCommerceConfig(config, NOW)).toEqual({
			managed: true,
			available: true,
			reason: "entitlement_available",
		});
		expect(
			evaluateManagedCommerceConfig(
				config,
				new Date("2026-08-13T12:00:01.000Z"),
			),
		).toEqual({
			managed: true,
			available: false,
			reason: "entitlement_stale",
		});
	});

	it.each([
		"entitlement_suspended",
		"entitlement_destroyed",
		"entitlement_missing",
		"entitlement_invalid",
		"entitlement_reconciliation_required",
	] as const)("fails closed for %s", (reason) => {
		const config = managedConfig({
			version: 1,
			available: false,
			reason,
			evaluatedAt: "2026-08-13T11:59:00.000Z",
		});

		expect(evaluateManagedCommerceConfig(config, NOW)).toEqual({
			managed: true,
			available: false,
			reason: "entitlement_unavailable",
		});
	});

	it.each([
		{ status: "active", isActive: true, expected: true },
		{ status: "trialing", isActive: true, expected: true },
		{ status: "past_due", isActive: true, expected: false },
		{ status: "active", isActive: false, expected: false },
	] as const)(
		"contains legacy billing unless active and current: $status/$isActive",
		({ status, isActive, expected }) => {
			const result = evaluateManagedCommerceConfig(
				{
					...DEFAULT_CONFIG,
					billing: {
						plan: "legacy",
						status,
						isActive,
						periodEnd: "2026-08-14T12:00:00.000Z",
					},
				},
				NOW,
			);

			expect(result.available).toBe(expected);
		},
	);
});

describe("Store Runtime commerce gate resolution", () => {
	it("does not contact 86d.app for a standalone Store Runtime", async () => {
		vi.stubEnv("86D_STORE_ID", "");
		vi.stubEnv("86D_WORKLOAD_CREDENTIAL", "");

		await expect(resolveStoreCommerceGate()).resolves.toEqual({
			managed: false,
			available: true,
			reason: "standalone",
		});
		expect(sdkBoundary.getStoreConfig).not.toHaveBeenCalled();
	});

	it("fails managed commerce closed when 86d.app cannot be reached", async () => {
		vi.stubEnv("86D_STORE_ID", "store_123");
		sdkBoundary.getStoreConfig.mockRejectedValueOnce(
			new Error("control plane unavailable"),
		);

		await expect(resolveStoreCommerceGate()).resolves.toEqual({
			managed: true,
			available: false,
			reason: "configuration_unavailable",
		});
		expect(sdkBoundary.getStoreConfig).toHaveBeenCalledOnce();
	});
});
