#!/usr/bin/env tsx

/**
 * Component Documentation Generator
 *
 * Scans all modules for store and admin components and generates a
 * comprehensive component API reference at internals/docs/component-api.md.
 *
 * Usage:
 *   bun run generate:docs
 *   bun run generate:docs -- --out internals/docs/component-api.md
 *
 * Output format:
 *   - One section per module
 *   - Lists all exported store components and admin components
 *   - Extracts props interfaces from TypeScript source
 *   - Provides MDX usage examples
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const WORKSPACE_ROOT = workspaceRootFromImportMeta(import.meta.url);
const MODULES_DIR = join(WORKSPACE_ROOT, "modules");

// Parse --out flag
const outFlagIdx = process.argv.indexOf("--out");
const OUTPUT_PATH =
	outFlagIdx !== -1 && process.argv[outFlagIdx + 1]
		? join(WORKSPACE_ROOT, process.argv[outFlagIdx + 1])
		: join(WORKSPACE_ROOT, "internals/docs/component-api.md");

interface ComponentInfo {
	name: string;
	props: PropInfo[];
	description?: string;
}

interface PropInfo {
	name: string;
	type: string;
	optional: boolean;
	description?: string;
}

interface ModuleDoc {
	moduleId: string;
	packageName: string;
	storeComponents: ComponentInfo[];
	adminComponents: ComponentInfo[];
}

/**
 * Extract exported component names from an index.tsx file.
 * Parses `export default { Name, ... }` and named exports.
 */
function extractComponentNames(indexPath: string): string[] {
	if (!existsSync(indexPath)) return [];
	const source = readFileSync(indexPath, "utf-8");
	const names: string[] = [];

	// Match `export default { Name1, Name2, ... }` (possibly with wrapping functions)
	const defaultExportMatch = source.match(/export default\s*\{([^}]+)\}/s);
	if (defaultExportMatch) {
		const body = defaultExportMatch[1];
		// Extract top-level keys: either `Name,` or `Name:` patterns
		const keyPattern = /^\s*([A-Z][a-zA-Z0-9]*)[\s:,]/gm;
		for (const m of body.matchAll(keyPattern)) {
			if (m[1] && !names.includes(m[1])) {
				names.push(m[1]);
			}
		}
	}

	// Also match `satisfies MDXComponents` block — pick all PascalCase keys
	const satisfiesBlock = source.match(
		/\{([^}]+)\}\s*satisfies\s*MDXComponents/s,
	);
	if (satisfiesBlock) {
		const body = satisfiesBlock[1];
		const keyPattern = /^\s*([A-Z][a-zA-Z0-9]*)[\s:,]/gm;
		for (const m of body.matchAll(keyPattern)) {
			if (m[1] && !names.includes(m[1])) {
				names.push(m[1]);
			}
		}
	}

	return names.sort();
}

/**
 * Find the TSX file for a component (kebab-case filename).
 */
function findComponentFile(
	componentDir: string,
	componentName: string,
): string | null {
	if (!existsSync(componentDir)) return null;

	// Convert PascalCase to kebab-case: ProductCard → product-card
	const kebab = componentName
		.replace(/([A-Z])/g, (m, letter, offset) =>
			offset > 0 ? `-${letter.toLowerCase()}` : letter.toLowerCase(),
		)
		.replace(/^-/, "");

	const candidates = [
		join(componentDir, `${kebab}.tsx`),
		join(componentDir, `${componentName}.tsx`),
	];

	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return null;
}

/**
 * Extract props interface from a TSX file for a component.
 * Looks for `export interface <Name>Props { ... }` or `interface <Name>Props { ... }`.
 */
function extractProps(filePath: string, componentName: string): PropInfo[] {
	if (!existsSync(filePath)) return [];
	const source = readFileSync(filePath, "utf-8");

	// Find interface block
	const interfacePattern = new RegExp(
		`(?:export\\s+)?interface\\s+${componentName}Props\\s*\\{([^}]+)\\}`,
		"s",
	);
	const match = source.match(interfacePattern);
	if (!match) return [];

	const body = match[1];
	const props: PropInfo[] = [];

	// Parse each line: name?: type; or name: type;
	const linePattern = /^\s*(?:\/\*\*([^*]*)\*\/\s*)?(\w+)(\??):\s*([^;]+);/gm;
	for (const m of body.matchAll(linePattern)) {
		const [, comment, name, optional, type] = m;
		if (name && type) {
			props.push({
				name,
				type: type.trim(),
				optional: optional === "?",
				description: comment?.trim(),
			});
		}
	}

	return props;
}

