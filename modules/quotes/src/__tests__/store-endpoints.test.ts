import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQuoteController } from "../service-impl";

/**
 * Store endpoint integration tests for the quotes module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. create-quote: auth required, starts as draft
 * 2. add-item: adds a product line to a draft quote
 * 3. submit-quote: transitions draft → submitted
 * 4. get-my-quotes: auth required, lists customer's quotes
 * 5. accept-quote: customer accepts a countered quote
 * 6. decline-quote: customer declines a quote
 * 7. add-comment: customer adds a comment to their quote
 * 8. get-comments: returns comment thread
 */

type DataService = ReturnType<typeof createMockDataService>;

function createController(data: DataService) {
	return createQuoteController(data, { defaultExpirationDays: 30 });
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateCreateQuote(
	data: DataService,
	body: {
		customerEmail: string;
		customerName: string;
		companyName?: string;
		notes?: string;
	},
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.createQuote({
		customerId: opts.customerId,
		customerEmail: body.customerEmail,
		customerName: body.customerName,
		...(body.companyName != null && { companyName: body.companyName }),
		...(body.notes != null && { notes: body.notes }),
	});
	return { quote };
}

async function simulateAddItem(
	data: DataService,
	body: {
		quoteId: string;
		productId: string;
		productName: string;
		quantity: number;
		unitPrice: number;
	},
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(body.quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const item = await controller.addItem({
		quoteId: body.quoteId,
		productId: body.productId,
		productName: body.productName,
		quantity: body.quantity,
		unitPrice: body.unitPrice,
	});
	if (!item) {
		return { error: "Cannot add item", status: 400 };
	}
	return { item };
}

async function simulateSubmitQuote(
	data: DataService,
	quoteId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const submitted = await controller.submitQuote(quoteId);
	if (!submitted) {
		return { error: "Cannot submit quote", status: 400 };
	}
	return { quote: submitted };
}

async function simulateGetMyQuotes(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quotes = await controller.getMyQuotes({
		customerId: opts.customerId,
	});
	return { quotes };
}

async function simulateAcceptQuote(
	data: DataService,
	quoteId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const accepted = await controller.acceptQuote(quoteId);
	if (!accepted) {
		return { error: "Cannot accept quote", status: 400 };
	}
	return { quote: accepted };
}

async function simulateDeclineQuote(
	data: DataService,
	quoteId: string,
	reason: string | undefined,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const declined = await controller.declineQuote(quoteId, reason);
	if (!declined) {
		return { error: "Cannot decline quote", status: 400 };
	}
	return { quote: declined };
}

async function simulateAddComment(
	data: DataService,
	body: { quoteId: string; message: string; authorName: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(body.quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const comment = await controller.addComment({
		quoteId: body.quoteId,
		authorType: "customer",
		authorId: opts.customerId,
		authorName: body.authorName,
		message: body.message,
	});
	return { comment };
}

async function simulateGetComments(
	data: DataService,
	quoteId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const quote = await controller.getQuote(quoteId);
	if (!quote || quote.customerId !== opts.customerId) {
		return { error: "Quote not found", status: 404 };
	}
	const comments = await controller.getComments(quoteId);
	return { comments };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: create quote — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCreateQuote(data, {
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("creates a draft quote", async () => {
		const result = await simulateCreateQuote(
			data,
			{
				customerEmail: "jane@example.com",
				customerName: "Jane Doe",
				companyName: "Acme Corp",
			},
			{ customerId: "cust_1" },
		);

		expect("quote" in result).toBe(true);
		if ("quote" in result) {
			expect(result.quote.status).toBe("draft");
			expect(result.quote.customerName).toBe("Jane Doe");
			expect(result.quote.companyName).toBe("Acme Corp");
		}
	});
});

describe("store endpoint: add item — build quote", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("adds a product line to a draft quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});

		const result = await simulateAddItem(
			data,
			{
				quoteId: quote.id,
				productId: "prod_widget",
				productName: "Widget",
				quantity: 10,
				unitPrice: 500,
			},
			{ customerId: "cust_1" },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.productName).toBe("Widget");
			expect(result.item.quantity).toBe(10);
			expect(result.item.unitPrice).toBe(500);
		}
	});

	it("returns 404 when adding to another customer's quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_2",
			customerEmail: "bob@example.com",
			customerName: "Bob",
		});

		const result = await simulateAddItem(
			data,
			{
				quoteId: quote.id,
				productId: "prod_1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 100,
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({ error: "Quote not found", status: 404 });
	});
});

describe("store endpoint: submit quote — draft to submitted", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("submits a draft quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		await ctrl.addItem({
			quoteId: quote.id,
			productId: "prod_1",
			productName: "Widget",
			quantity: 5,
			unitPrice: 100,
		});

		const result = await simulateSubmitQuote(data, quote.id, {
			customerId: "cust_1",
		});

		expect("quote" in result).toBe(true);
		if ("quote" in result) {
			expect(result.quote.status).toBe("submitted");
		}
	});

	it("returns 404 when submitting another customer's quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_2",
			customerEmail: "bob@example.com",
			customerName: "Bob",
		});

		const result = await simulateSubmitQuote(data, quote.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Quote not found", status: 404 });
	});
});

