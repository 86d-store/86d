import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VercelBlobProvider } from "../vercel.ts";

// Mock @vercel/blob
vi.mock("@vercel/blob", () => ({
	put: vi.fn(),
	del: vi.fn(),
}));

describe("VercelBlobProvider", () => {
	let provider: VercelBlobProvider;

	beforeEach(() => {
		provider = new VercelBlobProvider();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.VERCEL_BLOB_STORAGE_HOSTNAME;
		delete process.env.BLOB_READ_WRITE_TOKEN;
	});

	describe("upload", () => {
		it("calls @vercel/blob put and returns url + key", async () => {
			const { put } = await import("@vercel/blob");
			vi.mocked(put).mockResolvedValueOnce({
				url: "https://blob.vercel-storage.com/uploads/photo.png",
				downloadUrl: "https://blob.vercel-storage.com/uploads/photo.png",
				pathname: "uploads/photo.png",
				contentType: "image/png",
				contentDisposition: "",
			});

			const result = await provider.upload({
				key: "uploads/photo.png",
				content: Buffer.from("png data"),
				contentType: "image/png",
			});

			expect(result.url).toBe(
				"https://blob.vercel-storage.com/uploads/photo.png",
			);
			expect(result.key).toBe("uploads/photo.png");
			expect(put).toHaveBeenCalledWith(
				"uploads/photo.png",
				expect.any(Buffer),
				{ access: "public", contentType: "image/png" },
			);
		});

		it("converts ArrayBuffer to Buffer", async () => {
			const { put } = await import("@vercel/blob");
			vi.mocked(put).mockResolvedValueOnce({
				url: "https://blob.vercel-storage.com/file.txt",
				downloadUrl: "https://blob.vercel-storage.com/file.txt",
				pathname: "file.txt",
				contentType: "text/plain",
				contentDisposition: "",
			});

			const content = new TextEncoder().encode("text data").buffer;
			await provider.upload({
				key: "file.txt",
				content,
				contentType: "text/plain",
			});

			expect(put).toHaveBeenCalledWith(
				"file.txt",
				expect.any(Buffer),
				expect.any(Object),
			);
		});
	});

	describe("delete", () => {
		it("calls @vercel/blob del", async () => {
			const { del } = await import("@vercel/blob");
			vi.mocked(del).mockResolvedValueOnce(undefined);

			await provider.delete({ key: "uploads/old.png" });
			expect(del).toHaveBeenCalledWith("uploads/old.png");
		});
	});

	describe("getUrl", () => {
		it("returns hostname-based URL when VERCEL_BLOB_STORAGE_HOSTNAME is set", () => {
			process.env.VERCEL_BLOB_STORAGE_HOSTNAME =
				"myblob.public.blob.vercel-storage.com";
			expect(provider.getUrl("uploads/photo.png")).toBe(
				"https://myblob.public.blob.vercel-storage.com/uploads/photo.png",
			);
		});

		it("returns key as fallback when hostname is not set", () => {
			expect(provider.getUrl("uploads/photo.png")).toBe("uploads/photo.png");
		});
	});

	describe("healthCheck", () => {
		it("returns true when BLOB_READ_WRITE_TOKEN is set", async () => {
			process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_xxx";
			expect(await provider.healthCheck()).toBe(true);
		});

		it("returns false when BLOB_READ_WRITE_TOKEN is not set", async () => {
			expect(await provider.healthCheck()).toBe(false);
		});
	});
});