/**
 * Extract the module description from AGENTS.md or README.md.
 */
function extractModuleDescription(moduleDir: string): string {
	for (const file of ["AGENTS.md", "README.md"]) {
		const path = join(moduleDir, file);
		if (!existsSync(path)) continue;
		const source = readFileSync(path, "utf-8");
		// First non-heading line after the first heading
		const lines = source.split("\n");
		let seenHeading = false;
		for (const line of lines) {
			if (line.startsWith("# ")) {
				seenHeading = true;
				continue;
			}
			if (seenHeading && line.trim() && !line.startsWith("#")) {
				return line.trim();
			}
		}
	}
	return "";
}

/**
 * Build component doc info for a single directory (store or admin components).
 */
function buildComponentDocs(componentDir: string): ComponentInfo[] {
	if (!existsSync(componentDir)) return [];

	// Store components declare a single MDX map; admin components are one file per
	// component with no barrel, so they are discovered by scanning for real exports.
	const mapPath = join(componentDir, "mdx.tsx");
	const names = existsSync(mapPath)
		? extractComponentNames(mapPath)
		: exportedComponentNames(componentDir);

	return names.map((name) => {
		const filePath = findComponentFile(componentDir, name);
		const props = filePath ? extractProps(filePath, name) : [];
		return { name, props };
	});
}

/**
 * Component names exported by the files in a directory.
 *
 * Used for admin components, which no longer funnel through a re-export barrel.
 * Files prefixed with `_` are shared internals, not page components.
 */
function exportedComponentNames(componentDir: string): string[] {
	const names = new Set<string>();
	for (const file of readdirSync(componentDir)) {
		if (!file.endsWith(".tsx") || file.startsWith("_")) continue;
		const source = readFileSync(join(componentDir, file), "utf-8");
		for (const match of source.matchAll(
			/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g,
		)) {
			const name = match[1];
			if (name) names.add(name);
		}
	}
	return [...names].sort();
}

/**
 * Build MDX usage example for a component based on its props.
 */
function buildUsageExample(component: ComponentInfo): string {
	if (component.props.length === 0) {
		return `<${component.name} />`;
	}

	const required = component.props.filter((p) => !p.optional);
	if (required.length === 0) {
		return `<${component.name} />`;
	}

	// Build props string
	const propsStr = required
		.slice(0, 3) // show at most 3 required props to keep it concise
		.map((p) => {
			const val =
				p.type === "string"
					? `"..."`
					: p.type === "number"
						? `{0}`
						: p.type === "boolean"
							? `{true}`
							: p.type.startsWith("{") || p.type.startsWith("Record")
								? `{{}}`
								: p.type.includes("|")
									? `"${p.type.split("|")[0].trim().replace(/"/g, "")}"`
									: `{...}`;
			return `${p.name}=${val}`;
		})
		.join(" ");

	return `<${component.name} ${propsStr} />`;
}

/**
 * Process one module directory and build its doc structure.
 */
function processModule(moduleName: string): ModuleDoc | null {
	const moduleDir = join(MODULES_DIR, moduleName);
	const pkgJson = join(moduleDir, "package.json");
	if (!existsSync(pkgJson)) return null;

	const pkg = JSON.parse(readFileSync(pkgJson, "utf-8")) as { name?: string };
	const packageName = pkg.name ?? `@86d-app/${moduleName}`;

	const srcDir = join(moduleDir, "src");
	const storeComponentDir = join(srcDir, "store", "components");
	const adminComponentDir = join(srcDir, "admin", "components");

	const storeComponents = buildComponentDocs(storeComponentDir);
	const adminComponents = buildComponentDocs(adminComponentDir);

	if (storeComponents.length === 0 && adminComponents.length === 0) return null;

	// Read module id from index.ts
	const indexPath = join(srcDir, "index.ts");
	let moduleId = moduleName;
	if (existsSync(indexPath)) {
		const indexContent = readFileSync(indexPath, "utf-8");
		const idMatch = indexContent.match(/id:\s*"([^"]+)"/);
		if (idMatch) moduleId = idMatch[1];
	}

	return { moduleId, packageName, storeComponents, adminComponents };
}

/**
 * Render a props table in markdown.
 */
function renderPropsTable(props: PropInfo[]): string {
	if (props.length === 0) return "_No props_\n";

	const header = "| Prop | Type | Required | Description |";
	const divider = "|------|------|----------|-------------|";
	const rows = props.map((p) => {
		const desc = p.description ?? "";
		const type = `\`${p.type.replace(/\|/g, "\\|")}\``;
		return `| \`${p.name}\` | ${type} | ${p.optional ? "No" : "Yes"} | ${desc} |`;
	});

	return [header, divider, ...rows].join("\n") + "\n";
}

