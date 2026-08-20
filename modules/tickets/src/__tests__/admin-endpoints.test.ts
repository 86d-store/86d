import { describe, expect, it, vi } from "vitest";
import { adminReply } from "../admin/endpoints/admin-reply";
import { closeTicket } from "../admin/endpoints/close-ticket";
import { createCategory } from "../admin/endpoints/create-category";
import { deleteCategory } from "../admin/endpoints/delete-category";
import { deleteTicket } from "../admin/endpoints/delete-ticket";
import { getTicket } from "../admin/endpoints/get-ticket";
import { listCategories } from "../admin/endpoints/list-categories";
import { listMessages } from "../admin/endpoints/list-messages";
import { listTickets } from "../admin/endpoints/list-tickets";
import { reopenTicket } from "../admin/endpoints/reopen-ticket";
import { getStats } from "../admin/endpoints/stats";
import { updateCategory } from "../admin/endpoints/update-category";
import { updateTicket } from "../admin/endpoints/update-ticket";
import type {
	Ticket,
	TicketCategory,
	TicketController,
	TicketMessage,
	TicketPriority,
	TicketStatus,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCategory(overrides: Partial<TicketCategory> = {}): TicketCategory {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "General",
		slug: "general",
		position: 0,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		number: 1,
		subject: "Help needed",
		description: "I need help with my order.",
		status: "open" as TicketStatus,
		priority: "normal" as TicketPriority,
		customerEmail: "customer@example.com",
		customerName: "Jane Doe",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMessage(overrides: Partial<TicketMessage> = {}): TicketMessage {
	return {
		id: crypto.randomUUID(),
		ticketId: "ticket_1",
		body: "Hello, how can I help?",
		authorType: "admin",
		authorName: "Support Agent",
		isInternal: false,
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<TicketController> = {},
): TicketController {
	return {
		createCategory: vi.fn().mockResolvedValue(makeCategory()),
		getCategory: vi.fn().mockResolvedValue(null),
		listCategories: vi.fn().mockResolvedValue([]),
		updateCategory: vi.fn().mockResolvedValue(makeCategory()),
		deleteCategory: vi.fn().mockResolvedValue(undefined),
		createTicket: vi.fn().mockResolvedValue(makeTicket()),
		getTicket: vi.fn().mockResolvedValue(null),
		getTicketByNumber: vi.fn().mockResolvedValue(null),
		listTickets: vi.fn().mockResolvedValue([]),
		updateTicket: vi.fn().mockResolvedValue(makeTicket()),
		closeTicket: vi.fn().mockResolvedValue(makeTicket()),
		reopenTicket: vi.fn().mockResolvedValue(makeTicket()),
		deleteTicket: vi.fn().mockResolvedValue(false),
		addMessage: vi.fn().mockResolvedValue(makeMessage()),
		listMessages: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			total: 0,
			open: 0,
			pending: 0,
			inProgress: 0,
			resolved: 0,
			closed: 0,
			byPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: TicketController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { tickets: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listTicketsHandler = extractHandler(listTickets);
const getStatsHandler = extractHandler(getStats);
const listCategoriesHandler = extractHandler(listCategories);
const createCategoryHandler = extractHandler(createCategory);
const updateCategoryHandler = extractHandler(updateCategory);
const deleteCategoryHandler = extractHandler(deleteCategory);
const getTicketHandler = extractHandler(getTicket);
const updateTicketHandler = extractHandler(updateTicket);
const deleteTicketHandler = extractHandler(deleteTicket);
const closeTicketHandler = extractHandler(closeTicket);
const reopenTicketHandler = extractHandler(reopenTicket);
const adminReplyHandler = extractHandler(adminReply);
const listMessagesHandler = extractHandler(listMessages);

// ── listTickets ───────────────────────────────────────────────────────────────

describe("admin GET /tickets", () => {
	it("returns empty list", async () => {
		const result = (await call(listTicketsHandler)) as { tickets: Ticket[] };
		expect(result.tickets).toHaveLength(0);
	});

	it("returns tickets from controller", async () => {
		const tickets = [makeTicket(), makeTicket()];
		const ctrl = makeController({
			listTickets: vi.fn().mockResolvedValue(tickets),
		});
		const result = (await call(listTicketsHandler, {
			controller: ctrl,
		})) as { tickets: Ticket[] };
		expect(result.tickets).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listTicketsHandler, {
			query: { status: "open" },
			controller: ctrl,
		});
		expect(ctrl.listTickets).toHaveBeenCalledWith(
			expect.objectContaining({ status: "open" }),
		);
	});
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe("admin GET /tickets/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as {
			stats: {
				total: number;
				open: number;
				pending: number;
				inProgress: number;
				resolved: number;
				closed: number;
				byPriority: Record<string, number>;
			};
		};
		expect(result.stats.total).toBe(0);
		expect(result.stats.open).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				total: 50,
				open: 12,
				pending: 8,
				inProgress: 5,
				resolved: 20,
				closed: 5,
				byPriority: { low: 10, normal: 25, high: 12, urgent: 3 },
			}),
		});
		const result = (await call(getStatsHandler, { controller: ctrl })) as {
			stats: {
				total: number;
				open: number;
				inProgress: number;
				byPriority: Record<string, number>;
			};
		};
		expect(result.stats.total).toBe(50);
		expect(result.stats.open).toBe(12);
		expect(result.stats.inProgress).toBe(5);
		expect(result.stats.byPriority.urgent).toBe(3);
	});
});

