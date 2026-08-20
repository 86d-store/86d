import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TicketController } from "../service";
import { createTicketControllers } from "../service-impl";

describe("Tickets Module", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: TicketController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTicketControllers(mockData);
	});

	// ─── Categories ───

	describe("createCategory", () => {
		it("creates a category with all fields", async () => {
			const category = await controller.createCategory({
				name: "Billing",
				slug: "billing",
				description: "Billing and payment issues",
				position: 1,
			});

			expect(category.id).toBeDefined();
			expect(category.name).toBe("Billing");
			expect(category.slug).toBe("billing");
			expect(category.description).toBe("Billing and payment issues");
			expect(category.position).toBe(1);
			expect(category.isActive).toBe(true);
			expect(category.createdAt).toBeInstanceOf(Date);
		});

		it("creates a category with defaults", async () => {
			const category = await controller.createCategory({
				name: "General",
				slug: "general",
			});

			expect(category.position).toBe(0);
			expect(category.isActive).toBe(true);
			expect(category.description).toBeUndefined();
		});
	});

	describe("getCategory", () => {
		it("returns a category by ID", async () => {
			const created = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
			});

			const found = await controller.getCategory(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Shipping");
		});

		it("returns null for nonexistent ID", async () => {
			const found = await controller.getCategory("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listCategories", () => {
		it("lists all categories sorted by position", async () => {
			await controller.createCategory({ name: "B", slug: "b", position: 2 });
			await controller.createCategory({ name: "A", slug: "a", position: 1 });
			await controller.createCategory({ name: "C", slug: "c", position: 3 });

			const categories = await controller.listCategories();
			expect(categories).toHaveLength(3);
			expect(categories[0].name).toBe("A");
			expect(categories[1].name).toBe("B");
			expect(categories[2].name).toBe("C");
		});

		it("filters to active only", async () => {
			const cat = await controller.createCategory({
				name: "Inactive",
				slug: "inactive",
			});
			await controller.updateCategory(cat.id, { isActive: false });
			await controller.createCategory({ name: "Active", slug: "active" });

			const all = await controller.listCategories();
			expect(all).toHaveLength(2);

			const active = await controller.listCategories({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});
	});

	describe("updateCategory", () => {
		it("updates category fields", async () => {
			const cat = await controller.createCategory({
				name: "Old",
				slug: "old",
			});

			const updated = await controller.updateCategory(cat.id, {
				name: "New",
				slug: "new",
				description: "Updated desc",
				position: 5,
			});

			expect(updated.name).toBe("New");
			expect(updated.slug).toBe("new");
			expect(updated.description).toBe("Updated desc");
			expect(updated.position).toBe(5);
		});

		it("throws for nonexistent category", async () => {
			await expect(
				controller.updateCategory("bad-id", { name: "X" }),
			).rejects.toThrow("Ticket category bad-id not found");
		});
	});

	describe("deleteCategory", () => {
		it("deletes a category", async () => {
			const cat = await controller.createCategory({
				name: "ToDelete",
				slug: "todelete",
			});

			await controller.deleteCategory(cat.id);

			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});
	});

	// ─── Tickets ───

	describe("createTicket", () => {
		it("creates a ticket with sequential numbering", async () => {
			const ticket = await controller.createTicket({
				subject: "My order is late",
				description: "Order #123 has not arrived",
				customerEmail: "alice@example.com",
				customerName: "Alice",
			});

			expect(ticket.id).toBeDefined();
			expect(ticket.number).toBe(1001);
			expect(ticket.subject).toBe("My order is late");
			expect(ticket.status).toBe("open");
			expect(ticket.priority).toBe("normal");
			expect(ticket.customerEmail).toBe("alice@example.com");
			expect(ticket.createdAt).toBeInstanceOf(Date);
		});

		it("increments ticket numbers", async () => {
			const t1 = await controller.createTicket({
				subject: "First",
				description: "First ticket",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			const t2 = await controller.createTicket({
				subject: "Second",
				description: "Second ticket",
				customerEmail: "c@d.com",
				customerName: "B",
			});

			expect(t2.number).toBe(t1.number + 1);
		});

		it("accepts optional fields", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});

			const ticket = await controller.createTicket({
				subject: "Charge issue",
				description: "Double charged",
				customerEmail: "bob@example.com",
				customerName: "Bob",
				categoryId: cat.id,
				priority: "high",
				orderId: "order-456",
				customerId: "cust-789",
				tags: ["billing", "urgent"],
			});

			expect(ticket.categoryId).toBe(cat.id);
			expect(ticket.priority).toBe("high");
			expect(ticket.orderId).toBe("order-456");
			expect(ticket.customerId).toBe("cust-789");
			expect(ticket.tags).toEqual(["billing", "urgent"]);
		});
	});

	describe("getTicket", () => {
		it("returns a ticket by ID", async () => {
			const created = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const found = await controller.getTicket(created.id);
			expect(found).not.toBeNull();
			expect(found?.subject).toBe("Help");
		});

		it("returns null for nonexistent", async () => {
			const found = await controller.getTicket("nope");
			expect(found).toBeNull();
		});
	});

	describe("getTicketByNumber", () => {
		it("finds a ticket by its number", async () => {
			const created = await controller.createTicket({
				subject: "By number",
				description: "Find me",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const found = await controller.getTicketByNumber(created.number);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
		});

		it("returns null for nonexistent number", async () => {
			const found = await controller.getTicketByNumber(9999);
			expect(found).toBeNull();
		});
	});

	describe("listTickets", () => {
		it("lists all tickets", async () => {
			await controller.createTicket({
				subject: "First",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.createTicket({
				subject: "Second",
				description: "B",
				customerEmail: "c@d.com",
				customerName: "B",
			});

			const tickets = await controller.listTickets();
			expect(tickets).toHaveLength(2);
			const subjects = tickets.map((t) => t.subject);
			expect(subjects).toContain("First");
			expect(subjects).toContain("Second");
		});

		it("filters by status", async () => {
			await controller.createTicket({
				subject: "Open",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			const t2 = await controller.createTicket({
				subject: "To close",
				description: "B",
				customerEmail: "c@d.com",
				customerName: "B",
			});
			await controller.closeTicket(t2.id);

			const open = await controller.listTickets({ status: "open" });
			expect(open).toHaveLength(1);
			expect(open[0].subject).toBe("Open");

			const closed = await controller.listTickets({ status: "closed" });
			expect(closed).toHaveLength(1);
			expect(closed[0].subject).toBe("To close");
		});

		it("filters by priority", async () => {
			await controller.createTicket({
				subject: "Urgent",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
				priority: "urgent",
			});
			await controller.createTicket({
				subject: "Low",
				description: "B",
				customerEmail: "c@d.com",
				customerName: "B",
				priority: "low",
			});

			const urgent = await controller.listTickets({ priority: "urgent" });
			expect(urgent).toHaveLength(1);
			expect(urgent[0].subject).toBe("Urgent");
		});

		it("filters by customer email", async () => {
			await controller.createTicket({
				subject: "Alice ticket",
				description: "A",
				customerEmail: "alice@example.com",
				customerName: "Alice",
			});
			await controller.createTicket({
				subject: "Bob ticket",
				description: "B",
				customerEmail: "bob@example.com",
				customerName: "Bob",
			});

			const aliceTickets = await controller.listTickets({
				customerEmail: "alice@example.com",
			});
			expect(aliceTickets).toHaveLength(1);
			expect(aliceTickets[0].subject).toBe("Alice ticket");
		});
	});

	describe("updateTicket", () => {
		it("updates ticket fields", async () => {
			const ticket = await controller.createTicket({
				subject: "Original",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const updated = await controller.updateTicket(ticket.id, {
				subject: "Updated",
				priority: "high",
				assigneeId: "admin-1",
				assigneeName: "Admin",
				tags: ["escalated"],
			});

			expect(updated.subject).toBe("Updated");
			expect(updated.priority).toBe("high");
			expect(updated.assigneeId).toBe("admin-1");
			expect(updated.assigneeName).toBe("Admin");
			expect(updated.tags).toEqual(["escalated"]);
		});

		it("sets closedAt when status changes to closed", async () => {
			const ticket = await controller.createTicket({
				subject: "Will close",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const updated = await controller.updateTicket(ticket.id, {
				status: "closed",
			});

			expect(updated.status).toBe("closed");
			expect(updated.closedAt).toBeInstanceOf(Date);
		});

		it("sets closedAt when status changes to resolved", async () => {
			const ticket = await controller.createTicket({
				subject: "Will resolve",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const updated = await controller.updateTicket(ticket.id, {
				status: "resolved",
			});

			expect(updated.status).toBe("resolved");
			expect(updated.closedAt).toBeInstanceOf(Date);
		});

		it("throws for nonexistent ticket", async () => {
			await expect(
				controller.updateTicket("bad", { subject: "X" }),
			).rejects.toThrow("Ticket bad not found");
		});
	});

	describe("closeTicket", () => {
		it("closes a ticket and sets closedAt", async () => {
			const ticket = await controller.createTicket({
				subject: "To close",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const closed = await controller.closeTicket(ticket.id);

			expect(closed.status).toBe("closed");
			expect(closed.closedAt).toBeInstanceOf(Date);
		});

		it("throws for nonexistent ticket", async () => {
			await expect(controller.closeTicket("bad")).rejects.toThrow(
				"Ticket bad not found",
			);
		});
	});

	describe("reopenTicket", () => {
		it("reopens a closed ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Reopen me",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.closeTicket(ticket.id);

			const reopened = await controller.reopenTicket(ticket.id);

			expect(reopened.status).toBe("open");
			expect(reopened.closedAt).toBeUndefined();
		});

		it("reopens a resolved ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Reopen resolved",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.updateTicket(ticket.id, { status: "resolved" });

			const reopened = await controller.reopenTicket(ticket.id);
			expect(reopened.status).toBe("open");
		});

		it("throws when ticket is not closed or resolved", async () => {
			const ticket = await controller.createTicket({
				subject: "Still open",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			await expect(controller.reopenTicket(ticket.id)).rejects.toThrow(
				"is not closed or resolved",
			);
		});

		it("throws for nonexistent ticket", async () => {
			await expect(controller.reopenTicket("bad")).rejects.toThrow(
				"Ticket bad not found",
			);
		});
	});

	// ─── Messages ───

	describe("addMessage", () => {
		it("adds a customer message to a ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "Alice",
			});

			const message = await controller.addMessage({
				ticketId: ticket.id,
				body: "Any update?",
				authorType: "customer",
				authorName: "Alice",
				authorEmail: "a@b.com",
			});

			expect(message.id).toBeDefined();
			expect(message.ticketId).toBe(ticket.id);
			expect(message.body).toBe("Any update?");
			expect(message.authorType).toBe("customer");
			expect(message.isInternal).toBe(false);
			expect(message.createdAt).toBeInstanceOf(Date);
		});

		it("adds an admin message", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "Alice",
			});

			const message = await controller.addMessage({
				ticketId: ticket.id,
				body: "We're looking into it",
				authorType: "admin",
				authorName: "Support Agent",
				authorId: "admin-1",
			});

			expect(message.authorType).toBe("admin");
			expect(message.authorId).toBe("admin-1");
		});

		it("adds an internal note", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "Alice",
			});

			const message = await controller.addMessage({
				ticketId: ticket.id,
				body: "Internal: escalate to tier 2",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			expect(message.isInternal).toBe(true);
		});

		it("sets ticket to pending when customer replies to non-open ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "Alice",
			});

			// Admin replies first, moving to in-progress
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Working on it",
				authorType: "admin",
				authorName: "Agent",
			});

			// Customer replies, moving to pending
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Thanks for the update",
				authorType: "customer",
				authorName: "Alice",
			});

			const updated = await controller.getTicket(ticket.id);
			expect(updated?.status).toBe("pending");
		});

		it("sets ticket to in-progress when admin replies to open ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "I need help",
				customerEmail: "a@b.com",
				customerName: "Alice",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "We received your ticket",
				authorType: "admin",
				authorName: "Agent",
			});

			const updated = await controller.getTicket(ticket.id);
			expect(updated?.status).toBe("in-progress");
		});
	});

	describe("listMessages", () => {
		it("lists messages sorted by oldest first", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "First",
				authorType: "customer",
				authorName: "A",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Second",
				authorType: "admin",
				authorName: "Agent",
			});

			const messages = await controller.listMessages(ticket.id);
			expect(messages).toHaveLength(2);
			expect(messages[0].body).toBe("First");
			expect(messages[1].body).toBe("Second");
		});

		it("excludes internal messages by default", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public reply",
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

			const publicMessages = await controller.listMessages(ticket.id);
			expect(publicMessages).toHaveLength(1);
			expect(publicMessages[0].body).toBe("Public reply");
		});

		it("includes internal messages when requested", async () => {
			const ticket = await controller.createTicket({
				subject: "Help",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public",
				authorType: "admin",
				authorName: "Agent",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Internal",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			const allMessages = await controller.listMessages(ticket.id, {
				includeInternal: true,
			});
			expect(allMessages).toHaveLength(2);
		});
	});

	// ─── Stats ───

	describe("getStats", () => {
		it("returns zeroes when no tickets exist", async () => {
			const stats = await controller.getStats();

			expect(stats.total).toBe(0);
			expect(stats.open).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.inProgress).toBe(0);
			expect(stats.resolved).toBe(0);
			expect(stats.closed).toBe(0);
			expect(stats.byPriority).toEqual({
				low: 0,
				normal: 0,
				high: 0,
				urgent: 0,
			});
		});

		it("counts tickets by status and priority", async () => {
			await controller.createTicket({
				subject: "Open normal",
				description: "A",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.createTicket({
				subject: "Open urgent",
				description: "B",
				customerEmail: "c@d.com",
				customerName: "B",
				priority: "urgent",
			});

			const t3 = await controller.createTicket({
				subject: "To close",
				description: "C",
				customerEmail: "e@f.com",
				customerName: "C",
				priority: "low",
			});
			await controller.closeTicket(t3.id);

			const stats = await controller.getStats();

			expect(stats.total).toBe(3);
			expect(stats.open).toBe(2);
			expect(stats.closed).toBe(1);
			expect(stats.byPriority.normal).toBe(1);
			expect(stats.byPriority.urgent).toBe(1);
			expect(stats.byPriority.low).toBe(1);
		});
	});
});
