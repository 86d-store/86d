import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("86d workspace bin", () => {
	it("points at a file that exists before dist/ is built", () => {
		const pkg = JSON.parse(
			readFileSync(join(cliRoot, "package.json"), "utf-8"),
		) as {
			bin: { "86d": string };
			publishConfig: { bin: { "86d": string } };
		};

		expect(pkg.bin["86d"]).toBe("./bin/86d.mjs");
		expect(existsSync(join(cliRoot, "bin/86d.mjs"))).toBe(true);
		expect(pkg.publishConfig.bin["86d"]).toBe("./dist/index.js");
	});
});
