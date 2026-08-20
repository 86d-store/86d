import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createDigitalDownloadsController } from "../service-impl";

// ---------------------------------------------------------------------------
// getToken (by ID)
// ---------------------------------------------------------------------------

describe("getToken", () => {
	it("returns a token by ID", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
		});
		const fetched = await ctrl.getToken(token.id);
		expect(fetched?.id).toBe(token.id);
		expect(fetched?.email).toBe("user@example.com");
	});

	it("returns null for missing token ID", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		expect(await ctrl.getToken("nope")).toBeNull();
	});

	it("returns token with all fields", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const expiry = new Date("2026-12-31");
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			orderId: "order-1",
			maxDownloads: 5,
			expiresAt: expiry,
		});
		const fetched = await ctrl.getToken(token.id);
		expect(fetched?.orderId).toBe("order-1");
		expect(fetched?.maxDownloads).toBe(5);
		expect(fetched?.expiresAt).toEqual(expiry);
	});
});

// ---------------------------------------------------------------------------
// revokeTokenById
// ---------------------------------------------------------------------------

describe("revokeTokenById", () => {
	it("revokes a token by ID", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
		});
		expect(await ctrl.revokeTokenById(token.id)).toBe(true);

		// Verify the token is revoked by trying to use it
		const result = await ctrl.useToken(token.token);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("Token revoked");
	});

	it("returns false for missing token", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		expect(await ctrl.revokeTokenById("nope")).toBe(false);
	});

	it("sets revokedAt timestamp", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
		});
		await ctrl.revokeTokenById(token.id);
		const fetched = await ctrl.getToken(token.id);
		expect(fetched?.revokedAt).toBeInstanceOf(Date);
	});

	it("revoked token cannot be used", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
		});

		// Use once successfully
		const first = await ctrl.useToken(token.token);
		expect(first.ok).toBe(true);

		// Revoke
		await ctrl.revokeTokenById(token.id);

		// Try to use again
		const second = await ctrl.useToken(token.token);
		expect(second.ok).toBe(false);
		expect(second.reason).toBe("Token revoked");
	});
});

// ---------------------------------------------------------------------------
// createTokenBatch
// ---------------------------------------------------------------------------