// ── listCategories ────────────────────────────────────────────────────────────

describe("admin GET /tickets/categories", () => {
	it("returns empty list", async () => {
		const result = (await call(listCategoriesHandler)) as {
			categories: TicketCategory[];
		};
		expect(result.categories).toHaveLength(0);
	});

	it("returns categories from controller", async () => {
		const categories = [makeCategory(), makeCategory()];
		const ctrl = makeController({
			listCategories: vi.fn().mockResolvedValue(categories),
		});
		const result = (await call(listCategoriesHandler, {
			controller: ctrl,
		})) as { categories: TicketCategory[] };
		expect(result.categories).toHaveLength(2);
	});
});

// ── createCategory ────────────────────────────────────────────────────────────

describe("admin POST /tickets/categories/create", () => {
	it("creates category and returns it", async () => {
		const category = makeCategory({ name: "Billing", slug: "billing" });
		const ctrl = makeController({
			createCategory: vi.fn().mockResolvedValue(category),
		});
		const result = (await call(createCategoryHandler, {
			body: { name: "Billing", slug: "billing" },
			controller: ctrl,
		})) as { category: TicketCategory };
		expect(result.category.name).toBe("Billing");
		expect(result.category.slug).toBe("billing");
	});
});

// ── updateCategory ────────────────────────────────────────────────────────────

describe("admin PUT /tickets/categories/:id", () => {
	it("updates category and returns it", async () => {
		const category = makeCategory({ name: "Updated", slug: "updated" });
		const ctrl = makeController({
			updateCategory: vi.fn().mockResolvedValue(category),
		});
		const result = (await call(updateCategoryHandler, {
			params: { id: category.id },
			body: { name: "Updated" },
			controller: ctrl,
		})) as { category: TicketCategory };
		expect(result.category.name).toBe("Updated");
	});
});

// ── deleteCategory ────────────────────────────────────────────────────────────

