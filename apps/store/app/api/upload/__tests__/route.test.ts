import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	verifyStoreAdminAccess: vi.fn(),
	upload: vi.fn(),
	delete: vi.fn(),
	rateLimitCheck: vi.fn(),
	loggerError: vi.fn(),
}));

vi.mock("auth/actions", () => ({
	getSession: mocks.getSession,
}));

vi.mock("auth/store-access", () => ({
	verifyStoreAdminAccess: mocks.verifyStoreAdminAccess,
}));

vi.mock("env", () => ({
	default: {
		STORE_ID: "store-123",
	},
}));

vi.mock("utils/logger", () => ({
	logger: {
		error: mocks.loggerError,
	},
}));

vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({
		check: mocks.rateLimitCheck,
	}),
}));

vi.mock("~/lib/storage", () => ({
	getStorage: () => ({
		upload: mocks.upload,
		delete: mocks.delete,
		getUrl: vi.fn(),
		healthCheck: vi.fn(),
	}),
}));

const { DELETE, POST } = await import("../route");

const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("/api/upload route", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.verifyStoreAdminAccess.mockReset();
		mocks.upload.mockReset();
		mocks.delete.mockReset();
		mocks.rateLimitCheck.mockReset();
		mocks.loggerError.mockReset();

		mocks.getSession.mockResolvedValue({
			user: { id: "user-1" },
		});
		mocks.verifyStoreAdminAccess.mockReturnValue({ hasAccess: true });
		mocks.rateLimitCheck.mockReturnValue({
			allowed: true,
			resetAt: Date.now() + 60_000,
		});
		mocks.upload.mockResolvedValue({
			key: "stores/store-123/uuid-123",
			url: "http://minio:9000/86d-uploads/stores/store-123/uuid-123",
		});
		mocks.delete.mockResolvedValue(undefined);
		vi.spyOn(crypto, "randomUUID").mockReturnValue("uuid-123");
		delete process.env.STORAGE_PUBLIC_URL_MODE;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.STORAGE_PUBLIC_URL_MODE;
	});

	it("returns proxied upload URLs in proxy mode", async () => {
		process.env.STORAGE_PUBLIC_URL_MODE = "proxy";

		const formData = new FormData();
		formData.append(
			"file",
			new File([PNG_BYTES], "image.png", { type: "image/png" }),
		);

		const response = await POST(
			new Request("http://localhost/api/upload", {
				method: "POST",
				body: formData,
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			url: "/uploads/stores/store-123/uuid-123",
		});
		expect(mocks.upload).toHaveBeenCalledWith({
			key: "stores/store-123/uuid-123",
			content: expect.any(ArrayBuffer),
			contentType: "image/png",
		});
	});

	it("returns direct provider URLs in direct mode", async () => {
		const formData = new FormData();
		formData.append(
			"file",
			new File([PNG_BYTES], "image.png", { type: "image/png" }),
		);

		const response = await POST(
			new Request("http://localhost/api/upload", {
				method: "POST",
				body: formData,
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			url: "http://minio:9000/86d-uploads/stores/store-123/uuid-123",
		});
	});

	it("accepts proxied upload URLs for deletion", async () => {
		const response = await DELETE(
			new Request("http://localhost/api/upload", {
				method: "DELETE",
				body: JSON.stringify({
					key: "/uploads/stores/store-123/uuid-123",
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(mocks.delete).toHaveBeenCalledWith({
			key: "stores/store-123/uuid-123",
		});
	});

	it("rejects malformed proxied upload keys", async () => {
		const response = await DELETE(
			new Request("http://localhost/api/upload", {
				method: "DELETE",
				body: JSON.stringify({
					key: "/uploads/stores/store-123/../escape",
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "Invalid key" });
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("rejects cross-store deletion keys", async () => {
		const response = await DELETE(
			new Request("http://localhost/api/upload", {
				method: "DELETE",
				body: JSON.stringify({
					key: "stores/other-store/uuid-123",
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}),
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
		expect(mocks.delete).not.toHaveBeenCalled();
	});
});
