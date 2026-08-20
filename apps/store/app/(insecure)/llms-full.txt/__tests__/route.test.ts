import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	generateLlmsFullMarkdown: vi.fn(),
}));

vi.mock("~/lib/llms-content", () => ({
	generateLlmsFullMarkdown: mocks.generateLlmsFullMarkdown,
}));

const { GET } = await import("../route");

describe("GET /llms-full.txt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with markdown content and correct headers", async () => {
		const content = "# Store\n\n## Products\n\n- Sneaker";
		mocks.generateLlmsFullMarkdown.mockResolvedValue(content);

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/plain");
		expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
		const text = await response.text();
		expect(text).toBe(content);
	});

	it("returns 503 with fallback message when generation fails", async () => {
		mocks.generateLlmsFullMarkdown.mockRejectedValue(
			new Error("DB unavailable"),
		);

		const response = await GET();

		expect(response.status).toBe(503);
		const text = await response.text();
		expect(text).toContain("unavailable");
	});

	it("sets stale-while-revalidate in cache control on success", async () => {
		mocks.generateLlmsFullMarkdown.mockResolvedValue("# Content");
		const response = await GET();
		expect(response.headers.get("Cache-Control")).toContain(
			"stale-while-revalidate",
		);
	});
});
