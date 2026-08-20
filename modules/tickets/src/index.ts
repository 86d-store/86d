import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { ticketsStorage } from "./schema";
import { createTicketControllers } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	MessageAuthorType,
	Ticket,
	TicketCategory,
	TicketController,
	TicketMessage,
	TicketPriority,
	TicketStatus,
} from "./service";

export interface TicketsOptions extends ModuleConfig {
	/**
	 * Whether customers can reopen closed tickets via the store
	 * @default false
	 */
	allowCustomerReopen?: boolean;

	/**
	 * Auto-close resolved tickets after this many days (0 = disabled)
	 * @default 7
	 */
	autoCloseDays?: number;
}

/**
 * Tickets module factory function
 * Creates a customer support ticket system with threaded messages
 */
export default function tickets(options?: TicketsOptions): Module {
	return {
		id: "tickets",
		version: "1.0.0",
		storage: ticketsStorage,
		exports: {
			read: ["tickets", "ticketCategories", "ticketMessages"],
		},
		events: {
			emits: [
				"ticket.created",
				"ticket.updated",
				"ticket.closed",
				"ticket.reopened",
				"ticket.message.added",
			],
		},

		init: async (ctx: ModuleContext) => {
			const ticketController = createTicketControllers(ctx.data);

			return {
				controllers: { tickets: ticketController },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/tickets",
					component: "TicketList",
					label: "Tickets",
					icon: "Ticket",
					group: "Support",
				},
				{
					path: "/admin/tickets/categories",
					component: "TicketCategories",
					label: "Categories",
					icon: "FolderSimple",
					group: "Support",
				},
				{
					path: "/admin/tickets/:id",
					component: "TicketDetail",
				},
				{
					path: "/admin/tickets/categories/:id",
					component: "TicketCategoryDetail",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/support/tickets",
					component: "MyTickets",
				},
				{
					path: "/support/tickets/new",
					component: "TicketForm",
				},
				{
					path: "/support/tickets/:id",
					component: "TicketDetail",
				},
			],
		},
		options,
	};
}
