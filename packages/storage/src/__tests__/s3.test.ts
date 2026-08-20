import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3StorageProvider } from "../s3.ts";

const DEFAULT_CONFIG = {
	endpoint: "https://s3.example.com",
	bucket: "test-bucket",
	region: "us-east-1",
	accessKey: "AKIAIOSFODNN7EXAMPLE",
	secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("S3StorageProvider", () => {
	let provider: S3StorageProvider;
	const fetchMock = vi.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		provider = new S3StorageProvider(DEFAULT_CONFIG);
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getUrl", () => {
		it("returns path-style URL", () => {
			expect(provider.getUrl("images/photo.png")).toBe(
				"https://s3.example.com/test-bucket/images/photo.png",
			);
		});

		it("strips trailing slash from endpoint", () => {
			const p = new S3StorageProvider({
				...DEFAULT_CONFIG,
				endpoint: "https://s3.example.com/",
			});
			expect(p.getUrl("file.txt")).toBe(
				"https://s3.example.com/test-bucket/file.txt",
			);
		});

		it("returns virtual-hosted URL when virtualHosted is true", () => {
			const p = new S3StorageProvider({
				...DEFAULT_CONFIG,
				virtualHosted: true,
			});
			expect(p.getUrl("images/photo.png")).toBe(
				"https://test-bucket.s3.example.com/images/photo.png",
			);
		});
	});

	describe("upload", () => {
		it("sends a PUT request with signed headers", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

			const result = await provider.upload({
				key: "uploads/image.png",
				content: Buffer.from("png data"),
				contentType: "image/png",
			});

			expect(result).toEqual({
				url: "https://s3.example.com/test-bucket/uploads/image.png",
				key: "uploads/image.png",
			});

			expect(fetchMock).toHaveBeenCalledOnce();
			const [url, opts] = fetchMock.mock.calls[0];
			expect(url).toBe("https://s3.example.com/test-bucket/uploads/image.png");
			expect(opts.method).toBe("PUT");
			expect(opts.headers).toHaveProperty("authorization");
			expect(opts.headers.authorization).toContain("AWS4-HMAC-SHA256");
			expect(opts.headers["x-amz-date"]).toBeDefined();
			expect(opts.headers["x-amz-content-sha256"]).toBeDefined();
		});

		it("converts ArrayBuffer to Buffer before upload", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

			const content = new TextEncoder().encode("data").buffer;
			const result = await provider.upload({
				key: "file.txt",
				content,
				contentType: "text/plain",
			});

			expect(result.key).toBe("file.txt");
			expect(fetchMock).toHaveBeenCalledOnce();
		});

		it("throws on non-OK response", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response("Access Denied", { status: 403, statusText: "Forbidden" }),
			);

			await expect(
				provider.upload({
					key: "file.txt",
					content: Buffer.from("data"),
					contentType: "text/plain",
				}),
			).rejects.toThrow("S3 upload failed: 403 Forbidden");
		});
	});

	describe("delete", () => {
		it("sends a DELETE request with signed headers", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

			await provider.delete({ key: "uploads/old.png" });

			expect(fetchMock).toHaveBeenCalledOnce();
			const [url, opts] = fetchMock.mock.calls[0];
			expect(url).toBe("https://s3.example.com/test-bucket/uploads/old.png");
			expect(opts.method).toBe("DELETE");
			expect(opts.headers.authorization).toContain("AWS4-HMAC-SHA256");
		});

		it("ignores 404 responses", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response(null, { status: 404, statusText: "Not Found" }),
			);

			await expect(
				provider.delete({ key: "nonexistent.txt" }),
			).resolves.toBeUndefined();
		});

		it("throws on other error responses", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response("Internal Error", {
					status: 500,
					statusText: "Internal Server Error",
				}),
			);

			await expect(provider.delete({ key: "file.txt" })).rejects.toThrow(
				"S3 delete failed: 500 Internal Server Error",
			);
		});
	});

	describe("healthCheck", () => {
		it("returns true on 200", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
			expect(await provider.healthCheck()).toBe(true);
		});

		it("returns true on 404 (bucket exists but empty)", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
			expect(await provider.healthCheck()).toBe(true);
		});

		it("returns true on 403 (bucket exists but no list perm)", async () => {
			fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
			expect(await provider.healthCheck()).toBe(true);
		});

		it("returns false on network error", async () => {
			fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
			expect(await provider.healthCheck()).toBe(false);
		});
	});
});
