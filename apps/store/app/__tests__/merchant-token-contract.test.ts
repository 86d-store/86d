import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storeStyles = readFileSync(
	new URL("../globals.css", import.meta.url),
	"utf8",
);
const uiTokens = readFileSync(
	new URL("../../../../packages/ui/src/globals.css", import.meta.url),
	"utf8",
);

function readProperty(css: string, property: string): string {
	const match = css.match(
		new RegExp(`^\\s*${property.replaceAll("-", "\\-")}:\\s*([^;]+);`, "m"),
	);
	if (!match?.[1]) throw new Error(`Missing CSS property ${property}`);
	return match[1].trim();
}

function readRule(css: string, selector: string): string {
	const ruleStart = css.indexOf(`${selector} {`);
	if (ruleStart === -1) throw new Error(`Missing CSS rule ${selector}`);
	const bodyStart = css.indexOf("{", ruleStart) + 1;
	const bodyEnd = css.indexOf("}", bodyStart);
	if (bodyEnd === -1) throw new Error(`Unclosed CSS rule ${selector}`);
	return css.slice(bodyStart, bodyEnd);
}

describe("Store shared theme contract", () => {
	it("loads colors and typography solely from the published UI stylesheet", () => {
		expect(storeStyles).toContain('@import "@86d-store/ui/globals.css";');
		expect(storeStyles).not.toMatch(/--[a-z-]+\s*:|@font-face|font-family\s*:/);
	});

	it("preserves the original UI semantic color specification", () => {
		for (const [property, value] of Object.entries({
			"--primary": "var(--primary-step-500)",
			"--primary-foreground": "var(--primary-25)",
			"--muted-foreground": "var(--neutral-step-500)",
			"--neutral": "var(--neutral-step-500)",
			"--neutral-foreground": "var(--neutral-step-950)",
			"--constructive": "var(--constructive-step-500)",
			"--constructive-foreground": "var(--constructive-step-700)",
			"--caution": "var(--caution-step-500)",
			"--caution-foreground": "var(--caution-step-700)",
			"--destructive": "var(--destructive-step-500)",
			"--destructive-foreground": "var(--destructive-step-700)",
		})) {
			expect(readProperty(uiTokens, property)).toBe(value);
		}
		expect(readRule(uiTokens, ".dark")).not.toContain("--primary-foreground:");
	});

	it("inverts the same complete set of steps for every semantic ramp", () => {
		const root = readRule(uiTokens, ":root");
		const dark = readRule(uiTokens, ".dark");
		const steps = [
			25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000,
		];
		for (const family of [
			"neutral",
			"primary",
			"secondary",
			"constructive",
			"caution",
			"destructive",
		]) {
			for (const [index, step] of steps.entries()) {
				expect(readProperty(root, `--${family}-step-${step}`)).toBe(
					`var(--${family}-${step})`,
				);
				expect(readProperty(dark, `--${family}-step-${step}`)).toBe(
					`var(--${family}-${steps[steps.length - index - 1]})`,
				);
			}
		}
	});

	it("exposes only canonical color family names for status styling", () => {
		expect(uiTokens).not.toMatch(/--(?:color-)?status-/);
	});
});
