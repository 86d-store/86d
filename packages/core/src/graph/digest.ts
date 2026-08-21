import { createHash } from "node:crypto";

/** Deterministic JSON stringify with sorted object keys. */
export function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(sortValue);
	const record = value as Record<string, unknown>;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(record).sort()) {
		sorted[key] = sortValue(record[key]);
	}
	return sorted;
}

export function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

export function digestObject(value: unknown): string {
	return sha256Hex(stableStringify(value));
}
