import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDigitalDownloadsController } from "../service-impl";

/**
 * Security regression tests for digital-downloads endpoints.
 *
 * Digital downloads gate access to paid content via tokens.
 * These tests verify:
 * - Token validation chain: revoked > expired > limit > grant
 * - Email scoping: tokens are email-bound, list by email won't leak
 * - File deletion does not grant zombie token access
 * - Download count cannot exceed maxDownloads
 * - Revoked tokens are permanently unusable
 */

describe("digital-downloads endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDigitalDownloadsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDigitalDownloadsController(mockData);
	});

	// ── Token Validation Chain ─────────────────────────────────────

	describe("token validation chain (revoked > expired > limit)", () => {
		it("revoked token is rejected even if not expired and under limit", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 5,
			});

			await controller.revokeToken(token.token);

			const result = await controller.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token revoked");
		});

		it("expired token is rejected even if under download limit", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 100,
				expiresAt: new Date("2020-01-01"),
			});

			const result = await controller.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token expired");
		});

		it("token at download limit is rejected", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 2,
			});

			// Use twice
			await controller.useToken(token.token);
			await controller.useToken(token.token);

			// Third attempt should fail
			const result = await controller.useToken(token.token);
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Download limit reached");
		});

		it("non-existent token is rejected", async () => {
			const result = await controller.useToken("fake-token-uuid");
			expect(result.ok).toBe(false);
			expect(result.reason).toBe("Token not found");
		});
	});

	// ── Email Scoping ──────────────────────────────────────────────

	describe("email-scoped token isolation", () => {
		it("listTokensByEmail only returns tokens for that email", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});

			await controller.createToken({
				fileId: file.id,
				email: "alice@test.com",
			});
			await controller.createToken({
				fileId: file.id,
				email: "bob@test.com",
			});
			await controller.createToken({
				fileId: file.id,
				email: "alice@test.com",
			});

			const aliceTokens = await controller.listTokensByEmail({
				email: "alice@test.com",
			});
			expect(aliceTokens).toHaveLength(2);
			for (const t of aliceTokens) {
				expect(t.email).toBe("alice@test.com");
			}

			const bobTokens = await controller.listTokensByEmail({
				email: "bob@test.com",
			});
			expect(bobTokens).toHaveLength(1);
		});

		it("each token has its own independent download counter", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});

			const token1 = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 3,
			});
			const token2 = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				maxDownloads: 3,
			});

			// Use token1 three times (exhaust)
			await controller.useToken(token1.token);
			await controller.useToken(token1.token);
			await controller.useToken(token1.token);

			// Token1 exhausted
			const result1 = await controller.useToken(token1.token);
			expect(result1.ok).toBe(false);

			// Token2 still has full allowance
			const result2 = await controller.useToken(token2.token);
			expect(result2.ok).toBe(true);
		});
	});

	// ── File Deletion ──────────────────────────────────────────────

	describe("file deletion behavior", () => {
		it("deleting file makes useToken return undefined file", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			await controller.deleteFile(file.id);

			const result = await controller.useToken(token.token);
			// Token still validates but file is gone
			expect(result.ok).toBe(true);
			expect(result.file).toBeUndefined();
		});

		it("tokens persist after file deletion", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			await controller.deleteFile(file.id);

			// Token still retrievable
			const found = await controller.getTokenByValue(token.token);
			expect(found).not.toBeNull();
			expect(found?.fileId).toBe(file.id);
		});
	});

	// ── Revocation ─────────────────────────────────────────────────

	describe("token revocation", () => {
		it("revoked token is permanently unusable", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			// Use once successfully
			const first = await controller.useToken(token.token);
			expect(first.ok).toBe(true);

			// Revoke
			await controller.revokeToken(token.token);

			// Can't use anymore
			const after = await controller.useToken(token.token);
			expect(after.ok).toBe(false);
			expect(after.reason).toBe("Token revoked");
		});

		it("revoking non-existent token returns false", async () => {
			const result = await controller.revokeToken("fake-token");
			expect(result).toBe(false);
		});

		it("double revocation is idempotent", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			const first = await controller.revokeToken(token.token);
			expect(first).toBe(true);

			const second = await controller.revokeToken(token.token);
			expect(second).toBe(true);
		});

		it("download count is not incremented on revoked token use", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			// Use once
			await controller.useToken(token.token);
			const afterUse = await controller.getTokenByValue(token.token);
			expect(afterUse?.downloadCount).toBe(1);

			// Revoke
			await controller.revokeToken(token.token);

			// Try to use again (should fail)
			await controller.useToken(token.token);

			// Count should not have increased
			const afterRevoked = await controller.getTokenByValue(token.token);
			expect(afterRevoked?.downloadCount).toBe(1);
		});
	});

	// ── Unlimited Downloads ────────────────────────────────────────

	describe("unlimited download tokens", () => {
		it("token without maxDownloads allows unlimited uses", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			// Use many times
			for (let i = 0; i < 20; i++) {
				const result = await controller.useToken(token.token);
				expect(result.ok).toBe(true);
			}
		});

		it("token without expiresAt never expires", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});
			const token = await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
			});

			// Should succeed (no expiry set)
			const result = await controller.useToken(token.token);
			expect(result.ok).toBe(true);
		});
	});

	// ── File Filtering ─────────────────────────────────────────────

	describe("file and token filtering", () => {
		it("listFiles by productId only returns matching files", async () => {
			await controller.createFile({
				productId: "prod_A",
				name: "File A",
				url: "https://cdn.example.com/a.pdf",
			});
			await controller.createFile({
				productId: "prod_B",
				name: "File B",
				url: "https://cdn.example.com/b.pdf",
			});

			const filesA = await controller.listFiles({ productId: "prod_A" });
			expect(filesA).toHaveLength(1);
			expect(filesA[0].name).toBe("File A");
		});

		it("listTokens by orderId only returns matching tokens", async () => {
			const file = await controller.createFile({
				productId: "prod_1",
				name: "eBook",
				url: "https://cdn.example.com/ebook.pdf",
			});

			await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				orderId: "order_A",
			});
			await controller.createToken({
				fileId: file.id,
				email: "user@test.com",
				orderId: "order_B",
			});

			const tokens = await controller.listTokens({ orderId: "order_A" });
			expect(tokens).toHaveLength(1);
			expect(tokens[0].orderId).toBe("order_A");
		});
	});
});
