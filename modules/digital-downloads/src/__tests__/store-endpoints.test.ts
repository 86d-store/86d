import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDigitalDownloadsController } from "../service-impl";

/**
 * Store endpoint integration tests for the digital-downloads module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. use-token: validates token, increments download count, returns file
 * 2. list-my-downloads: auth required, lists customer's download tokens
 * 3. get-file-info: returns downloadable file metadata for product page
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateUseToken(data: DataService, token: string) {
	const controller = createDigitalDownloadsController(data);
	const result = await controller.useToken(token);
	if (!result.ok) {
		return { error: result.reason ?? "Invalid token", status: 400 };
	}
	return { file: result.file, token: result.token };
}

async function simulateListMyDownloads(
	data: DataService,
	opts: { email?: string } = {},
) {
	if (!opts.email) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createDigitalDownloadsController(data);
	const tokens = await controller.listTokensByEmail({ email: opts.email });
	return { tokens };
}

async function simulateGetFileInfo(data: DataService, productId: string) {
	const controller = createDigitalDownloadsController(data);
	const allFiles = await controller.listFiles({ productId });
	const files = allFiles.filter((f) => f.isActive);
	return { files };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: use token — download validation", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("successfully uses a valid token and returns the file", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_ebook",
			name: "ebook.pdf",
			url: "https://storage.example.com/ebook.pdf",
			fileSize: 5000000,
			mimeType: "application/pdf",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "buyer@example.com",
			maxDownloads: 3,
		});

		const result = await simulateUseToken(data, token.token);

		expect("file" in result).toBe(true);
		if ("file" in result) {
			expect(result.file?.name).toBe("ebook.pdf");
		}
		if ("token" in result && result.token) {
			expect(result.token.downloadCount).toBe(1);
		}
	});

	it("rejects an invalid token", async () => {
		const result = await simulateUseToken(data, "invalid_token_xyz");

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
		}
	});

	it("rejects a revoked token", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_1",
			name: "file.zip",
			url: "https://storage.example.com/file.zip",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			maxDownloads: 5,
		});
		await ctrl.revokeToken(token.token);

		const result = await simulateUseToken(data, token.token);

		expect("error" in result).toBe(true);
	});

	it("rejects token that exceeded max downloads", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_1",
			name: "file.zip",
			url: "https://storage.example.com/file.zip",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			maxDownloads: 1,
		});

		// Use the single allowed download
		await ctrl.useToken(token.token);

		// Second attempt should fail
		const result = await simulateUseToken(data, token.token);

		expect("error" in result).toBe(true);
	});

	it("rejects an expired token", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_1",
			name: "file.zip",
			url: "https://storage.example.com/file.zip",
		});
		const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			expiresAt: pastDate,
		});

		const result = await simulateUseToken(data, token.token);

		expect("error" in result).toBe(true);
	});

	it("increments download count on each use", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_1",
			name: "file.zip",
			url: "https://storage.example.com/file.zip",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			maxDownloads: 5,
		});

		await simulateUseToken(data, token.token);
		await simulateUseToken(data, token.token);
		const result = await simulateUseToken(data, token.token);

		expect("token" in result).toBe(true);
		if ("token" in result && result.token) {
			expect(result.token.downloadCount).toBe(3);
		}
	});
});

describe("store endpoint: list my downloads — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListMyDownloads(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns download tokens for the customer's email", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file = await ctrl.createFile({
			productId: "prod_1",
			name: "guide.pdf",
			url: "https://storage.example.com/guide.pdf",
		});
		await ctrl.createToken({
			fileId: file.id,
			email: "buyer@example.com",
		});
		await ctrl.createToken({
			fileId: file.id,
			email: "other@example.com",
		});

		const result = await simulateListMyDownloads(data, {
			email: "buyer@example.com",
		});

		expect("tokens" in result).toBe(true);
		if ("tokens" in result) {
			expect(result.tokens).toHaveLength(1);
		}
	});

	it("returns empty for customer with no downloads", async () => {
		const result = await simulateListMyDownloads(data, {
			email: "nobody@example.com",
		});

		expect("tokens" in result).toBe(true);
		if ("tokens" in result) {
			expect(result.tokens).toHaveLength(0);
		}
	});

	it("returns multiple tokens for the same email", async () => {
		const ctrl = createDigitalDownloadsController(data);
		const file1 = await ctrl.createFile({
			productId: "prod_1",
			name: "ebook.pdf",
			url: "https://storage.example.com/ebook.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod_2",
			name: "course.zip",
			url: "https://storage.example.com/course.zip",
		});
		await ctrl.createToken({
			fileId: file1.id,
			email: "buyer@example.com",
		});
		await ctrl.createToken({
			fileId: file2.id,
			email: "buyer@example.com",
		});

		const result = await simulateListMyDownloads(data, {
			email: "buyer@example.com",
		});

		expect("tokens" in result).toBe(true);
		if ("tokens" in result) {
			expect(result.tokens).toHaveLength(2);
		}
	});
});

describe("store endpoint: get file info — product page display", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns active files for a product", async () => {
		const ctrl = createDigitalDownloadsController(data);
		await ctrl.createFile({
			productId: "prod_ebook",
			name: "ebook.pdf",
			url: "https://storage.example.com/ebook.pdf",
			fileSize: 5000000,
			mimeType: "application/pdf",
		});

		const result = await simulateGetFileInfo(data, "prod_ebook");

		expect(result.files).toHaveLength(1);
		expect(result.files[0].name).toBe("ebook.pdf");
		expect(result.files[0].fileSize).toBe(5000000);
	});

	it("excludes inactive files", async () => {
		const ctrl = createDigitalDownloadsController(data);
		await ctrl.createFile({
			productId: "prod_1",
			name: "active.pdf",
			url: "https://storage.example.com/active.pdf",
		});
		const inactive = await ctrl.createFile({
			productId: "prod_1",
			name: "removed.pdf",
			url: "https://storage.example.com/removed.pdf",
		});
		await ctrl.updateFile(inactive.id, { isActive: false });

		const result = await simulateGetFileInfo(data, "prod_1");

		expect(result.files).toHaveLength(1);
		expect(result.files[0].name).toBe("active.pdf");
	});

	it("returns empty for product with no files", async () => {
		const result = await simulateGetFileInfo(data, "prod_no_files");

		expect(result.files).toHaveLength(0);
	});

	it("returns multiple files for a product", async () => {
		const ctrl = createDigitalDownloadsController(data);
		await ctrl.createFile({
			productId: "prod_course",
			name: "video.mp4",
			url: "https://storage.example.com/video.mp4",
			fileSize: 50000000,
			mimeType: "video/mp4",
		});
		await ctrl.createFile({
			productId: "prod_course",
			name: "slides.pdf",
			url: "https://storage.example.com/slides.pdf",
			fileSize: 2000000,
			mimeType: "application/pdf",
		});

		const result = await simulateGetFileInfo(data, "prod_course");

		expect(result.files).toHaveLength(2);
	});
});
