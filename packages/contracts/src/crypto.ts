import { createHash, createHmac } from "node:crypto";
import type { JsonValue } from "./json-value";
import { canonicalJson } from "./serialize";

export function sha256Domain(
	domain: string,
	version: number,
	value: JsonValue,
): string {
	if (version !== 1) {
		throw new RangeError(`Unsupported ${domain} hash version.`);
	}
	return createHash("sha256")
		.update(`${domain}\0v${version}\0`)
		.update(canonicalJson(value))
		.digest("hex");
}

export function hmacSha256Domain(
	key: string,
	domain: string,
	version: number,
	value: JsonValue,
): string {
	return createHmac("sha256", key)
		.update(`${domain}\0v${version}\0`)
		.update(canonicalJson(value))
		.digest("hex");
}

export function requireDigestKey(key: string, label: string): void {
	if (new TextEncoder().encode(key).byteLength < 32) {
		throw new Error(`${label} must be at least 32 bytes.`);
	}
}