describe("store endpoint: get my quotes — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetMyQuotes(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns only the customer's quotes", async () => {
		const ctrl = createController(data);
		await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		await ctrl.createQuote({
			customerId: "cust_2",
			customerEmail: "bob@example.com",
			customerName: "Bob",
		});

		const result = await simulateGetMyQuotes(data, {
			customerId: "cust_1",
		});

		expect("quotes" in result).toBe(true);
		if ("quotes" in result) {
			expect(result.quotes).toHaveLength(1);
			expect(result.quotes[0].customerName).toBe("Jane");
		}
	});

	it("returns empty for customer with no quotes", async () => {
		const result = await simulateGetMyQuotes(data, {
			customerId: "cust_new",
		});

		expect("quotes" in result).toBe(true);
		if ("quotes" in result) {
			expect(result.quotes).toHaveLength(0);
		}
	});
});

describe("store endpoint: accept/decline quote — customer response", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("accepts a countered quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		const item = await ctrl.addItem({
			quoteId: quote.id,
			productId: "prod_1",
			productName: "Widget",
			quantity: 10,
			unitPrice: 500,
		});
		if (!item) throw new Error("addItem returned null");
		await ctrl.submitQuote(quote.id);
		await ctrl.reviewQuote(quote.id);
		await ctrl.counterQuote(quote.id, {
			items: [{ itemId: item.id, offeredPrice: 450 }],
		});

		const result = await simulateAcceptQuote(data, quote.id, {
			customerId: "cust_1",
		});

		expect("quote" in result).toBe(true);
		if ("quote" in result) {
			expect(result.quote.status).toBe("accepted");
		}
	});

	it("declines a quote with reason", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		const item = await ctrl.addItem({
			quoteId: quote.id,
			productId: "prod_1",
			productName: "Widget",
			quantity: 10,
			unitPrice: 500,
		});
		if (!item) throw new Error("addItem returned null");
		await ctrl.submitQuote(quote.id);
		await ctrl.reviewQuote(quote.id);
		await ctrl.counterQuote(quote.id, {
			items: [{ itemId: item.id, offeredPrice: 400 }],
		});

		const result = await simulateDeclineQuote(
			data,
			quote.id,
			"Price too high",
			{ customerId: "cust_1" },
		);

		expect("quote" in result).toBe(true);
		if ("quote" in result) {
			expect(result.quote.status).toBe("rejected");
		}
	});

	it("returns 404 when accepting another customer's quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_2",
			customerEmail: "bob@example.com",
			customerName: "Bob",
		});

		const result = await simulateAcceptQuote(data, quote.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Quote not found", status: 404 });
	});
});

describe("store endpoint: comments — quote discussion", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("adds a customer comment to their quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});

		const result = await simulateAddComment(
			data,
			{
				quoteId: quote.id,
				message: "Can you offer a bulk discount?",
				authorName: "Jane",
			},
			{ customerId: "cust_1" },
		);

		expect("comment" in result).toBe(true);
		if ("comment" in result) {
			expect(result.comment.message).toBe("Can you offer a bulk discount?");
			expect(result.comment.authorType).toBe("customer");
		}
	});

	it("returns comment thread for a quote", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_1",
			customerEmail: "jane@example.com",
			customerName: "Jane",
		});
		await ctrl.addComment({
			quoteId: quote.id,
			authorType: "customer",
			authorId: "cust_1",
			authorName: "Jane",
			message: "Question about pricing",
		});
		await ctrl.addComment({
			quoteId: quote.id,
			authorType: "admin",
			authorId: "admin_1",
			authorName: "Support",
			message: "We can offer 10% off",
		});

		const result = await simulateGetComments(data, quote.id, {
			customerId: "cust_1",
		});

		expect("comments" in result).toBe(true);
		if ("comments" in result) {
			expect(result.comments).toHaveLength(2);
		}
	});

	it("returns 404 when viewing another customer's comments", async () => {
		const ctrl = createController(data);
		const quote = await ctrl.createQuote({
			customerId: "cust_2",
			customerEmail: "bob@example.com",
			customerName: "Bob",
		});

		const result = await simulateGetComments(data, quote.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Quote not found", status: 404 });
	});
});
