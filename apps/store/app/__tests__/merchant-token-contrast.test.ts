import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storeTokens = readFileSync(
	new URL("../merchant-tokens.css", import.meta.url),
	"utf8",
);
const uiTokens = readFileSync(
	new URL("../../../../packages/ui/src/globals.css", import.meta.url),
	"utf8",
);
const templateHome = readFileSync(
	new URL("../../../../templates/brisa/index.mdx", import.meta.url),
	"utf8",
);

function readProperty(css: string, property: string): string {
	const match = css.match(
		new RegExp(`^\\s*${property.replaceAll("-", "\\-")}:\\s*([^;]+);`, "m"),
	);
	if (!match?.[1]) {
		throw new Error(`Missing CSS property ${property}`);
	}
	return match[1].trim();
}

function readRule(css: string, selector: string): string {
	const ruleStart = css.indexOf(`${selector} {`);
	if (ruleStart === -1) {
		throw new Error(`Missing CSS rule ${selector}`);
	}
	const bodyStart = css.indexOf("{", ruleStart) + 1;
	const bodyEnd = css.indexOf("}", bodyStart);
	if (bodyEnd === -1) {
		throw new Error(`Unclosed CSS rule ${selector}`);
	}
	return css.slice(bodyStart, bodyEnd);
}

function oklchToLinearRgb(value: string): [number, number, number] {
	const match = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);
	if (!match) {
		throw new Error(`Expected an opaque OKLCH color, received ${value}`);
	}
	const lightness = Number(match[1]) / 100;
	const chroma = Number(match[2]);
	const hue = (Number(match[3]) * Math.PI) / 180;
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map((channel) => Math.max(0, Math.min(1, channel))) as [
		number,
		number,
		number,
	];
}

function luminance(color: [number, number, number]): number {
	return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
}

function contrast(
	first: [number, number, number],
	second: [number, number, number],
): number {
	const firstLuminance = luminance(first);
	const secondLuminance = luminance(second);
	return (
		(Math.max(firstLuminance, secondLuminance) + 0.05) /
		(Math.min(firstLuminance, secondLuminance) + 0.05)
	);
}

function composite(
	foreground: [number, number, number],
	background: [number, number, number],
	alpha: number,
): [number, number, number] {
	const toSrgb = (channel: number) =>
		channel <= 0.0031308
			? 12.92 * channel
			: 1.055 * channel ** (1 / 2.4) - 0.055;
	const toLinear = (channel: number) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	return foreground.map((channel, index) =>
		toLinear(
			toSrgb(channel) * alpha + toSrgb(background[index] ?? 0) * (1 - alpha),
		),
	) as [number, number, number];
}

describe("merchant semantic color contrast", () => {
	for (const [name, css] of [
		["Store", storeTokens],
		["@86d-app/ui", uiTokens],
	] as const) {
		it(`${name} keeps muted text and primary actions at WCAG AA contrast`, () => {
			const darkTokens = readRule(css, ".dark");
			expect(readProperty(css, "--muted-foreground")).toBe(
				"var(--neutral-step-600)",
			);
			expect(readProperty(css, "--primary")).toBe("var(--primary-step-800)");
			expect(readProperty(css, "--primary-foreground")).toBe(
				"var(--primary-step-25)",
			);
			expect(readProperty(darkTokens, "--primary-step-800")).toBe(
				"var(--primary-200)",
			);
			expect(readProperty(darkTokens, "--primary-step-25")).toBe(
				"var(--primary-1000)",
			);
			const lightBackground = oklchToLinearRgb(
				readProperty(css, "--neutral-25"),
			);
			const lightCard = oklchToLinearRgb(readProperty(css, "--card"));
			const primaryForeground = oklchToLinearRgb(
				readProperty(css, "--primary-25"),
			);
			const primaryBackground = oklchToLinearRgb(
				readProperty(css, "--primary-800"),
			);
			const darkBackground = oklchToLinearRgb(
				readProperty(css, "--neutral-1000"),
			);
			const darkCard = oklchToLinearRgb(readProperty(css, "--neutral-950"));
			const darkPrimary = oklchToLinearRgb(readProperty(css, "--primary-200"));
			const darkPrimaryForeground = oklchToLinearRgb(
				readProperty(css, "--primary-1000"),
			);
			expect(
				contrast(
					oklchToLinearRgb(readProperty(css, "--neutral-600")),
					lightBackground,
				),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(
					oklchToLinearRgb(readProperty(css, "--neutral-600")),
					lightCard,
				),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(primaryForeground, primaryBackground),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(
					primaryForeground,
					composite(primaryBackground, lightBackground, 0.8),
				),
			).toBeGreaterThanOrEqual(4.5);
			for (const opacity of [0.8, 0.9]) {
				expect(
					contrast(
						primaryForeground,
						composite(primaryBackground, lightCard, opacity),
					),
				).toBeGreaterThanOrEqual(4.5);
			}
			expect(
				contrast(
					oklchToLinearRgb(readProperty(css, "--neutral-400")),
					darkBackground,
				),
			).toBeGreaterThanOrEqual(4.5);
			expect(contrast(darkPrimary, darkBackground)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(darkPrimary, darkCard)).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(darkPrimaryForeground, darkPrimary),
			).toBeGreaterThanOrEqual(4.5);
			for (const [background, opacity] of [
				[darkBackground, 0.8],
				[darkCard, 0.8],
				[darkCard, 0.9],
			] as const) {
				expect(
					contrast(
						darkPrimaryForeground,
						composite(darkPrimary, background, opacity),
					),
				).toBeGreaterThanOrEqual(4.5);
			}
		});
	}

	it("keeps the Store and published UI semantic aliases aligned", () => {
		for (const property of [
			"--muted-foreground",
			"--primary",
			"--primary-foreground",
		]) {
			expect(readProperty(storeTokens, property)).toBe(
				readProperty(uiTokens, property),
			);
		}
	});

	it("keeps the muted hero phrase readable at its large-text opacity", () => {
		expect(templateHome).toContain("text-muted-foreground/70");
		const background = oklchToLinearRgb(
			readProperty(storeTokens, "--neutral-25"),
		);
		const muted = oklchToLinearRgb(readProperty(storeTokens, "--neutral-600"));
		expect(
			contrast(composite(muted, background, 0.7), background),
		).toBeGreaterThanOrEqual(3);
	});
});
