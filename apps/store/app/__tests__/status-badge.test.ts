import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { StatusVariant } from "~/components/status-badge";

function renderBadge(props: {
	status: string;
	variant?: StatusVariant;
	label?: string;
}): string {
	const rendered = spawnSync(
		"bun",
		[
			"--eval",
			`import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "./components/status-badge.tsx";
console.log(renderToStaticMarkup(createElement(StatusBadge, ${JSON.stringify(props)})));`,
		],
		{ cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8" },
	);
	expect(rendered.status, rendered.stderr).toBe(0);
	return rendered.stdout;
}

describe("StatusBadge semantic styling", () => {
	it.each([
		["paid", "constructive"],
		["pending", "caution"],
		["failed", "destructive"],
		["processing", "primary"],
	])("renders the %s commerce status using %s colors", (status, family) => {
		const markup = renderBadge({ status });
		expect(markup).toContain(`bg-${family}-50`);
		expect(markup).toContain(`text-${family}-600`);
		expect(markup).toContain(`>${status}</span>`);
		expect(markup).not.toMatch(/(?:bg|text)-status-/);
	});

	it("accepts canonical overrides without changing the commerce status label", () => {
		const markup = renderBadge({ status: "past_due", variant: "destructive" });
		expect(markup).toContain("bg-destructive-50");
		expect(markup).toContain("text-destructive-600");
		expect(markup).toContain(">past due</span>");
	});

	it("keeps an unrecognized commerce status neutral", () => {
		const markup = renderBadge({ status: "reviewing", label: "In review" });
		expect(markup).toContain("bg-secondary");
		expect(markup).toContain("text-secondary-foreground");
		expect(markup).toContain(">In review</span>");
	});
});
