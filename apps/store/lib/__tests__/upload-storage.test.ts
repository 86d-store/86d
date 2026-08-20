import { afterEach, describe, expect, it } from "vitest";

import {
	buildPublicUploadUrl,
	hasInvalidUploadKey,
	isProxyingUploadUrls,
	normalizeUploadKey,
} from "../upload-storage";

// ── isProxyingUploadUrls ────────────────────────────────────────────

describe("isProxyingUploadUrls", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("returns false when STORAGE_PUBLIC_URL_MODE is unset", () => {
		delete process.env.STORAGE_PUBLIC_URL_MODE;
		expect(isProxyingUploadUrls()).toBe(false);
	});

	it("returns true when STORAGE_PUBLIC_URL_MODE is proxy", () => {
		process.env.STORAGE_PUBLIC_URL_MODE = "proxy";
		expect(isProxyingUploadUrls()).toBe(true);
	});

	it("returns false when STORAGE_PUBLIC_URL_MODE is direct", () => {
		process.env.STORAGE_PUBLIC_URL_MODE = "direct";
		expect(isProxyingUploadUrls()).toBe(false);
	});

	it("returns false for any other value", () => {
		process.env.STORAGE_PUBLIC_URL_MODE = "cdn";
		expect(isProxyingUploadUrls()).toBe(false);
	});
});

// ── buildPublicUploadUrl ────────────────────────────────────────────

describe("buildPublicUploadUrl", () => {
	it("prepends the /uploads/ prefix to a bare key", () => {
		expect(buildPublicUploadUrl("images/photo.jpg")).toBe(
			"/uploads/images/photo.jpg",
		);
	});

	it("works with a simple filename", () => {
		expect(buildPublicUploadUrl("banner.png")).toBe("/uploads/banner.png");
	});

	it("preserves a nested key structure", () => {
		expect(buildPublicUploadUrl("a/b/c/file.webp")).toBe(
			"/uploads/a/b/c/file.webp",
		);
	});
});

// ── normalizeUploadKey ──────────────────────────────────────────────

describe("normalizeUploadKey", () => {
	it("returns empty string for empty input", () => {
		expect(normalizeUploadKey("")).toBe("");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(normalizeUploadKey("   ")).toBe("");
	});

	it("trims leading/trailing whitespace from a bare key", () => {
		expect(normalizeUploadKey("  images/photo.jpg  ")).toBe("images/photo.jpg");
	});

	it("extracts pathname from an absolute http URL", () => {
		expect(
			normalizeUploadKey("http://cdn.example.com/uploads/images/photo.jpg"),
		).toBe("images/photo.jpg");
	});

	it("extracts pathname from an absolute https URL", () => {
		expect(
			normalizeUploadKey("https://cdn.example.com/uploads/images/photo.jpg"),
		).toBe("images/photo.jpg");
	});

	it("handles absolute URL with no /uploads/ prefix in pathname", () => {
		expect(normalizeUploadKey("https://cdn.example.com/raw/file.jpg")).toBe("");
	});

	it("strips the /uploads/ prefix when present as a path prefix", () => {
		expect(normalizeUploadKey("/uploads/products/shirt.jpg")).toBe(
			"products/shirt.jpg",
		);
	});

	it("returns empty string for other absolute paths starting with /", () => {
		expect(normalizeUploadKey("/other/path/file.jpg")).toBe("");
	});

	it("returns bare key as-is when already normalized", () => {
		expect(normalizeUploadKey("products/shirt.jpg")).toBe("products/shirt.jpg");
	});

	it("returns empty string for invalid absolute URL", () => {
		expect(normalizeUploadKey("http://[not-a-valid-url")).toBe("");
	});
});

// ── hasInvalidUploadKey ─────────────────────────────────────────────

describe("hasInvalidUploadKey", () => {
	it("returns true for empty string", () => {
		expect(hasInvalidUploadKey("")).toBe(true);
	});

	it("returns true for null byte (security)", () => {
		expect(hasInvalidUploadKey("path/\0/file")).toBe(true);
	});

	it("returns true for dot-dot segment (path traversal)", () => {
		expect(hasInvalidUploadKey("path/../etc/passwd")).toBe(true);
	});

	it("returns true for single dot segment", () => {
		expect(hasInvalidUploadKey("path/./file")).toBe(true);
	});

	it("returns true for empty segment (double slash)", () => {
		expect(hasInvalidUploadKey("path//file")).toBe(true);
	});

	it("returns false for a valid key", () => {
		expect(hasInvalidUploadKey("images/product-photo.jpg")).toBe(false);
	});

	it("returns false for a simple filename", () => {
		expect(hasInvalidUploadKey("banner.png")).toBe(false);
	});

	it("returns false for deeply nested valid key", () => {
		expect(hasInvalidUploadKey("year/2025/uploads/photo.webp")).toBe(false);
	});

	it("returns true for leading dot-dot", () => {
		expect(hasInvalidUploadKey("../etc/passwd")).toBe(true);
	});
});
