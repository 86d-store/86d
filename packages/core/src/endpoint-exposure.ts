import type { Endpoint } from "better-call";
import type { Module } from "./types/module";

/**
 * Who an endpoint is reachable by, declared at construction.
 *
 * The request path is not authority. A provider webhook and a shopper endpoint
 * are both registered under `endpoints.store` and both answer a POST from the
 * public internet; only this declaration tells them apart, so authentication,
 * rate limiting, and audit read it rather than inspecting the URL.
 *
 * - `public`: unauthenticated and safe for anyone, including crawlers.
 * - `shopper`: the Storefront surface, optionally carrying a shopper session.
 * - `admin`: Store Admin, requiring an authenticated operator.
 * - `provider_webhook`: an external provider posting a signed event. Never
 *   session-authenticated, and it must fail closed without verification
 *   material.
 * - `internal`: reachable only by the Store Runtime or its operator.
 */
export type EndpointExposure =
	| "public"
	| "shopper"
	| "admin"
	| "provider_webhook"
	| "internal";

export const ENDPOINT_EXPOSURES = [
	"public",
	"shopper",
	"admin",
	"provider_webhook",
	"internal",
] as const satisfies readonly EndpointExposure[];

const EXPOSURES = new Set<string>(ENDPOINT_EXPOSURES);

export function isEndpointExposure(value: unknown): value is EndpointExposure {
	return typeof value === "string" && EXPOSURES.has(value);
}

/** Options carrying an exposure declaration. */
export interface EndpointExposureOptions {
	exposure?: EndpointExposure | undefined;
}

type EndpointWithExposure = Endpoint & {
	options?: { exposure?: unknown } | undefined;
};

/**
 * Read an endpoint's declared exposure.
 *
 * Every endpoint built through `createStoreEndpoint` or `createAdminEndpoint`
 * carries one. A missing or unrecognized value is a registration defect, not a
 * reason to guess: guessing is how a provider webhook ends up treated as a
 * shopper endpoint.
 */
export function endpointExposure(endpoint: Endpoint): EndpointExposure {
	const declared = (endpoint as EndpointWithExposure).options?.exposure;
	if (!isEndpointExposure(declared)) {
		throw new Error(
			`Endpoint "${endpoint.path ?? "<unknown>"}" does not declare a valid exposure.`,
		);
	}
	return declared;
}

export interface EndpointExposureEntry {
	moduleId: string;
	surface: "store" | "admin";
	path: string;
	exposure: EndpointExposure;
}

export interface EndpointExposureViolation {
	moduleId: string;
	surface: "store" | "admin";
	path: string;
	declared: unknown;
	reason: "missing" | "unrecognized" | "surface_mismatch";
}

/**
 * Collect every registered endpoint's declared exposure and report the ones
 * that cannot be resolved. Callers decide whether to fail the boot or report.
 */
export function collectEndpointExposures(modules: readonly Module[]): {
	entries: EndpointExposureEntry[];
	violations: EndpointExposureViolation[];
} {
	const entries: EndpointExposureEntry[] = [];
	const violations: EndpointExposureViolation[] = [];

	for (const mod of modules) {
		for (const surface of ["store", "admin"] as const) {
			const endpoints = mod.endpoints?.[surface];
			if (!endpoints) continue;
			for (const [path, endpoint] of Object.entries(endpoints)) {
				const declared = (endpoint as EndpointWithExposure).options?.exposure;
				if (declared === undefined) {
					violations.push({
						moduleId: mod.id,
						surface,
						path,
						declared,
						reason: "missing",
					});
					continue;
				}
				if (!isEndpointExposure(declared)) {
					violations.push({
						moduleId: mod.id,
						surface,
						path,
						declared,
						reason: "unrecognized",
					});
					continue;
				}
				// The admin surface is authenticated by construction. Declaring a
				// different exposure there would make one of the two a lie.
				if (surface === "admin" && declared !== "admin") {
					violations.push({
						moduleId: mod.id,
						surface,
						path,
						declared,
						reason: "surface_mismatch",
					});
					continue;
				}
				if (surface === "store" && declared === "admin") {
					violations.push({
						moduleId: mod.id,
						surface,
						path,
						declared,
						reason: "surface_mismatch",
					});
					continue;
				}
				entries.push({ moduleId: mod.id, surface, path, exposure: declared });
			}
		}
	}

	return { entries, violations };
}

export function formatEndpointExposureViolations(
	violations: readonly EndpointExposureViolation[],
): string[] {
	return violations.map((violation) => {
		const where = `${violation.moduleId} ${violation.surface} "${violation.path}"`;
		if (violation.reason === "missing") {
			return `${where} declares no exposure.`;
		}
		if (violation.reason === "unrecognized") {
			return `${where} declares unrecognized exposure ${JSON.stringify(violation.declared)}.`;
		}
		return `${where} declares exposure ${JSON.stringify(violation.declared)}, which its surface cannot serve.`;
	});
}

/**
 * Resolve a concrete request path to a declared exposure.
 *
 * Patterns use `:param` for one segment, matching the router. The longest
 * literal match wins so a fixed segment always beats a parameter.
 */
export function createEndpointExposureResolver(
	entries: readonly EndpointExposureEntry[],
): (path: string) => EndpointExposure | undefined {
	const compiled = entries
		.map((entry) => ({
			segments: entry.path.replace(/^\//, "").split("/").filter(Boolean),
			exposure: entry.exposure,
		}))
		.sort(
			(left, right) =>
				right.segments.filter((segment) => !segment.startsWith(":")).length -
				left.segments.filter((segment) => !segment.startsWith(":")).length,
		);

	return (path: string) => {
		const segments = path.replace(/^\//, "").split("/").filter(Boolean);
		for (const candidate of compiled) {
			if (candidate.segments.length !== segments.length) continue;
			const matched = candidate.segments.every((segment, index) => {
				const value = segments[index];
				return segment.startsWith(":")
					? value !== undefined && value.length > 0
					: segment === value;
			});
			if (matched) return candidate.exposure;
		}
		return undefined;
	};
}
