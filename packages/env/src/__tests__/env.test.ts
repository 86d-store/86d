import { describe, expect, it, vi } from "vitest";

describe("env", () => {
	it("rejects production without an auth secret", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
			}),
		).toThrow(/BETTER_AUTH_SECRET/);
	});

	it("rejects a production auth secret shorter than 32 characters", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
				BETTER_AUTH_SECRET: "short-production-secret",
			}),
		).toThrow(/at least 32 characters/);
	});

	it("rejects Better Auth's predictable production default", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
				BETTER_AUTH_SECRET: "better-auth-secret-12345678901234567890",
			}),
		).toThrow(/placeholder or default/);
	});

	it("rejects the repository's Docker development secret in production", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
				BETTER_AUTH_SECRET: "docker-dev-secret-change-in-production",
			}),
		).toThrow(/placeholder or default/);
	});

	it.each(["development", "test"] as const)(
		"uses an explicit local-only auth secret in %s",
		async (nodeEnv) => {
			const mod = await import("../index");

			const parsed = mod.parseEnvironment({ NODE_ENV: nodeEnv });

			expect(parsed.BETTER_AUTH_SECRET).toBe(
				"86d-local-development-only-better-auth-secret",
			);
		},
	);

	it("rejects the local-only auth secret in production", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
				BETTER_AUTH_SECRET: "86d-local-development-only-better-auth-secret",
			}),
		).toThrow(/local-only/);
	});

	it("rejects a low-entropy production auth secret", async () => {
		const mod = await import("../index");

		expect(() =>
			mod.parseEnvironment({
				NODE_ENV: "production",
				BETTER_AUTH_SECRET: "a".repeat(64),
			}),
		).toThrow(/low entropy/);
	});

	it("preserves an acceptable production auth secret", async () => {
		const mod = await import("../index");
		const secret = "vG9!xQ2#pL7@rT4$wY8%mN6&kC3*zF5+uH1";

		const parsed = mod.parseEnvironment({
			NODE_ENV: "production",
			BETTER_AUTH_SECRET: secret,
		});

		expect(parsed.BETTER_AUTH_SECRET).toBe(secret);
	});

	it("exports a validated env object with defaults", async () => {
		const mod = await import("../index");
		const env = mod.default;

		expect(env).toBeDefined();
		expect(env.NODE_ENV).toBeTypeOf("string");
		expect(["development", "production", "test"]).toContain(env.NODE_ENV);
	});

	it("provides default STORE_ID", async () => {
		const mod = await import("../index");
		const env = mod.default;

		expect(env.STORE_ID).toBeTypeOf("string");
		expect(env.STORE_ID.length).toBeGreaterThan(0);
	});

	it("provides default 86D_API_URL", async () => {
		const mod = await import("../index");
		const env = mod.default;

		expect(env["86D_API_URL"]).toBe("https://api.86d.app");
	});

	it("keeps managed workload identity distinct from legacy Store identity", async () => {
		const mod = await import("../index");
		const env = mod.default;

		if (!process.env["86D_STORE_ID"]) {
			expect(env["86D_STORE_ID"]).toBeUndefined();
		}
		if (!process.env["86D_WORKLOAD_CREDENTIAL"]) {
			expect(env["86D_WORKLOAD_CREDENTIAL"]).toBeUndefined();
		}
	});

	it("accepts only the explicit Managed Runtime Diagnostics opt-in", async () => {
		const previous = process.env["86D_TELEMETRY"];
		try {
			process.env["86D_TELEMETRY"] = "managed-runtime-diagnostics-v1";
			vi.resetModules();

			const mod = await import("../index");

			expect(mod.default["86D_TELEMETRY"]).toBe(
				"managed-runtime-diagnostics-v1",
			);
		} finally {
			if (previous === undefined) {
				Reflect.deleteProperty(process.env, "86D_TELEMETRY");
			} else {
				process.env["86D_TELEMETRY"] = previous;
			}
			vi.resetModules();
		}
	});

	it("prefers managed Store identity at the shared Runtime boundary", async () => {
		const legacyStoreId = "784d078d-9202-43e7-9624-63a92f479331";
		const managedStoreId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
		const previousLegacy = process.env.STORE_ID;
		const previousManaged = process.env["86D_STORE_ID"];
		try {
			process.env.STORE_ID = legacyStoreId;
			process.env["86D_STORE_ID"] = managedStoreId;
			vi.resetModules();

			const mod = await import("../index");

			expect(mod.default.STORE_ID).toBe(managedStoreId);
			expect(mod.default["86D_STORE_ID"]).toBe(managedStoreId);
		} finally {
			if (previousLegacy === undefined) {
				Reflect.deleteProperty(process.env, "STORE_ID");
			} else {
				process.env.STORE_ID = previousLegacy;
			}
			if (previousManaged === undefined) {
				Reflect.deleteProperty(process.env, "86D_STORE_ID");
			} else {
				process.env["86D_STORE_ID"] = previousManaged;
			}
			vi.resetModules();
		}
	});

	it("leaves optional fields as undefined when not set", async () => {
		const mod = await import("../index");
		const env = mod.default;

		// This should be undefined unless set in the actual environment.
		if (!process.env.RESEND_API_KEY) {
			expect(env.RESEND_API_KEY).toBeUndefined();
		}
	});

	it("exports the Env type", async () => {
		const mod = await import("../index");
		// Type check - the default export should match Env shape
		const env: typeof mod.default = mod.default;
		expect(env).toBeDefined();
	});
});
