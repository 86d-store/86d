"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useProductQaApi() {
	const client = useModuleClient();
	const mod = client.module("product-qa");
	return {
		list: mod.admin["/admin/product-qa/questions"],
		analytics: mod.admin["/admin/product-qa/analytics"],
		getQuestion: mod.admin["/admin/product-qa/questions/:id"],
		publishQuestion: mod.admin["/admin/product-qa/questions/:id/publish"],
		rejectQuestion: mod.admin["/admin/product-qa/questions/:id/reject"],
		deleteQuestion: mod.admin["/admin/product-qa/questions/:id/delete"],
		postAnswer: mod.admin["/admin/product-qa/questions/:id/answer"],
		publishAnswer: mod.admin["/admin/product-qa/answers/:id/publish"],
		rejectAnswer: mod.admin["/admin/product-qa/answers/:id/reject"],
		deleteAnswer: mod.admin["/admin/product-qa/answers/:id/delete"],
	};
}

export interface Question {
	id: string;
	productId: string;
	customerId?: string;
	authorName: string;
	authorEmail: string;
	body: string;
	status: "pending" | "published" | "rejected";
	upvoteCount: number;
	answerCount: number;
	createdAt: string;
	updatedAt: string;
}

export const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	published:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};
