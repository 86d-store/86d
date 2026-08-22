import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
	collectEndpointExposures,
	createEndpointExposureResolver,
	type EndpointExposureEntry,
	formatEndpointExposureViolations,
} from "../endpoint-exposure";
import type { Module } from "../types/module";

// Every first-party Module in the repository, instantiated from source. This is
// the registered endpoint surface, not a sample of it.

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
);
const modulesRoot = resolve(repositoryRoot, "modules");
const moduleNames = readdirSync(modulesRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

let modules: Module[] = [];
let entries: EndpointExposureEntry[] = [];
let violations: ReturnType<typeof collectEndpointExposures>["violations"] = [];
let providerWebhooks: EndpointExposureEntry[] = [];

beforeAll(async () => {
	modules = await Promise.all(
		moduleNames.map(async (name) => {
			const loaded = (await import(
				/* @vite-ignore */ resolve(modulesRoot, name, "src/index.ts")
			)) as { default: (options?: unknown) => Module };
			return loaded.default({});
		}),
	);
	const collected = collectEndpointExposures(modules);
	entries = collected.entries;
	violations = collected.violations;
	providerWebhooks = entries.filter(
		(entry) => entry.exposure === "provider_webhook",
	);
}, 120_000);

describe("registered endpoint exposure", () => {
	it("covers every first-party Module", () => {
		expect(modules).toHaveLength(moduleNames.length);
		expect(moduleNames.length).toBeGreaterThanOrEqual(100);
	});

	it("resolves a declared exposure for every registered endpoint", () => {
		expect(formatEndpointExposureViolations(violations)).toEqual([]);
		expect(entries.length).toBeGreaterThan(1_000);
	});

	it("declares every admin endpoint as admin and no store endpoint as admin", () => {
		const admin = entries.filter((entry) => entry.surface === "admin");
		expect(admin.length).toBeGreaterThan(0);
		expect(admin.every((entry) => entry.exposure === "admin")).toBe(true);
		expect(
			entries.filter(
				(entry) => entry.surface === "store" && entry.exposure === "admin",
			),
		).toEqual([]);
	});

	it("declares every provider webhook rather than leaving it on the shopper default", () => {
		// The path convention is a migration ratchet, not the authority. The
		// runtime reads the declaration; this keeps a new webhook from silently
		// shipping on the shopper default.
		const undeclared = entries.filter(
			(entry) =>
				/webhook/i.test(entry.path) && entry.exposure !== "provider_webhook",
		);

		expect(undeclared).toEqual([]);
		// Four more are registered only once their Integration is configured.
		expect(providerWebhooks.length).toBeGreaterThanOrEqual(19);
	});

	it("never resolves a provider webhook to the shopper surface", () => {
		const resolveExposure = createEndpointExposureResolver(entries);
		for (const webhook of providerWebhooks) {
			expect(resolveExposure(webhook.path)).toBe("provider_webhook");
		}
	});

	it("keeps provider webhooks off the admin surface", () => {
		expect(
			providerWebhooks.filter((entry) => entry.surface === "admin"),
		).toEqual([]);
	});
});

// ── Fail-closed behavior ──────────────────────────────────────────────────────

type Invocation = { path: string; status: number | "threw" };

async function invokeWithoutVerification(
	entry: EndpointExposureEntry,
): Promise<Invocation> {
	const mod = modules.find((candidate) => candidate.id === entry.moduleId);
	const endpoint = mod?.endpoints?.store?.[entry.path];
	if (!endpoint) return { path: entry.path, status: "threw" };

	const body = { type: "test.event", id: "evt_1", data: {} };
	const request = new Request(`https://store.example${entry.path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

	try {
		const response = (await endpoint({
			request,
			headers: request.headers,
			body,
			asResponse: true,
		})) as Response;
		return { path: entry.path, status: response.status };
	} catch {
		// A throw is also a refusal: nothing was accepted.
		return { path: entry.path, status: "threw" };
	}
}

describe("provider webhooks fail closed without verification configuration", () => {
	it("accepts no provider event when no verification material is configured", async () => {
		const results = await Promise.all(
			providerWebhooks.map(invokeWithoutVerification),
		);

		const accepted = results.filter(
			(result) => typeof result.status === "number" && result.status < 300,
		);
		expect(accepted).toEqual([]);
	}, 60_000);

	it("reports unavailable rather than pretending success", async () => {
		// PayPal and Braintree already had the correct shape. Pin it so a later
		// change cannot quietly turn a missing secret into an accepted event.
		// (`/shipping/webhook` is registered only when EasyPost is configured, so
		// it is not part of the default surface.)
		const pinned = providerWebhooks.filter((entry) =>
			["/paypal/webhook", "/braintree/webhook"].includes(entry.path),
		);
		expect(
			pinned.map((entry) => entry.path).sort((a, b) => a.localeCompare(b)),
		).toEqual(["/braintree/webhook", "/paypal/webhook"]);

		for (const entry of pinned) {
			const result = await invokeWithoutVerification(entry);
			expect(result.path).toBe(entry.path);
			expect(result.status === 503 || result.status === "threw").toBe(true);
		}
	}, 30_000);

	it("gives every provider webhook source an unavailable path", () => {
		// The behavioral check above cannot reach an endpoint whose Integration is
		// registered only when configured, and a body-schema rejection can mask a
		// missing guard. This reads the sources directly so neither gap hides one.
		const withoutFailClosed = moduleNames
			.flatMap((name) => {
				const endpointsRoot = resolve(modulesRoot, name, "src/store/endpoints");
				let files: string[] = [];
				try {
					files = readdirSync(endpointsRoot, { recursive: true })
						.map(String)
						.filter((file) => /webhook.*\.tsx?$/.test(file));
				} catch {
					return [];
				}
				return files.map((file) => ({
					file: `modules/${name}/src/store/endpoints/${file}`,
					contents: readFileSync(resolve(endpointsRoot, file), "utf8"),
				}));
			})
			.filter(({ contents }) => contents.includes("createStoreEndpoint("))
			.filter(({ contents }) => !contents.includes("status: 503"))
			.map(({ file }) => file);

		expect(withoutFailClosed).toEqual([]);
	});
});
