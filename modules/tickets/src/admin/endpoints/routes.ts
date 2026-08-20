import { adminReply } from "./admin-reply";
import { closeTicket } from "./close-ticket";
import { createCategory } from "./create-category";
import { deleteCategory } from "./delete-category";
import { deleteTicket } from "./delete-ticket";
import { getTicket } from "./get-ticket";
import { listCategories } from "./list-categories";
import { listMessages } from "./list-messages";
import { listTickets } from "./list-tickets";
import { reopenTicket } from "./reopen-ticket";
import { getStats } from "./stats";
import { updateCategory } from "./update-category";
import { updateTicket } from "./update-ticket";

export const adminEndpoints = {
	"/admin/tickets": listTickets,
	"/admin/tickets/stats": getStats,
	"/admin/tickets/categories": listCategories,
	"/admin/tickets/categories/create": createCategory,
	"/admin/tickets/categories/:id": updateCategory,
	"/admin/tickets/categories/:id/delete": deleteCategory,
	"/admin/tickets/:id": getTicket,
	"/admin/tickets/:id/update": updateTicket,
	"/admin/tickets/:id/delete": deleteTicket,
	"/admin/tickets/:id/close": closeTicket,
	"/admin/tickets/:id/reopen": reopenTicket,
	"/admin/tickets/:id/reply": adminReply,
	"/admin/tickets/:id/messages": listMessages,
};
