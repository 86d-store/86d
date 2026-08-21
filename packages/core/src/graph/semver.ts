import type { StableSemVer } from "../schema/declaration";

const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export type ParsedSemVer = Readonly<{
	raw: StableSemVer;
	major: number;
	minor: number;
	patch: number;
}>;

/** Parse a stable `MAJOR.MINOR.PATCH` string; reject prerelease, build, and wildcards. */
export function parseStableSemVer(value: string): ParsedSemVer | undefined {
	const match = STABLE_SEMVER.exec(value);
	if (!match) return undefined;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	if (
		!Number.isSafeInteger(major) ||
		!Number.isSafeInteger(minor) ||
		!Number.isSafeInteger(patch) ||
		major < 0 ||
		minor < 0 ||
		patch < 0
	) {
		return undefined;
	}
	return {
		raw: `${major}.${minor}.${patch}` as StableSemVer,
		major,
		minor,
		patch,
	};
}

export function isStableSemVer(value: string): value is StableSemVer {
	return parseStableSemVer(value) !== undefined;
}

/** Bytewise-safe numeric SemVer comparison: negative if a < b. */
export function compareSemVer(a: string, b: string): number {
	const left = parseStableSemVer(a);
	const right = parseStableSemVer(b);
	if (!left || !right) {
		throw new Error(`Cannot compare non-stable SemVer: "${a}" vs "${b}".`);
	}
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	return left.patch - right.patch;
}

/**
 * Caret compatibility per SemVer left-most non-zero:
 * - `^1.2.3` → `>=1.2.3 <2.0.0`
 * - `^0.2.3` → `>=0.2.3 <0.3.0`
 * - `^0.0.3` → exactly `0.0.3`
 */
export function matchesCaret(candidate: string, base: string): boolean {
	const version = parseStableSemVer(candidate);
	const floor = parseStableSemVer(base);
	if (!version || !floor) return false;
	if (compareSemVer(candidate, base) < 0) return false;
	if (floor.major > 0) {
		return version.major === floor.major;
	}
	if (floor.minor > 0) {
		return version.major === 0 && version.minor === floor.minor;
	}
	return (
		version.major === 0 && version.minor === 0 && version.patch === floor.patch
	);
}
