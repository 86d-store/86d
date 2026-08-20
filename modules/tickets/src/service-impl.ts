import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Ticket,
	TicketCategory,
	TicketController,
	TicketMessage,
	TicketPriority,
} from "./service";

export function createTicketControllers(
	data: ModuleDataService,
): TicketController {
	/** Generate a sequential ticket number */
	async function nextTicketNumber(): Promise<number> {
		const all = (await data.findMany("ticket", {})) as Ticket[];
		if (all.length === 0) return 1001;
		const max = Math.max(...all.map((t) => t.number));
		return max + 1;
	}

	return {
		async createCategory(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const category: TicketCategory = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description ?? undefined,
				position: params.position ?? 0,
				isActive: true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"ticketCategory",
				id,
				category as Record<string, unknown>,
			);

			return category;
		},

		async getCategory(id: string) {
			return (await data.get("ticketCategory", id)) as TicketCategory | null;
		},

		async listCategories(opts = {}) {
			const { activeOnly = false } = opts;

			const where: Record<string, unknown> = {};
			if (activeOnly) where.isActive = true;

			const categories = (await data.findMany("ticketCategory", {
				where,
			})) as TicketCategory[];

			return categories.sort((a, b) => a.position - b.position);
		},

		async updateCategory(id, updateData) {
			const existing = (await data.get(
				"ticketCategory",
				id,
			)) as TicketCategory | null;
			if (!existing) {
				throw new Error(`Ticket category ${id} not found`);
			}

			const updated: TicketCategory = {
				...existing,
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.description !== undefined && {
					description: updateData.description,
				}),
				...(updateData.position !== undefined && {
					position: updateData.position,
				}),
				...(updateData.isActive !== undefined && {
					isActive: updateData.isActive,
				}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"ticketCategory",
				id,
				updated as Record<string, unknown>,
			);

			return updated;
		},

		async deleteCategory(id: string) {
			await data.delete("ticketCategory", id);
		},

		async createTicket(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const number = await nextTicketNumber();

			const ticket: Ticket = {
				id,
				number,
				categoryId: params.categoryId ?? undefined,
				subject: params.subject,
				description: params.description,
				status: "open",
				priority: params.priority ?? "normal",
				customerEmail: params.customerEmail,
				customerName: params.customerName,
				customerId: params.customerId ?? undefined,
				orderId: params.orderId ?? undefined,
				tags: params.tags ?? [],
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("ticket", id, ticket as Record<string, unknown>);

			return ticket;
		},

		async getTicket(id: string) {
			return (await data.get("ticket", id)) as Ticket | null;
		},

		async getTicketByNumber(num: number) {
			const tickets = (await data.findMany("ticket", {
				where: { number: num },
			})) as Ticket[];

			return tickets[0] ?? null;
		},

		async listTickets(opts = {}) {
			const {
				status,
				priority,
				categoryId,
				assigneeId,
				customerEmail,
				customerId,
			} = opts;

			const where: Record<string, unknown> = {};
			if (status) where.status = status;
			if (priority) where.priority = priority;
			if (categoryId) where.categoryId = categoryId;
			if (assigneeId) where.assigneeId = assigneeId;
			if (customerEmail) where.customerEmail = customerEmail;
			if (customerId) where.customerId = customerId;

			const tickets = (await data.findMany("ticket", {
				where,
			})) as Ticket[];

			return tickets.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			);
		},

		async updateTicket(id, updateData) {
			const existing = (await data.get("ticket", id)) as Ticket | null;
			if (!existing) {
				throw new Error(`Ticket ${id} not found`);
			}

			const updated: Ticket = {
				...existing,
				...(updateData.subject !== undefined && {
					subject: updateData.subject,
				}),
				...(updateData.categoryId !== undefined && {
					categoryId: updateData.categoryId,
				}),
				...(updateData.status !== undefined && {
					status: updateData.status,
				}),
				...(updateData.priority !== undefined && {
					priority: updateData.priority,
				}),
				...(updateData.assigneeId !== undefined && {
					assigneeId: updateData.assigneeId,
				}),
				...(updateData.assigneeName !== undefined && {
					assigneeName: updateData.assigneeName,
				}),
				...(updateData.tags !== undefined && { tags: updateData.tags }),
				updatedAt: new Date(),
			};

			// If status changed to closed/resolved, set closedAt
			if (updateData.status === "closed" || updateData.status === "resolved") {
				updated.closedAt = new Date();
			}

			await data.upsert("ticket", id, updated as Record<string, unknown>);

			return updated;
		},

		async closeTicket(id: string) {
			const existing = (await data.get("ticket", id)) as Ticket | null;
			if (!existing) {
				throw new Error(`Ticket ${id} not found`);
			}

			const now = new Date();
			const updated: Ticket = {
				...existing,
				status: "closed",
				closedAt: now,
				updatedAt: now,
			};

			await data.upsert("ticket", id, updated as Record<string, unknown>);

			return updated;
		},

		async reopenTicket(id: string) {
			const existing = (await data.get("ticket", id)) as Ticket | null;
			if (!existing) {
				throw new Error(`Ticket ${id} not found`);
			}

			if (existing.status !== "closed" && existing.status !== "resolved") {
				throw new Error(`Ticket ${id} is not closed or resolved`);
			}

			const updated: Ticket = {
				...existing,
				status: "open",
				closedAt: undefined,
				updatedAt: new Date(),
			};

			await data.upsert("ticket", id, updated as Record<string, unknown>);

			return updated;
		},

		async deleteTicket(id: string) {
			const existing = (await data.get("ticket", id)) as Ticket | null;
			if (!existing) return false;
			await data.delete("ticket", id);
			return true;
		},

		async addMessage(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const message: TicketMessage = {
				id,
				ticketId: params.ticketId,
				body: params.body,
				authorType: params.authorType,
				authorId: params.authorId ?? undefined,
				authorName: params.authorName,
				authorEmail: params.authorEmail ?? undefined,
				isInternal: params.isInternal ?? false,
				metadata: {},
				createdAt: now,
			};

			await data.upsert(
				"ticketMessage",
				id,
				message as Record<string, unknown>,
			);

			// Update ticket's updatedAt and set to pending if customer replied
			const ticket = (await data.get(
				"ticket",
				params.ticketId,
			)) as Ticket | null;
			if (ticket) {
				const statusUpdate: Partial<Ticket> = { updatedAt: now };
				if (params.authorType === "customer" && ticket.status !== "open") {
					statusUpdate.status = "pending";
				}
				if (params.authorType === "admin" && ticket.status === "open") {
					statusUpdate.status = "in-progress";
				}

				const updatedTicket: Ticket = {
					...ticket,
					...statusUpdate,
				};

				await data.upsert(
					"ticket",
					ticket.id,
					updatedTicket as Record<string, unknown>,
				);
			}

			return message;
		},

		async listMessages(ticketId, opts = {}) {
			const { includeInternal = false } = opts;

			const where: Record<string, unknown> = { ticketId };
			if (!includeInternal) where.isInternal = false;

			const messages = (await data.findMany("ticketMessage", {
				where,
			})) as TicketMessage[];

			return messages.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
		},

		async getStats() {
			const tickets = (await data.findMany("ticket", {})) as Ticket[];

			const byPriority: Record<TicketPriority, number> = {
				low: 0,
				normal: 0,
				high: 0,
				urgent: 0,
			};

			let open = 0;
			let pending = 0;
			let inProgress = 0;
			let resolved = 0;
			let closed = 0;

			for (const t of tickets) {
				byPriority[t.priority]++;
				switch (t.status) {
					case "open":
						open++;
						break;
					case "pending":
						pending++;
						break;
					case "in-progress":
						inProgress++;
						break;
					case "resolved":
						resolved++;
						break;
					case "closed":
						closed++;
						break;
				}
			}

			return {
				total: tickets.length,
				open,
				pending,
				inProgress,
				resolved,
				closed,
				byPriority,
			};
		},
	};
}
