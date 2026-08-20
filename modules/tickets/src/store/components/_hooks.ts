"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useTicketsApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("tickets").store["/tickets/categories"],
		submitTicket: client.module("tickets").store["/tickets/submit"],
		myTickets: client.module("tickets").store["/tickets/mine"],
		getTicket: client.module("tickets").store["/tickets/:id"],
		reply: client.module("tickets").store["/tickets/:id/reply"],
	};
}
