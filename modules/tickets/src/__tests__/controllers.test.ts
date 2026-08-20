import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTicketControllers } from "../service-impl";

describe("tickets controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTicketControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTicketControllers(mockData);
	});

	// ── Ticket lifecycle ─────────────────────────────────────────────

	describe("ticket lifecycle", () => {
		it("full lifecycle: open → in-progress → resolved → reopen → closed", async () => {
			const ticket = await controller.createTicket({
				subject: "Lifecycle",
				description: "Test full lifecycle",
				customerEmail: "alice@example.com",
				customerName: "Alice",
			});
			expect(ticket.status).toBe("open");

			// Admin replies → in-progress
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Looking into it",
				authorType: "admin",
				authorName: "Agent",
			});
			let t = await controller.getTicket(ticket.id);
			expect(t?.status).toBe("in-progress");

			// Resolve
			await controller.updateTicket(ticket.id, { status: "resolved" });
			t = await controller.getTicket(ticket.id);
			expect(t?.status).toBe("resolved");
			expect(t?.closedAt).toBeDefined();

			// Reopen
			const reopened = await controller.reopenTicket(ticket.id);
			expect(reopened.status).toBe("open");
			expect(reopened.closedAt).toBeUndefined();

			// Close
			const closed = await controller.closeTicket(ticket.id);
			expect(closed.status).toBe("closed");
			expect(closed.closedAt).toBeDefined();
		});

		it("customer reply on open ticket does not change to pending", async () => {
			const ticket = await controller.createTicket({
				subject: "Open",
				description: "Still open",
				customerEmail: "alice@example.com",
				customerName: "Alice",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Adding more info",
				authorType: "customer",
				authorName: "Alice",
			});

			const t = await controller.getTicket(ticket.id);
			// Customer reply on open ticket shouldn't change to pending
			// (only non-open tickets change to pending on customer reply)
			expect(t?.status).toBe("open");
		});

		it("admin reply on non-open ticket does not change to in-progress", async () => {
			const ticket = await controller.createTicket({
				subject: "Test",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			// Move to in-progress via admin reply
			await controller.addMessage({
				ticketId: ticket.id,
				body: "On it",
				authorType: "admin",
				authorName: "Agent",
			});
			let t = await controller.getTicket(ticket.id);
			expect(t?.status).toBe("in-progress");

			// Another admin reply should NOT change status
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Still working",
				authorType: "admin",
				authorName: "Agent",
			});
			t = await controller.getTicket(ticket.id);
			expect(t?.status).toBe("in-progress");
		});
	});

	// ── Sequential ticket numbers ────────────────────────────────────

	describe("ticket numbering", () => {
		it("starts at 1001 for first ticket", async () => {
			const ticket = await controller.createTicket({
				subject: "First",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			expect(ticket.number).toBe(1001);
		});

		it("numbers are strictly sequential", async () => {
			const numbers: number[] = [];
			for (let i = 0; i < 5; i++) {
				const ticket = await controller.createTicket({
					subject: `Ticket ${i}`,
					description: `D ${i}`,
					customerEmail: `user${i}@example.com`,
					customerName: `User ${i}`,
				});
				numbers.push(ticket.number);
			}
			for (let i = 1; i < numbers.length; i++) {
				expect(numbers[i]).toBe(numbers[i - 1] + 1);
			}
		});
	});

	// ── listTickets combined filters ─────────────────────────────────

	describe("listTickets — combined filters", () => {
		it("filters by categoryId", async () => {
			const cat = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});

			await controller.createTicket({
				subject: "Billing issue",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
				categoryId: cat.id,
			});
			await controller.createTicket({
				subject: "General issue",
				description: "D",
				customerEmail: "c@d.com",
				customerName: "B",
			});

			const billing = await controller.listTickets({
				categoryId: cat.id,
			});
			expect(billing).toHaveLength(1);
			expect(billing[0].subject).toBe("Billing issue");
		});

		it("filters by assigneeId", async () => {
			const t = await controller.createTicket({
				subject: "Assigned",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.updateTicket(t.id, {
				assigneeId: "agent_1",
				assigneeName: "Agent One",
			});

			await controller.createTicket({
				subject: "Unassigned",
				description: "D",
				customerEmail: "c@d.com",
				customerName: "B",
			});

			const assigned = await controller.listTickets({
				assigneeId: "agent_1",
			});
			expect(assigned).toHaveLength(1);
			expect(assigned[0].subject).toBe("Assigned");
		});

		it("filters by customerId", async () => {
			await controller.createTicket({
				subject: "Customer 1",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
				customerId: "cust_1",
			});
			await controller.createTicket({
				subject: "Customer 2",
				description: "D",
				customerEmail: "c@d.com",
				customerName: "B",
				customerId: "cust_2",
			});

			const result = await controller.listTickets({
				customerId: "cust_1",
			});
			expect(result).toHaveLength(1);
			expect(result[0].subject).toBe("Customer 1");
		});

		it("returns empty array when no tickets exist", async () => {
			const result = await controller.listTickets();
			expect(result).toHaveLength(0);
		});
	});

	// ── Messages edge cases ──────────────────────────────────────────

	describe("messages — edge cases", () => {
		it("messages are scoped to specific ticket", async () => {
			const t1 = await controller.createTicket({
				subject: "T1",
				description: "D1",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			const t2 = await controller.createTicket({
				subject: "T2",
				description: "D2",
				customerEmail: "c@d.com",
				customerName: "B",
			});

			await controller.addMessage({
				ticketId: t1.id,
				body: "Message for T1",
				authorType: "customer",
				authorName: "A",
			});
			await controller.addMessage({
				ticketId: t2.id,
				body: "Message for T2",
				authorType: "customer",
				authorName: "B",
			});

			const t1Messages = await controller.listMessages(t1.id, {
				includeInternal: true,
			});
			const t2Messages = await controller.listMessages(t2.id, {
				includeInternal: true,
			});
			expect(t1Messages).toHaveLength(1);
			expect(t1Messages[0].body).toBe("Message for T1");
			expect(t2Messages).toHaveLength(1);
			expect(t2Messages[0].body).toBe("Message for T2");
		});

		it("returns empty array for ticket with no messages", async () => {
			const ticket = await controller.createTicket({
				subject: "Empty",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			const messages = await controller.listMessages(ticket.id);
			expect(messages).toHaveLength(0);
		});

		it("internal and public messages interleave correctly", async () => {
			const ticket = await controller.createTicket({
				subject: "Mixed",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public 1",
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
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public 2",
				authorType: "customer",
				authorName: "A",
			});

			const publicOnly = await controller.listMessages(ticket.id);
			expect(publicOnly).toHaveLength(2);

			const all = await controller.listMessages(ticket.id, {
				includeInternal: true,
			});
			expect(all).toHaveLength(3);
		});
	});

	// ── Stats edge cases ─────────────────────────────────────────────

	describe("getStats — all statuses", () => {
		it("counts all statuses correctly", async () => {
			// Open
			await controller.createTicket({
				subject: "Open",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});

			// In-progress (admin reply)
			const t2 = await controller.createTicket({
				subject: "In progress",
				description: "D",
				customerEmail: "b@c.com",
				customerName: "B",
			});
			await controller.addMessage({
				ticketId: t2.id,
				body: "Working",
				authorType: "admin",
				authorName: "Agent",
			});

			// Pending (customer reply on in-progress)
			const t3 = await controller.createTicket({
				subject: "Pending",
				description: "D",
				customerEmail: "c@d.com",
				customerName: "C",
			});
			await controller.addMessage({
				ticketId: t3.id,
				body: "Working",
				authorType: "admin",
				authorName: "Agent",
			});
			await controller.addMessage({
				ticketId: t3.id,
				body: "Thanks",
				authorType: "customer",
				authorName: "C",
			});

			// Resolved
			const t4 = await controller.createTicket({
				subject: "Resolved",
				description: "D",
				customerEmail: "d@e.com",
				customerName: "D",
				priority: "high",
			});
			await controller.updateTicket(t4.id, { status: "resolved" });

			// Closed
			const t5 = await controller.createTicket({
				subject: "Closed",
				description: "D",
				customerEmail: "e@f.com",
				customerName: "E",
				priority: "urgent",
			});
			await controller.closeTicket(t5.id);

			const stats = await controller.getStats();
			expect(stats.total).toBe(5);
			expect(stats.open).toBe(1);
			expect(stats.inProgress).toBe(1);
			expect(stats.pending).toBe(1);
			expect(stats.resolved).toBe(1);
			expect(stats.closed).toBe(1);
			expect(stats.byPriority.normal).toBe(3);
			expect(stats.byPriority.high).toBe(1);
			expect(stats.byPriority.urgent).toBe(1);
		});
	});

	// ── updateTicket edge cases ──────────────────────────────────────

	describe("updateTicket — edge cases", () => {
		it("preserves unmodified fields on update", async () => {
			const ticket = await controller.createTicket({
				subject: "Keep me",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
				priority: "high",
				tags: ["original"],
			});

			const updated = await controller.updateTicket(ticket.id, {
				assigneeId: "agent_1",
			});

			expect(updated.subject).toBe("Keep me");
			expect(updated.priority).toBe("high");
			expect(updated.tags).toEqual(["original"]);
			expect(updated.assigneeId).toBe("agent_1");
		});

		it("updates tags to empty array", async () => {
			const ticket = await controller.createTicket({
				subject: "Tagged",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
				tags: ["remove", "these"],
			});

			const updated = await controller.updateTicket(ticket.id, {
				tags: [],
			});
			expect(updated.tags).toEqual([]);
		});
	});

	// ── Category edge cases ──────────────────────────────────────────

	describe("category — edge cases", () => {
		it("updateCategory preserves unmodified fields", async () => {
			const cat = await controller.createCategory({
				name: "Original",
				slug: "original",
				description: "Keep me",
				position: 5,
			});

			const updated = await controller.updateCategory(cat.id, {
				name: "Changed",
			});

			expect(updated.name).toBe("Changed");
			expect(updated.slug).toBe("original");
			expect(updated.description).toBe("Keep me");
			expect(updated.position).toBe(5);
		});

		it("deactivating category preserves it in list", async () => {
			const cat = await controller.createCategory({
				name: "Deactivate",
				slug: "deactivate",
			});
			await controller.updateCategory(cat.id, { isActive: false });

			const all = await controller.listCategories();
			expect(all).toHaveLength(1);
			expect(all[0].isActive).toBe(false);

			const active = await controller.listCategories({ activeOnly: true });
			expect(active).toHaveLength(0);
		});
	});

	// ── closeTicket/reopenTicket edge cases ───────────────────────────

	describe("closeTicket + reopenTicket — edge cases", () => {
		it("closing already closed ticket updates closedAt", async () => {
			const ticket = await controller.createTicket({
				subject: "Double close",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.closeTicket(ticket.id);

			// Close again
			const second = await controller.closeTicket(ticket.id);
			expect(second.status).toBe("closed");
			expect(second.closedAt).toBeDefined();
		});

		it("reopening an in-progress ticket throws", async () => {
			const ticket = await controller.createTicket({
				subject: "In progress",
				description: "D",
				customerEmail: "a@b.com",
				customerName: "A",
			});
			await controller.updateTicket(ticket.id, { status: "in-progress" });

			await expect(controller.reopenTicket(ticket.id)).rejects.toThrow(
				"is not closed or resolved",
			);
		});
	});
});
