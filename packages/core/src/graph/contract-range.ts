import type { StableSemVer } from "../schema/declaration";
import { isStableSemVer, matchesCaret, parseStableSemVer } from "./semver";

/** Exact version or one caret range. Arrays elsewhere form a union of these. */
export type ContractRange = StableSemVer | `^${StableSemVer}`;

const CARET_RANGE = /^\^(\d+\.\d+\.\d+)$/;

export type ParsedContractRange =
	| Readonly<{ kind: "exact"; version: StableSemVer }>
	| Readonly<{ kind: "caret"; base: StableSemVer }>;

/** Parse one ContractRange token. Rejects wildcards, tags, inequalities, and nested unions. */
export function parseContractRange(
	value: string,
): ParsedContractRange | undefined {
	if (isStableSemVer(value)) {
		return { kind: "exact", version: value };
	}
	const caret = CARET_RANGE.exec(value);
	if (!caret?.[1] || !isStableSemVer(caret[1])) return undefined;
	return { kind: "caret", base: caret[1] as StableSemVer };
}

export function isContractRange(value: string): value is ContractRange {
	return parseContractRange(value) !== undefined;
}

/** True when candidate satisfies every token as a union (any match wins). */
export function matchesContractRanges(
	candidate: string,
	ranges: readonly string[],
): boolean {
	if (!parseStableSemVer(candidate)) return false;
	for (const range of ranges) {
		const parsed = parseContractRange(range);
		if (!parsed) return false;
		if (parsed.kind === "exact" && candidate === parsed.version) return true;
		if (parsed.kind === "caret" && matchesCaret(candidate, parsed.base)) {
			return true;
		}
	}
	return false;
}

/** Validate a consumer range list: non-empty, unique tokens, each a ContractRange. */
export function validateContractRanges(ranges: readonly string[]):
	| Readonly<{ ok: true; ranges: readonly ContractRange[] }>
	| Readonly<{
			ok: false;
			reason: "empty" | "duplicate" | "invalid_grammar";
			invalid?: string | undefined;
	  }> {
	if (ranges.length === 0) return { ok: false, reason: "empty" };
	const seen = new Set<string>();
	const normalized: ContractRange[] = [];
	for (const range of ranges) {
		if (seen.has(range)) return { ok: false, reason: "duplicate" };
		seen.add(range);
		const parsed = parseContractRange(range);
		if (!parsed) {
			return { ok: false, reason: "invalid_grammar", invalid: range };
		}
		normalized.push(
			parsed.kind === "exact" ? parsed.version : (`^${parsed.base}` as const),
		);
	}
	return { ok: true, ranges: Object.freeze(normalized) };
}
