import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
);
const modulesRoot = resolve(repositoryRoot, "modules");
const moduleNames = new Set(
	readdirSync(modulesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name),
);

function moduleSourceFiles(): string[] {
	return readdirSync(modulesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			const sourceRoot = resolve(modulesRoot, entry.name, "src");
			try {
				return readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
					.filter((sourceEntry) => sourceEntry.isFile())
					.map((sourceEntry) =>
						resolve(sourceEntry.parentPath, sourceEntry.name),
					);
			} catch {
				return [];
			}
		})
		.filter((file) => [".ts", ".tsx"].includes(extname(file)));
}

const allModuleSources = moduleSourceFiles().map((file) => ({
	file,
	contents: readFileSync(file, "utf8"),
}));
const moduleSources = allModuleSources
	.filter(({ file }) => !file.includes("/__tests__/"))
	.filter(({ file }) => !/\.(?:test|spec)\.[cm]?tsx?$/.test(file));

describe("Module isolation boundary", () => {
	it("has no cross-Module imports", () => {
		const moduleImport =
			/(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["']@86d-app\/([^/"']+)(?:\/[^"']*)?["']/g;
		const violations = allModuleSources.flatMap(({ file, contents }) => {
			const source = file.match(/\/modules\/([^/]+)\/src\//)?.[1];
			if (!source) return [];

			return [...contents.matchAll(moduleImport)]
				.map((match) => match[1])
				.filter((target): target is string =>
					Boolean(target && target !== source && moduleNames.has(target)),
				)
				.map((target) => ({ file, source, target }));
		});

		expect(violations).toEqual([]);
	});

	it("declares no cross-Module dependencies", () => {
		const dependencyFields = [
			"dependencies",
			"devDependencies",
			"optionalDependencies",
			"peerDependencies",
		] as const;
		const violations = [...moduleNames].flatMap((source) => {
			const manifest = JSON.parse(
				readFileSync(resolve(modulesRoot, source, "package.json"), "utf8"),
			) as Record<string, Record<string, string> | undefined>;

			return dependencyFields.flatMap((field) =>
				Object.keys(manifest[field] ?? {})
					.filter((dependency) => dependency.startsWith("@86d-app/"))
					.map((dependency) => dependency.slice("@86d-app/".length))
					.filter((target) => target !== source && moduleNames.has(target))
					.map((target) => ({ field, source, target })),
			);
		});

		expect(violations).toEqual([]);
	});

	it("has no production access to the runtime data registry", () => {
		const matches = moduleSources
			.filter(({ contents }) => contents.includes("_dataRegistry"))
			.map(({ file }) => file);

		expect(matches).toEqual([]);
	});

	it("has no production cross-Module controller escape casts", () => {
		const escapeCast =
			/controllers(?:\??\.[A-Za-z0-9_$]+|\[[^\]]+\])\s+as\s+unknown\s+as/;
		const matches = moduleSources
			.filter(({ contents }) => escapeCast.test(contents))
			.map(({ file }) => file);

		expect(matches).toEqual([]);
	});

	it("has no known plain cross-Module controller access", () => {
		const controllerOwners: Record<string, string> = {
			abandonedCarts: "abandoned-carts",
			customer: "customers",
			discount: "discounts",
			giftCards: "giftcards",
			inventory: "inventory",
			multiCurrency: "multi-currency",
			order: "orders",
			payments: "payments",
			priceLists: "price-lists",
			product: "products",
			shipping: "shipping",
			storeCredits: "store-credits",
			tax: "tax",
		};
		const violations = moduleSources.flatMap(({ file, contents }) => {
			const moduleName = file.match(/\/modules\/([^/]+)\/src\//)?.[1];
			if (!moduleName) return [];
			return Object.entries(controllerOwners)
				.filter(
					([controller, owner]) =>
						moduleName !== owner &&
						new RegExp(
							`controllers(?:\\?\\.)?\\.${controller}\\b|controllers\\[["']${controller}["']\\]`,
						).test(contents),
				)
				.map(([controller, owner]) => ({ file, controller, owner }));
		});

		expect(violations).toEqual([]);
	});
});
