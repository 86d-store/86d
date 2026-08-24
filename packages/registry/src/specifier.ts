import type { ModuleSourceType, ModuleSpecifier } from "./types.js";

const SAFE_MODULE_NAME = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const SAFE_GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const SAFE_GITHUB_REPO_SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;
const SAFE_GITHUB_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SAFE_GIT_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

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
	const refParts = withoutPrefix.split("#");
	if (refParts.length > 2) {
		throw invalidSpecifier("GitHub", raw, "only one ref separator is allowed");
	}
	const [pathPart = "", ref] = refParts;
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
	assertValidModuleSpecifier(result);
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

	const result: ModuleSpecifier = {
		raw,
		source: "npm",
		name,
		packageName,
		version: version ?? "latest",
	};
	assertValidModuleSpecifier(result);
	return result;
}

function parseOfficialSpecifier(raw: string): ModuleSpecifier {
	// Strip @86d-app/ prefix if present
	const name = raw.replace(/^@86d-app\//, "");
	const packageName = `@86d-app/${name}`;

	// Source determination happens later during resolution — for now
	// mark as "registry" (the resolver will check local first).
	const source: ModuleSourceType = "registry";

	const result: ModuleSpecifier = {
		raw,
		source,
		name,
		packageName,
	};
	if (raw !== name && raw !== packageName) {
		throw invalidSpecifier(
			"official",
			raw,
			"expected a bare name or the @86d-app/ scope",
		);
	}
	assertValidModuleSpecifier(result);
	return result;
}

/** Reject a Module name that cannot be one direct filesystem segment. */
export function assertSafeModuleName(name: string): void {
	if (name === "." || name === ".." || !SAFE_MODULE_NAME.test(name)) {
		throw new Error(
			`Module name "${name}" must be one canonical lowercase path segment.`,
		);
	}
}

/** Validate parsed and programmatically constructed Module specifiers. */
export function assertValidModuleSpecifier(spec: ModuleSpecifier): void {
	const label =
		spec.source === "github"
			? "GitHub"
			: spec.source === "npm"
				? "npm"
				: "official";
	try {
		assertSafeModuleName(spec.name);
	} catch {
		throw invalidSpecifier(label, spec.raw, "module name is not canonical");
	}

	switch (spec.source) {
		case "local":
		case "registry":
			if (spec.packageName !== `@86d-app/${spec.name}`) {
				throw invalidSpecifier(
					"official",
					spec.raw,
					"package name does not match the Module name",
				);
			}
			return;
		case "github": {
			if (!spec.repo) {
				throw invalidSpecifier("GitHub", spec.raw, "missing repo");
			}
			const repoSegments = spec.repo?.split("/") ?? [];
			const owner = repoSegments[0] ?? "";
			const repoName = repoSegments[1] ?? "";
			if (
				repoSegments.length !== 2 ||
				!SAFE_GITHUB_OWNER.test(owner) ||
				repoName === "." ||
				repoName === ".." ||
				!SAFE_GITHUB_REPO_SEGMENT.test(repoName)
			) {
				throw invalidSpecifier(
					"GitHub",
					spec.raw,
					"owner/repository is not canonical",
				);
			}
			const pathSegments = spec.path?.split("/") ?? [];
			if (
				pathSegments.some(
					(segment) =>
						segment === "" ||
						segment === "." ||
						segment === ".." ||
						!SAFE_GITHUB_PATH_SEGMENT.test(segment),
				)
			) {
				throw invalidSpecifier(
					"GitHub",
					spec.raw,
					"repository path is not canonical",
				);
			}
			const derivedName = pathSegments.at(-1) ?? repoName;
			if (
				derivedName !== spec.name ||
				spec.packageName !== `@86d-app/${spec.name}`
			) {
				throw invalidSpecifier(
					"GitHub",
					spec.raw,
					"package and Module names do not match the repository path",
				);
			}
			const ref = spec.ref ?? "main";
			if (
				!SAFE_GIT_REF.test(ref) ||
				ref.includes("..") ||
				ref.includes("@{") ||
				ref.endsWith("/") ||
				ref.endsWith(".lock")
			) {
				throw invalidSpecifier("GitHub", spec.raw, "ref is not canonical");
			}
			return;
		}
		case "npm": {
			const packageSegments = spec.packageName.startsWith("@")
				? spec.packageName.slice(1).split("/")
				: spec.packageName.split("/");
			if (
				packageSegments.length !== (spec.packageName.startsWith("@") ? 2 : 1) ||
				packageSegments.some(
					(segment) =>
						segment === "." ||
						segment === ".." ||
						!SAFE_MODULE_NAME.test(segment),
				) ||
				spec.packageName.length > 214 ||
				packageSegments.at(-1) !== spec.name
			) {
				throw invalidSpecifier(
					"npm",
					spec.raw,
					"package name is not canonical",
				);
			}
			if (!spec.version || /[\s\0]/.test(spec.version)) {
				throw invalidSpecifier("npm", spec.raw, "version is empty or invalid");
			}
			return;
		}
	}
}

function invalidSpecifier(
	label: "GitHub" | "npm" | "official",
	raw: string,
	reason: string,
): Error {
	return new Error(`Invalid ${label} specifier "${raw}": ${reason}`);
}

/**
 * Check if a specifier refers to an official 86d module.
 * Official modules use bare names or the `@86d-app/` scope.
 */
export function isOfficialModule(spec: ModuleSpecifier): boolean {
	return spec.source === "registry" || spec.source === "local";
}
