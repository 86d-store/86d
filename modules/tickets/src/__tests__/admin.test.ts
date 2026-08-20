import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTicketControllers } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the tickets module.
 *
 * Covers: category CRUD, ticket lifecycle (create, assign, close, reopen),
 * messages (customer, admin, internal), listing/filtering, statistics,
 * and multi-category isolation.
 */

describe("tickets — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTicketControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTicketControllers(mockData);
	});

	// ── Category CRUD ─────────────────────────────────────────────

	describe("category creation", () => {
		it("creates a category", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			expect(cat.id).toBeDefined();
			expect(cat.name).toBe("Billing");
			expect(cat.slug).toBe("billing");
		});

		it("creates a category with description", async () => {
			const cat = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
				description: "Shipping and delivery issues",
			});
			expect(cat.description).toBe("Shipping and delivery issues");
		});

		it("creates a category with position", async () => {
			const cat = await controller.createCategory({
				name: "Returns",
				slug: "returns",
				position: 3,
			});
			expect(cat.position).toBe(3);
		});
	});

	describe("category retrieval and listing", () => {
		it("gets category by id", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			const found = await controller.getCategory(cat.id);
			expect(found?.name).toBe("Billing");
		});

		it("getCategory returns null for unknown id", async () => {
			const result = await controller.getCategory("fake-id");
			expect(result).toBeNull();
		});

		it("lists all categories", async () => {
			await controller.createCategory({ name: "Billing", slug: "billing" });
			await controller.createCategory({ name: "Shipping", slug: "shipping" });
			await controller.createCategory({ name: "Returns", slug: "returns" });
			const cats = await controller.listCategories({});
			expect(cats).toHaveLength(3);
		});
	});

	describe("category update", () => {
		it("updates category name", async () => {
			const cat = await controller.createCategory({
				name: "Old Name",
				slug: "old",
			});
			const updated = await controller.updateCategory(cat.id, {
				name: "New Name",
			});
			expect(updated.name).toBe("New Name");
		});

		it("deactivates a category", async () => {
			const cat = await controller.createCategory({
				name: "To Disable",
				slug: "disable",
			});
			const updated = await controller.updateCategory(cat.id, {
				isActive: false,
			});
			expect(updated.isActive).toBe(false);
		});

		it("updates category position", async () => {
			const cat = await controller.createCategory({
				name: "Category",
				slug: "cat",
			});
			const updated = await controller.updateCategory(cat.id, { position: 5 });
			expect(updated.position).toBe(5);
		});
	});

	describe("category deletion", () => {
		it("deletes a category", async () => {
			const cat = await controller.createCategory({
				name: "To Delete",
				slug: "del",
			});
			await controller.deleteCategory(cat.id);
			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});
	});

	// ── Ticket creation ───────────────────────────────────────────

	describe("ticket creation", () => {
		it("creates a ticket with defaults", async () => {
			const ticket = await controller.createTicket({
				subject: "Order not received",
				description:
					"I placed an order 2 weeks ago and still haven't received it.",
				customerEmail: "alice@example.com",
				customerName: "Alice Johnson",
			});
			expect(ticket.id).toBeDefined();
			expect(ticket.number).toBeDefined();
			expect(ticket.subject).toBe("Order not received");
			expect(ticket.status).toBe("open");
			expect(ticket.priority).toBe("normal");
		});

		it("creates a ticket with high priority", async () => {
			const ticket = await controller.createTicket({
				subject: "Urgent issue",
				description: "System down",
				customerEmail: "user@example.com",
				customerName: "User",
				priority: "urgent",
			});
			expect(ticket.priority).toBe("urgent");
		});

		it("creates a ticket with category", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			const ticket = await controller.createTicket({
				subject: "Billing question",
				description: "Wrong charge",
				customerEmail: "user@example.com",
				customerName: "User",
				categoryId: cat.id,
			});
			expect(ticket.categoryId).toBe(cat.id);
		});

		it("creates a ticket with customerId and orderId", async () => {
			const ticket = await controller.createTicket({
				subject: "Order issue",
				description: "Problem with order",
				customerEmail: "user@example.com",
				customerName: "User",
				customerId: "cust_1",
				orderId: "order_42",
			});
			expect(ticket.customerId).toBe("cust_1");
			expect(ticket.orderId).toBe("order_42");
		});

		it("creates a ticket with tags", async () => {
			const ticket = await controller.createTicket({
				subject: "Tag test",
				description: "Testing tags",
				customerEmail: "user@example.com",
				customerName: "User",
				tags: ["urgent", "shipping"],
			});
			expect(ticket.tags).toEqual(["urgent", "shipping"]);
		});

		it("each ticket gets a unique number", async () => {
			const numbers = new Set<number>();
			for (let i = 0; i < 10; i++) {
				const ticket = await controller.createTicket({
					subject: `Ticket ${i}`,
					description: "Test",
					customerEmail: `user${i}@example.com`,
					customerName: `User ${i}`,
				});
				numbers.add(ticket.number);
			}
			expect(numbers.size).toBe(10);
		});
	});

	// ── Ticket retrieval ──────────────────────────────────────────

	describe("ticket retrieval", () => {
		it("gets ticket by id", async () => {
			const ticket = await controller.createTicket({
				subject: "Test",
				description: "Testing",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const found = await controller.getTicket(ticket.id);
			expect(found?.subject).toBe("Test");
		});

		it("getTicket returns null for unknown id", async () => {
			const result = await controller.getTicket("fake-id");
			expect(result).toBeNull();
		});

		it("gets ticket by number", async () => {
			const ticket = await controller.createTicket({
				subject: "By Number",
				description: "Testing",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const found = await controller.getTicketByNumber(ticket.number);
			expect(found?.id).toBe(ticket.id);
		});

		it("getTicketByNumber returns null for unknown number", async () => {
			const result = await controller.getTicketByNumber(99999);
			expect(result).toBeNull();
		});
	});

	// ── Ticket update and lifecycle ───────────────────────────────

	describe("ticket update", () => {
		it("updates ticket subject", async () => {
			const ticket = await controller.createTicket({
				subject: "Old Subject",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const updated = await controller.updateTicket(ticket.id, {
				subject: "New Subject",
			});
			expect(updated.subject).toBe("New Subject");
		});

		it("assigns ticket to agent", async () => {
			const ticket = await controller.createTicket({
				subject: "Assign Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const updated = await controller.updateTicket(ticket.id, {
				assigneeId: "agent_1",
				assigneeName: "Agent Smith",
			});
			expect(updated.assigneeId).toBe("agent_1");
			expect(updated.assigneeName).toBe("Agent Smith");
		});

		it("changes ticket priority", async () => {
			const ticket = await controller.createTicket({
				subject: "Priority Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const updated = await controller.updateTicket(ticket.id, {
				priority: "high",
			});
			expect(updated.priority).toBe("high");
		});

		it("updates ticket status", async () => {
			const ticket = await controller.createTicket({
				subject: "Status Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const updated = await controller.updateTicket(ticket.id, {
				status: "in-progress",
			});
			expect(updated.status).toBe("in-progress");
		});

		it("updates ticket tags", async () => {
			const ticket = await controller.createTicket({
				subject: "Tag Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const updated = await controller.updateTicket(ticket.id, {
				tags: ["vip", "escalated"],
			});
			expect(updated.tags).toEqual(["vip", "escalated"]);
		});
	});

	describe("close and reopen", () => {
		it("closes an open ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Close Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const closed = await controller.closeTicket(ticket.id);
			expect(closed.status).toBe("closed");
		});

		it("reopens a closed ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Reopen Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			await controller.closeTicket(ticket.id);
			const reopened = await controller.reopenTicket(ticket.id);
			expect(reopened.status).toBe("open");
		});
	});

	// ── Messages ──────────────────────────────────────────────────

	describe("messages", () => {
		it("adds a customer message", async () => {
			const ticket = await controller.createTicket({
				subject: "Message Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const msg = await controller.addMessage({
				ticketId: ticket.id,
				body: "I need help with my order.",
				authorType: "customer",
				authorName: "User",
				authorEmail: "user@example.com",
			});
			expect(msg.id).toBeDefined();
			expect(msg.body).toBe("I need help with my order.");
			expect(msg.authorType).toBe("customer");
		});

		it("adds an admin reply", async () => {
			const ticket = await controller.createTicket({
				subject: "Message Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const msg = await controller.addMessage({
				ticketId: ticket.id,
				body: "We're looking into this.",
				authorType: "admin",
				authorId: "agent_1",
				authorName: "Agent Smith",
			});
			expect(msg.authorType).toBe("admin");
			expect(msg.authorId).toBe("agent_1");
		});

		it("adds an internal note", async () => {
			const ticket = await controller.createTicket({
				subject: "Internal Note Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const msg = await controller.addMessage({
				ticketId: ticket.id,
				body: "Check with shipping team",
				authorType: "admin",
				authorName: "Agent Smith",
				isInternal: true,
			});
			expect(msg.isInternal).toBe(true);
		});

		it("lists all messages for a ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Thread Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Customer message",
				authorType: "customer",
				authorName: "User",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Admin reply",
				authorType: "admin",
				authorName: "Agent",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Internal note",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			const all = await controller.listMessages(ticket.id, {
				includeInternal: true,
			});
			expect(all).toHaveLength(3);
		});

		it("excludes internal notes by default", async () => {
			const ticket = await controller.createTicket({
				subject: "Filter Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public message",
				authorType: "customer",
				authorName: "User",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Internal note",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			const publicOnly = await controller.listMessages(ticket.id, {});
			expect(publicOnly).toHaveLength(1);
			expect(publicOnly[0].body).toBe("Public message");
		});

		it("adds a system message", async () => {
			const ticket = await controller.createTicket({
				subject: "System Msg Test",
				description: "Test",
				customerEmail: "user@example.com",
				customerName: "User",
			});
			const msg = await controller.addMessage({
				ticketId: ticket.id,
				body: "Ticket reassigned to Agent B",
				authorType: "system",
				authorName: "System",
			});
			expect(msg.authorType).toBe("system");
		});
	});

	// ── Listing and filtering ─────────────────────────────────────

	describe("ticket listing", () => {
		it("lists all tickets", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createTicket({
					subject: `Ticket ${i}`,
					description: "Test",
					customerEmail: `user${i}@example.com`,
					customerName: `User ${i}`,
				});
			}
			const tickets = await controller.listTickets({});
			expect(tickets).toHaveLength(5);
		});

		it("filters by status", async () => {
			const t1 = await controller.createTicket({
				subject: "Open",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
			});
			await controller.createTicket({
				subject: "Also Open",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
			});
			await controller.closeTicket(t1.id);

			const open = await controller.listTickets({ status: "open" });
			expect(open).toHaveLength(1);
			expect(open[0].subject).toBe("Also Open");
		});

		it("filters by priority", async () => {
			await controller.createTicket({
				subject: "Normal",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
			});
			await controller.createTicket({
				subject: "Urgent",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
				priority: "urgent",
			});

			const urgent = await controller.listTickets({ priority: "urgent" });
			expect(urgent).toHaveLength(1);
			expect(urgent[0].subject).toBe("Urgent");
		});

		it("filters by categoryId", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			await controller.createTicket({
				subject: "Billing Issue",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
				categoryId: cat.id,
			});
			await controller.createTicket({
				subject: "Other",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
			});

			const billing = await controller.listTickets({ categoryId: cat.id });
			expect(billing).toHaveLength(1);
			expect(billing[0].subject).toBe("Billing Issue");
		});

		it("filters by assigneeId", async () => {
			const t1 = await controller.createTicket({
				subject: "Assigned",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
			});
			await controller.createTicket({
				subject: "Unassigned",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
			});
			await controller.updateTicket(t1.id, { assigneeId: "agent_1" });

			const assigned = await controller.listTickets({ assigneeId: "agent_1" });
			expect(assigned).toHaveLength(1);
		});

		it("filters by customerEmail", async () => {
			await controller.createTicket({
				subject: "T1",
				description: "Test",
				customerEmail: "target@example.com",
				customerName: "Target",
			});
			await controller.createTicket({
				subject: "T2",
				description: "Test",
				customerEmail: "target@example.com",
				customerName: "Target",
			});
			await controller.createTicket({
				subject: "T3",
				description: "Test",
				customerEmail: "other@example.com",
				customerName: "Other",
			});

			const results = await controller.listTickets({
				customerEmail: "target@example.com",
			});
			expect(results).toHaveLength(2);
		});
	});

	// ── Statistics ─────────────────────────────────────────────────

	describe("statistics", () => {
		it("returns zeros on empty database", async () => {
			const stats = await controller.getStats();
			expect(stats.total).toBe(0);
			expect(stats.open).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.inProgress).toBe(0);
			expect(stats.resolved).toBe(0);
			expect(stats.closed).toBe(0);
		});

		it("counts tickets by status", async () => {
			const t1 = await controller.createTicket({
				subject: "A",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
			});
			const t2 = await controller.createTicket({
				subject: "B",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
			});
			await controller.createTicket({
				subject: "C",
				description: "Test",
				customerEmail: "c@example.com",
				customerName: "C",
			});
			await controller.closeTicket(t1.id);
			await controller.updateTicket(t2.id, { status: "in-progress" });

			const stats = await controller.getStats();
			expect(stats.total).toBe(3);
			expect(stats.open).toBe(1);
			expect(stats.closed).toBe(1);
			expect(stats.inProgress).toBe(1);
		});

		it("counts tickets by priority", async () => {
			await controller.createTicket({
				subject: "Low",
				description: "Test",
				customerEmail: "a@example.com",
				customerName: "A",
				priority: "low",
			});
			await controller.createTicket({
				subject: "Urgent",
				description: "Test",
				customerEmail: "b@example.com",
				customerName: "B",
				priority: "urgent",
			});
			await controller.createTicket({
				subject: "Urgent 2",
				description: "Test",
				customerEmail: "c@example.com",
				customerName: "C",
				priority: "urgent",
			});

			const stats = await controller.getStats();
			expect(stats.byPriority.low).toBe(1);
			expect(stats.byPriority.urgent).toBe(2);
		});
	});

	// ── Multi-customer isolation ──────────────────────────────────

	describe("multi-customer isolation", () => {
		it("tickets from different customers are independent", async () => {
			await controller.createTicket({
				subject: "Customer 1 ticket",
				description: "Test",
				customerEmail: "cust1@example.com",
				customerName: "Customer 1",
				customerId: "cust_1",
			});
			await controller.createTicket({
				subject: "Customer 2 ticket",
				description: "Test",
				customerEmail: "cust2@example.com",
				customerName: "Customer 2",
				customerId: "cust_2",
			});

			const c1 = await controller.listTickets({ customerId: "cust_1" });
			const c2 = await controller.listTickets({ customerId: "cust_2" });
			expect(c1).toHaveLength(1);
			expect(c2).toHaveLength(1);
			expect(c1[0].subject).toBe("Customer 1 ticket");
			expect(c2[0].subject).toBe("Customer 2 ticket");
		});
	});
});
