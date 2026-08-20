"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFaqApi() {
	const client = useModuleClient();
	return {
		listItems: client.module("faq").admin["/admin/faq/items"],
		createItem: client.module("faq").admin["/admin/faq/items/create"],
		getItem: client.module("faq").admin["/admin/faq/items/:id"],
		updateItem: client.module("faq").admin["/admin/faq/items/:id"],
		deleteItem: client.module("faq").admin["/admin/faq/items/:id/delete"],
		listCategories: client.module("faq").admin["/admin/faq/categories"],
		createCategory: client.module("faq").admin["/admin/faq/categories/create"],
		updateCategory: client.module("faq").admin["/admin/faq/categories/:id"],
		deleteCategory:
			client.module("faq").admin["/admin/faq/categories/:id/delete"],
		stats: client.module("faq").admin["/admin/faq/stats"],
	};
}

export interface FaqItem {
	id: string;
	categoryId: string;
	question: string;
	answer: string;
	slug: string;
	position: number;
	isVisible: boolean;
	tags?: string[];
	helpfulCount: number;
	notHelpfulCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface FaqCategory {
	id: string;
	name: string;
	slug: string;
	description?: string;
	icon?: string;
	position: number;
	isVisible: boolean;
	createdAt: string;
	updatedAt: string;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}
