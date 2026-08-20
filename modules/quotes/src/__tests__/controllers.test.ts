import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQuoteController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("quote controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createQuoteController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createQuoteController(mockData, {
			defaultExpirationDays: 30,
		});
	});

	// ── Full lifecycle ──────────────────────────────────────────────

	describe("full lifecycle: draft -> items -> submit -> review -> counter -> accept -> convert", () => {
		it("completes the full happy-path lifecycle with multiple items", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "buyer@acme.com",
				customerName: "Jane Buyer",
				companyName: "Acme Corp",
				notes: "Q2 bulk order",
			});
			expect(quote.status).toBe("draft");
			expect(quote.subtotal).toBe(0);
			expect(quote.total).toBe(0);

			const itemA = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-a",
					productName: "Widget A",
					sku: "WA-100",
					quantity: 200,
					unitPrice: 15,
				}),
			);
			const itemB = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-b",
					productName: "Widget B",
					quantity: 100,
					unitPrice: 8,
				}),
			);

			let q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(200 * 15 + 100 * 8); // 3800

			q = unwrap(await controller.submitQuote(quote.id));
			expect(q.status).toBe("submitted");

			q = unwrap(await controller.reviewQuote(quote.id));
			expect(q.status).toBe("under_review");

			q = unwrap(
				await controller.counterQuote(quote.id, {
					items: [
						{ itemId: itemA.id, offeredPrice: 12 },
						{ itemId: itemB.id, offeredPrice: 6 },
					],
					adminNotes: "Volume discount applied",
				}),
			);
			expect(q.status).toBe("countered");
			expect(q.total).toBe(200 * 12 + 100 * 6); // 3000
			expect(q.adminNotes).toBe("Volume discount applied");
			expect(q.expiresAt).toBeDefined();

			q = unwrap(await controller.acceptQuote(quote.id));
			expect(q.status).toBe("accepted");

			q = unwrap(await controller.convertToOrder(quote.id, "order-2026-001"));
			expect(q.status).toBe("converted");
			expect(q.convertedOrderId).toBe("order-2026-001");

			const history = await controller.getHistory(quote.id);
			expect(history).toHaveLength(5);
			expect(history[0]?.fromStatus).toBe("draft");
			expect(history[0]?.toStatus).toBe("submitted");
			expect(history[1]?.toStatus).toBe("under_review");
			expect(history[2]?.toStatus).toBe("countered");
			expect(history[3]?.toStatus).toBe("accepted");
			expect(history[4]?.toStatus).toBe("converted");
		});

		it("completes lifecycle without review step (submit -> counter directly)", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "Bob",
			});
			const item = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-1",
					productName: "Gadget",
					quantity: 50,
					unitPrice: 20,
				}),
			);
			await controller.submitQuote(quote.id);

			// Counter directly from submitted (skip review)
			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [{ itemId: item.id, offeredPrice: 18 }],
				}),
			);
			expect(countered.status).toBe("countered");
			expect(countered.total).toBe(50 * 18); // 900

			const accepted = unwrap(await controller.acceptQuote(quote.id));
			expect(accepted.status).toBe("accepted");

			const converted = unwrap(
				await controller.convertToOrder(quote.id, "order-fast"),
			);
			expect(converted.status).toBe("converted");
		});
	});

	// ── Cannot submit empty quote ───────────────────────────────────

	describe("cannot submit empty quote", () => {
		it("returns null when submitting a quote with zero items", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const result = await controller.submitQuote(quote.id);
			expect(result).toBeNull();

			// Quote remains in draft
			const q = unwrap(await controller.getQuote(quote.id));
			expect(q.status).toBe("draft");
		});

		it("returns null when all items were removed before submitting", async () => {
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
					unitPrice: 10,
				}),
			);
			await controller.removeItem(quote.id, item.id);

			const result = await controller.submitQuote(quote.id);
			expect(result).toBeNull();
		});
	});

	// ── Cannot add items to non-draft quote ─────────────────────────

	describe("cannot add items to non-draft quote", () => {
		it("returns null when adding item to submitted quote", async () => {
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
				productName: "New Item",
				quantity: 5,
				unitPrice: 25,
			});
			expect(result).toBeNull();
		});

		it("returns null when adding item to countered quote", async () => {
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

			const result = await controller.addItem({
				quoteId: quote.id,
				productId: "prod-2",
				productName: "Another",
				quantity: 1,
				unitPrice: 5,
			});
			expect(result).toBeNull();
		});

		it("returns null when updating item on submitted quote", async () => {
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
					unitPrice: 10,
				}),
			);
			await controller.submitQuote(quote.id);

			const result = await controller.updateItem(quote.id, item.id, {
				quantity: 99,
			});
			expect(result).toBeNull();
		});

		it("returns false when removing item from submitted quote", async () => {
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
					unitPrice: 10,
				}),
			);
			await controller.submitQuote(quote.id);

			const result = await controller.removeItem(quote.id, item.id);
			expect(result).toBe(false);
		});
	});

	// ── Total recalculation with offeredPrice ───────────────────────

	describe("total recalculation with offeredPrice", () => {
		it("uses offeredPrice when set, otherwise unitPrice", async () => {
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
					unitPrice: 100,
				}),
			);
			unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-2",
					productName: "Gadget",
					quantity: 5,
					unitPrice: 50,
				}),
			);

			// Before counter: 10*100 + 5*50 = 1250
			const q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(1250);

			await controller.submitQuote(quote.id);

			// Counter only item1, leave item2 at unitPrice
			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [{ itemId: item1.id, offeredPrice: 80 }],
				}),
			);
			// item1: 10*80 = 800, item2: 5*50 = 250 => 1050
			expect(countered.total).toBe(1050);
			expect(countered.subtotal).toBe(1050);
		});

		it("recalculates correctly when all items get offered prices", async () => {
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
					quantity: 20,
					unitPrice: 50,
				}),
			);
			const item2 = unwrap(
				await controller.addItem({
					quoteId: quote.id,
					productId: "prod-2",
					productName: "Gadget",
					quantity: 10,
					unitPrice: 30,
				}),
			);

			await controller.submitQuote(quote.id);

			const countered = unwrap(
				await controller.counterQuote(quote.id, {
					items: [
						{ itemId: item1.id, offeredPrice: 40 },
						{ itemId: item2.id, offeredPrice: 25 },
					],
				}),
			);
			// 20*40 + 10*25 = 1050
			expect(countered.total).toBe(1050);
		});

		it("approveAsIs preserves original unitPrice-based totals", async () => {
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
				unitPrice: 25,
			});

			await controller.submitQuote(quote.id);
			const approved = unwrap(await controller.approveAsIs(quote.id));

			// Total stays at unitPrice since no offeredPrice was set
			expect(approved.status).toBe("countered");

			const q = unwrap(await controller.getQuote(quote.id));
			expect(q.total).toBe(250);
		});
	});

	// ── Expired quotes cannot be accepted ───────────────────────────

	describe("expired quotes cannot be accepted", () => {
		it("returns null when accepting after expireQuote was called", async () => {
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
			await controller.expireQuote(quote.id);

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});

		it("returns null when accepting with a past expiresAt date", async () => {
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
					unitPrice: 10,
				}),
			);
			await controller.submitQuote(quote.id);

			// Set expiration in the past
			const pastDate = new Date("2020-01-01");
			await controller.counterQuote(quote.id, {
				items: [{ itemId: item.id, offeredPrice: 8 }],
				expiresAt: pastDate,
			});

			const result = await controller.acceptQuote(quote.id);
			expect(result).toBeNull();
		});

		it("cannot decline an expired quote", async () => {
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
			await controller.expireQuote(quote.id);

			const result = await controller.declineQuote(quote.id, "Too late");
			expect(result).toBeNull();
		});
	});

	// ── Status transition guards ────────────────────────────────────

	describe("status transition guards", () => {
		it("reviewQuote only works from submitted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot review
			expect(await controller.reviewQuote(quote.id)).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.reviewQuote(quote.id);

			// under_review -> cannot review again
			expect(await controller.reviewQuote(quote.id)).toBeNull();
		});

		it("counterQuote only works from submitted or under_review", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot counter
			expect(await controller.counterQuote(quote.id, { items: [] })).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);
			await controller.approveAsIs(quote.id);

			// countered -> cannot counter again
			expect(await controller.counterQuote(quote.id, { items: [] })).toBeNull();
		});

		it("acceptQuote only works from countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot accept
			expect(await controller.acceptQuote(quote.id)).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			// submitted -> cannot accept
			expect(await controller.acceptQuote(quote.id)).toBeNull();
		});

		it("convertToOrder only works from accepted", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot convert
			expect(await controller.convertToOrder(quote.id, "order-1")).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			// submitted -> cannot convert
			expect(await controller.convertToOrder(quote.id, "order-1")).toBeNull();

			await controller.approveAsIs(quote.id);
			// countered -> cannot convert
			expect(await controller.convertToOrder(quote.id, "order-1")).toBeNull();
		});

		it("expireQuote only works from countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot expire
			expect(await controller.expireQuote(quote.id)).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			// submitted -> cannot expire
			expect(await controller.expireQuote(quote.id)).toBeNull();
		});

		it("declineQuote only works from countered", async () => {
			const quote = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			// draft -> cannot decline
			expect(await controller.declineQuote(quote.id)).toBeNull();

			await controller.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(quote.id);

			// submitted -> cannot decline
			expect(await controller.declineQuote(quote.id)).toBeNull();
		});

		it("rejectQuote cannot reject already rejected, expired, or converted quotes", async () => {
			// Already rejected
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.rejectQuote(q1.id);
			expect(await controller.rejectQuote(q1.id)).toBeNull();

			// Expired
			const q2 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q2.id,
				productId: "prod-1",
				productName: "W",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(q2.id);
			await controller.approveAsIs(q2.id);
			await controller.expireQuote(q2.id);
			expect(await controller.rejectQuote(q2.id)).toBeNull();

			// Converted
			const q3 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q3.id,
				productId: "prod-1",
				productName: "W",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(q3.id);
			await controller.approveAsIs(q3.id);
			await controller.acceptQuote(q3.id);
			await controller.convertToOrder(q3.id, "order-x");
			expect(await controller.rejectQuote(q3.id)).toBeNull();
		});

		it("rejectQuote can reject from draft, submitted, under_review, countered, and accepted", async () => {
			const statuses = [
				"draft",
				"submitted",
				"under_review",
				"countered",
				"accepted",
			];
			for (const targetStatus of statuses) {
				const q = await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});

				if (targetStatus !== "draft") {
					await controller.addItem({
						quoteId: q.id,
						productId: "prod-1",
						productName: "W",
						quantity: 1,
						unitPrice: 10,
					});
					await controller.submitQuote(q.id);
				}
				if (targetStatus === "under_review") {
					await controller.reviewQuote(q.id);
				}
				if (targetStatus === "countered" || targetStatus === "accepted") {
					await controller.approveAsIs(q.id);
				}
				if (targetStatus === "accepted") {
					await controller.acceptQuote(q.id);
				}

				const rejected = await controller.rejectQuote(
					q.id,
					`reject from ${targetStatus}`,
				);
				expect(rejected).not.toBeNull();
				expect(rejected?.status).toBe("rejected");
			}
		});
	});

	// ── History tracking ────────────────────────────────────────────

	describe("history tracking", () => {
		it("records changedBy for different actors", async () => {
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

			// Customer submits -> changedBy = customerId
			await controller.submitQuote(quote.id);

			// Admin reviews -> changedBy = "admin"
			await controller.reviewQuote(quote.id);

			// Admin counters -> changedBy = "admin"
			await controller.approveAsIs(quote.id);

			// Customer accepts -> changedBy = customerId
			await controller.acceptQuote(quote.id);

			const history = await controller.getHistory(quote.id);
			expect(history).toHaveLength(4);
			expect(history[0]?.changedBy).toBe("cust-1"); // submit
			expect(history[1]?.changedBy).toBe("admin"); // review
			expect(history[2]?.changedBy).toBe("admin"); // counter/approve
			expect(history[3]?.changedBy).toBe("cust-1"); // accept
		});

		it("records reason in history when declining", async () => {
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
			await controller.declineQuote(quote.id, "Budget constraints");

			const history = await controller.getHistory(quote.id);
			const declineEntry = history.find((h) => h.toStatus === "rejected");
			expect(declineEntry?.reason).toBe("Budget constraints");
		});

		it("records reason in history when admin rejects", async () => {
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
			await controller.rejectQuote(quote.id, "Out of stock");

			const history = await controller.getHistory(quote.id);
			const rejectEntry = history.find((h) => h.toStatus === "rejected");
			expect(rejectEntry?.reason).toBe("Out of stock");
			expect(rejectEntry?.changedBy).toBe("admin");
		});

		it("expireQuote records changedBy as system", async () => {
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
			await controller.expireQuote(quote.id);

			const history = await controller.getHistory(quote.id);
			const expireEntry = history.find((h) => h.toStatus === "expired");
			expect(expireEntry?.changedBy).toBe("system");
		});
	});

	// ── Stats with conversionRate calculation ───────────────────────

	describe("stats with conversionRate calculation", () => {
		it("conversionRate = (accepted + converted) / (accepted + converted + rejected + expired)", async () => {
			// 1 accepted, 1 converted, 1 rejected, 1 expired = rate = 2/4 = 0.5
			const makeAndSubmit = async () => {
				const q = await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});
				await controller.addItem({
					quoteId: q.id,
					productId: "prod-1",
					productName: "W",
					quantity: 1,
					unitPrice: 100,
				});
				await controller.submitQuote(q.id);
				return q;
			};

			// Accepted quote
			const q1 = await makeAndSubmit();
			await controller.approveAsIs(q1.id);
			await controller.acceptQuote(q1.id);

			// Converted quote
			const q2 = await makeAndSubmit();
			await controller.approveAsIs(q2.id);
			await controller.acceptQuote(q2.id);
			await controller.convertToOrder(q2.id, "order-1");

			// Rejected quote
			const q3 = await makeAndSubmit();
			await controller.rejectQuote(q3.id);

			// Expired quote
			const q4 = await makeAndSubmit();
			await controller.approveAsIs(q4.id);
			await controller.expireQuote(q4.id);

			const stats = await controller.getStats();
			expect(stats.totalQuotes).toBe(4);
			expect(stats.acceptedQuotes).toBe(1);
			expect(stats.convertedQuotes).toBe(1);
			expect(stats.rejectedQuotes).toBe(1);
			expect(stats.expiredQuotes).toBe(1);
			// (1 + 1) / (1 + 1 + 1 + 1) = 0.5
			expect(stats.conversionRate).toBe(0.5);
		});

		it("conversionRate is 0 when no quotes have reached a terminal state", async () => {
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});
			await controller.addItem({
				quoteId: q2.id,
				productId: "prod-1",
				productName: "W",
				quantity: 1,
				unitPrice: 10,
			});
			await controller.submitQuote(q2.id);

			const stats = await controller.getStats();
			expect(stats.totalQuotes).toBe(2);
			expect(stats.draftQuotes).toBe(1);
			expect(stats.submittedQuotes).toBe(1);
			expect(stats.conversionRate).toBe(0);
		});

		it("conversionRate is 1.0 when all decided quotes are accepted or converted", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q1.id,
				productId: "prod-1",
				productName: "W",
				quantity: 10,
				unitPrice: 50,
			});
			await controller.submitQuote(q1.id);
			await controller.approveAsIs(q1.id);
			await controller.acceptQuote(q1.id);
			await controller.convertToOrder(q1.id, "order-1");

			const stats = await controller.getStats();
			expect(stats.conversionRate).toBe(1);
			expect(stats.totalValue).toBe(500);
			expect(stats.averageValue).toBe(500);
		});

		it("averageValue divides totalValue by totalQuotes", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await controller.addItem({
				quoteId: q1.id,
				productId: "prod-1",
				productName: "W",
				quantity: 10,
				unitPrice: 10,
			});
			await controller.submitQuote(q1.id);

			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});
			await controller.addItem({
				quoteId: q2.id,
				productId: "prod-2",
				productName: "G",
				quantity: 5,
				unitPrice: 20,
			});
			await controller.submitQuote(q2.id);

			// q1 total = 100, q2 total = 100 => average = 100
			const stats = await controller.getStats();
			expect(stats.totalQuotes).toBe(2);
			expect(stats.totalValue).toBe(200);
			expect(stats.averageValue).toBe(100);
		});

		it("tracks all status counts correctly", async () => {
			const makeQuote = async () => {
				const q = await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});
				await controller.addItem({
					quoteId: q.id,
					productId: "prod-1",
					productName: "W",
					quantity: 1,
					unitPrice: 10,
				});
				return q;
			};

			// 1 draft (no items added through makeQuote, so use createQuote directly)
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			// 1 submitted
			const qSub = await makeQuote();
			await controller.submitQuote(qSub.id);

			// 1 under_review
			const qRev = await makeQuote();
			await controller.submitQuote(qRev.id);
			await controller.reviewQuote(qRev.id);

			// 1 countered
			const qCtr = await makeQuote();
			await controller.submitQuote(qCtr.id);
			await controller.approveAsIs(qCtr.id);

			const stats = await controller.getStats();
			expect(stats.draftQuotes).toBe(1);
			expect(stats.submittedQuotes).toBe(1);
			expect(stats.underReviewQuotes).toBe(1);
			expect(stats.counteredQuotes).toBe(1);
		});
	});

	// ── Comment system ──────────────────────────────────────────────

	describe("comment system", () => {
		it("supports both customer and admin comments on the same quote", async () => {
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
				message: "Can we get 10% off?",
			});
			await controller.addComment({
				quoteId: quote.id,
				authorType: "admin",
				authorId: "admin-1",
				authorName: "Sales Rep",
				message: "We can do 5% for orders over 100 units.",
			});
			await controller.addComment({
				quoteId: quote.id,
				authorType: "customer",
				authorId: "cust-1",
				authorName: "Jane",
				message: "Deal!",
			});

			const comments = await controller.getComments(quote.id);
			expect(comments).toHaveLength(3);
			expect(comments[0]?.authorType).toBe("customer");
			expect(comments[1]?.authorType).toBe("admin");
			expect(comments[2]?.authorType).toBe("customer");
		});

		it("comments on different quotes are isolated", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			await controller.addComment({
				quoteId: q1.id,
				authorType: "customer",
				authorId: "cust-1",
				authorName: "Jane",
				message: "Hello from q1",
			});
			await controller.addComment({
				quoteId: q2.id,
				authorType: "customer",
				authorId: "cust-2",
				authorName: "Bob",
				message: "Hello from q2",
			});
			await controller.addComment({
				quoteId: q2.id,
				authorType: "admin",
				authorId: "admin-1",
				authorName: "Rep",
				message: "Reply on q2",
			});

			const c1 = await controller.getComments(q1.id);
			expect(c1).toHaveLength(1);
			expect(c1[0]?.message).toBe("Hello from q1");

			const c2 = await controller.getComments(q2.id);
			expect(c2).toHaveLength(2);
		});

		it("comment has a createdAt timestamp", async () => {
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
				message: "Test",
			});

			expect(comment.createdAt).toBeInstanceOf(Date);
			expect(comment.id).toBeDefined();
		});
	});

	// ── Pagination on listQuotes/getMyQuotes ────────────────────────

	describe("pagination on listQuotes and getMyQuotes", () => {
		it("listQuotes supports skip and take", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createQuote({
					customerId: `cust-${i}`,
					customerEmail: `${i}@test.com`,
					customerName: `User ${i}`,
				});
			}

			const page1 = await controller.listQuotes({ skip: 0, take: 3 });
			expect(page1).toHaveLength(3);

			const page2 = await controller.listQuotes({ skip: 3, take: 3 });
			expect(page2).toHaveLength(3);

			const page4 = await controller.listQuotes({ skip: 9, take: 3 });
			expect(page4).toHaveLength(1);
		});

		it("getMyQuotes supports skip and take for a specific customer", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});
			}
			// Another customer's quotes should not appear
			await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const all = await controller.getMyQuotes({ customerId: "cust-1" });
			expect(all).toHaveLength(7);

			const page = await controller.getMyQuotes({
				customerId: "cust-1",
				skip: 2,
				take: 3,
			});
			expect(page).toHaveLength(3);
		});

		it("listQuotes with status filter and pagination", async () => {
			for (let i = 0; i < 5; i++) {
				const q = await controller.createQuote({
					customerId: "cust-1",
					customerEmail: "a@test.com",
					customerName: "A",
				});
				await controller.addItem({
					quoteId: q.id,
					productId: "prod-1",
					productName: "W",
					quantity: 1,
					unitPrice: 10,
				});
				await controller.submitQuote(q.id);
			}
			// Also create a draft that should not appear
			await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});

			const submitted = await controller.listQuotes({
				status: "submitted",
				skip: 1,
				take: 2,
			});
			expect(submitted).toHaveLength(2);

			const allSubmitted = await controller.listQuotes({
				status: "submitted",
			});
			expect(allSubmitted).toHaveLength(5);
		});
	});

	// ── Item ownership verification ─────────────────────────────────

	describe("item ownership verification", () => {
		it("updateItem returns null when item belongs to a different quote", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const item = unwrap(
				await controller.addItem({
					quoteId: q1.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 1,
					unitPrice: 10,
				}),
			);

			// Try to update item using q2's id
			const result = await controller.updateItem(q2.id, item.id, {
				quantity: 99,
			});
			expect(result).toBeNull();
		});

		it("removeItem returns false when item belongs to a different quote", async () => {
			const q1 = await controller.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			const q2 = await controller.createQuote({
				customerId: "cust-2",
				customerEmail: "b@test.com",
				customerName: "B",
			});

			const item = unwrap(
				await controller.addItem({
					quoteId: q1.id,
					productId: "prod-1",
					productName: "Widget",
					quantity: 1,
					unitPrice: 10,
				}),
			);

			const result = await controller.removeItem(q2.id, item.id);
			expect(result).toBe(false);
		});
	});

	// ── Default expiration ──────────────────────────────────────────

	describe("default expiration days", () => {
		it("counterQuote uses defaultExpirationDays when no expiresAt provided", async () => {
			const shortController = createQuoteController(mockData, {
				defaultExpirationDays: 7,
			});

			const quote = await shortController.createQuote({
				customerId: "cust-1",
				customerEmail: "a@test.com",
				customerName: "A",
			});
			await shortController.addItem({
				quoteId: quote.id,
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			await shortController.submitQuote(quote.id);

			const before = Date.now();
			const countered = unwrap(
				await shortController.counterQuote(quote.id, { items: [] }),
			);
			const after = Date.now();

			expect(countered.expiresAt).toBeDefined();
			const expiresMs = new Date(countered.expiresAt as Date).getTime();
			// Should be roughly 7 days from now
			const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
			expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
			expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
		});

		it("approveAsIs uses defaultExpirationDays when no expiresAt provided", async () => {
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

			const approved = unwrap(await controller.approveAsIs(quote.id));
			expect(approved.expiresAt).toBeDefined();
		});
	});

	// ── Non-existent entities ───────────────────────────────────────

	describe("non-existent entities", () => {
		it("returns null for operations on non-existent quote ids", async () => {
			expect(await controller.getQuote("non-existent")).toBeNull();
			expect(await controller.submitQuote("non-existent")).toBeNull();
			expect(await controller.acceptQuote("non-existent")).toBeNull();
			expect(await controller.declineQuote("non-existent")).toBeNull();
			expect(await controller.reviewQuote("non-existent")).toBeNull();
			expect(await controller.rejectQuote("non-existent")).toBeNull();
			expect(await controller.expireQuote("non-existent")).toBeNull();
			expect(
				await controller.convertToOrder("non-existent", "order-1"),
			).toBeNull();
			expect(
				await controller.counterQuote("non-existent", { items: [] }),
			).toBeNull();
			expect(await controller.approveAsIs("non-existent")).toBeNull();
		});

		it("addItem returns null for non-existent quote", async () => {
			const result = await controller.addItem({
				quoteId: "non-existent",
				productId: "prod-1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 10,
			});
			expect(result).toBeNull();
		});
	});
});
