import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../local.ts";

const TEST_DIR = join(tmpdir(), `storage-test-${Date.now()}`);
const BASE_URL = "/uploads";

describe("LocalStorageProvider", () => {
	let provider: LocalStorageProvider;

	beforeEach(() => {
		provider = new LocalStorageProvider(TEST_DIR, BASE_URL);
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	it("creates the base directory on construction", () => {
		expect(existsSync(TEST_DIR)).toBe(true);
	});

	it("handles trailing slash on baseUrl", () => {
		const p = new LocalStorageProvider(TEST_DIR, "/uploads/");
		expect(p.getUrl("test.png")).toBe("/uploads/test.png");
	});

	describe("upload", () => {
		it("writes a Buffer to disk and returns url + key", async () => {
			const content = Buffer.from("hello world");
			const result = await provider.upload({
				key: "test.txt",
				content,
				contentType: "text/plain",
			});
			expect(result.url).toBe("/uploads/test.txt");
			expect(result.key).toBe("test.txt");

			const written = readFileSync(join(TEST_DIR, "test.txt"), "utf-8");
			expect(written).toBe("hello world");
		});

		it("writes an ArrayBuffer to disk", async () => {
			const content = new TextEncoder().encode("arraybuffer data").buffer;
			const result = await provider.upload({
				key: "ab.txt",
				content,
				contentType: "text/plain",
			});
			expect(result.key).toBe("ab.txt");

			const written = readFileSync(join(TEST_DIR, "ab.txt"), "utf-8");
			expect(written).toBe("arraybuffer data");
		});

		it("creates nested directories as needed", async () => {
			const result = await provider.upload({
				key: "images/products/photo.jpg",
				content: Buffer.from("jpeg data"),
				contentType: "image/jpeg",
			});
			expect(result.url).toBe("/uploads/images/products/photo.jpg");
			expect(
				existsSync(join(TEST_DIR, "images", "products", "photo.jpg")),
			).toBe(true);
		});

		it("overwrites existing files", async () => {
			await provider.upload({
				key: "overwrite.txt",
				content: Buffer.from("first"),
				contentType: "text/plain",
			});
			await provider.upload({
				key: "overwrite.txt",
				content: Buffer.from("second"),
				contentType: "text/plain",
			});
			const written = readFileSync(join(TEST_DIR, "overwrite.txt"), "utf-8");
			expect(written).toBe("second");
		});
	});

	describe("delete", () => {
		it("removes an existing file", async () => {
			await provider.upload({
				key: "to-delete.txt",
				content: Buffer.from("delete me"),
				contentType: "text/plain",
			});
			expect(existsSync(join(TEST_DIR, "to-delete.txt"))).toBe(true);

			await provider.delete({ key: "to-delete.txt" });
			expect(existsSync(join(TEST_DIR, "to-delete.txt"))).toBe(false);
		});

		it("does not throw when deleting a non-existent file", async () => {
			await expect(
				provider.delete({ key: "nonexistent.txt" }),
			).resolves.toBeUndefined();
		});

		it("rejects path traversal in delete", async () => {
			await expect(
				provider.delete({ key: "../../../etc/passwd" }),
			).rejects.toThrow("path traversal");
		});
	});

	describe("path traversal protection", () => {
		it("rejects upload keys with .. segments", async () => {
			await expect(
				provider.upload({
					key: "../outside/file.txt",
					content: Buffer.from("malicious"),
					contentType: "text/plain",
				}),
			).rejects.toThrow("path traversal");
		});

		it("rejects upload keys that escape via nested traversal", async () => {
			await expect(
				provider.upload({
					key: "stores/abc/../../../../../../../etc/passwd",
					content: Buffer.from("malicious"),
					contentType: "text/plain",
				}),
			).rejects.toThrow("path traversal");
		});

		it("allows keys with legitimate nested paths", async () => {
			const result = await provider.upload({
				key: "stores/abc123/image.png",
				content: Buffer.from("ok"),
				contentType: "image/png",
			});
			expect(result.key).toBe("stores/abc123/image.png");
		});
	});

	describe("getUrl", () => {
		it("returns base URL + key", () => {
			expect(provider.getUrl("images/photo.png")).toBe(
				"/uploads/images/photo.png",
			);
		});
	});

	describe("healthCheck", () => {
		it("returns true when base directory exists", async () => {
			expect(await provider.healthCheck()).toBe(true);
		});

		it("returns false when base directory is removed", async () => {
			rmSync(TEST_DIR, { recursive: true, force: true });
			expect(await provider.healthCheck()).toBe(false);
		});
	});
});
