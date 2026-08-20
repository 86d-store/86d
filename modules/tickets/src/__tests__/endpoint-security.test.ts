import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TicketController } from "../service";
import { createTicketControllers } from "../service-impl";
import { customerReply } from "../store/endpoints/customer-reply";
import { customerTickets } from "../store/endpoints/customer-tickets";
import { getTicket } from "../store/endpoints/get-ticket";
import { submitTicket } from "../store/endpoints/submit-ticket";

/**
 * Security regression tests for tickets endpoints.
 *
 * Support tickets contain sensitive customer data (emails, order references,
 * internal agent notes). These tests verify:
 * - Customer isolation: customer A cannot see customer B's tickets
 * - Message isolation: internal notes are hidden from public listing
 * - Status transition enforcement: only valid transitions are allowed
 * - Priority escalation integrity: priority changes are recorded correctly
 * - Assignee integrity: ticket assignment state is consistent
 */

async function createTestTicket(
	controller: TicketController,
	overrides: Partial<Parameters<TicketController["createTicket"]>[0]> = {},
) {
	return controller.createTicket({
		subject: "Test ticket",
		description: "Test description",
		customerEmail: "default@example.com",
		customerName: "Default Customer",
		...overrides,
	});
}

async function callEndpoint<
	E extends (...args: never[]) => Promise<unknown>,
	I extends Parameters<E>[0] & object,
>(
	endpoint: E,
	input: I,
	context: {
		controllers: { tickets: TicketController };
		session?:
			| {
					user: {
						email: string;
						id?: string | undefined;
						name?: string | null | undefined;
					};
			  }
			| undefined;
	},
): Promise<Awaited<ReturnType<E>>> {
	return endpoint(
		Object.assign({}, input, { context }) as Parameters<E>[0],
	) as Promise<Awaited<ReturnType<E>>>;
}

