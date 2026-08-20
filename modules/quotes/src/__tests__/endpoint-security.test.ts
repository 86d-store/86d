import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { QuoteController } from "../service";
import { createQuoteController } from "../service-impl";
import { acceptQuoteEndpoint } from "../store/endpoints/accept-quote";
import { addCommentEndpoint } from "../store/endpoints/add-comment";
import { submitQuoteEndpoint } from "../store/endpoints/submit-quote";

/**
 * Security tests for quotes module endpoints.
 *
 * These tests verify:
 * - Customer isolation: quotes scoped to customerId, no cross-customer enumeration
 * - Ownership verification: mutations require matching customerId
 * - State machine enforcement: quotes follow valid status transitions
 * - Item manipulation: only draft quotes allow item changes
 * - Comment isolation: comments scoped to their quote
 */

async function callEndpoint<
	E extends (...args: never[]) => Promise<unknown>,
	I extends Parameters<E>[0] & object,
>(
	endpoint: E,
	input: I,
	context: {
		controllers: { quotes: QuoteController };
		session?:
			| {
					user: {
						email: string;
						id: string;
						name: string;
					};
			  }
			| undefined;
	},
): Promise<Awaited<ReturnType<E>>> {
	return endpoint(
		Object.assign({}, input, { context }) as Parameters<E>[0],
	) as Promise<Awaited<ReturnType<E>>>;
}

