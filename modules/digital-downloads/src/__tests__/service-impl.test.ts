import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createDigitalDownloadsController } from "../service-impl";

describe("createDigitalDownloadsController", () => {
	// ── Files ────────────────────────────────────────────────────────────────

	describe("createFile", () => {
		it("creates a file with required fields and defaults", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "prod-1",
				name: "ebook.pdf",
				url: "https://example.com/ebook.pdf",
			});

			expect(file.id).toBeTruthy();
			expect(file.productId).toBe("prod-1");
			expect(file.name).toBe("ebook.pdf");
			expect(file.url).toBe("https://example.com/ebook.pdf");
			expect(file.isActive).toBe(true);
			expect(file.createdAt).toBeInstanceOf(Date);
			expect(file.updatedAt).toBeInstanceOf(Date);
			expect(file.fileSize).toBeUndefined();
			expect(file.mimeType).toBeUndefined();
		});

		it("creates a file with all optional fields", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "prod-2",
				name: "video.mp4",
				url: "https://example.com/video.mp4",
				fileSize: 1048576,
				mimeType: "video/mp4",
				isActive: false,
			});

			expect(file.fileSize).toBe(1048576);
			expect(file.mimeType).toBe("video/mp4");
			expect(file.isActive).toBe(false);
		});

		it("generates unique IDs for each file", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const f1 = await ctrl.createFile({
				productId: "p1",
				name: "a.pdf",
				url: "https://example.com/a.pdf",
			});
			const f2 = await ctrl.createFile({
				productId: "p1",
				name: "b.pdf",
				url: "https://example.com/b.pdf",
			});

			expect(f1.id).not.toBe(f2.id);
		});
	});

	describe("getFile", () => {
		it("returns the file when found", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const created = await ctrl.createFile({
				productId: "p1",
				name: "doc.pdf",
				url: "https://example.com/doc.pdf",
			});
			const found = await ctrl.getFile(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("doc.pdf");
		});

		it("returns null when not found", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.getFile("nonexistent-id");
			expect(result).toBeNull();
		});
	});

	describe("listFiles", () => {
		it("returns all files when no filter", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createFile({
				productId: "p1",
				name: "a.pdf",
				url: "https://example.com/a.pdf",
			});
			await ctrl.createFile({
				productId: "p2",
				name: "b.pdf",
				url: "https://example.com/b.pdf",
			});
			await ctrl.createFile({
				productId: "p1",
				name: "c.pdf",
				url: "https://example.com/c.pdf",
			});

			const all = await ctrl.listFiles();
			expect(all).toHaveLength(3);
		});

		it("filters by productId", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createFile({
				productId: "p1",
				name: "a.pdf",
				url: "https://example.com/a.pdf",
			});
			await ctrl.createFile({
				productId: "p2",
				name: "b.pdf",
				url: "https://example.com/b.pdf",
			});
			await ctrl.createFile({
				productId: "p1",
				name: "c.pdf",
				url: "https://example.com/c.pdf",
			});

			const p1Files = await ctrl.listFiles({ productId: "p1" });
			expect(p1Files).toHaveLength(2);
			expect(p1Files.every((f) => f.productId === "p1")).toBe(true);
		});

		it("returns empty array when no files exist", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.listFiles();
			expect(result).toEqual([]);
		});

		it("respects take and skip parameters", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			for (let i = 0; i < 5; i++) {
				await ctrl.createFile({
					productId: "p1",
					name: `file-${i}.pdf`,
					url: `https://example.com/file-${i}.pdf`,
				});
			}

			const page1 = await ctrl.listFiles({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listFiles({ take: 2, skip: 2 });
			expect(page2).toHaveLength(2);
		});
	});

	describe("updateFile", () => {
		it("updates specified fields", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "old-name.pdf",
				url: "https://example.com/old.pdf",
			});
			const updated = await ctrl.updateFile(file.id, {
				name: "new-name.pdf",
				isActive: false,
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("new-name.pdf");
			expect(updated?.isActive).toBe(false);
			expect(updated?.url).toBe("https://example.com/old.pdf"); // unchanged
			expect(updated?.productId).toBe("p1"); // unchanged
		});

		it("updates updatedAt timestamp", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://example.com/file.pdf",
			});
			const originalUpdatedAt = file.updatedAt;

			// Ensure time progresses
			await new Promise((r) => setTimeout(r, 5));
			const updated = await ctrl.updateFile(file.id, { name: "updated.pdf" });

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("returns null when file not found", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.updateFile("nonexistent", { name: "new.pdf" });
			expect(result).toBeNull();
		});
	});

	describe("deleteFile", () => {
		it("deletes a file and returns true", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "delete-me.pdf",
				url: "https://example.com/delete-me.pdf",
			});
			const result = await ctrl.deleteFile(file.id);

			expect(result).toBe(true);
			const found = await ctrl.getFile(file.id);
			expect(found).toBeNull();
		});

		it("returns true even for nonexistent id", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.deleteFile("nonexistent-id");
			expect(result).toBe(true);
		});
	});

	// ── Tokens ───────────────────────────────────────────────────────────────

	describe("createToken", () => {
		it("creates token with required fields and defaults", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const token = await ctrl.createToken({
				fileId: "file-1",
				email: "user@example.com",
			});

			expect(token.id).toBeTruthy();
			expect(token.token).toBeTruthy();
			expect(token.fileId).toBe("file-1");
			expect(token.email).toBe("user@example.com");
			expect(token.downloadCount).toBe(0);
			expect(token.createdAt).toBeInstanceOf(Date);
			expect(token.updatedAt).toBeInstanceOf(Date);
			expect(token.orderId).toBeUndefined();
			expect(token.maxDownloads).toBeUndefined();
			expect(token.expiresAt).toBeUndefined();
			expect(token.revokedAt).toBeUndefined();
		});

		it("creates token with all optional fields", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const expiresAt = new Date(Date.now() + 86400_000);
			const token = await ctrl.createToken({
				fileId: "file-1",
				email: "user@example.com",
				orderId: "order-123",
				maxDownloads: 3,
				expiresAt,
			});

			expect(token.orderId).toBe("order-123");
			expect(token.maxDownloads).toBe(3);
			expect(token.expiresAt).toEqual(expiresAt);
		});

		it("generates a unique UUID token value", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const t1 = await ctrl.createToken({
				fileId: "f1",
				email: "a@example.com",
			});
			const t2 = await ctrl.createToken({
				fileId: "f1",
				email: "b@example.com",
			});

			expect(t1.token).not.toBe(t2.token);
			// UUID format check
			expect(t1.token).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});
	});

	describe("getTokenByValue", () => {
		it("returns the token when found by token value", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const created = await ctrl.createToken({
				fileId: "f1",
				email: "user@example.com",
			});
			const found = await ctrl.getTokenByValue(created.token);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.token).toBe(created.token);
		});

		it("returns null when token value not found", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.getTokenByValue("nonexistent-token-value");
			expect(result).toBeNull();
		});
	});

	describe("useToken", () => {
		it("successfully uses token, increments downloadCount and returns file", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "ebook.pdf",
				url: "https://example.com/ebook.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
			});

			const result = await ctrl.useToken(token.token);

			expect(result.ok).toBe(true);
			expect(result.file).toBeDefined();
			expect(result.file?.id).toBe(file.id);
			expect(result.token?.downloadCount).toBe(1);
			expect(result.reason).toBeUndefined();
		});

		it("increments downloadCount on repeated use", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "ebook.pdf",
				url: "https://example.com/ebook.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
			});

			await ctrl.useToken(token.token);
			const result = await ctrl.useToken(token.token);

			expect(result.ok).toBe(true);
			expect(result.token?.downloadCount).toBe(2);
		});

		it("returns ok:false for revoked token", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://example.com/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
			});
			await ctrl.revokeToken(token.token);

			const result = await ctrl.useToken(token.token);

			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token revoked");
		});

		it("returns ok:false for expired token", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://example.com/file.pdf",
			});
			const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
				expiresAt: pastDate,
			});

			const result = await ctrl.useToken(token.token);

			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token expired");
		});

		it("returns ok:false when download limit reached", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://example.com/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
				maxDownloads: 1,
			});

			// Use it once (allowed)
			await ctrl.useToken(token.token);

			// Second use should fail
			const result = await ctrl.useToken(token.token);

			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Download limit reached");
		});

		it("returns ok:false for unknown token", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.useToken("totally-unknown-token");

			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token not found");
		});

		it("succeeds for token with future expiry", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://example.com/file.pdf",
			});
			const futureDate = new Date(Date.now() + 86400_000);
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@example.com",
				expiresAt: futureDate,
			});

			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(true);
		});
	});

	describe("revokeToken", () => {
		it("sets revokedAt and returns true", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const token = await ctrl.createToken({
				fileId: "f1",
				email: "user@example.com",
			});
			const result = await ctrl.revokeToken(token.token);

			expect(result).toBe(true);

			const found = await ctrl.getTokenByValue(token.token);
			expect(found?.revokedAt).toBeInstanceOf(Date);
		});

		it("returns false when token not found", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.revokeToken("nonexistent-token");
			expect(result).toBe(false);
		});
	});

	describe("listTokensByEmail", () => {
		it("returns tokens for the given email", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createToken({ fileId: "f1", email: "alice@example.com" });
			await ctrl.createToken({ fileId: "f2", email: "alice@example.com" });
			await ctrl.createToken({ fileId: "f3", email: "bob@example.com" });

			const aliceTokens = await ctrl.listTokensByEmail({
				email: "alice@example.com",
			});
			expect(aliceTokens).toHaveLength(2);
			expect(aliceTokens.every((t) => t.email === "alice@example.com")).toBe(
				true,
			);
		});

		it("returns empty array when no tokens for email", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.listTokensByEmail({
				email: "nobody@example.com",
			});
			expect(result).toEqual([]);
		});
	});

	describe("listTokens", () => {
		it("returns all tokens when no filter", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createToken({ fileId: "f1", email: "a@example.com" });
			await ctrl.createToken({ fileId: "f2", email: "b@example.com" });
			await ctrl.createToken({ fileId: "f1", email: "c@example.com" });

			const all = await ctrl.listTokens();
			expect(all).toHaveLength(3);
		});

		it("filters by fileId", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createToken({ fileId: "f1", email: "a@example.com" });
			await ctrl.createToken({ fileId: "f2", email: "b@example.com" });
			await ctrl.createToken({ fileId: "f1", email: "c@example.com" });

			const f1Tokens = await ctrl.listTokens({ fileId: "f1" });
			expect(f1Tokens).toHaveLength(2);
			expect(f1Tokens.every((t) => t.fileId === "f1")).toBe(true);
		});

		it("filters by email", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createToken({ fileId: "f1", email: "a@example.com" });
			await ctrl.createToken({ fileId: "f2", email: "b@example.com" });
			await ctrl.createToken({ fileId: "f3", email: "a@example.com" });

			const aTokens = await ctrl.listTokens({ email: "a@example.com" });
			expect(aTokens).toHaveLength(2);
			expect(aTokens.every((t) => t.email === "a@example.com")).toBe(true);
		});

		it("filters by orderId", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			await ctrl.createToken({
				fileId: "f1",
				email: "a@example.com",
				orderId: "order-1",
			});
			await ctrl.createToken({
				fileId: "f2",
				email: "b@example.com",
				orderId: "order-2",
			});
			await ctrl.createToken({
				fileId: "f3",
				email: "c@example.com",
				orderId: "order-1",
			});

			const order1Tokens = await ctrl.listTokens({ orderId: "order-1" });
			expect(order1Tokens).toHaveLength(2);
			expect(order1Tokens.every((t) => t.orderId === "order-1")).toBe(true);
		});

		it("returns empty array when no tokens exist", async () => {
			const data = createMockDataService();
			const ctrl = createDigitalDownloadsController(data);

			const result = await ctrl.listTokens();
			expect(result).toEqual([]);
		});
	});
});