describe("tickets endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: TicketController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTicketControllers(mockData);
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("submitTicket ignores authenticated customerEmail impersonation", async () => {
			const response = await callEndpoint(
				submitTicket,
				{
					body: {
						subject: "Need help",
						description: "Checking ownership binding",
						customerEmail: "victim@example.com",
						customerName: "Victim",
					},
				},
				{
					controllers: { tickets: controller },
					session: {
						user: {
							id: "cust_attacker",
							email: "attacker@example.com",
							name: "<b>Attacker</b>",
						},
					},
				},
			);

			expect("ticket" in response).toBe(true);
			if (!("ticket" in response)) {
				throw new Error("Expected ticket response");
			}

			expect(response.ticket.customerId).toBe("cust_attacker");
			expect(response.ticket.customerEmail).toBe("attacker@example.com");
			expect(response.ticket.customerName).toBe("Attacker");
		});

		it("listTickets by customerId only returns that customer's tickets", async () => {
			await createTestTicket(controller, {
				customerId: "cust_victim",
				customerEmail: "victim@example.com",
				customerName: "Victim",
			});
			await createTestTicket(controller, {
				customerId: "cust_victim",
				customerEmail: "victim@example.com",
				customerName: "Victim",
				subject: "Second ticket",
			});
			await createTestTicket(controller, {
				customerId: "cust_attacker",
				customerEmail: "attacker@example.com",
				customerName: "Attacker",
			});

			const attackerTickets = await controller.listTickets({
				customerId: "cust_attacker",
			});
			expect(attackerTickets).toHaveLength(1);
			for (const t of attackerTickets) {
				expect(t.customerId).toBe("cust_attacker");
			}
		});

		it("listTickets by customerEmail only returns that email's tickets", async () => {
			await createTestTicket(controller, {
				customerEmail: "alice@shop.com",
				customerName: "Alice",
			});
			await createTestTicket(controller, {
				customerEmail: "bob@shop.com",
				customerName: "Bob",
			});

			const aliceTickets = await controller.listTickets({
				customerEmail: "alice@shop.com",
			});
			expect(aliceTickets).toHaveLength(1);
			expect(aliceTickets[0].customerEmail).toBe("alice@shop.com");
		});

		it("getTicket exposes ticket regardless of customerId (endpoint must verify ownership)", async () => {
			const ticket = await createTestTicket(controller, {
				customerId: "cust_owner",
				customerEmail: "owner@example.com",
			});

			// Controller-level getTicket does NOT enforce ownership — the endpoint must
			const found = await controller.getTicket(ticket.id);
			expect(found).not.toBeNull();
			expect(found?.customerId).toBe("cust_owner");
		});

		it("getTicket grants access when customerId matches even if email changed", async () => {
			const ticket = await createTestTicket(controller, {
				customerId: "cust_owner",
				customerEmail: "old-email@example.com",
			});

			const response = await callEndpoint(
				getTicket,
				{
					params: { id: ticket.id },
				},
				{
					controllers: { tickets: controller },
					session: {
						user: {
							id: "cust_owner",
							email: "new-email@example.com",
							name: "Owner",
						},
					},
				},
			);

			expect("ticket" in response).toBe(true);
			if (!("ticket" in response)) {
				throw new Error("Expected ticket response");
			}

			expect(response.ticket.id).toBe(ticket.id);
		});

		it("getTicket rejects email match when ticket belongs to another customerId", async () => {
			const ticket = await createTestTicket(controller, {
				customerId: "cust_attacker",
				customerEmail: "victim@example.com",
			});

			const response = await callEndpoint(
				getTicket,
				{
					params: { id: ticket.id },
				},
				{
					controllers: { tickets: controller },
					session: {
						user: {
							id: "cust_victim",
							email: "victim@example.com",
							name: "Victim",
						},
					},
				},
			);

			expect(response).toEqual({
				error: "Ticket not found",
				status: 404,
			});
		});

		it("getTicketByNumber exposes ticket without ownership check", async () => {
			const ticket = await createTestTicket(controller, {
				customerId: "cust_private",
				customerEmail: "private@example.com",
			});

			// Same pattern: controller returns it, endpoint must guard
			const found = await controller.getTicketByNumber(ticket.number);
			expect(found).not.toBeNull();
			expect(found?.customerId).toBe("cust_private");
		});

		it("customerTickets returns both id-owned tickets and legacy email-only tickets", async () => {
			const owned = await createTestTicket(controller, {
				customerId: "cust_owner",
				customerEmail: "owner@example.com",
			});
			const legacy = await createTestTicket(controller, {
				customerEmail: "owner@example.com",
				customerName: "Owner",
			});
			await createTestTicket(controller, {
				customerId: "cust_other",
				customerEmail: "owner@example.com",
				customerName: "Impostor",
			});

			const response = await callEndpoint(
				customerTickets,
				{
					query: {},
				},
				{
					controllers: { tickets: controller },
					session: {
						user: {
							id: "cust_owner",
							email: "owner@example.com",
							name: "Owner",
						},
					},
				},
			);

			expect("tickets" in response).toBe(true);
			if (!("tickets" in response)) {
				throw new Error("Expected tickets response");
			}

			expect(response.tickets).toHaveLength(2);
			expect(new Set(response.tickets.map((ticket) => ticket.id))).toEqual(
				new Set([legacy.id, owned.id]),
			);
		});
	});

	// ── Message Isolation ───────────────────────────────────────────

	describe("message isolation — internal notes", () => {
		it("internal messages are excluded from default listing", async () => {
			const ticket = await createTestTicket(controller);

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Public reply",
				authorType: "admin",
				authorName: "Agent",
			});
			await controller.addMessage({
				ticketId: ticket.id,
				body: "Internal: customer is VIP, escalate",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			const publicMessages = await controller.listMessages(ticket.id);
			expect(publicMessages).toHaveLength(1);
			expect(publicMessages[0].body).toBe("Public reply");
		});

		it("internal messages are visible only when includeInternal is true", async () => {
			const ticket = await createTestTicket(controller);

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Sensitive internal note",
				authorType: "admin",
				authorName: "Agent",
				isInternal: true,
			});

			const withInternal = await controller.listMessages(ticket.id, {
				includeInternal: true,
			});
			expect(withInternal).toHaveLength(1);
			expect(withInternal[0].isInternal).toBe(true);

			const withoutInternal = await controller.listMessages(ticket.id);
			expect(withoutInternal).toHaveLength(0);
		});

		it("messages for one ticket do not leak into another ticket's listing", async () => {
			const ticket1 = await createTestTicket(controller, {
				subject: "Ticket 1",
			});
			const ticket2 = await createTestTicket(controller, {
				subject: "Ticket 2",
			});

			await controller.addMessage({
				ticketId: ticket1.id,
				body: "Message for ticket 1",
				authorType: "customer",
				authorName: "Alice",
			});
			await controller.addMessage({
				ticketId: ticket2.id,
				body: "Message for ticket 2",
				authorType: "customer",
				authorName: "Bob",
			});

			const t1Messages = await controller.listMessages(ticket1.id);
			expect(t1Messages).toHaveLength(1);
			expect(t1Messages[0].body).toBe("Message for ticket 1");

			const t2Messages = await controller.listMessages(ticket2.id);
			expect(t2Messages).toHaveLength(1);
			expect(t2Messages[0].body).toBe("Message for ticket 2");
		});
	});

	// ── Status Transition Enforcement ───────────────────────────────

	describe("status transition enforcement", () => {
		it("customerReply rejects email match when ticket belongs to another customerId", async () => {
			const ticket = await createTestTicket(controller, {
				customerId: "cust_attacker",
				customerEmail: "victim@example.com",
			});

			const response = await callEndpoint(
				customerReply,
				{
					params: { id: ticket.id },
					body: { body: "This should be blocked" },
				},
				{
					controllers: { tickets: controller },
					session: {
						user: {
							id: "cust_victim",
							email: "victim@example.com",
							name: "Victim",
						},
					},
				},
			);

			expect(response).toEqual({
				error: "Ticket not found",
				status: 404,
			});
		});

		it("reopen rejects a ticket that is still open", async () => {
			const ticket = await createTestTicket(controller);
			expect(ticket.status).toBe("open");

			await expect(controller.reopenTicket(ticket.id)).rejects.toThrow(
				"is not closed or resolved",
			);
		});

		it("reopen rejects an in-progress ticket", async () => {
			const ticket = await createTestTicket(controller);
			await controller.updateTicket(ticket.id, { status: "in-progress" });

			await expect(controller.reopenTicket(ticket.id)).rejects.toThrow(
				"is not closed or resolved",
			);
		});

		it("reopen rejects a pending ticket", async () => {
			const ticket = await createTestTicket(controller);
			await controller.updateTicket(ticket.id, { status: "pending" });

			await expect(controller.reopenTicket(ticket.id)).rejects.toThrow(
				"is not closed or resolved",
			);
		});

		it("reopen succeeds for a closed ticket", async () => {
			const ticket = await createTestTicket(controller);
			await controller.closeTicket(ticket.id);

			const reopened = await controller.reopenTicket(ticket.id);
			expect(reopened.status).toBe("open");
			expect(reopened.closedAt).toBeUndefined();
		});

		it("reopen succeeds for a resolved ticket", async () => {
			const ticket = await createTestTicket(controller);
			await controller.updateTicket(ticket.id, { status: "resolved" });

			const reopened = await controller.reopenTicket(ticket.id);
			expect(reopened.status).toBe("open");
		});

		it("closeTicket sets closedAt timestamp", async () => {
			const ticket = await createTestTicket(controller);
			const closed = await controller.closeTicket(ticket.id);

			expect(closed.status).toBe("closed");
			expect(closed.closedAt).toBeInstanceOf(Date);
		});

		it("updateTicket to resolved sets closedAt", async () => {
			const ticket = await createTestTicket(controller);
			const resolved = await controller.updateTicket(ticket.id, {
				status: "resolved",
			});

			expect(resolved.status).toBe("resolved");
			expect(resolved.closedAt).toBeInstanceOf(Date);
		});

		it("customer reply to in-progress ticket sets status to pending", async () => {
			const ticket = await createTestTicket(controller);
			await controller.updateTicket(ticket.id, { status: "in-progress" });

			await controller.addMessage({
				ticketId: ticket.id,
				body: "Customer follow-up",
				authorType: "customer",
				authorName: "Customer",
			});

			const updated = await controller.getTicket(ticket.id);
			expect(updated?.status).toBe("pending");
		});

		it("admin reply to open ticket sets status to in-progress", async () => {
			const ticket = await createTestTicket(controller);
			expect(ticket.status).toBe("open");

			await controller.addMessage({
				ticketId: ticket.id,
				body: "We received your request",
				authorType: "admin",
				authorName: "Agent",
			});

			const updated = await controller.getTicket(ticket.id);
			expect(updated?.status).toBe("in-progress");
		});
	});

	// ── Priority Escalation Integrity ───────────────────────────────

	describe("priority escalation integrity", () => {
		it("newly created tickets default to normal priority", async () => {
			const ticket = await createTestTicket(controller);
			expect(ticket.priority).toBe("normal");
		});

		it("priority escalation from normal to urgent is recorded", async () => {
			const ticket = await createTestTicket(controller);
			const escalated = await controller.updateTicket(ticket.id, {
				priority: "urgent",
			});

			expect(escalated.priority).toBe("urgent");
			expect(escalated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				ticket.createdAt.getTime(),
			);
		});

		it("priority de-escalation from urgent to low is recorded", async () => {
			const ticket = await createTestTicket(controller, {
				priority: "urgent",
			});
			const deescalated = await controller.updateTicket(ticket.id, {
				priority: "low",
			});

			expect(deescalated.priority).toBe("low");
		});

		it("stats reflect accurate priority counts after changes", async () => {
			const t1 = await createTestTicket(controller, { priority: "urgent" });
			await createTestTicket(controller, { priority: "low" });

			// Escalate t1 from urgent to high (change)
			await controller.updateTicket(t1.id, { priority: "high" });

			const stats = await controller.getStats();
			expect(stats.byPriority.urgent).toBe(0);
			expect(stats.byPriority.high).toBe(1);
			expect(stats.byPriority.low).toBe(1);
			expect(stats.total).toBe(2);
		});
	});

	// ── Assignee Integrity ──────────────────────────────────────────

	describe("assignee integrity", () => {
		it("ticket starts with no assignee", async () => {
			const ticket = await createTestTicket(controller);
			expect(ticket.assigneeId).toBeUndefined();
			expect(ticket.assigneeName).toBeUndefined();
		});

		it("assigning an agent sets both assigneeId and assigneeName", async () => {
			const ticket = await createTestTicket(controller);
			const assigned = await controller.updateTicket(ticket.id, {
				assigneeId: "agent_1",
				assigneeName: "Agent Smith",
			});

			expect(assigned.assigneeId).toBe("agent_1");
			expect(assigned.assigneeName).toBe("Agent Smith");
		});

		it("reassignment to a different agent replaces the original", async () => {
			const ticket = await createTestTicket(controller);
			await controller.updateTicket(ticket.id, {
				assigneeId: "agent_1",
				assigneeName: "Agent Smith",
			});

			const reassigned = await controller.updateTicket(ticket.id, {
				assigneeId: "agent_2",
				assigneeName: "Agent Jones",
			});

			expect(reassigned.assigneeId).toBe("agent_2");
			expect(reassigned.assigneeName).toBe("Agent Jones");
		});

		it("filter by assigneeId only returns tickets for that agent", async () => {
			await createTestTicket(controller, { subject: "Ticket A" });
			const t2 = await createTestTicket(controller, { subject: "Ticket B" });
			await controller.updateTicket(t2.id, {
				assigneeId: "agent_1",
				assigneeName: "Agent",
			});

			const agentTickets = await controller.listTickets({
				assigneeId: "agent_1",
			});
			expect(agentTickets).toHaveLength(1);
			expect(agentTickets[0].subject).toBe("Ticket B");
		});
	});

	// ── Nonexistent Resource Guards ─────────────────────────────────

	describe("nonexistent resource guards", () => {
		it("updateTicket throws for nonexistent ticket ID", async () => {
			await expect(
				controller.updateTicket("ghost-id", { subject: "Hacked" }),
			).rejects.toThrow("Ticket ghost-id not found");
		});

		it("closeTicket throws for nonexistent ticket ID", async () => {
			await expect(controller.closeTicket("ghost-id")).rejects.toThrow(
				"Ticket ghost-id not found",
			);
		});

		it("reopenTicket throws for nonexistent ticket ID", async () => {
			await expect(controller.reopenTicket("ghost-id")).rejects.toThrow(
				"Ticket ghost-id not found",
			);
		});

		it("updateCategory throws for nonexistent category ID", async () => {
			await expect(
				controller.updateCategory("ghost-cat", { name: "Hacked" }),
			).rejects.toThrow("Ticket category ghost-cat not found");
		});
	});
});