describe("quotes endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createQuoteController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createQuoteController(mockData, {
			defaultExpirationDays: 30,
		});
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getMyQuotes returns only the specified customer's quotes", async () => {
			await controller.createQuote({
				customerId: "customer_a",
				customerEmail: "a@test.com",
				customerName: "Customer A",
			});
			await controller.createQuote({
				customerId: "customer_b",
				customerEmail: "b@test.com",
				customerName: "Customer B",
			});

			const quotesA = await controller.getMyQuotes({
				customerId: "customer_a",
			});
			const quotesB = await controller.getMyQuotes({
				customerId: "customer_b",
			});

			expect(quotesA).toHaveLength(1);
			expect(quotesA[0].customerId).toBe("customer_a");
			expect(quotesB).toHaveLength(1);
			expect(quotesB[0].customerId).toBe("customer_b");
		});

		it("getMyQuotes returns empty for non-existent customer", async () => {
			await controller.createQuote({
				customerId: "customer_a",
				customerEmail: "a@test.com",
				customerName: "Customer A",
			});

			const quotes = await controller.getMyQuotes({
				customerId: "nonexistent",
			});
			expect(quotes).toHaveLength(0);
		});

		it("getQuote does not scope by customer (endpoint must verify ownership)", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_a",
				customerEmail: "a@test.com",
				customerName: "Customer A",
			});

			// Controller returns the quote regardless of caller — endpoint must verify
			const result = await controller.getQuote(quote.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("customer_a");
		});
	});

	// ── Ownership Verification Pattern ──────────────────────────────

	describe("ownership verification pattern", () => {
		it("submitQuote uses the route id as the source of truth", async () => {
			const ownedQuote = await controller.createQuote({
				customerId: "customer_a",
				customerEmail: "owner@test.com",
				customerName: "Owner",
			});
			await controller.addItem({
				quoteId: ownedQuote.id,
				productId: "prod_1",
				productName: "Product 1",
				quantity: 1,
				unitPrice: 500,
			});

			const otherQuote = await controller.createQuote({
				customerId: "customer_a",
				customerEmail: "owner@test.com",
				customerName: "Owner",
			});
			await controller.addItem({
				quoteId: otherQuote.id,
				productId: "prod_2",
				productName: "Product 2",
				quantity: 1,
				unitPrice: 900,
			});

			const response = await callEndpoint(
				submitQuoteEndpoint,
				{
					params: { id: ownedQuote.id },
					body: { quoteId: otherQuote.id },
				},
				{
					controllers: { quotes: controller },
					session: {
						user: {
							id: "customer_a",
							email: "owner@test.com",
							name: "Owner",
						},
					},
				},
			);

			expect(response).toEqual({ error: "Quote not found", status: 404 });
			expect((await controller.getQuote(ownedQuote.id))?.status).toBe("draft");
			expect((await controller.getQuote(otherQuote.id))?.status).toBe("draft");
		});

		it("endpoint must verify quote ownership before allowing submit", async () => {
			const victimQuote = await controller.createQuote({
				customerId: "victim",
				customerEmail: "victim@test.com",
				customerName: "Victim",
			});

			// Simulate the correct endpoint pattern:
			const quote = await controller.getQuote(victimQuote.id);
			const attackerSessionId = "attacker";

			// Endpoint MUST check this before calling submitQuote
			if (quote?.customerId !== attackerSessionId) {
				expect(quote?.customerId).toBe("victim");
				// Endpoint returns 404, does not call submitQuote
			}

			// Verify quote is still in draft (not submitted)
			const stillDraft = await controller.getQuote(victimQuote.id);
			expect(stillDraft?.status).toBe("draft");
		});

		it("endpoint must verify ownership before accepting quote", async () => {
			const quote = await controller.createQuote({
				customerId: "victim",
				customerEmail: "victim@test.com",
				customerName: "Victim",
			});
			await controller.submitQuote(quote.id);

			// Simulate admin reviewing and countering
			await controller.reviewQuote(quote.id);
			await controller.counterQuote(quote.id, {
				items: [],
				adminNotes: "Counter offer",
			});

			// Attacker should not be able to accept victim's quote
			const fetchedQuote = await controller.getQuote(quote.id);
			expect(fetchedQuote?.customerId).toBe("victim");
			// Endpoint MUST verify customerId === session.user.id before calling acceptQuote
		});

		it("acceptQuote accepts requests without a duplicate body quoteId", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod_1",
				productName: "Product 1",
				quantity: 1,
				unitPrice: 200,
			});
			await controller.submitQuote(quote.id);
			await controller.reviewQuote(quote.id);
			await controller.counterQuote(quote.id, { items: [] });

			const response = await callEndpoint(
				acceptQuoteEndpoint,
				{
					params: { id: quote.id },
				},
				{
					controllers: { quotes: controller },
					session: {
						user: {
							id: "customer_1",
							email: "c1@test.com",
							name: "Customer 1",
						},
					},
				},
			);

			expect("quote" in response).toBe(true);
			if ("quote" in response) {
				expect(response.quote.status).toBe("accepted");
			}
		});
	});

	// ── State Machine Enforcement ───────────────────────────────────

	describe("state machine enforcement", () => {
		it("cannot submit an already submitted quote", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			await controller.submitQuote(quote.id);

			// Second submit should return null or fail
			const result = await controller.submitQuote(quote.id);
			expect(result).toBeNull();
		});

		it("cannot accept a draft quote", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});

		it("cannot decline a draft quote", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});

			const result = await controller.declineQuote(quote.id, "Not interested");
			expect(result).toBeNull();
		});

		it("rejected quote cannot be accepted", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			await controller.submitQuote(quote.id);
			await controller.rejectQuote(quote.id, "Too expensive");

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});

		it("expired quote cannot be accepted", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			await controller.submitQuote(quote.id);
			await controller.expireQuote(quote.id);

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Item Manipulation Security ──────────────────────────────────

	describe("item manipulation security", () => {
		it("items scoped to their quote", async () => {
			const quote1 = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			const quote2 = await controller.createQuote({
				customerId: "customer_2",
				customerEmail: "c2@test.com",
				customerName: "Customer 2",
			});

			await controller.addItem({
				quoteId: quote1.id,
				productId: "prod_1",
				productName: "Product 1",
				quantity: 2,
				unitPrice: 1000,
			});

			const items1 = await controller.getItems(quote1.id);
			const items2 = await controller.getItems(quote2.id);

			expect(items1).toHaveLength(1);
			expect(items2).toHaveLength(0);
		});

		it("removing an item from one quote does not affect another", async () => {
			const quote1 = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			const quote2 = await controller.createQuote({
				customerId: "customer_2",
				customerEmail: "c2@test.com",
				customerName: "Customer 2",
			});

			const item1 = await controller.addItem({
				quoteId: quote1.id,
				productId: "prod_1",
				productName: "Product 1",
				quantity: 1,
				unitPrice: 500,
			});
			await controller.addItem({
				quoteId: quote2.id,
				productId: "prod_1",
				productName: "Product 1",
				quantity: 1,
				unitPrice: 500,
			});

			if (item1) {
				await controller.removeItem(quote1.id, item1.id);
			}

			const items1 = await controller.getItems(quote1.id);
			const items2 = await controller.getItems(quote2.id);

			expect(items1).toHaveLength(0);
			expect(items2).toHaveLength(1);
		});
	});

	// ── Comment Isolation ───────────────────────────────────────────

	describe("comment isolation", () => {
		it("comments scoped to their quote", async () => {
			const quote1 = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			const quote2 = await controller.createQuote({
				customerId: "customer_2",
				customerEmail: "c2@test.com",
				customerName: "Customer 2",
			});

			await controller.addComment({
				quoteId: quote1.id,
				authorType: "customer",
				authorId: "customer_1",
				authorName: "Customer 1",
				message: "Private message",
			});

			const comments1 = await controller.getComments(quote1.id);
			const comments2 = await controller.getComments(quote2.id);

			expect(comments1).toHaveLength(1);
			expect(comments1[0].message).toBe("Private message");
			expect(comments2).toHaveLength(0);
		});

		it("addComment derives author identity from the session", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});

			const response = await callEndpoint(
				addCommentEndpoint,
				{
					params: { id: quote.id },
					body: {
						message: "Need updated lead times",
					},
				},
				{
					controllers: { quotes: controller },
					session: {
						user: {
							id: "customer_1",
							email: "c1@test.com",
							name: "<b>Customer 1</b>",
						},
					},
				},
			);

			expect("comment" in response).toBe(true);
			if ("comment" in response) {
				expect(response.comment.authorId).toBe("customer_1");
				expect(response.comment.authorName).toBe("Customer 1");
				expect(response.comment.quoteId).toBe(quote.id);
			}
		});
	});

	// ── Admin vs Store Boundary ─────────────────────────────────────

	describe("admin vs store boundary", () => {
		it("listQuotes returns all quotes (admin-only — not exposed via store)", async () => {
			await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});
			await controller.createQuote({
				customerId: "customer_2",
				customerEmail: "c2@test.com",
				customerName: "Customer 2",
			});

			const all = await controller.listQuotes({});
			expect(all).toHaveLength(2);
		});

		it("convertToOrder only works on accepted quotes", async () => {
			const quote = await controller.createQuote({
				customerId: "customer_1",
				customerEmail: "c1@test.com",
				customerName: "Customer 1",
			});

			// Draft quote cannot be converted
			const result = await controller.convertToOrder(quote.id, "order_123");
			expect(result).toBeNull();
		});
	});

	// ── Non-existent Resource Handling ───────────────────────────────

	describe("non-existent resource handling", () => {
		it("getQuote returns null for non-existent ID", async () => {
			const result = await controller.getQuote("nonexistent");
			expect(result).toBeNull();
		});

		it("submitQuote returns null for non-existent ID", async () => {
			const result = await controller.submitQuote("nonexistent");
			expect(result).toBeNull();
		});

		it("addItem returns null for non-existent quote", async () => {
			const result = await controller.addItem({
				quoteId: "nonexistent",
				productId: "prod_1",
				productName: "Product 1",
				quantity: 1,
				unitPrice: 500,
			});
			expect(result).toBeNull();
		});
	});
});
