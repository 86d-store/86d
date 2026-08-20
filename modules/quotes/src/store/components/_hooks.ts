"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useQuotesApi() {
	const client = useModuleClient();
	return {
		createQuote: client.module("quotes").store["/quotes/create"],
		myQuotes: client.module("quotes").store["/quotes/my"],
		getQuote: client.module("quotes").store["/quotes/:id"],
		addItem: client.module("quotes").store["/quotes/:id/items/add"],
		updateItem: client.module("quotes").store["/quotes/:id/items/update"],
		removeItem: client.module("quotes").store["/quotes/:id/items/remove"],
		submitQuote: client.module("quotes").store["/quotes/:id/submit"],
		acceptQuote: client.module("quotes").store["/quotes/:id/accept"],
		declineQuote: client.module("quotes").store["/quotes/:id/decline"],
		addComment: client.module("quotes").store["/quotes/:id/comments/add"],
	};
}
