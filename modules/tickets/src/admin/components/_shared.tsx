"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useTicketsApi() {
	const client = useModuleClient();
	return {
		listTickets: client.module("tickets").admin["/admin/tickets"],
		getTicket: client.module("tickets").admin["/admin/tickets/:id"],
		updateTicket: client.module("tickets").admin["/admin/tickets/:id/update"],
		closeTicket: client.module("tickets").admin["/admin/tickets/:id/close"],
		reopenTicket: client.module("tickets").admin["/admin/tickets/:id/reopen"],
		deleteTicket: client.module("tickets").admin["/admin/tickets/:id/delete"],
		adminReply: client.module("tickets").admin["/admin/tickets/:id/reply"],
		listMessages: client.module("tickets").admin["/admin/tickets/:id/messages"],
		stats: client.module("tickets").admin["/admin/tickets/stats"],
		listCategories: client.module("tickets").admin["/admin/tickets/categories"],
		createCategory:
			client.module("tickets").admin["/admin/tickets/categories/create"],
		updateCategory:
			client.module("tickets").admin["/admin/tickets/categories/:id"],
		deleteCategory:
			client.module("tickets").admin["/admin/tickets/categories/:id/delete"],
	};
}

export interface Ticket {
	id: string;
	number: number;
	categoryId?: string;
	subject: string;
	description: string;
	status: string;
	priority: string;
	customerEmail: string;
	customerName: string;
	customerId?: string;
	orderId?: string;
	assigneeId?: string;
	assigneeName?: string;
	tags?: string[];
	closedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export const STATUS_COLORS: Record<string, string> = {
	open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	"in-progress":
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	resolved:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	closed: "bg-muted text-muted-foreground",
};

export const STATUS_LABELS: Record<string, string> = {
	open: "Open",
	pending: "Pending",
	"in-progress": "In Progress",
	resolved: "Resolved",
	closed: "Closed",
};

export const PRIORITY_COLORS: Record<string, string> = {
	low: "bg-muted text-muted-foreground",
	normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
	urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const PRIORITY_LABELS: Record<string, string> = {
	low: "Low",
	normal: "Normal",
	high: "High",
	urgent: "Urgent",
};

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export interface TicketCategory {
	id: string;
	name: string;
	slug: string;
	description?: string;
	position: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
