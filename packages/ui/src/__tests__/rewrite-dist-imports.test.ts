import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rewriteFileContents } from "../../scripts/rewrite-dist-imports";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("rewriteFileContents", () => {
	it("makes extensionless local imports resolvable without changing external or asset specifiers", () => {
		const fromFile = join(pkgRoot, "dist/data-table/example.js");
		const source = [
			'import local from "./local";',
			'export { Button } from "../button";',
			'const lazy = import("../shadcn/table");',
			'import alias from "~/lib/utils";',
			'import worker from "./worker?raw";',
			'import "./theme.css";',
			'import image from "./image.png";',
			'import complete from "./complete.js";',
			'import React from "react";',
		].join("\n");

		expect(rewriteFileContents(fromFile, source)).toBe(
			[
				'import local from "./local.js";',
				'export { Button } from "../button.js";',
				'const lazy = import("../shadcn/table.js");',
				'import alias from "../lib/utils.js";',
				'import worker from "./worker.js?raw";',
				'import "./theme.css";',
				'import image from "./image.png";',
				'import complete from "./complete.js";',
				'import React from "react";',
			].join("\n"),
		);
	});
});
