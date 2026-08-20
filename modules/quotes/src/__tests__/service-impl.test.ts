import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQuoteController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("createQuoteController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createQuoteController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createQuoteController(mockData, {
			defaultExpirationDays: 30,
		});
	});

	// ── Quote creation ──

	describe("createQuote", () => {
		it("creates a draft quote with required fields", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@acme.com",
				customerName: "Jane Buyer",
			});

			expect(quote.id).toBeDefined();
			expect(quote.customerId).toBe("cust-1");
			expect(quote.customerEmail).toBe("buyer@acme.com");
			expect(quote.customerName).toBe("Jane Buyer");
			expect(quote.status).toBe("draft");
			expect(quote.subtotal).toBe(0);
			expect(quote.discount).toBe(0);
			expect(quote.total).toBe(0);
			expect(quote.createdAt).toBeInstanceOf(Date);
		});

		it("creates a quote with optional company and notes", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@acme.com",
				customerName: "Jane Buyer",
				companyName: "Acme Corp",
				notes: "Need bulk pricing for Q2",
			});

			expect(quote.companyName).toBe("Acme Corp");
			expect(quote.notes).toBe("Need bulk pricing for Q2");
		});
	});

	// ── Getters ──

	describe("getQuote", () => {
		it("returns a quote by id", async () => {
			const created = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@acme.com",
				customerName: "Jane Buyer",
			});

			const found = await controller.getQuote(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent quote", async () => {
			const found = await controller.getQuote("non-existent");
			expect(found).toBeNull();
		});
	});

	describe("getMyQuotes", () => {
		it("returns quotes for a customer", async () => {
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const quotes = await controller.getMyQuotes({
				customerId: "cust-1",
			});
			expect(quotes).toHaveLength(2);
		});

		it("filters by status", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			// Add item and submit q1
			await controller.addItem({
				quoteId: q1.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 5,
			});
			await controller.submitQuote(q1.id);

			const drafts = await controller.getMyQuotes({
				customerId: "cust-1",
				status: "draft",
			});
			expect(drafts).toHaveLength(1);

			const submitted = await controller.getMyQuotes({
				customerId: "cust-1",
				status: "submitted",
			});
			expect(submitted).toHaveLength(1);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});
			}

			const page = await controller.getMyQuotes({
				customerId: "cust-1",
				skip: 2,
				take: 2,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Items ──

	describe("addItem", () => {
		it("adds an item to a draft quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget A",
					sku: "WA-100",
					quantity: 10,
					unitPrice: 25.5,
					notes: "Blue color preferred",
				}),
			);

			expect(item.id).toBeDefined();
			expect(item.quoteId).toBe(quote.id);
			expect(item.productId).toBe("prod-1");
			expect(item.productName).toBe("Widget A");
			expect(item.sku).toBe("WA-100");
			expect(item.quantity).toBe(10);
			expect(item.unitPrice).toBe(25.5);
		});

		it("recalculates quote totals after adding item", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 5,
			});

			const updated = unwrap(await controller.getQuote(quote.id));
			expect(updated.subtotal).toBe(50);
			expect(updated.total).toBe(50);
		});

		it("returns null when adding to a non-draft quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const result = await controller.addItem({
				quoteId: quote.id,
				productId: "prod-2",
				productName: "Gadget",
				quantity: 1,
				unitPrice: 20,
			});
			expect(result).toBeNull();
		});
	});

	describe("updateItem", () => {
		it("updates item quantity and recalculates totals", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 10,
					unitPrice: 5,
				}),
			);

			const updated = unwrap(
				await controller.updateItem(quote.id, item.id, { quantity: 20 }),
			);
			expect(updated.quantity).toBe(20);

			const q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(100);
		});

		it("returns null for wrong quoteId", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 1,
					unitPrice: 5,
				}),
			);

			const result = await controller.updateItem("wrong-quote", item.id, {
				quantity: 2,
			});
			expect(result).toBeNull();
		});
	});

	describe("removeItem", () => {
		it("removes an item and recalculates totals", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const item1 = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 10,
					unitPrice: 5,
				}),
			);
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-2",
				productName: "Gadget",
				quantity: 5,
				unitPrice: 10,
			});

			const removed = await controller.removeItem(quote.id, item1.id);
			expect(removed).toBe(true);

			const q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(50); // Only gadget remains: 5 * 10
		});

		it("returns false for non-existent item", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.removeItem(quote.id, "nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("getItems", () => {
		it("returns all items for a quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 5,
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-2",
				productName: "Gadget",
				quantity: 5,
				unitPrice: 10,
			});

			const items = await controller.getItems(quote.id);
			expect(items).toHaveLength(2);
		});
	});

	// ── Submit ──

	describe("submitQuote", () => {
		it("transitions draft to submitted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});

			const submitted = unwrap(await controller.submitQuote(quote.id));
			expect(submitted.status).toBe("submitted");
		});

		it("returns null when submitting empty quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.submitQuote(quote.id);
			expect(result).toBeNull();
		});

		it("returns null when not in draft status", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const result = await controller.submitQuote(quote.id);
			expect(result).toBeNull();
		});

		it("records status change in history", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const history = await controller.getHistory(quote.id);
			expect(history).toHaveLength(1);
			expect(history[0].fromStatus).toBe("draft");
			expect(history[0].toStatus).toBe("submitted");
		});
	});

	// ── Admin review ──

	describe("reviewQuote", () => {
		it("transitions submitted to under_review", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const reviewed = unwrap(await controller.reviewQuote(quote.id));
			expect(reviewed.status).toBe("under_review");
		});

		it("returns null when not submitted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.reviewQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Counter offer ──

	describe("counterQuote", () => {
		it("applies offered prices and transitions to countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 100,
					unitPrice: 10,
				}),
			);
			await controller.submitQuote(quote.id);

			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [{ itemId: item.id, offeredPrice: 8 }],
					adminNotes: "Volume discount applied",
				}),
			);

			expect(countered.status).toBe("countered");
			expect(countered.total).toBe(800); // 100 * 8
			expect(countered.adminNotes).toBe("Volume discount applied");
			expect(countered.expiresAt).toBeDefined();
		});

		it("works from under_review status", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 50,
					unitPrice: 10,
				}),
			);
			await controller.submitQuote(quote.id);
			await controller.reviewQuote(quote.id);

			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [{ itemId: item.id, offeredPrice: 7 }],
				}),
			);
			expect(countered.status).toBe("countered");
			expect(countered.total).toBe(350);
		});

		it("returns null when in wrong status", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.counterQuote(quote.id, {
				items: [],
			});
			expect(result).toBeNull();
		});

		it("uses custom expiration date", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const customExpiry = new Date("2099-12-31");
			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [],
					expiresAt: customExpiry,
				}),
			);
			expect(countered.expiresAt).toBeDefined();
			expect(new Date(countered.expiresAt as Date).getTime()).toBe(
				customExpiry.getTime(),
			);
		});
	});

	// ── Approve as-is ──

	describe("approveAsIs", () => {
		it("transitions submitted to countered (accept customer pricing)", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 5,
			});
			await controller.submitQuote(quote.id);

			const approved = unwrap(await controller.approveAsIs(quote.id));
			expect(approved.status).toBe("countered");
			expect(approved.expiresAt).toBeDefined();
		});

		it("returns null when in wrong status", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.approveAsIs(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Customer accept/decline ──

	describe("acceptQuote", () => {
		it("transitions countered to accepted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			const accepted = unwrap(await controller.acceptQuote(quote.id));
			expect(accepted.status).toBe("accepted");
		});

		it("returns null when not countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	describe("declineQuote", () => {
		it("transitions countered to rejected with reason", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			const declined = unwrap(
				await controller.declineQuote(quote.id, "Price too high"),
			);
			expect(declined.status).toBe("rejected");
		});

		it("returns null when not countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.declineQuote(quote.id);
			expect(result).toBeNull();
		});

		it("records reason in history", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);
			await controller.declineQuote(quote.id, "Too expensive");

			const history = await controller.getHistory(quote.id);
			const declineEntry = history.find((h) => h.toStatus === "rejected");
			expect(declineEntry).toBeDefined();
			expect(declineEntry?.reason).toBe("Too expensive");
		});
	});

	// ── Admin reject ──

	describe("rejectQuote (admin)", () => {
		it("rejects a submitted quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const rejected = unwrap(
				await controller.rejectQuote(quote.id, "Not serviceable"),
			);
			expect(rejected.status).toBe("rejected");
		});

		it("rejects a draft quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const rejected = unwrap(await controller.rejectQuote(quote.id));
			expect(rejected.status).toBe("rejected");
		});

		it("returns null for already rejected quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.rejectQuote(quote.id);

			const result = await controller.rejectQuote(quote.id);
			expect(result).toBeNull();
		});

		it("returns null for converted quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);
			await controller.acceptQuote(quote.id);
			await controller.convertToOrder(quote.id, "order-1");

			const result = await controller.rejectQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Convert to order ──

	describe("convertToOrder", () => {
		it("transitions accepted to converted with orderId", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);
			await controller.acceptQuote(quote.id);

			const converted = unwrap(
				await controller.convertToOrder(quote.id, "order-123"),
			);
			expect(converted.status).toBe("converted");
			expect(converted.convertedOrderId).toBe("order-123");
		});

		it("returns null when not accepted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.convertToOrder(quote.id, "order-1");
			expect(result).toBeNull();
		});
	});

	// ── Expire ──

	describe("expireQuote", () => {
		it("transitions countered to expired", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			const expired = unwrap(await controller.expireQuote(quote.id));
			expect(expired.status).toBe("expired");
		});

		it("returns null when not countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.expireQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Comments ──

	describe("comments", () => {
		it("adds a customer comment", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const comment = await controller.addComment({
				quoteId: quote.id,
				authorType: "customer",
				authorId: "cust-1",
				authorName: "Jane",
				message: "Can we get a better price?",
			});

			expect(comment.id).toBeDefined();
			expect(comment.authorType).toBe("customer");
			expect(comment.message).toBe("Can we get a better price?");
		});

		it("adds an admin comment", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const comment = await controller.addComment({
				quoteId: quote.id,
				authorType: "admin",
				authorId: "admin-1",
				authorName: "Sales Rep",
				message: "We can offer 15% off for orders over 100 units.",
			});

			expect(comment.authorType).toBe("admin");
		});

		it("returns comments for a quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			await controller.addComment({
				quoteId: quote.id,
				authorType: "customer",
				authorId: "cust-1",
				authorName: "Jane",
				message: "Hello",
			});
			await controller.addComment({
				quoteId: quote.id,
				authorType: "admin",
				authorId: "admin-1",
				authorName: "Rep",
				message: "Hi there",
			});

			const comments = await controller.getComments(quote.id);
			expect(comments).toHaveLength(2);
		});
	});

	// ── Admin list ──

	describe("listQuotes", () => {
		it("returns all quotes", async () => {
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const quotes = await controller.listQuotes();
			expect(quotes).toHaveLength(2);
		});

		it("filters by status", async () => {
			const q = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(q.id);

			await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const submitted = await controller.listQuotes({ status: "submitted" });
			expect(submitted).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const filtered = await controller.listQuotes({
				customerId: "cust-1",
			});
			expect(filtered).toHaveLength(1);
		});
	});

	// ── History ──

	describe("getHistory", () => {
		it("records full lifecycle history", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.reviewQuote(quote.id);
			await controller.approveAsIs(quote.id);
			await controller.acceptQuote(quote.id);
			await controller.convertToOrder(quote.id, "order-1");

			const history = await controller.getHistory(quote.id);
			expect(history).toHaveLength(5);
			expect(history[0].fromStatus).toBe("draft");
			expect(history[0].toStatus).toBe("submitted");
			expect(history[1].toStatus).toBe("under_review");
			expect(history[2].toStatus).toBe("countered");
			expect(history[3].toStatus).toBe("accepted");
			expect(history[4].toStatus).toBe("converted");
		});
	});

	// ── Stats ──

	describe("getStats", () => {
		it("returns zeroes when no quotes exist", async () => {
			const stats = await controller.getStats();
			expect(stats.totalQuotes).toBe(0);
			expect(stats.totalValue).toBe(0);
			expect(stats.averageValue).toBe(0);
			expect(stats.conversionRate).toBe(0);
		});

		it("aggregates stats across quotes", async () => {
			// Create and submit a quote
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q1.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 10,
			});
			await controller.submitQuote(q1.id);
			await controller.approveAsIs(q1.id);
			await controller.acceptQuote(q1.id);

			// Create a rejected quote
			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});
			await controller.addItem({
				quoteId: q2.id,
				productId: "prod-2",
				productName: "Gadget",
				quantity: 5,
				unitPrice: 20,
			});
			await controller.submitQuote(q2.id);
			await controller.rejectQuote(q2.id);

			// Create a draft quote
			await controller.createQuote({
				customerId: "cust-3",
				customerEmail: "c@test.com",
				customerName: "C",
			});

			const stats = await controller.getStats();
			expect(stats.totalQuotes).toBe(3);
			expect(stats.acceptedQuotes).toBe(1);
			expect(stats.rejectedQuotes).toBe(1);
			expect(stats.draftQuotes).toBe(1);
			// 1 accepted out of 2 decided (1 accepted + 1 rejected)
			expect(stats.conversionRate).toBe(0.5);
		});
	});

	// ── Full lifecycle ──

	describe("full lifecycle", () => {
		it("draft → submit → review → counter → accept → convert", async () => {
			// Customer creates quote
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@acme.com",
				customerName: "Jane Buyer",
				companyName: "Acme Corp",
				notes: "Need 500 units for Q2 rollout",
			});
			expect(quote.status).toBe("draft");

			// Customer adds items
			const item1 = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-widget",
					productName: "Premium Widget",
					sku: "PW-500",
					quantity: 500,
					unitPrice: 12,
				}),
			);
			const item2 = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-bracket",
					productName: "Mounting Bracket",
					sku: "MB-100",
					quantity: 500,
					unitPrice: 3,
				}),
			);

			// Verify totals: 500*12 + 500*3 = 7500
			let q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(7500);

			// Customer submits
			q = unwrap(await controller.submitQuote(quote.id));
			expect(q.status).toBe("submitted");

			// Admin reviews
			q = unwrap(await controller.reviewQuote(quote.id));
			expect(q.status).toBe("under_review");

			// Admin adds comment
			await controller.addComment({
				quoteId: quote.id,
				authorType: "admin",
				authorId: "admin-1",
				authorName: "Sales Manager",
				message: "Reviewing with procurement team.",
			});

			// Admin counters with volume discount
			q = unwrap(
				await controller.counterQuote(quote.id, {
					items: [
						{ itemId: item1.id, offeredPrice: 9.5 },
						{ itemId: item2.id, offeredPrice: 2.5 },
					],
					adminNotes: "Bulk discount: 20% off widgets, 17% off brackets",
				}),
			);
			expect(q.status).toBe("countered");
			// 500*9.5 + 500*2.5 = 6000
			expect(q.total).toBe(6000);

			// Customer accepts
			q = unwrap(await controller.acceptQuote(quote.id));
			expect(q.status).toBe("accepted");

			// Admin converts to order
			q = unwrap(
				await controller.convertToOrder(quote.id, "order-20260308-001"),
			);
			expect(q.status).toBe("converted");
			expect(q.convertedOrderId).toBe("order-20260308-001");

			// Verify full history
			const history = await controller.getHistory(quote.id);
			expect(history).toHaveLength(5);

			// Verify comments
			const comments = await controller.getComments(quote.id);
			expect(comments).toHaveLength(1);
		});

		it("draft → submit → counter → decline (customer rejects offer)", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@test.com",
				customerName: "Test Buyer",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 100,
				unitPrice: 20,
			});

			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			const declined = unwrap(
				await controller.declineQuote(quote.id, "Found a better deal"),
			);
			expect(declined.status).toBe("rejected");

			const history = await controller.getHistory(quote.id);
			const lastEntry = history[history.length - 1];
			expect(lastEntry.toStatus).toBe("rejected");
			expect(lastEntry.reason).toBe("Found a better deal");
		});

		it("draft → submit → counter → expire", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@test.com",
				customerName: "Test Buyer",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 10,
				unitPrice: 10,
			});

			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			const expired = unwrap(await controller.expireQuote(quote.id));
			expect(expired.status).toBe("expired");
		});

		it("cannot add items after submission", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@test.com",
				customerName: "Test Buyer",
			});

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			const result = await controller.addItem({
				quoteId: quote.id,
				productId: "prod-2",
				productName: "Another Widget",
				quantity: 1,
				unitPrice: 5,
			});
			expect(result).toBeNull();
		});

		it("cannot accept an expired quote", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@test.com",
				customerName: "Test Buyer",
			});
			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);
			await controller.expireQuote(quote.id);

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});
	});
});
