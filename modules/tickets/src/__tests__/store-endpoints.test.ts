import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTicketControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the tickets module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-categories: active categories for the ticket form dropdown
 * 2. submit-ticket: creates a new support ticket
 * 3. get-my-tickets: auth required, lists customer's tickets
 * 4. get-ticket: lookup by ticket number (customer must own it)
 * 5. add-message: customer adds a reply to their ticket
 * 6. list-messages: public messages only (no internal notes)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListCategories(data: DataService) {
	const controller = createTicketControllers(data);
	const categories = await controller.listCategories({ activeOnly: true });
	return { categories };
}

async function simulateSubmitTicket(
	data: DataService,
	body: {
		subject: string;
		description: string;
		categoryId?: string;
		priority?: "low" | "normal" | "high" | "urgent";
		customerEmail: string;
		customerName: string;
		customerId?: string;
		orderId?: string;
	},
) {
	const controller = createTicketControllers(data);
	const ticket = await controller.createTicket(body);
	return { ticket };
}

async function simulateGetMyTickets(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTicketControllers(data);
	const tickets = await controller.listTickets({
		customerId: opts.customerId,
	});
	return { tickets };
}

async function simulateGetTicket(
	data: DataService,
	ticketNumber: number,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTicketControllers(data);
	const ticket = await controller.getTicketByNumber(ticketNumber);
	if (!ticket || ticket.customerId !== opts.customerId) {
		return { error: "Ticket not found", status: 404 };
	}
	return { ticket };
}

async function simulateAddMessage(
	data: DataService,
	body: { ticketId: string; body: string; authorName: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTicketControllers(data);
	const ticket = await controller.getTicket(body.ticketId);
	if (!ticket || ticket.customerId !== opts.customerId) {
		return { error: "Ticket not found", status: 404 };
	}
	const message = await controller.addMessage({
		ticketId: body.ticketId,
		body: body.body,
		authorType: "customer",
		authorId: opts.customerId,
		authorName: body.authorName,
	});
	return { message };
}

async function simulateListMessages(
	data: DataService,
	ticketId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createTicketControllers(data);
	const ticket = await controller.getTicket(ticketId);
	if (!ticket || ticket.customerId !== opts.customerId) {
		return { error: "Ticket not found", status: 404 };
	}
	const messages = await controller.listMessages(ticketId, {
		includeInternal: false,
	});
	return { messages };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list categories — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active categories", async () => {
		const ctrl = createTicketControllers(data);
		await ctrl.createCategory({
			name: "Billing",
			slug: "billing",
		});
		const cat2 = await ctrl.createCategory({
			name: "Hidden",
			slug: "hidden",
		});
		await ctrl.updateCategory(cat2.id, { isActive: false });

		const result = await simulateListCategories(data);

		expect(result.categories).toHaveLength(1);
		expect(result.categories[0].name).toBe("Billing");
	});

	it("returns empty when no active categories exist", async () => {
		const result = await simulateListCategories(data);

		expect(result.categories).toHaveLength(0);
	});

	it("returns categories ordered by position", async () => {
		const ctrl = createTicketControllers(data);
		await ctrl.createCategory({
			name: "Shipping",
			slug: "shipping",
			position: 2,
		});
		await ctrl.createCategory({
			name: "Billing",
			slug: "billing",
			position: 1,
		});

		const result = await simulateListCategories(data);

		expect(result.categories).toHaveLength(2);
		expect(result.categories[0].name).toBe("Billing");
		expect(result.categories[1].name).toBe("Shipping");
	});
});

describe("store endpoint: submit ticket — create support ticket", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a ticket with required fields", async () => {
		const result = await simulateSubmitTicket(data, {
			subject: "Order not received",
			description: "My order has not arrived after 2 weeks.",
			customerEmail: "jane@example.com",
			customerName: "Jane Doe",
			customerId: "cust_1",
		});

		expect(result.ticket.subject).toBe("Order not received");
		expect(result.ticket.status).toBe("open");
		expect(result.ticket.customerEmail).toBe("jane@example.com");
		expect(result.ticket.number).toBeGreaterThan(0);
	});

	it("creates a ticket with category and priority", async () => {
		const ctrl = createTicketControllers(data);
		const category = await ctrl.createCategory({
			name: "Shipping",
			slug: "shipping",
		});

		const result = await simulateSubmitTicket(data, {
			subject: "Damaged package",
			description: "Package arrived damaged.",
			categoryId: category.id,
			priority: "high",
			customerEmail: "bob@example.com",
			customerName: "Bob",
			customerId: "cust_2",
		});

		expect(result.ticket.categoryId).toBe(category.id);
		expect(result.ticket.priority).toBe("high");
	});

	it("creates a ticket linked to an order", async () => {
		const result = await simulateSubmitTicket(data, {
			subject: "Wrong item",
			description: "Received wrong item in order.",
			customerEmail: "alice@example.com",
			customerName: "Alice",
			customerId: "cust_1",
			orderId: "order_123",
		});

		expect(result.ticket.orderId).toBe("order_123");
	});
});

