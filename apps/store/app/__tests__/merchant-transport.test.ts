import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicRoot = resolve(import.meta.dirname, "../../../..");

describe("public transport contract", () => {
	it("keeps better-call and TanStack Query while remaining free of tRPC packages", () => {
		const storePkg = JSON.parse(
			readFileSync(resolve(publicRoot, "apps/store/package.json"), "utf8"),
		) as { dependencies: Record<string, string> };
		expect(storePkg.dependencies["better-call"]).toBeTruthy();
		expect(storePkg.dependencies["@tanstack/react-form"]).toBe("1.33.5");
		expect(storePkg.dependencies["@tanstack/react-table"]).toBe("9.1.2");
		const banned = Object.keys(storePkg.dependencies).filter((name) =>
			name.includes("trpc"),
		);
		expect(banned).toEqual([]);
	});
});
