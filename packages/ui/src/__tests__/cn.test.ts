import { describe, expect, it } from "vitest";
import { cn } from "../lib/utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("px-2", "py-1")).toBe("px-2 py-1");
	});

	it("handles conditional classes", () => {
		expect(cn("base", false && "hidden", "visible")).toBe("base visible");
	});

	it("resolves Tailwind conflicts by keeping the last class", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});

	it("handles undefined and null inputs", () => {
		expect(cn("base", undefined, null, "end")).toBe("base end");
	});

	it("handles empty inputs", () => {
		expect(cn()).toBe("");
		expect(cn("")).toBe("");
	});

	it("handles arrays of classes", () => {
		expect(cn(["px-2", "py-1"])).toBe("px-2 py-1");
	});

	it("handles object syntax for conditional classes", () => {
		expect(cn({ "bg-red-500": true, "bg-blue-500": false })).toBe("bg-red-500");
	});

	it("merges complex Tailwind classes correctly", () => {
		expect(cn("border-t border-b", "border-t-2")).toBe("border-b border-t-2");
	});
});
