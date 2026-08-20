import type { ModuleSourceType, ModuleSpecifier } from "./types.js";

/**
 * Parse a module specifier string into a structured {@link ModuleSpecifier}.
 *
 * Supported formats:
 * ```
 * "products"                              → local/registry  @86d-app/products
 * "@86d-app/products"                     → local/registry  @86d-app/products
 * "github:owner/repo"                     → github          (repo root)
 * "github:owner/repo/modules/custom"      → github          (subpath)
 * "github:owner/repo/modules/custom#v2"   → github          (ref)
 * "npm:@acme/commerce-module"             → npm
 * "npm:@acme/commerce-module@^1.0.0"      → npm             (version)
 * ```
 */
export function parseSpecifier(raw: string): ModuleSpecifier {
	// ── GitHub specifier ──────────────────────────────────────────
	if (raw.startsWith("github:")) {
		return parseGitHubSpecifier(raw);
	}

	// ── npm specifier ─────────────────────────────────────────────
	if (raw.startsWith("npm:")) {
		return parseNpmSpecifier(raw);
	}

	// ── Official module (bare name or @86d-app/ prefix) ───────────
	return parseOfficialSpecifier(raw);
}

function parseGitHubSpecifier(raw: string): ModuleSpecifier {
	const withoutPrefix = raw.slice("github:".length);

	// Split ref: "owner/repo/path#ref" → ["owner/repo/path", "ref"]
	const [pathPart, ref] = withoutPrefix.split("#");
	const segments = pathPart.split("/");

	if (segments.length < 2) {
		throw new Error(
			`Invalid GitHub specifier "${raw}": expected at least "owner/repo"`,
		);
	}

	const owner = segments[0];
	const repoName = segments[1];
	const repo = `${owner}/${repoName}`;
	const subpath = segments.length > 2 ? segments.slice(2).join("/") : "";

	// Derive module name from last path segment or repo name
	const name = segments[segments.length - 1];

	const result: ModuleSpecifier = {
		raw,
		source: "github",
		name,
		packageName: `@86d-app/${name}`,
		repo,
		ref: ref || "main",
	};
	if (subpath) result.path = subpath;
	return result;
}

function parseNpmSpecifier(raw: string): ModuleSpecifier {
	const withoutPrefix = raw.slice("npm:".length);

	// Handle scoped packages: @scope/name@version
	let packageName: string;
	let version: string | undefined;

	if (withoutPrefix.startsWith("@")) {
		// Scoped: find the second @ for version
		const atIdx = withoutPrefix.indexOf("@", 1);
		if (atIdx > 0) {
			packageName = withoutPrefix.slice(0, atIdx);
			version = withoutPrefix.slice(atIdx + 1);
		} else {
			packageName = withoutPrefix;
		}
	} else {
		// Unscoped: split on @
		const atIdx = withoutPrefix.indexOf("@");
		if (atIdx > 0) {
			packageName = withoutPrefix.slice(0, atIdx);
			version = withoutPrefix.slice(atIdx + 1);
		} else {
			packageName = withoutPrefix;
		}
	}

	// Derive short name from package name
	const name = packageName.replace(/^@[^/]+\//, "");

	return {
		raw,
		source: "npm",
		name,
		packageName,
		version: version ?? "latest",
	};
}

function parseOfficialSpecifier(raw: string): ModuleSpecifier {
	// Strip @86d-app/ prefix if present
	const name = raw.replace(/^@86d-app\//, "");
	const packageName = `@86d-app/${name}`;

	// Source determination happens later during resolution — for now
	// mark as "registry" (the resolver will check local first).
	const source: ModuleSourceType = "registry";

	return {
		raw,
		source,
		name,
		packageName,
	};
}

/**
 * Check if a specifier refers to an official 86d module.
 * Official modules use bare names or the `@86d-app/` scope.
 */
export function isOfficialModule(spec: ModuleSpecifier): boolean {
	return spec.source === "registry" || spec.source === "local";
}
