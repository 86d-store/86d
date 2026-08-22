import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setProcessEnv } from "env/process-env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getUrl: vi.fn(),
}));

vi.mock("~/lib/storage", () => ({
	getStorage: () => ({
		upload: vi.fn(),
		delete: vi.fn(),
		getUrl: mocks.getUrl,
		healthCheck: vi.fn(),
	}),
}));

describe("/uploads route", () => {
	let localUploadsDir: string;

	beforeEach(() => {
		localUploadsDir = mkdtempSync(join(tmpdir(), "86d-uploads-"));
		mocks.getUrl.mockReset();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	afterEach(() => {
		setProcessEnv("STORAGE_CLIENT", undefined);
		setProcessEnv("STORAGE_LOCAL_DIR", undefined);
		setProcessEnv("STORAGE_PUBLIC_URL_MODE", undefined);
		rmSync(localUploadsDir, { recursive: true, force: true });
	});

	it("serves local files when local storage is enabled", async () => {
		setProcessEnv("STORAGE_CLIENT", "local");
		setProcessEnv("STORAGE_LOCAL_DIR", localUploadsDir);

		const imagePath = join(localUploadsDir, "stores", "store-123", "image.png");
		mkdirSync(join(localUploadsDir, "stores", "store-123"), {
			recursive: true,
		});
		writeFileSync(imagePath, PNG_BYTES);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: ["stores", "store-123", "image.png"],
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	it("blocks local path traversal attempts", async () => {
		setProcessEnv("STORAGE_CLIENT", "local");
		setProcessEnv("STORAGE_LOCAL_DIR", localUploadsDir);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: ["..", "secret.txt"],
			}),
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
	});

	it("proxies S3-backed SVG uploads with hardened headers", async () => {
		setProcessEnv("STORAGE_CLIENT", "s3");
		setProcessEnv("STORAGE_PUBLIC_URL_MODE", "proxy");
		mocks.getUrl.mockReturnValue(
			"http://minio:9000/86d-uploads/stores/store-123/object",
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<svg></svg>", {
				status: 200,
				headers: {
					"Content-Type": "image/svg+xml; charset=utf-8",
					"Content-Length": "11",
					ETag: '"etag-123"',
				},
			}),
		);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: ["stores", "store-123", "object"],
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(
			"image/svg+xml; charset=utf-8",
		);
		expect(response.headers.get("Content-Security-Policy")).toBe(
			"default-src 'none'; style-src 'unsafe-inline'",
		);
		expect(response.headers.get("ETag")).toBe('"etag-123"');
		expect(mocks.getUrl).toHaveBeenCalledWith("stores/store-123/object");
	});

	it("proxies deeply nested seed asset paths", async () => {
		setProcessEnv("STORAGE_CLIENT", "s3");
		setProcessEnv("STORAGE_PUBLIC_URL_MODE", "proxy");
		mocks.getUrl.mockReturnValue(
			"http://minio:9000/86d-uploads/stores/store-123/seed/luxury-house/blog/inside-the-atelier.webp",
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(PNG_BYTES, {
				status: 200,
				headers: {
					"Content-Type": "image/webp",
				},
			}),
		);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: [
					"stores",
					"store-123",
					"seed",
					"luxury-house",
					"blog",
					"inside-the-atelier.webp",
				],
			}),
		});

		expect(response.status).toBe(200);
		expect(mocks.getUrl).toHaveBeenCalledWith(
			"stores/store-123/seed/luxury-house/blog/inside-the-atelier.webp",
		);
	});

	it("adds attachment headers for proxied PDFs", async () => {
		setProcessEnv("STORAGE_CLIENT", "s3");
		setProcessEnv("STORAGE_PUBLIC_URL_MODE", "proxy");
		mocks.getUrl.mockReturnValue(
			"http://minio:9000/86d-uploads/stores/store-123/manual",
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("%PDF", {
				status: 200,
				headers: {
					"Content-Type": "application/pdf",
				},
			}),
		);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: ["stores", "store-123", "manual"],
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Disposition")).toBe("attachment");
	});

	it("returns 404 when the proxied S3 object is missing", async () => {
		setProcessEnv("STORAGE_CLIENT", "s3");
		setProcessEnv("STORAGE_PUBLIC_URL_MODE", "proxy");
		mocks.getUrl.mockReturnValue(
			"http://minio:9000/86d-uploads/stores/store-123/missing",
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("missing", { status: 404 }),
		);

		const { GET } = await import("../route");
		const response = await GET(new Request("http://localhost/uploads/test"), {
			params: Promise.resolve({
				path: ["stores", "store-123", "missing"],
			}),
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: "Not found" });
	});
});

const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
