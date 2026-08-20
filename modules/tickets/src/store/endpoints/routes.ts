import { customerReply } from "./customer-reply";
import { customerTickets } from "./customer-tickets";
import { getTicket } from "./get-ticket";
import { listCategories } from "./list-categories";
import { submitTicket } from "./submit-ticket";

export const storeEndpoints = {
	"/tickets/categories": listCategories,
	"/tickets/submit": submitTicket,
	"/tickets/mine": customerTickets,
	"/tickets/:id": getTicket,
	"/tickets/:id/reply": customerReply,
};
