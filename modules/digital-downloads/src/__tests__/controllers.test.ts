import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDigitalDownloadsController } from "../service-impl";

describe("digital-downloads controllers — edge cases", () => {
	let data: ReturnType<typeof createMockDataService>;
	let ctrl: ReturnType<typeof createDigitalDownloadsController>;

	beforeEach(() => {
		data = createMockDataService();
		ctrl = createDigitalDownloadsController(data);
	});

	// ── File operations edge cases ────────────────────────────────────────

	describe("createFile — same product", () => {
		it("allows multiple files for the same productId", async () => {
			const f1 = await ctrl.createFile({
				productId: "prod-1",
				name: "chapter1.pdf",
				url: "https://cdn.test/chapter1.pdf",
			});
			const f2 = await ctrl.createFile({
				productId: "prod-1",
				name: "chapter2.pdf",
				url: "https://cdn.test/chapter2.pdf",
			});

			expect(f1.id).not.toBe(f2.id);
			expect(f1.productId).toBe(f2.productId);

			const files = await ctrl.listFiles({ productId: "prod-1" });
			expect(files).toHaveLength(2);
		});

		it("allows files with identical names for different products", async () => {
			const f1 = await ctrl.createFile({
				productId: "prod-1",
				name: "readme.pdf",
				url: "https://cdn.test/a/readme.pdf",
			});
			const f2 = await ctrl.createFile({
				productId: "prod-2",
				name: "readme.pdf",
				url: "https://cdn.test/b/readme.pdf",
			});

			expect(f1.id).not.toBe(f2.id);
			expect(f1.name).toBe(f2.name);
		});
	});

	describe("updateFile — inactive file", () => {
		it("can update fields on an inactive file", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "old.pdf",
				url: "https://cdn.test/old.pdf",
				isActive: false,
			});

			const updated = await ctrl.updateFile(file.id, {
				name: "renamed.pdf",
				url: "https://cdn.test/renamed.pdf",
				fileSize: 2048,
				mimeType: "application/pdf",
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("renamed.pdf");
			expect(updated?.url).toBe("https://cdn.test/renamed.pdf");
			expect(updated?.fileSize).toBe(2048);
			expect(updated?.mimeType).toBe("application/pdf");
			expect(updated?.isActive).toBe(false);
		});

		it("can reactivate an inactive file", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "dormant.zip",
				url: "https://cdn.test/dormant.zip",
				isActive: false,
			});

			const updated = await ctrl.updateFile(file.id, { isActive: true });
			expect(updated?.isActive).toBe(true);
		});
	});

	describe("listFiles — pagination combined with productId", () => {
		it("paginates within a productId filter", async () => {
			for (let i = 0; i < 5; i++) {
				await ctrl.createFile({
					productId: "prod-x",
					name: `file-${i}.pdf`,
					url: `https://cdn.test/file-${i}.pdf`,
				});
			}
			await ctrl.createFile({
				productId: "prod-y",
				name: "other.pdf",
				url: "https://cdn.test/other.pdf",
			});

			const page = await ctrl.listFiles({
				productId: "prod-x",
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
			expect(page.every((f) => f.productId === "prod-x")).toBe(true);
		});

		it("returns empty when skip exceeds total for productId", async () => {
			await ctrl.createFile({
				productId: "prod-x",
				name: "only.pdf",
				url: "https://cdn.test/only.pdf",
			});

			const page = await ctrl.listFiles({
				productId: "prod-x",
				take: 10,
				skip: 100,
			});
			expect(page).toEqual([]);
		});
	});

	describe("deleteFile — then verify list", () => {
		it("no longer appears in listFiles after deletion", async () => {
			const f1 = await ctrl.createFile({
				productId: "p1",
				name: "keep.pdf",
				url: "https://cdn.test/keep.pdf",
			});
			const f2 = await ctrl.createFile({
				productId: "p1",
				name: "remove.pdf",
				url: "https://cdn.test/remove.pdf",
			});

			await ctrl.deleteFile(f2.id);

			const files = await ctrl.listFiles({ productId: "p1" });
			expect(files).toHaveLength(1);
			expect(files[0].id).toBe(f1.id);
		});

		it("deleting all files for a product leaves empty list", async () => {
			const f1 = await ctrl.createFile({
				productId: "p1",
				name: "a.pdf",
				url: "https://cdn.test/a.pdf",
			});
			const f2 = await ctrl.createFile({
				productId: "p1",
				name: "b.pdf",
				url: "https://cdn.test/b.pdf",
			});

			await ctrl.deleteFile(f1.id);
			await ctrl.deleteFile(f2.id);

			const files = await ctrl.listFiles({ productId: "p1" });
			expect(files).toEqual([]);
		});
	});

	// ── Token lifecycle edge cases ────────────────────────────────────────

	describe("createToken — same file and email", () => {
		it("allows multiple tokens for the same file and email", async () => {
			const t1 = await ctrl.createToken({
				fileId: "f1",
				email: "buyer@test.com",
			});
			const t2 = await ctrl.createToken({
				fileId: "f1",
				email: "buyer@test.com",
			});

			expect(t1.id).not.toBe(t2.id);
			expect(t1.token).not.toBe(t2.token);
		});

		it("tokens for same file+email are independently usable", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "book.pdf",
				url: "https://cdn.test/book.pdf",
			});
			const t1 = await ctrl.createToken({
				fileId: file.id,
				email: "buyer@test.com",
				maxDownloads: 1,
			});
			const t2 = await ctrl.createToken({
				fileId: file.id,
				email: "buyer@test.com",
				maxDownloads: 1,
			});

			const r1 = await ctrl.useToken(t1.token);
			expect(r1.ok).toBe(true);

			// t1 exhausted, but t2 still works
			const r1b = await ctrl.useToken(t1.token);
			expect(r1b.ok).toBe(false);

			const r2 = await ctrl.useToken(t2.token);
			expect(r2.ok).toBe(true);
		});
	});

	describe("useToken — multiple uses until limit", () => {
		it("allows exactly maxDownloads uses then rejects", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "track.mp3",
				url: "https://cdn.test/track.mp3",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 3,
			});

			for (let i = 1; i <= 3; i++) {
				const result = await ctrl.useToken(token.token);
				expect(result.ok).toBe(true);
				expect(result.token?.downloadCount).toBe(i);
			}

			const rejected = await ctrl.useToken(token.token);
			expect(rejected.ok).toBe(false);
			expect(rejected.reason).toBe("Download limit reached");
		});

		it("unlimited downloads when maxDownloads is not set", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			for (let i = 0; i < 10; i++) {
				const result = await ctrl.useToken(token.token);
				expect(result.ok).toBe(true);
			}

			const last = await ctrl.useToken(token.token);
			expect(last.ok).toBe(true);
			expect(last.token?.downloadCount).toBe(11);
		});
	});

	describe("useToken — expired token", () => {
		it("rejects a token that expired just now", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
				expiresAt: new Date(Date.now() - 1),
			});

			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token expired");
		});
	});

	describe("useToken — revoked then re-checked", () => {
		it("remains revoked after re-fetching the token", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			await ctrl.revokeToken(token.token);

			// Re-fetch and verify revokedAt persists
			const fetched = await ctrl.getTokenByValue(token.token);
			expect(fetched?.revokedAt).toBeInstanceOf(Date);

			// Attempt to use still fails
			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token revoked");
		});
	});

	describe("createToken — zero maxDownloads", () => {
		it("immediately rejects use when maxDownloads is 0", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 0,
			});

			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Download limit reached");
		});
	});

	describe("createToken — far-future expiry", () => {
		it("accepts use with expiry set far in the future", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const farFuture = new Date("2099-12-31T23:59:59Z");
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
				expiresAt: farFuture,
			});

			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(true);
			expect(result.file?.id).toBe(file.id);
		});
	});

	// ── Combined operations ───────────────────────────────────────────────

	describe("full lifecycle: create file -> token -> use -> revoke", () => {
		it("walks through the complete happy path", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "course.zip",
				url: "https://cdn.test/course.zip",
				fileSize: 50_000_000,
				mimeType: "application/zip",
			});

			const token = await ctrl.createToken({
				fileId: file.id,
				email: "student@test.com",
				orderId: "order-42",
				maxDownloads: 5,
			});

			// Use it twice
			const use1 = await ctrl.useToken(token.token);
			expect(use1.ok).toBe(true);
			expect(use1.file?.name).toBe("course.zip");
			expect(use1.file?.mimeType).toBe("application/zip");
			expect(use1.token?.downloadCount).toBe(1);

			const use2 = await ctrl.useToken(token.token);
			expect(use2.ok).toBe(true);
			expect(use2.token?.downloadCount).toBe(2);

			// Revoke
			const revoked = await ctrl.revokeToken(token.token);
			expect(revoked).toBe(true);

			// Can no longer use
			const use3 = await ctrl.useToken(token.token);
			expect(use3.ok).toBe(false);
			expect(use3.reason).toBe("Token revoked");
		});
	});

	describe("deleteFile — with existing tokens", () => {
		it("tokens still exist after file deletion but useToken returns undefined file", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "ephemeral.pdf",
				url: "https://cdn.test/ephemeral.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			await ctrl.deleteFile(file.id);

			// Token record still exists
			const fetched = await ctrl.getTokenByValue(token.token);
			expect(fetched).not.toBeNull();
			expect(fetched?.fileId).toBe(file.id);

			// Using the token succeeds at the token level but file is undefined
			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(true);
			expect(result.file).toBeUndefined();
		});
	});

	describe("listTokens — across multiple files and emails", () => {
		it("combines fileId and email filters", async () => {
			await ctrl.createToken({
				fileId: "f1",
				email: "alice@test.com",
			});
			await ctrl.createToken({
				fileId: "f1",
				email: "bob@test.com",
			});
			await ctrl.createToken({
				fileId: "f2",
				email: "alice@test.com",
			});
			await ctrl.createToken({
				fileId: "f2",
				email: "bob@test.com",
			});

			const f1Alice = await ctrl.listTokens({
				fileId: "f1",
				email: "alice@test.com",
			});
			expect(f1Alice).toHaveLength(1);
			expect(f1Alice[0].fileId).toBe("f1");
			expect(f1Alice[0].email).toBe("alice@test.com");
		});

		it("paginates token results", async () => {
			for (let i = 0; i < 5; i++) {
				await ctrl.createToken({
					fileId: "f1",
					email: `user${i}@test.com`,
				});
			}

			const page1 = await ctrl.listTokens({ fileId: "f1", take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listTokens({ fileId: "f1", take: 2, skip: 2 });
			expect(page2).toHaveLength(2);

			const page3 = await ctrl.listTokens({ fileId: "f1", take: 2, skip: 4 });
			expect(page3).toHaveLength(1);
		});

		it("returns all tokens across files when no filter given", async () => {
			await ctrl.createToken({ fileId: "f1", email: "a@test.com" });
			await ctrl.createToken({ fileId: "f2", email: "b@test.com" });
			await ctrl.createToken({ fileId: "f3", email: "c@test.com" });

			const all = await ctrl.listTokens();
			expect(all).toHaveLength(3);
		});
	});

	describe("listTokensByEmail — pagination", () => {
		it("paginates tokens for a specific email", async () => {
			for (let i = 0; i < 4; i++) {
				await ctrl.createToken({
					fileId: `f${i}`,
					email: "frequent@test.com",
				});
			}

			const page1 = await ctrl.listTokensByEmail({
				email: "frequent@test.com",
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listTokensByEmail({
				email: "frequent@test.com",
				take: 2,
				skip: 2,
			});
			expect(page2).toHaveLength(2);
		});
	});

	// ── Additional edge cases ─────────────────────────────────────────────

	describe("useToken — returns correct file data", () => {
		it("returns the file matching the token fileId", async () => {
			const fileA = await ctrl.createFile({
				productId: "p1",
				name: "alpha.pdf",
				url: "https://cdn.test/alpha.pdf",
				fileSize: 1024,
				mimeType: "application/pdf",
			});
			const fileB = await ctrl.createFile({
				productId: "p2",
				name: "beta.mp4",
				url: "https://cdn.test/beta.mp4",
				fileSize: 999_999,
				mimeType: "video/mp4",
			});

			const tokenA = await ctrl.createToken({
				fileId: fileA.id,
				email: "user@test.com",
			});
			const tokenB = await ctrl.createToken({
				fileId: fileB.id,
				email: "user@test.com",
			});

			const resultA = await ctrl.useToken(tokenA.token);
			expect(resultA.ok).toBe(true);
			expect(resultA.file?.id).toBe(fileA.id);
			expect(resultA.file?.name).toBe("alpha.pdf");
			expect(resultA.file?.fileSize).toBe(1024);

			const resultB = await ctrl.useToken(tokenB.token);
			expect(resultB.ok).toBe(true);
			expect(resultB.file?.id).toBe(fileB.id);
			expect(resultB.file?.name).toBe("beta.mp4");
			expect(resultB.file?.mimeType).toBe("video/mp4");
		});
	});

	describe("multiple tokens for same file", () => {
		it("each token tracks its own downloadCount independently", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "shared.pdf",
				url: "https://cdn.test/shared.pdf",
			});

			const t1 = await ctrl.createToken({
				fileId: file.id,
				email: "a@test.com",
			});
			const t2 = await ctrl.createToken({
				fileId: file.id,
				email: "b@test.com",
			});

			await ctrl.useToken(t1.token);
			await ctrl.useToken(t1.token);
			await ctrl.useToken(t1.token);
			await ctrl.useToken(t2.token);

			const fetched1 = await ctrl.getTokenByValue(t1.token);
			const fetched2 = await ctrl.getTokenByValue(t2.token);

			expect(fetched1?.downloadCount).toBe(3);
			expect(fetched2?.downloadCount).toBe(1);
		});
	});

	describe("revokeToken — idempotency", () => {
		it("revoking an already-revoked token still returns true", async () => {
			const token = await ctrl.createToken({
				fileId: "f1",
				email: "user@test.com",
			});

			const first = await ctrl.revokeToken(token.token);
			expect(first).toBe(true);

			const second = await ctrl.revokeToken(token.token);
			expect(second).toBe(true);

			// Token is still revoked
			const fetched = await ctrl.getTokenByValue(token.token);
			expect(fetched?.revokedAt).toBeInstanceOf(Date);
		});
	});

	describe("updateFile — preserves unrelated fields", () => {
		it("partial update does not clear optional fields", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "orig.pdf",
				url: "https://cdn.test/orig.pdf",
				fileSize: 4096,
				mimeType: "application/pdf",
			});

			const updated = await ctrl.updateFile(file.id, { name: "renamed.pdf" });

			expect(updated?.name).toBe("renamed.pdf");
			expect(updated?.fileSize).toBe(4096);
			expect(updated?.mimeType).toBe("application/pdf");
			expect(updated?.url).toBe("https://cdn.test/orig.pdf");
		});
	});

	describe("listTokens — filter by orderId with pagination", () => {
		it("paginates tokens filtered by orderId", async () => {
			for (let i = 0; i < 4; i++) {
				await ctrl.createToken({
					fileId: `f${i}`,
					email: `u${i}@test.com`,
					orderId: "order-99",
				});
			}
			await ctrl.createToken({
				fileId: "fx",
				email: "other@test.com",
				orderId: "order-100",
			});

			const page = await ctrl.listTokens({
				orderId: "order-99",
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
			expect(page.every((t) => t.orderId === "order-99")).toBe(true);

			const all = await ctrl.listTokens({ orderId: "order-99" });
			expect(all).toHaveLength(4);
		});
	});

	describe("getFile — after update", () => {
		it("getFile reflects the latest update", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "v1.pdf",
				url: "https://cdn.test/v1.pdf",
			});

			await ctrl.updateFile(file.id, {
				name: "v2.pdf",
				url: "https://cdn.test/v2.pdf",
			});

			const fetched = await ctrl.getFile(file.id);
			expect(fetched?.name).toBe("v2.pdf");
			expect(fetched?.url).toBe("https://cdn.test/v2.pdf");
		});
	});

	describe("deleteFile — double delete", () => {
		it("deleting an already-deleted file returns true", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "gone.pdf",
				url: "https://cdn.test/gone.pdf",
			});

			await ctrl.deleteFile(file.id);
			const result = await ctrl.deleteFile(file.id);
			expect(result).toBe(true);

			const found = await ctrl.getFile(file.id);
			expect(found).toBeNull();
		});
	});

	describe("createToken — with orderId links tokens to orders", () => {
		it("filters tokens by orderId correctly", async () => {
			await ctrl.createToken({
				fileId: "f1",
				email: "a@test.com",
				orderId: "order-A",
			});
			await ctrl.createToken({
				fileId: "f2",
				email: "b@test.com",
				orderId: "order-A",
			});
			await ctrl.createToken({
				fileId: "f1",
				email: "c@test.com",
				orderId: "order-B",
			});

			const orderA = await ctrl.listTokens({ orderId: "order-A" });
			expect(orderA).toHaveLength(2);

			const orderB = await ctrl.listTokens({ orderId: "order-B" });
			expect(orderB).toHaveLength(1);
		});
	});

	describe("useToken — revoked token does not increment downloadCount", () => {
		it("downloadCount stays at pre-revoke value", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			await ctrl.useToken(token.token);
			await ctrl.useToken(token.token);
			await ctrl.revokeToken(token.token);

			const rejected = await ctrl.useToken(token.token);
			expect(rejected.ok).toBe(false);

			const fetched = await ctrl.getTokenByValue(token.token);
			expect(fetched?.downloadCount).toBe(2);
		});
	});

	describe("useToken — check order after revoke vs expire priority", () => {
		it("revoked takes precedence when both revoked and expired", async () => {
			const file = await ctrl.createFile({
				productId: "p1",
				name: "file.pdf",
				url: "https://cdn.test/file.pdf",
			});
			const token = await ctrl.createToken({
				fileId: file.id,
				email: "user@test.com",
				expiresAt: new Date(Date.now() - 60_000),
			});

			await ctrl.revokeToken(token.token);

			const result = await ctrl.useToken(token.token);
			expect(result.ok).toBe(false);
			// Implementation checks revoked before expired
			expect(result.reason).toBe("Token revoked");
		});
	});
});
