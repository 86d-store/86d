import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isHoldFillComplete } from "~/console/hold-to-confirm-button";

const source = readFileSync(
	resolve(import.meta.dirname, "../console/hold-to-confirm-button.tsx"),
	"utf8",
);

describe("isHoldFillComplete", () => {
	const overlay = { id: "overlay" };

	it("confirms only when the fill finishes while the pointer is still held", () => {
		expect(
			isHoldFillComplete(
				{
					propertyName: "clip-path",
					target: overlay,
					currentTarget: overlay,
				},
				true,
				false,
			),
		).toBe(true);
	});

	it("does not confirm a click or an early release", () => {
		expect(
			isHoldFillComplete(
				{
					propertyName: "clip-path",
					target: overlay,
					currentTarget: overlay,
				},
				false,
				false,
			),
		).toBe(false);
	});

	it("does not confirm twice", () => {
		expect(
			isHoldFillComplete(
				{
					propertyName: "clip-path",
					target: overlay,
					currentTarget: overlay,
				},
				true,
				true,
			),
		).toBe(false);
	});

	it("ignores bubbled transitions from nested content", () => {
		expect(
			isHoldFillComplete(
				{
					propertyName: "clip-path",
					target: { id: "child" },
					currentTarget: overlay,
				},
				true,
				false,
			),
		).toBe(false);
	});
});

describe("HoldToConfirmButton fill", () => {
	it("reveals left to right over 2s linear and snaps back in 200ms", () => {
		expect(source).toContain("[clip-path:inset(0_100%_0_0)]");
		expect(source).toContain(
			"group-data-[holding]/button:[clip-path:inset(0_0_0_0)]",
		);
		expect(source).toContain("group-data-[holding]/button:duration-[2s]");
		expect(source).toContain("group-data-[holding]/button:ease-linear");
		expect(source).toContain("duration-200");
		expect(source).toContain("ease-[var(--ease-out-strong)]");
	});
});
