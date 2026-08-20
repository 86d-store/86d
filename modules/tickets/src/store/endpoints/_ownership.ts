import { sanitizeText } from "@86d-app/core/sanitize";
import type { Ticket } from "../../service";

type SessionUser = {
	email: string;
	id?: string | undefined;
	name?: string | null | undefined;
};

export function isTicketOwnedByUser(
	ticket: Pick<Ticket, "customerEmail" | "customerId">,
	user: SessionUser,
): boolean {
	if (ticket.customerId) {
		return ticket.customerId === user.id;
	}

	return ticket.customerEmail === user.email;
}

export function getAuthenticatedTicketCustomer(user: SessionUser): {
	customerEmail: string;
	customerId?: string | undefined;
	customerName: string;
} {
	return {
		customerEmail: user.email,
		customerId: user.id,
		customerName: sanitizeText(user.name ?? user.email),
	};
}
