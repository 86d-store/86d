import {
	matchesContractRanges,
	validateContractRanges,
} from "./contract-range";
import { compareSemVer } from "./semver";

/** Synchronous contract identity: (kind, owner, name, version). */
export type ContractKind =
	| "module"
	| "capability"
	| "hook"
	| "reader"
	| "template-projection";

export type VersionedDefinition = Readonly<{
	kind: ContractKind;
	owner: string;
	name: string;
	version: string;
}>;

export type ResolveVersionResult =
	| Readonly<{ ok: true; version: string }>
	| Readonly<{
			ok: false;
			reason:
				| "invalid_range"
				| "no_match"
				| "duplicate_identity"
				| "empty_definitions";
			detail?: string | undefined;
	  }>;

/**
 * Find definitions with exact kind/owner/name, filter by consumer ranges, and
 * select the highest matching SemVer. Duplicate identity at the same version
 * is a failure.
 */
export function resolveHighestMatchingVersion(input: {
	kind: ContractKind;
	owner: string;
	name: string;
	ranges: readonly string[];
	definitions: readonly VersionedDefinition[];
}): ResolveVersionResult {
	const ranges = validateContractRanges(input.ranges);
	if (!ranges.ok) {
		return {
			ok: false,
			reason: "invalid_range",
			detail:
				ranges.reason === "invalid_grammar" ? ranges.invalid : ranges.reason,
		};
	}

	const matchingIdentity = input.definitions.filter(
		(definition) =>
			definition.kind === input.kind &&
			definition.owner === input.owner &&
			definition.name === input.name,
	);

	if (matchingIdentity.length === 0) {
		return { ok: false, reason: "empty_definitions" };
	}

	const byVersion = new Map<string, number>();
	for (const definition of matchingIdentity) {
		byVersion.set(
			definition.version,
			(byVersion.get(definition.version) ?? 0) + 1,
		);
	}
	for (const [version, count] of byVersion) {
		if (count > 1) {
			return {
				ok: false,
				reason: "duplicate_identity",
				detail: `${input.kind}:${input.owner}/${input.name}@${version}`,
			};
		}
	}

	const compatible = matchingIdentity
		.map((definition) => definition.version)
		.filter((version) => matchesContractRanges(version, ranges.ranges));

	if (compatible.length === 0) {
		return { ok: false, reason: "no_match" };
	}

	compatible.sort(compareSemVer);
	const highest = compatible[compatible.length - 1];
	if (!highest) return { ok: false, reason: "no_match" };
	return { ok: true, version: highest };
}
