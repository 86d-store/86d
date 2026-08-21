import type { JsonValue } from "./json-value";

/**
 * Canonical wire serialization for digests and conformance fixtures.
 * Key order is sorted; object holes become null; no whitespace.
 * Any other serialization of the same logical value is noncanonical and rejected.
 */
export function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`)
		.join(",")}}`;
}

/** Parse JSON and re-emit canonical form; throws when the input is not canonical. */
export function parseCanonicalJson(text: string): JsonValue {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		throw new Error("Noncanonical serialization: invalid JSON.");
	}
	const asJson = toJsonValue(parsed);
	if (asJson === undefined) {
		throw new Error("Noncanonical serialization: unsupported JSON value.");
	}
	const canonical = canonicalJson(asJson);
	if (canonical !== text) {
		throw new Error(
			"Noncanonical serialization: bytes must match canonicalJson.",
		);
	}
	return asJson;
}

export function assertCanonicalJson(text: string): void {
	parseCanonicalJson(text);
}

export function toJsonValue(value: unknown): JsonValue | undefined {
	if (value === null) return null;
	if (
		typeof value === "boolean" ||
		typeof value === "string" ||
		(typeof value === "number" && Number.isFinite(value))
	) {
		return value;
	}
	if (Array.isArray(value)) {
		const result: JsonValue[] = [];
		for (const entry of value) {
			const converted = toJsonValue(entry);
			if (converted === undefined) return undefined;
			result.push(converted);
		}
		return result;
	}
	if (typeof value === "object") {
		const result: { [key: string]: JsonValue } = {};
		for (const [key, entry] of Object.entries(value)) {
			if (entry === undefined) continue;
			const converted = toJsonValue(entry);
			if (converted === undefined) return undefined;
			result[key] = converted;
		}
		return result;
	}
	return undefined;
}
