"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFaqApi() {
	const client = useModuleClient();
	return {
		listCategories: client.module("faq").store["/faq/categories"],
		getCategory: client.module("faq").store["/faq/categories/:slug"],
		getItem: client.module("faq").store["/faq/items/:slug"],
		search: client.module("faq").store["/faq/search"],
		vote: client.module("faq").store["/faq/items/:id/vote"],
	};
}
