"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useProductQaApi() {
	const client = useModuleClient();
	return {
		submitQuestion: client.module("product-qa").store["/product-qa/questions"],
		listProductQuestions:
			client.module("product-qa").store[
				"/product-qa/products/:productId/questions"
			],
		productQaSummary:
			client.module("product-qa").store[
				"/product-qa/products/:productId/summary"
			],
		submitAnswer:
			client.module("product-qa").store[
				"/product-qa/questions/:questionId/answer"
			],
		listAnswers:
			client.module("product-qa").store[
				"/product-qa/questions/:questionId/answers"
			],
		upvoteQuestion:
			client.module("product-qa").store["/product-qa/questions/:id/upvote"],
		upvoteAnswer:
			client.module("product-qa").store["/product-qa/answers/:id/upvote"],
	};
}