describe("admin DELETE /tickets/categories/:id", () => {
	it("deletes category and returns success", async () => {
		const ctrl = makeController({
			deleteCategory: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteCategoryHandler, {
			params: { id: "cat_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── getTicket ─────────────────────────────────────────────────────────────────

describe("admin GET /tickets/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getTicketHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Ticket not found");
		expect(result.status).toBe(404);
	});

	it("returns ticket and messages when found", async () => {
		const ticket = makeTicket({ id: "ticket_1" });
		const messages = [makeMessage({ ticketId: "ticket_1" })];
		const ctrl = makeController({
			getTicket: vi.fn().mockResolvedValue(ticket),
			listMessages: vi.fn().mockResolvedValue(messages),
		});
		const result = (await call(getTicketHandler, {
			params: { id: "ticket_1" },
			controller: ctrl,
		})) as { ticket: Ticket; messages: TicketMessage[] };
		expect(result.ticket.id).toBe("ticket_1");
		expect(result.messages).toHaveLength(1);
	});
});

// ── updateTicket ──────────────────────────────────────────────────────────────

describe("admin PUT /tickets/:id", () => {
	it("updates ticket and returns it", async () => {
		const ticket = makeTicket({ priority: "high" });
		const ctrl = makeController({
			updateTicket: vi.fn().mockResolvedValue(ticket),
		});
		const result = (await call(updateTicketHandler, {
			params: { id: ticket.id },
			body: { priority: "high" },
			controller: ctrl,
		})) as { ticket: Ticket };
		expect(result.ticket.priority).toBe("high");
	});
});

// ── deleteTicket ──────────────────────────────────────────────────────────────

describe("admin POST /tickets/:id/delete", () => {
	it("returns error without status when ticket not found", async () => {
		const result = (await call(deleteTicketHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Ticket not found");
		expect((result as Record<string, unknown>).status).toBeUndefined();
	});

	it("deletes ticket and returns success", async () => {
		const ctrl = makeController({
			deleteTicket: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteTicketHandler, {
			params: { id: "ticket_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── closeTicket ───────────────────────────────────────────────────────────────

describe("admin POST /tickets/:id/close", () => {
	it("closes ticket and returns it", async () => {
		const ticket = makeTicket({ status: "closed" });
		const ctrl = makeController({
			closeTicket: vi.fn().mockResolvedValue(ticket),
		});
		const result = (await call(closeTicketHandler, {
			params: { id: ticket.id },
			controller: ctrl,
		})) as { ticket: Ticket };
		expect(result.ticket.status).toBe("closed");
		expect(ctrl.closeTicket).toHaveBeenCalledWith(ticket.id);
	});
});

// ── reopenTicket ──────────────────────────────────────────────────────────────

describe("admin POST /tickets/:id/reopen", () => {
	it("reopens ticket and returns it", async () => {
		const ticket = makeTicket({ status: "open" });
		const ctrl = makeController({
			reopenTicket: vi.fn().mockResolvedValue(ticket),
		});
		const result = (await call(reopenTicketHandler, {
			params: { id: ticket.id },
			controller: ctrl,
		})) as { ticket: Ticket };
		expect(result.ticket.status).toBe("open");
		expect(ctrl.reopenTicket).toHaveBeenCalledWith(ticket.id);
	});
});

// ── adminReply ────────────────────────────────────────────────────────────────

describe("admin POST /tickets/:id/reply", () => {
	it("returns 404 when ticket not found", async () => {
		const result = (await call(adminReplyHandler, {
			params: { id: "missing" },
			body: { body: "Hello!", authorName: "Support" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Ticket not found");
		expect(result.status).toBe(404);
	});

	it("adds admin reply and returns message", async () => {
		const ticket = makeTicket({ id: "ticket_1" });
		const message = makeMessage({
			ticketId: "ticket_1",
			body: "Hello!",
			authorType: "admin",
			authorName: "Support",
		});
		const ctrl = makeController({
			getTicket: vi.fn().mockResolvedValue(ticket),
			addMessage: vi.fn().mockResolvedValue(message),
		});
		const result = (await call(adminReplyHandler, {
			params: { id: "ticket_1" },
			body: { body: "Hello!", authorName: "Support" },
			controller: ctrl,
		})) as { message: TicketMessage };
		expect(result.message.body).toBe("Hello!");
		expect(result.message.authorType).toBe("admin");
	});

	it("supports internal notes", async () => {
		const ticket = makeTicket({ id: "ticket_1" });
		const message = makeMessage({ isInternal: true });
		const ctrl = makeController({
			getTicket: vi.fn().mockResolvedValue(ticket),
			addMessage: vi.fn().mockResolvedValue(message),
		});
		const result = (await call(adminReplyHandler, {
			params: { id: "ticket_1" },
			body: { body: "Internal note", authorName: "Support", isInternal: true },
			controller: ctrl,
		})) as { message: TicketMessage };
		expect(result.message.isInternal).toBe(true);
	});
});

// ── listMessages ──────────────────────────────────────────────────────────────

describe("admin GET /tickets/:id/messages", () => {
	it("returns empty list when no messages", async () => {
		const result = (await call(listMessagesHandler, {
			params: { id: "ticket_1" },
		})) as { messages: TicketMessage[] };
		expect(result.messages).toHaveLength(0);
	});

	it("returns messages for ticket", async () => {
		const messages = [makeMessage(), makeMessage()];
		const ctrl = makeController({
			listMessages: vi.fn().mockResolvedValue(messages),
		});
		const result = (await call(listMessagesHandler, {
			params: { id: "ticket_1" },
			controller: ctrl,
		})) as { messages: TicketMessage[] };
		expect(result.messages).toHaveLength(2);
		expect(ctrl.listMessages).toHaveBeenCalledWith(
			"ticket_1",
			expect.anything(),
		);
	});
});