/**
 * Render a full module section in markdown.
 */
function renderModuleSection(doc: ModuleDoc, description: string): string {
	const lines: string[] = [];

	lines.push(`## \`${doc.packageName}\``);
	lines.push("");
	if (description) {
		lines.push(description);
		lines.push("");
	}

	if (doc.storeComponents.length > 0) {
		lines.push("### Store components");
		lines.push("");
		lines.push("Use in MDX template files:");
		lines.push("");

		for (const comp of doc.storeComponents) {
			lines.push(`#### \`${comp.name}\``);
			lines.push("");
			lines.push("```mdx");
			lines.push(buildUsageExample(comp));
			lines.push("```");
			lines.push("");
			if (comp.props.length > 0) {
				lines.push("**Props**");
				lines.push("");
				lines.push(renderPropsTable(comp.props));
			}
		}
	}

	if (doc.adminComponents.length > 0) {
		lines.push("### Admin components");
		lines.push("");
		lines.push("Registered as admin pages — accessed via the admin sidebar.");
		lines.push("");

		for (const comp of doc.adminComponents) {
			lines.push(`#### \`${comp.name}\``);
			lines.push("");
			if (comp.props.length > 0) {
				lines.push("**Props**");
				lines.push("");
				lines.push(renderPropsTable(comp.props));
			}
		}
	}

	return lines.join("\n");
}

async function main() {
	console.log("Scanning modules for components...");

	const moduleNames = readdirSync(MODULES_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	const docs: ModuleDoc[] = [];
	let scanned = 0;

	for (const name of moduleNames) {
		const doc = processModule(name);
		if (doc) {
			docs.push(doc);
			scanned++;
		}
	}

	console.log(`  Found components in ${scanned}/${moduleNames.length} modules`);

	// Build the full document
	const sections: string[] = [
		"# Component API Reference",
		"",
		"Auto-generated from module source files. Run `bun run generate:docs` to regenerate.",
		"",
		`Generated: ${new Date().toISOString().slice(0, 10)}  `,
		`Modules with components: ${docs.length}`,
		"",
		"---",
		"",
		"## Quick start",
		"",
		"Add components to your MDX templates by importing them from the module system.",
		"Modules must be listed in `templates/brisa/config.json` to be available.",
		"",
		"```mdx",
		"{/* templates/brisa/index.mdx */}",
		'<FeaturedProducts limit={4} title="Featured" />',
		'<CollectionGrid title="Shop by collection" featured />',
		'<NewsletterInline source="homepage" />',
		"```",
		"",
		"---",
		"",
	];

	// Table of contents
	sections.push("## Modules");
	sections.push("");
	for (const doc of docs) {
		const anchor = doc.packageName
			.replace(/[@/]/g, "")
			.replace(/[^a-zA-Z0-9-]/g, "-")
			.toLowerCase();
		const storePart =
			doc.storeComponents.length > 0
				? `${doc.storeComponents.length} store`
				: "";
		const adminPart =
			doc.adminComponents.length > 0
				? `${doc.adminComponents.length} admin`
				: "";
		const counts = [storePart, adminPart].filter(Boolean).join(", ");
		sections.push(
			`- [\`${doc.packageName}\`](#${anchor}) — ${counts} component${counts.includes(",") || counts.match(/[2-9]/) ? "s" : ""}`,
		);
	}
	sections.push("");
	sections.push("---");
	sections.push("");

	// Module sections
	for (const doc of docs) {
		const moduleDir = join(
			MODULES_DIR,
			doc.moduleId === doc.packageName.replace("@86d-app/", "")
				? doc.moduleId
				: doc.packageName.replace("@86d-app/", ""),
		);
		const description = extractModuleDescription(moduleDir);
		sections.push(renderModuleSection(doc, description));
		sections.push("");
		sections.push("---");
		sections.push("");
	}

	const output = sections.join("\n");

	// Ensure output directory exists
	const outputDir = OUTPUT_PATH.replace(/\/[^/]+$/, "");
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	writeFileSync(OUTPUT_PATH, output);
	console.log(`✓ Generated ${OUTPUT_PATH}`);
	console.log(
		`  ${output.split("\n").length} lines, ${Math.round(output.length / 1024)}KB`,
	);
}

main().catch((err) => {
	console.error("Failed to generate component docs:", err);
	process.exit(1);
});
