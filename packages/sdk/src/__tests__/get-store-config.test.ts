import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	readProcessEnv,
	restoreProcessEnv,
	setProcessEnv,
	snapshotProcessEnv,
} from "env/process-env";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { getStoreConfig } from "../get-store-config";
import { DEFAULT_CONFIG } from "../types";

const TMP_DIR = join(import.meta.dirname, "__tmp_config_test__");
const VALID_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

beforeAll(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
	if (existsSync(TMP_DIR)) {
		rmSync(TMP_DIR, { recursive: true });
	}
});

describe("getStoreConfig", () => {
	const originalFetch = globalThis.fetch;
	const originalEnv = snapshotProcessEnv();

	beforeEach(() => {
		for (const key of [
			"86D_API_URL",
			"86D_STORE_ID",
			"86D_WORKLOAD_CREDENTIAL",
		] as const) {
			Reflect.deleteProperty(readProcessEnv(), key);
		}
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		restoreProcessEnv(originalEnv);
	});

	it("loads from template when no managed workload is configured", async () => {
		const configPath = join(TMP_DIR, "template-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "template",
				name: "Template Store",
				favicon: "/favicon.ico",
				icon: DEFAULT_CONFIG.icon,
				logo: DEFAULT_CONFIG.logo,
				variables: DEFAULT_CONFIG.variables,
			}),
		);

		const config = await getStoreConfig({ templatePath: configPath });
		expect(config.theme).toBe("template");
		expect(config.name).toBe("Template Store");
	});

	it("throws when no managed workload and no templatePath", async () => {
		await expect(getStoreConfig()).rejects.toThrow(
			"Store config requires a managed workload credential trio or templatePath",
		);
	});

	it("uses managed workload exchange for a newly provisioned Store", async () => {
		const credentialId = "86d_wc_abcdefghijklmnopqrstuvwx";
		const credentialSecret = "s".repeat(43);
		setProcessEnv("86D_STORE_ID", VALID_UUID);
		setProcessEnv("86D_API_URL", "https://api.86d.app");
		setProcessEnv(
			"86D_WORKLOAD_CREDENTIAL",
			`${credentialId}.${credentialSecret}`,
		);
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					access_token: "scoped-config-token",
					token_type: "Bearer",
					expires_in: 300,
					scope: "runtime.config:read",
				}),
			)
			.mockResolvedValueOnce(
				Response.json({
					theme: "managed",
					name: "Managed Store",
					favicon: "/managed.ico",
					icon: DEFAULT_CONFIG.icon,
					logo: DEFAULT_CONFIG.logo,
					variables: DEFAULT_CONFIG.variables,
				}),
			);

		const config = await getStoreConfig();

		expect(config.name).toBe("Managed Store");
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		expect(globalThis.fetch).toHaveBeenNthCalledWith(
			1,
			"https://api.86d.app/api/oauth/token",
			expect.objectContaining({ method: "POST" }),
		);
		const configRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
			.calls[1];
		expect(configRequest?.[0].toString()).toBe(
			`https://api.86d.app/api/v1/stores/${VALID_UUID}`,
		);
		const requestHeaders = new Headers(
			(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]
				?.headers,
		);
		expect(requestHeaders.get("Authorization")).toBe(
			"Bearer scoped-config-token",
		);
	});

	it("fails closed on a compromised managed Control Plane config response", async () => {
		const secretCanary = "managed-provider-secret-must-not-escape";
		setProcessEnv("86D_STORE_ID", VALID_UUID);
		setProcessEnv("86D_API_URL", "https://api.86d.app");
		setProcessEnv(
			"86D_WORKLOAD_CREDENTIAL",
			`86d_wc_compromisedconfigclient1.${"c".repeat(43)}`,
		);
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					access_token: "scoped-config-token",
					token_type: "Bearer",
					expires_in: 300,
					scope: "runtime.config:read",
				}),
			)
			.mockResolvedValueOnce(
				Response.json({
					theme: "remote",
					name: "Compromised Store",
					favicon: "/remote.ico",
					icon: DEFAULT_CONFIG.icon,
					logo: DEFAULT_CONFIG.logo,
					notificationSettings: {
						fromAddress: `${secretCanary}@example.com`,
					},
					webhookSettings: { signingSecret: secretCanary },
				}),
			);

		let failure: unknown;
		try {
			await getStoreConfig();
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect(String(failure)).toContain("Invalid store config from 86d API");
		expect(String(failure)).not.toContain(secretCanary);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it("reuses one managed access token across sequential config reads", async () => {
		setProcessEnv("86D_STORE_ID", VALID_UUID);
		setProcessEnv("86D_API_URL", "https://api.86d.app");
		setProcessEnv(
			"86D_WORKLOAD_CREDENTIAL",
			`86d_wc_sequentialcacheclient001.${"q".repeat(43)}`,
		);
		globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
			const url = input instanceof Request ? input.url : input.toString();
			if (url.endsWith("/api/oauth/token")) {
				return Response.json({
					access_token: "shared-sequential-token",
					token_type: "Bearer",
					expires_in: 300,
					scope: "runtime.config:read",
				});
			}
			return Response.json({
				theme: "managed",
				name: "Managed Store",
				favicon: "/managed.ico",
				icon: DEFAULT_CONFIG.icon,
				logo: DEFAULT_CONFIG.logo,
				variables: DEFAULT_CONFIG.variables,
			});
		});

		await getStoreConfig();
		await getStoreConfig();

		const tokenExchanges = (
			globalThis.fetch as ReturnType<typeof vi.fn>
		).mock.calls.filter(([input]) =>
			input.toString().endsWith("/api/oauth/token"),
		);
		expect(tokenExchanges).toHaveLength(1);
		expect(globalThis.fetch).toHaveBeenCalledTimes(3);
	});

	it.each([
		[
			"revoked",
			async () => Response.json({ error: "invalid_client" }, { status: 401 }),
		],
		[
			"network failure",
			async () => Promise.reject(new Error("control plane unavailable")),
		],
	])(
		"fails closed on managed %s instead of loading a local template",
		async (_label, exchangeResult) => {
			const configPath = join(TMP_DIR, "managed-fail-closed.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					theme: "forbidden-fallback",
					name: "Must Not Load",
					favicon: "/fallback.ico",
					icon: DEFAULT_CONFIG.icon,
					logo: DEFAULT_CONFIG.logo,
					variables: DEFAULT_CONFIG.variables,
				}),
			);
			setProcessEnv("86D_STORE_ID", VALID_UUID);
			setProcessEnv("86D_API_URL", "https://api.86d.app");
			setProcessEnv(
				"86D_WORKLOAD_CREDENTIAL",
				`86d_wc_abcdefghijklmnopqrstuvwx.${"s".repeat(43)}`,
			);
			globalThis.fetch = vi.fn(exchangeResult);

			await expect(
				getStoreConfig({
					templatePath: configPath,
				}),
			).rejects.toThrow();
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		},
	);
});
