"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useReviewsApi() {
	const client = useModuleClient();
	return {
		submitReview: client.module("reviews").store["/reviews"],
		listMyReviews: client.module("reviews").store["/reviews/me"],
		listProductReviews:
			client.module("reviews").store["/reviews/products/:productId"],
		markHelpful: client.module("reviews").store["/reviews/:id/helpful"],
	};
}
