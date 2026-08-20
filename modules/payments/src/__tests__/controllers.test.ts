import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "../service";
import { createPaymentController } from "../service-impl";

describe("payment controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPaymentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPaymentController(mockData, undefined, {
			allowOfflineForDevelopment: true,
		});
	});

	// ── createIntent edge cases ─────────────────────────────────────────

	describe("createIntent edge cases", () => {
		it("each intent gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 1; i <= 20; i++) {
				const intent = await controller.createIntent({ amount: 100 * i });
				ids.add(intent.id);
			}
			expect(ids.size).toBe(20);
		});

		it("rejects zero amount", async () => {
			await expect(controller.createIntent({ amount: 0 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("rejects negative amount", async () => {
			await expect(controller.createIntent({ amount: -500 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("handles very large amount", async () => {
			const intent = await controller.createIntent({
				amount: Number.MAX_SAFE_INTEGER,
			});
			expect(intent.amount).toBe(Number.MAX_SAFE_INTEGER);
		});

		it("rejects fractional amount", async () => {
			await expect(controller.createIntent({ amount: 99.99 })).rejects.toThrow(
				"Amount must be a positive integer",
			);
		});

		it("preserves special characters in metadata keys and values", async () => {
			const meta = {
				"key with spaces": "value with spaces",
				"unicode-\u00e9\u00e8": "\u00fc\u00f6\u00e4",
				nested: { deep: { value: true } },
				array: [1, 2, 3],
			};
			const intent = await controller.createIntent({
				amount: 1000,
				metadata: meta,
			});
			expect(intent.metadata).toEqual(meta);
		});

		it("createdAt and updatedAt are the same on creation", async () => {
			const intent = await controller.createIntent({ amount: 500 });
			expect(intent.createdAt.getTime()).toBe(intent.updatedAt.getTime());
		});

		it("handles empty string for optional string fields", async () => {
			const intent = await controller.createIntent({
				amount: 1000,
				customerId: "",
				email: "",
				orderId: "",
				checkoutSessionId: "",
			});
			expect(intent.customerId).toBe("");
			expect(intent.email).toBe("");
			expect(intent.orderId).toBe("");
			expect(intent.checkoutSessionId).toBe("");
		});

		it("provider returning undefined providerMetadata defaults to empty object", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_no_meta",
					status: "pending",
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			expect(intent.providerMetadata).toEqual({});
		});

		it("stores intent in data service under paymentIntent entity type", async () => {
			await controller.createIntent({ amount: 1000 });
			await controller.createIntent({ amount: 2000 });
			expect(mockData.size("paymentIntent")).toBe(2);
		});
	});

	// ── getIntent edge cases ────────────────────────────────────────────

	describe("getIntent edge cases", () => {
		it("returns null for empty string id", async () => {
			const result = await controller.getIntent("");
			expect(result).toBeNull();
		});

		it("returns correct intent among many", async () => {
			const intents: Awaited<ReturnType<typeof controller.createIntent>>[] = [];
			for (let i = 1; i <= 15; i++) {
				const intent = await controller.createIntent({ amount: i * 100 });
				intents.push(intent);
			}
			const middle = await controller.getIntent(intents[7].id);
			expect(middle).not.toBeNull();
			expect(middle?.amount).toBe(800);
		});

		it("reflects updated status after confirm", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			const fetched = await controller.getIntent(intent.id);
			expect(fetched?.status).toBe("succeeded");
		});
	});

	// ── confirmIntent edge cases ────────────────────────────────────────

	describe("confirmIntent edge cases", () => {
		it("confirm after cancel throws status guard error", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.cancelIntent(intent.id);
			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'cancelled' state",
			);
		});

		it("confirm after refund throws status guard error", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({ intentId: intent.id });
			await expect(controller.confirmIntent(intent.id)).rejects.toThrow(
				"Cannot confirm intent in 'refunded' state",
			);
		});

		it("provider confirmIntent returning failed preserves that status", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_fail_confirm",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "failed",
					providerMetadata: { error: "authentication_required" },
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 2000 });
			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("failed");
			expect(confirmed?.providerMetadata).toEqual({
				error: "authentication_required",
			});
		});

		it("confirm preserves original intent data", async () => {
			const intent = await controller.createIntent({
				amount: 5000,
				customerId: "cust_x",
				email: "x@test.com",
				orderId: "ord_x",
				metadata: { foo: "bar" },
			});
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.amount).toBe(5000);
			expect(confirmed?.customerId).toBe("cust_x");
			expect(confirmed?.email).toBe("x@test.com");
			expect(confirmed?.orderId).toBe("ord_x");
			expect(confirmed?.metadata).toEqual({ foo: "bar" });
		});

		it("provider confirmIntent with undefined providerMetadata preserves existing", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_keep_meta",
					status: "pending",
					providerMetadata: { original: "keep" },
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "succeeded",
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.providerMetadata).toEqual({ original: "keep" });
		});
	});

	// ── cancelIntent edge cases ─────────────────────────────────────────

	describe("cancelIntent edge cases", () => {
		it("cancel after confirm throws status guard error", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			await expect(controller.cancelIntent(intent.id)).rejects.toThrow(
				"Cannot cancel intent in 'succeeded' state",
			);
		});

		it("cancel preserves original intent data", async () => {
			const intent = await controller.createIntent({
				amount: 3000,
				customerId: "cust_y",
				email: "y@test.com",
				currency: "GBP",
			});
			const cancelled = await controller.cancelIntent(intent.id);
			expect(cancelled?.amount).toBe(3000);
			expect(cancelled?.customerId).toBe("cust_y");
			expect(cancelled?.email).toBe("y@test.com");
			expect(cancelled?.currency).toBe("GBP");
		});

		it("provider cancelIntent with undefined providerMetadata preserves existing", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_cancel_meta",
					status: "pending",
					providerMetadata: { keep: "this" },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn().mockResolvedValue({}),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });
			const cancelled = await ctrl.cancelIntent(intent.id);
			expect(cancelled?.providerMetadata).toEqual({ keep: "this" });
		});
	});

	// ── listIntents pagination edge cases ───────────────────────────────

	describe("listIntents pagination edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createIntent({ amount: 100 });
			await controller.createIntent({ amount: 200 });
			const result = await controller.listIntents({ take: 0 });
			expect(result).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.createIntent({ amount: 100 });
			const result = await controller.listIntents({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("handles take larger than total items", async () => {
			await controller.createIntent({ amount: 100 });
			const result = await controller.listIntents({ take: 1000 });
			expect(result).toHaveLength(1);
		});

		it("paginates through all intents correctly", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createIntent({ amount: (i + 1) * 100 });
			}
			const page1 = await controller.listIntents({ take: 3, skip: 0 });
			const page2 = await controller.listIntents({ take: 3, skip: 3 });
			const page3 = await controller.listIntents({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allIds = [
				...page1.map((i) => i.id),
				...page2.map((i) => i.id),
				...page3.map((i) => i.id),
			];
			expect(new Set(allIds).size).toBe(7);
		});

		it("returns all with empty params object", async () => {
			await controller.createIntent({ amount: 100 });
			await controller.createIntent({ amount: 200 });
			const result = await controller.listIntents({});
			expect(result).toHaveLength(2);
		});

		it("returns all with undefined params", async () => {
			await controller.createIntent({ amount: 100 });
			const result = await controller.listIntents();
			expect(result).toHaveLength(1);
		});

		it("combines pagination with filter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createIntent({
					amount: (i + 1) * 100,
					customerId: "cust_page",
				});
			}
			await controller.createIntent({
				amount: 999,
				customerId: "cust_other",
			});
			const result = await controller.listIntents({
				customerId: "cust_page",
				take: 2,
				skip: 1,
			});
			expect(result).toHaveLength(2);
			for (const r of result) {
				expect(r.customerId).toBe("cust_page");
			}
		});

		it("returns empty array when no intents exist", async () => {
			const result = await controller.listIntents();
			expect(result).toHaveLength(0);
		});
	});

	// ── savePaymentMethod edge cases ────────────────────────────────────

	describe("savePaymentMethod edge cases", () => {
		it("each method gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const method = await controller.savePaymentMethod({
					customerId: "cust_1",
					providerMethodId: `pm_${i}`,
				});
				ids.add(method.id);
			}
			expect(ids.size).toBe(10);
		});

		it("createdAt and updatedAt match on creation", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			expect(method.createdAt.getTime()).toBe(method.updatedAt.getTime());
		});

		it("handles special characters in providerMethodId", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_stripe:tok_visa/test+special",
			});
			expect(method.providerMethodId).toBe("pm_stripe:tok_visa/test+special");
		});

		it("handles expiryMonth boundary values", async () => {
			const jan = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_jan",
				expiryMonth: 1,
			});
			const dec = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_dec",
				expiryMonth: 12,
			});
			expect(jan.expiryMonth).toBe(1);
			expect(dec.expiryMonth).toBe(12);
		});

		it("clearing defaults does not affect non-default methods", async () => {
			const nonDefault = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
				isDefault: false,
			});
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_2",
				isDefault: true,
			});
			// Adding another default should clear pm_2 but not pm_1
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_3",
				isDefault: true,
			});
			const check = await controller.getPaymentMethod(nonDefault.id);
			expect(check?.isDefault).toBe(false);
		});

		it("stores under paymentMethod entity type", async () => {
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			expect(mockData.size("paymentMethod")).toBe(1);
		});
	});

	// ── deletePaymentMethod edge cases ──────────────────────────────────

	describe("deletePaymentMethod edge cases", () => {
		it("double delete returns false on second attempt", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			expect(await controller.deletePaymentMethod(method.id)).toBe(true);
			expect(await controller.deletePaymentMethod(method.id)).toBe(false);
		});

		it("deleting one method does not affect others", async () => {
			const m1 = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			const m2 = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_2",
			});
			await controller.deletePaymentMethod(m1.id);
			const remaining = await controller.getPaymentMethod(m2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.providerMethodId).toBe("pm_2");
		});

		it("returns false for empty string id", async () => {
			const result = await controller.deletePaymentMethod("");
			expect(result).toBe(false);
		});

		it("deleted method no longer appears in listPaymentMethods", async () => {
			const m1 = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_2",
			});
			await controller.deletePaymentMethod(m1.id);
			const methods = await controller.listPaymentMethods("cust_1");
			expect(methods).toHaveLength(1);
			expect(methods[0].providerMethodId).toBe("pm_2");
		});

		it("removes from data store", async () => {
			const method = await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			expect(mockData.size("paymentMethod")).toBe(1);
			await controller.deletePaymentMethod(method.id);
			expect(mockData.size("paymentMethod")).toBe(0);
		});
	});

	// ── listPaymentMethods edge cases ───────────────────────────────────

	describe("listPaymentMethods edge cases", () => {
		it("does not return methods from other customers", async () => {
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			await controller.savePaymentMethod({
				customerId: "cust_2",
				providerMethodId: "pm_2",
			});
			const methods = await controller.listPaymentMethods("cust_1");
			expect(methods).toHaveLength(1);
			expect(methods[0].customerId).toBe("cust_1");
		});

		it("handles many methods for one customer", async () => {
			for (let i = 0; i < 25; i++) {
				await controller.savePaymentMethod({
					customerId: "cust_1",
					providerMethodId: `pm_${i}`,
				});
			}
			const methods = await controller.listPaymentMethods("cust_1");
			expect(methods).toHaveLength(25);
		});
	});

	// ── createRefund edge cases ─────────────────────────────────────────

	describe("createRefund edge cases", () => {
		it("refund amount equal to intent amount creates full refund", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				amount: 5000,
			});
			expect(refund.amount).toBe(5000);
		});

		it("rejects refund with zero amount", async () => {
			const intent = await controller.createIntent({ amount: 5000 });
			await controller.confirmIntent(intent.id);
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 0,
				}),
			).rejects.toThrow("Refund amount must be positive");
		});

		it("refund with very long reason string", async () => {
			const longReason = "R".repeat(5000);
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				reason: longReason,
			});
			expect(refund.reason).toBe(longReason);
		});

		it("refund with special characters in reason", async () => {
			const intent = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(intent.id);
			const refund = await controller.createRefund({
				intentId: intent.id,
				reason: 'Customer said: "I don\'t want it!" <script>alert(1)</script>',
			});
			expect(refund.reason).toBe(
				'Customer said: "I don\'t want it!" <script>alert(1)</script>',
			);
		});

		it("multiple refunds are all stored under refund entity type", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({
				intentId: intent.id,
				amount: 1000,
			});
			await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
			});
			await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
			});
			expect(mockData.size("refund")).toBe(3);
		});

		it("partial refund on already-refunded intent respects cap", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({
				intentId: intent.id,
				amount: 5000,
			});
			// Second refund within remaining cap should succeed
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
			});
			expect(r2.amount).toBe(3000);
			expect(r2.status).toBe("succeeded");
		});

		it("rejects refund exceeding remaining refundable amount", async () => {
			const intent = await controller.createIntent({ amount: 10000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({
				intentId: intent.id,
				amount: 7000,
			});
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 5000,
				}),
			).rejects.toThrow(
				"Refund amount 5000 exceeds remaining refundable amount 3000",
			);
		});

		it("provider createRefund receives correct parameters", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_check_params",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "succeeded",
					providerMetadata: {},
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn().mockResolvedValue({
					providerRefundId: "re_check",
					status: "succeeded",
				}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });
			await ctrl.confirmIntent(intent.id);
			await ctrl.createRefund({
				intentId: intent.id,
				amount: 2000,
				reason: "Damaged item",
			});
			expect(mockProvider.createRefund).toHaveBeenCalledWith({
				providerIntentId: "pi_check_params",
				amount: 2000,
				currency: "USD",
				reason: "Damaged item",
			});
		});

		it("provider createRefund receives non-USD currency from intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_eur",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "succeeded",
					providerMetadata: {},
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn().mockResolvedValue({
					providerRefundId: "re_eur",
					status: "succeeded",
				}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({
				amount: 3000,
				currency: "EUR",
			});
			await ctrl.confirmIntent(intent.id);
			await ctrl.createRefund({ intentId: intent.id, amount: 1500 });
			expect(mockProvider.createRefund).toHaveBeenCalledWith({
				providerIntentId: "pi_eur",
				amount: 1500,
				currency: "EUR",
				reason: undefined,
			});
		});
	});

	// ── listRefunds edge cases ──────────────────────────────────────────

	describe("listRefunds edge cases", () => {
		it("returns empty array for nonexistent intent id", async () => {
			const refunds = await controller.listRefunds("nonexistent");
			expect(refunds).toHaveLength(0);
		});

		it("does not return refunds from other intents", async () => {
			const i1 = await controller.createIntent({ amount: 1000 });
			await controller.confirmIntent(i1.id);
			const i2 = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(i2.id);
			await controller.createRefund({ intentId: i1.id, amount: 500 });
			await controller.createRefund({ intentId: i2.id, amount: 1000 });
			const refunds = await controller.listRefunds(i1.id);
			expect(refunds).toHaveLength(1);
			expect(refunds[0].amount).toBe(500);
		});
	});

	// ── handleWebhookEvent edge cases ───────────────────────────────────

	describe("handleWebhookEvent edge cases", () => {
		it("multiple webhook events update status sequentially", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_multi_hook",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 5000 });

			// pending -> processing
			let result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_multi_hook",
				status: "processing",
			});
			expect(result?.status).toBe("processing");

			// processing -> succeeded
			result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_multi_hook",
				status: "succeeded",
			});
			expect(result?.status).toBe("succeeded");
		});

		it("accumulates providerMetadata across multiple webhook events", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_accum",
					status: "pending",
					providerMetadata: { step: "created" },
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 1000 });

			await ctrl.handleWebhookEvent({
				providerIntentId: "pi_accum",
				status: "processing",
				providerMetadata: { step: "processing", attempts: 1 },
			});

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_accum",
				status: "succeeded",
				providerMetadata: { step: "succeeded", finalizedAt: "2026-01-01" },
			});
			// The last providerMetadata overrides previous keys and adds new ones
			expect(result?.providerMetadata).toEqual({
				step: "succeeded",
				attempts: 1,
				finalizedAt: "2026-01-01",
			});
		});

		it("webhook event to refunded status", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_hook_refund",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 3000 });

			const result = await ctrl.handleWebhookEvent({
				providerIntentId: "pi_hook_refund",
				status: "refunded",
			});
			expect(result?.status).toBe("refunded");
		});

		it("webhook event updates persisted data", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_persist",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 1000 });

			await ctrl.handleWebhookEvent({
				providerIntentId: "pi_persist",
				status: "succeeded",
			});

			// Verify via getIntent that the change is persisted
			const fetched = await ctrl.getIntent(intent.id);
			expect(fetched?.status).toBe("succeeded");
		});
	});

	// ── handleWebhookRefund edge cases ──────────────────────────────────

	describe("handleWebhookRefund edge cases", () => {
		it("webhook refund creates retrievable refund record", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_wr_get",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 5000 });

			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_wr_get",
				providerRefundId: "re_get",
				amount: 3000,
			});

			// The refund should be retrievable
			const refund = result ? await ctrl.getRefund(result.refund.id) : null;
			expect(refund).not.toBeNull();
			expect(refund?.amount).toBe(3000);
		});

		it("webhook refund shows up in listRefunds", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_wr_list",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 5000 });

			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_wr_list",
				providerRefundId: "re_list",
				amount: 2000,
			});

			const refunds = await ctrl.listRefunds(intent.id);
			expect(refunds).toHaveLength(1);
			expect(refunds[0].providerRefundId).toBe("re_list");
		});

		it("multiple webhook refunds on same intent", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_wr_multi",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 10000 });

			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_wr_multi",
				providerRefundId: "re_1",
				amount: 3000,
			});
			await ctrl.handleWebhookRefund({
				providerIntentId: "pi_wr_multi",
				providerRefundId: "re_2",
				amount: 4000,
			});

			const refunds = await ctrl.listRefunds(intent.id);
			expect(refunds).toHaveLength(2);
			const total = refunds.reduce((s, r) => s + r.amount, 0);
			expect(total).toBe(7000);
		});

		it("webhook refund without reason leaves it undefined", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_wr_no_reason",
					status: "succeeded",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn(),
				cancelIntent: vi.fn(),
				createRefund: vi.fn(),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			await ctrl.createIntent({ amount: 2000 });

			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_wr_no_reason",
				providerRefundId: "re_no_reason",
			});
			expect(result?.refund.reason).toBeUndefined();
		});
	});

	// ── Data store consistency ───────────────────────────────────────────

	describe("data store consistency", () => {
		it("different entity types do not interfere", async () => {
			await controller.createIntent({ amount: 1000 });
			await controller.savePaymentMethod({
				customerId: "cust_1",
				providerMethodId: "pm_1",
			});
			const intent = await controller.createIntent({ amount: 2000 });
			await controller.confirmIntent(intent.id);
			await controller.createRefund({ intentId: intent.id });

			expect(mockData.size("paymentIntent")).toBe(2);
			expect(mockData.size("paymentMethod")).toBe(1);
			expect(mockData.size("refund")).toBe(1);
		});

		it("store is empty on fresh controller", async () => {
			expect(mockData.size("paymentIntent")).toBe(0);
			expect(mockData.size("paymentMethod")).toBe(0);
			expect(mockData.size("refund")).toBe(0);
		});
	});

	// ── Complex lifecycle ───────────────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full payment lifecycle: create, confirm, refund, verify", async () => {
			// Create
			const intent = await controller.createIntent({
				amount: 10000,
				customerId: "cust_lifecycle",
				currency: "EUR",
				orderId: "ord_lifecycle",
			});
			expect(intent.status).toBe("pending");

			// Confirm
			const confirmed = await controller.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");

			// Partial refund
			const r1 = await controller.createRefund({
				intentId: intent.id,
				amount: 3000,
				reason: "Item damaged",
			});
			expect(r1.amount).toBe(3000);

			// Check intent marked refunded
			const afterRefund = await controller.getIntent(intent.id);
			expect(afterRefund?.status).toBe("refunded");

			// Another partial refund (within cap: 10000 - 3000 = 7000 remaining)
			const r2 = await controller.createRefund({
				intentId: intent.id,
				amount: 2000,
				reason: "Item missing",
			});
			expect(r2.amount).toBe(2000);

			// Refund exceeding cap should fail (5000 remaining)
			await expect(
				controller.createRefund({
					intentId: intent.id,
					amount: 6000,
				}),
			).rejects.toThrow("exceeds remaining refundable amount");

			// List all refunds
			const refunds = await controller.listRefunds(intent.id);
			expect(refunds).toHaveLength(2);
		});

		it("multiple customers with intents, methods, and refunds", async () => {
			// Customer A
			const intentA = await controller.createIntent({
				amount: 5000,
				customerId: "cust_a",
			});
			await controller.savePaymentMethod({
				customerId: "cust_a",
				providerMethodId: "pm_a1",
				isDefault: true,
			});

			// Customer B
			const intentB = await controller.createIntent({
				amount: 7500,
				customerId: "cust_b",
			});
			await controller.savePaymentMethod({
				customerId: "cust_b",
				providerMethodId: "pm_b1",
				isDefault: true,
			});

			// Confirm both
			await controller.confirmIntent(intentA.id);
			await controller.confirmIntent(intentB.id);

			// Full refund A only (defaults to intent amount)
			await controller.createRefund({ intentId: intentA.id });

			// Verify states
			const aList = await controller.listIntents({
				customerId: "cust_a",
			});
			expect(aList).toHaveLength(1);
			expect(aList[0].status).toBe("refunded");

			const bList = await controller.listIntents({
				customerId: "cust_b",
			});
			expect(bList).toHaveLength(1);
			expect(bList[0].status).toBe("succeeded");

			// Methods are independent
			expect(await controller.listPaymentMethods("cust_a")).toHaveLength(1);
			expect(await controller.listPaymentMethods("cust_b")).toHaveLength(1);

			// Can't refund A again (fully refunded)
			await expect(
				controller.createRefund({ intentId: intentA.id }),
			).rejects.toThrow("exceeds remaining refundable amount");
		});

		it("webhook event and manual operations interleave correctly", async () => {
			const mockProvider: PaymentProvider = {
				createIntent: vi.fn().mockResolvedValue({
					providerIntentId: "pi_interleave",
					status: "pending",
					providerMetadata: {},
				}),
				confirmIntent: vi.fn().mockResolvedValue({
					status: "succeeded",
					providerMetadata: {},
				}),
				cancelIntent: vi.fn(),
				createRefund: vi.fn().mockResolvedValue({
					providerRefundId: "re_interleave",
					status: "succeeded",
				}),
			};
			const ctrl = createPaymentController(mockData, mockProvider);
			const intent = await ctrl.createIntent({ amount: 8000 });

			// Webhook arrives with processing status
			await ctrl.handleWebhookEvent({
				providerIntentId: "pi_interleave",
				status: "processing",
				providerMetadata: { step: "3ds" },
			});

			// Manually confirm
			const confirmed = await ctrl.confirmIntent(intent.id);
			expect(confirmed?.status).toBe("succeeded");

			// Refund via webhook
			const result = await ctrl.handleWebhookRefund({
				providerIntentId: "pi_interleave",
				providerRefundId: "re_wh",
				amount: 4000,
			});
			expect(result?.intent.status).toBe("refunded");
			expect(result?.refund.amount).toBe(4000);

			// listIntents shows refunded
			const list = await ctrl.listIntents({ status: "refunded" });
			expect(list).toHaveLength(1);
		});
	});
});
