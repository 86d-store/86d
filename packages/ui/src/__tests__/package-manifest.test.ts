import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("@86d-app/ui package manifest", () => {
	const pkg = JSON.parse(
		readFileSync(join(pkgRoot, "package.json"), "utf8"),
	) as {
		name: string;
		private?: boolean;
		files?: string[];
		dependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		publishConfig?: {
			access?: string;
			exports?: Record<string, unknown>;
		};
		exports?: Record<string, unknown>;
	};

	it("is a public scoped package on the shared version line", () => {
		expect(pkg.name).toBe("@86d-app/ui");
		expect(pkg.private).toBeUndefined();
	});

	it("ships dist, not src", () => {
		expect(pkg.files).toContain("dist");
		expect(pkg.files).not.toContain("src");
	});

	it("exposes data-table and CSS entry points for workspace and npm", () => {
		expect(pkg.exports?.["./*"]).toBe("./src/*");
		expect(pkg.exports?.["./globals.css"]).toBe("./src/globals.css");
		expect(pkg.publishConfig?.access).toBe("public");
		expect(pkg.publishConfig?.exports?.["./globals.css"]).toBe(
			"./dist/globals.css",
		);
		expect(pkg.publishConfig?.exports?.["./*"]).toEqual({
			types: "./dist/*.d.ts",
			default: "./dist/*.js",
		});
	});

	it("does not depend on private workspace packages", () => {
		const deps = {
			...pkg.dependencies,
			...pkg.peerDependencies,
		};
		expect(deps.lib).toBeUndefined();
		expect(deps.utils).toBeUndefined();
		expect(deps.validators).toBeUndefined();
		expect(deps["@tanstack/react-table"]).toBe("9.1.2");
	});
});