describe("createTokenBatch", () => {
	it("creates tokens for multiple files", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file1 = await ctrl.createFile({
			productId: "prod-1",
			name: "chapter1.pdf",
			url: "https://example.com/ch1.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod-1",
			name: "chapter2.pdf",
			url: "https://example.com/ch2.pdf",
		});
		const file3 = await ctrl.createFile({
			productId: "prod-1",
			name: "chapter3.pdf",
			url: "https://example.com/ch3.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file1.id, file2.id, file3.id],
			email: "buyer@example.com",
		});

		expect(tokens).toHaveLength(3);
		expect(tokens[0].fileId).toBe(file1.id);
		expect(tokens[1].fileId).toBe(file2.id);
		expect(tokens[2].fileId).toBe(file3.id);
		expect(tokens[0].email).toBe("buyer@example.com");
	});

	it("applies orderId to all tokens", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file1 = await ctrl.createFile({
			productId: "prod-1",
			name: "file1.pdf",
			url: "https://example.com/f1.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod-2",
			name: "file2.pdf",
			url: "https://example.com/f2.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file1.id, file2.id],
			email: "buyer@example.com",
			orderId: "order-42",
		});

		for (const t of tokens) {
			expect(t.orderId).toBe("order-42");
		}
	});

	it("applies maxDownloads to all tokens", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/f.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file.id],
			email: "buyer@example.com",
			maxDownloads: 3,
		});

		expect(tokens[0].maxDownloads).toBe(3);
	});

	it("applies expiresAt to all tokens", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/f.pdf",
		});
		const expiry = new Date("2026-12-31");

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file.id],
			email: "buyer@example.com",
			expiresAt: expiry,
		});

		expect(tokens[0].expiresAt).toEqual(expiry);
	});

	it("each token has a unique token value", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file1 = await ctrl.createFile({
			productId: "prod-1",
			name: "file1.pdf",
			url: "https://example.com/f1.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod-1",
			name: "file2.pdf",
			url: "https://example.com/f2.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file1.id, file2.id],
			email: "buyer@example.com",
		});

		expect(tokens[0].token).not.toBe(tokens[1].token);
		expect(tokens[0].id).not.toBe(tokens[1].id);
	});

	it("all batch tokens start with downloadCount 0", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/f.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file.id],
			email: "buyer@example.com",
		});

		expect(tokens[0].downloadCount).toBe(0);
	});

	it("batch tokens are usable individually", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/f.pdf",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file.id],
			email: "buyer@example.com",
		});

		const result = await ctrl.useToken(tokens[0].token);
		expect(result.ok).toBe(true);
		expect(result.file?.name).toBe("file.pdf");
	});

	it("returns empty array for empty fileIds", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const tokens = await ctrl.createTokenBatch({
			fileIds: [],
			email: "buyer@example.com",
		});
		expect(tokens).toHaveLength(0);
	});

	it("batch tokens are listed by order", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file1 = await ctrl.createFile({
			productId: "prod-1",
			name: "file1.pdf",
			url: "https://example.com/f1.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod-1",
			name: "file2.pdf",
			url: "https://example.com/f2.pdf",
		});

		await ctrl.createTokenBatch({
			fileIds: [file1.id, file2.id],
			email: "buyer@example.com",
			orderId: "order-99",
		});

		const tokens = await ctrl.listTokens({ orderId: "order-99" });
		expect(tokens).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// updateFile (via controller - existing but tested more thoroughly)
// ---------------------------------------------------------------------------

describe("updateFile extended", () => {
	it("deactivates a file", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const updated = await ctrl.updateFile(file.id, { isActive: false });
		expect(updated?.isActive).toBe(false);
	});

	it("updates file URL", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/old.pdf",
		});
		const updated = await ctrl.updateFile(file.id, {
			url: "https://example.com/new.pdf",
		});
		expect(updated?.url).toBe("https://example.com/new.pdf");
	});

	it("updates file size", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const updated = await ctrl.updateFile(file.id, { fileSize: 2048 });
		expect(updated?.fileSize).toBe(2048);
	});

	it("updates mime type", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const updated = await ctrl.updateFile(file.id, {
			mimeType: "application/pdf",
		});
		expect(updated?.mimeType).toBe("application/pdf");
	});

	it("preserves fields not included in update", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
			fileSize: 1024,
			mimeType: "application/pdf",
		});
		const updated = await ctrl.updateFile(file.id, { name: "new-name.pdf" });
		expect(updated?.name).toBe("new-name.pdf");
		expect(updated?.url).toBe("https://example.com/file.pdf");
		expect(updated?.fileSize).toBe(1024);
		expect(updated?.mimeType).toBe("application/pdf");
	});

	it("returns null for non-existent file", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		expect(await ctrl.updateFile("nope", { name: "fail" })).toBeNull();
	});

	it("updates the updatedAt timestamp", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});
		const updated = await ctrl.updateFile(file.id, { name: "new" });
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			file.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// Token lifecycle integration
// ---------------------------------------------------------------------------

describe("token lifecycle integration", () => {
	it("create → use → check download count → revoke by ID", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file = await ctrl.createFile({
			productId: "prod-1",
			name: "file.pdf",
			url: "https://example.com/file.pdf",
		});

		// Create token
		const token = await ctrl.createToken({
			fileId: file.id,
			email: "user@example.com",
			maxDownloads: 3,
		});

		// Use twice
		await ctrl.useToken(token.token);
		await ctrl.useToken(token.token);

		// Check count via getToken
		const afterUse = await ctrl.getToken(token.id);
		expect(afterUse?.downloadCount).toBe(2);

		// Revoke by ID
		await ctrl.revokeTokenById(token.id);

		// Cannot use anymore
		const result = await ctrl.useToken(token.token);
		expect(result.ok).toBe(false);
	});

	it("batch create → use individually → list by order", async () => {
		const ctrl = createDigitalDownloadsController(createMockDataService());
		const file1 = await ctrl.createFile({
			productId: "prod-1",
			name: "guide.pdf",
			url: "https://example.com/guide.pdf",
		});
		const file2 = await ctrl.createFile({
			productId: "prod-1",
			name: "bonus.mp4",
			url: "https://example.com/bonus.mp4",
		});

		const tokens = await ctrl.createTokenBatch({
			fileIds: [file1.id, file2.id],
			email: "buyer@example.com",
			orderId: "order-100",
			maxDownloads: 5,
		});

		// Use first token
		const result1 = await ctrl.useToken(tokens[0].token);
		expect(result1.ok).toBe(true);
		expect(result1.file?.name).toBe("guide.pdf");

		// Use second token
		const result2 = await ctrl.useToken(tokens[1].token);
		expect(result2.ok).toBe(true);
		expect(result2.file?.name).toBe("bonus.mp4");

		// List by order
		const orderTokens = await ctrl.listTokens({ orderId: "order-100" });
		expect(orderTokens).toHaveLength(2);
	});
});
