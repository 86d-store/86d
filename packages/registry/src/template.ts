import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchModule } from "./fetcher.js";
import { parseSpecifier } from "./specifier.js";
import type {
	FetchResult,
	ModuleSpecifier,
	RegistryManifest,
} from "./types.js";

/** Result of resolving a template specifier. */
export interface ResolvedTemplate {
	/** The parsed specifier. */
	specifier: ModuleSpecifier;
	/** Resolution status. */
	status: "found" | "missing" | "error";
	/** Absolute path to the template directory (when found). */
	localPath?: string;
	/** Error message when status is "error". */
	error?: string;
}

/**
 * Resolve a template specifier to a local directory.
 *
 * Resolution order:
 * 1. Check local `templates/{name}/` directory
 * 2. Check registry manifest for a matching template entry
 * 3. Mark as missing (caller can fetch via {@link fetchTemplate})
 *
 * Template specifier formats:
 * - `"brisa"` → local template
 * - `"github:owner/repo/templates/custom"` → GitHub
 * - `"npm:@acme/store-template"` → npm
 */
export function resolveTemplate(
	templateSpec: string,
	root: string,
	manifest?: RegistryManifest,
): ResolvedTemplate {
	// Parse using the same specifier format as modules
	const spec = parseSpecifier(templateSpec);

	const templatesDir = join(root, "templates");

	switch (spec.source) {
		case "local":
		case "registry": {
			// Check local templates directory
			const localPath = join(templatesDir, spec.name);
			if (existsSync(localPath) && existsSync(join(localPath, "config.json"))) {
				return {
					specifier: { ...spec, source: "local" },
					status: "found",
					localPath,
				};
			}

			// Check registry manifest for templates
			if (manifest?.templates[spec.name]) {
				return {
					specifier: { ...spec, source: "registry" },
					status: "missing",
				};
			}

			return {
				specifier: spec,
				status: "missing",
				error: `Template "${spec.name}" not found locally or in registry`,
			};
		}

		case "github": {
			const localPath = join(templatesDir, spec.name);
			if (existsSync(localPath) && existsSync(join(localPath, "config.json"))) {
				return {
					specifier: { ...spec, source: "local" },
					status: "found",
					localPath,
				};
			}
			return { specifier: spec, status: "missing" };
		}

		case "npm": {
			const nmPath = join(root, "node_modules", spec.packageName);
			if (existsSync(nmPath)) {
				return { specifier: spec, status: "found", localPath: nmPath };
			}
			return { specifier: spec, status: "missing" };
		}
	}
}

/**
 * Fetch a template from its remote source and install it into `templates/`.
 *
 * For GitHub/registry templates, the module is downloaded to `templates/{name}/`
 * instead of the default `modules/` directory.
 */
export async function fetchTemplate(
	spec: ModuleSpecifier,
	root: string,
	manifest?: RegistryManifest,
): Promise<FetchResult> {
	if (spec.source === "local") {
		return {
			success: true,
			localPath: join(root, "templates", spec.name),
		};
	}

	if (spec.source === "registry" && manifest) {
		const entry = manifest.templates[spec.name];
		if (!entry) {
			return {
				success: false,
				error: `Template "${spec.name}" not found in registry`,
			};
		}

		const repoMatch = manifest.baseUrl.match(/github\.com\/([^/]+\/[^/]+)/);
		if (!repoMatch) {
			return {
				success: false,
				error: `Invalid registry baseUrl: ${manifest.baseUrl}`,
			};
		}

		// Rewrite specifier as a GitHub source pointing to templates/ instead of modules/
		const ghSpec: ModuleSpecifier = {
			...spec,
			source: "github",
			repo: repoMatch[1],
			path: entry.path,
			ref: manifest.defaultRef,
		};

		return fetchTemplateFromGitHub(ghSpec, root);
	}

	if (spec.source === "github") {
		return fetchTemplateFromGitHub(spec, root);
	}

	// npm templates use the standard fetchModule (stays in node_modules)
	return fetchModule(spec, root, manifest);
}

/**
 * Fetch a template from GitHub into `templates/{name}/` instead of `modules/`.
 *
 * Reuses the fetchModule logic but targets the templates directory.
 */
async function fetchTemplateFromGitHub(
	spec: ModuleSpecifier,
	root: string,
): Promise<FetchResult> {
	// Temporarily rewrite the specifier to fetch into templates/ by using
	// a customized root where "modules" maps to "templates"
	const { execSync } = await import("node:child_process");
	const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");

	const { repo, path, ref = "main", name } = spec;
	if (!repo) {
		return {
			success: false,
			error: `GitHub specifier "${spec.raw}" missing repo`,
		};
	}

	const targetDir = join(root, "templates", name);

	if (existsSync(targetDir) && existsSync(join(targetDir, "config.json"))) {
		return { success: true, localPath: targetDir };
	}

	try {
		const { fetchWithRetry } = await import("./fetcher.js");

		const tarballUrl = `https://api.github.com/repos/${repo}/tarball/${ref}`;
		const tmpDir = join(root, ".86d", "tmp", `template-${name}-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const tarballPath = join(tmpDir, "archive.tar.gz");

		const response = await fetchWithRetry(tarballUrl, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "86d-registry",
				...(process.env.GITHUB_TOKEN
					? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
					: {}),
			},
			redirect: "follow",
		});

		if (!response.ok) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: `GitHub API returned ${response.status} for ${repo}@${ref}`,
			};
		}

		const buffer = Buffer.from(await response.arrayBuffer());
		writeFileSync(tarballPath, buffer);

		const extractDir = join(tmpDir, "extracted");
		mkdirSync(extractDir, { recursive: true });

		execSync(`tar xzf "${tarballPath}" -C "${extractDir}"`, {
			stdio: "pipe",
		});

		const { readdirSync } = await import("node:fs");
		const extractedDirs = readdirSync(extractDir);
		if (extractedDirs.length === 0) {
			rmSync(tmpDir, { recursive: true, force: true });
			return { success: false, error: "Tarball extraction produced no files" };
		}

		const extractedRoot = join(extractDir, extractedDirs[0]);
		const subpath = path ?? "";
		const sourcePath = subpath ? join(extractedRoot, subpath) : extractedRoot;

		if (!existsSync(sourcePath)) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: `Path "${subpath}" not found in ${repo}@${ref}`,
			};
		}

		mkdirSync(targetDir, { recursive: true });
		execSync(`cp -R "${sourcePath}/"* "${targetDir}/"`, { stdio: "pipe" });
		rmSync(tmpDir, { recursive: true, force: true });

		return { success: true, localPath: targetDir };
	} catch (err) {
		return {
			success: false,
			error: `Failed to fetch template from GitHub: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Get all locally available template names from the `templates/` directory.
 */
export function getLocalTemplateNames(root: string): string[] {
	const templatesDir = join(root, "templates");
	if (!existsSync(templatesDir)) return [];

	return readdirSync(templatesDir, { withFileTypes: true })
		.filter(
			(d) =>
				d.isDirectory() &&
				existsSync(join(templatesDir, d.name, "config.json")),
		)
		.map((d) => d.name)
		.sort();
}

/**
 * Read a template's config.json and return its contents.
 */
export function readTemplateConfig(
	templatePath: string,
): Record<string, unknown> | undefined {
	const configPath = join(templatePath, "config.json");
	if (!existsSync(configPath)) return undefined;
	try {
		return JSON.parse(readFileSync(configPath, "utf-8"));
	} catch {
		return undefined;
	}
}
