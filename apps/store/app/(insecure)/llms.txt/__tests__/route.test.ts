import { describe, expect, it, vi } from "vitest";

vi.mock("template/llms.txt", () => ({
	default: "# 86d Store\n\nThis is the store overview for AI assistants.",
}));

const { GET } = await import("../route");

describe("GET /llms.txt", () => {
	it("returns 200 with the template text content", async () => {
		const response = await GET();
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toContain("86d Store");
	});

	it("sets Content-Type to text/plain", async () => {
		const response = await GET();
		expect(response.headers.get("Content-Type")).toContain("text/plain");
	});

	it("returns the full template text without modification", async () => {
		const response = await GET();
		const text = await response.text();
		expect(text).toBe(
			"# 86d Store\n\nThis is the store overview for AI assistants.",
		);
	});
});