describe("store endpoint: get my tickets — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetMyTickets(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns only the customer's tickets", async () => {
		const ctrl = createTicketControllers(data);
		await ctrl.createTicket({
			subject: "My ticket",
			description: "Help me",
			customerEmail: "jane@example.com",
			customerName: "Jane",
			customerId: "cust_1",
		});
		await ctrl.createTicket({
			subject: "Other ticket",
			description: "Help other",
			customerEmail: "bob@example.com",
			customerName: "Bob",
			customerId: "cust_2",
		});

		const result = await simulateGetMyTickets(data, {
			customerId: "cust_1",
		});

		expect("tickets" in result).toBe(true);
		if ("tickets" in result) {
			expect(result.tickets).toHaveLength(1);
			expect(result.tickets[0].subject).toBe("My ticket");
		}
	});

	it("returns empty for customer with no tickets", async () => {
		const result = await simulateGetMyTickets(data, {
			customerId: "cust_new",
		});

		expect("tickets" in result).toBe(true);
		if ("tickets" in result) {
			expect(result.tickets).toHaveLength(0);
		}
	});
});

describe("store endpoint: get ticket — by number, ownership check", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetTicket(data, 1);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns a ticket by number for the owner", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Help needed",
			description: "Details here",
			customerEmail: "jane@example.com",
			customerName: "Jane",
			customerId: "cust_1",
		});

		const result = await simulateGetTicket(data, ticket.number, {
			customerId: "cust_1",
		});

		expect("ticket" in result).toBe(true);
		if ("ticket" in result) {
			expect(result.ticket.subject).toBe("Help needed");
		}
	});

	it("returns 404 when ticket belongs to another customer", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Private ticket",
			description: "Not yours",
			customerEmail: "bob@example.com",
			customerName: "Bob",
			customerId: "cust_2",
		});

		const result = await simulateGetTicket(data, ticket.number, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Ticket not found", status: 404 });
	});

	it("returns 404 for nonexistent ticket number", async () => {
		const result = await simulateGetTicket(data, 99999, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Ticket not found", status: 404 });
	});
});

describe("store endpoint: add message — customer reply", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateAddMessage(data, {
			ticketId: "ticket_1",
			body: "Hello",
			authorName: "Jane",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("adds a customer reply to their ticket", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Help",
			description: "I need help",
			customerEmail: "jane@example.com",
			customerName: "Jane",
			customerId: "cust_1",
		});

		const result = await simulateAddMessage(
			data,
			{
				ticketId: ticket.id,
				body: "Any update on this?",
				authorName: "Jane",
			},
			{ customerId: "cust_1" },
		);

		expect("message" in result).toBe(true);
		if ("message" in result) {
			expect(result.message.body).toBe("Any update on this?");
			expect(result.message.authorType).toBe("customer");
		}
	});

	it("returns 404 when adding message to another customer's ticket", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Not yours",
			description: "Private",
			customerEmail: "bob@example.com",
			customerName: "Bob",
			customerId: "cust_2",
		});

		const result = await simulateAddMessage(
			data,
			{
				ticketId: ticket.id,
				body: "Snooping",
				authorName: "Eve",
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({ error: "Ticket not found", status: 404 });
	});
});

describe("store endpoint: list messages — public only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListMessages(data, "ticket_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("excludes internal notes from customer view", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Help",
			description: "Help me",
			customerEmail: "jane@example.com",
			customerName: "Jane",
			customerId: "cust_1",
		});
		await ctrl.addMessage({
			ticketId: ticket.id,
			body: "We are looking into this.",
			authorType: "admin",
			authorName: "Support Agent",
		});
		await ctrl.addMessage({
			ticketId: ticket.id,
			body: "Internal: escalate to tier 2",
			authorType: "admin",
			authorName: "Support Agent",
			isInternal: true,
		});

		const result = await simulateListMessages(data, ticket.id, {
			customerId: "cust_1",
		});

		expect("messages" in result).toBe(true);
		if ("messages" in result) {
			const bodies = result.messages.map((m) => m.body);
			expect(bodies).toContain("We are looking into this.");
			expect(bodies).not.toContain("Internal: escalate to tier 2");
		}
	});

	it("returns 404 when listing messages of another customer's ticket", async () => {
		const ctrl = createTicketControllers(data);
		const ticket = await ctrl.createTicket({
			subject: "Private",
			description: "Private ticket",
			customerEmail: "bob@example.com",
			customerName: "Bob",
			customerId: "cust_2",
		});

		const result = await simulateListMessages(data, ticket.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Ticket not found", status: 404 });
	});
});
