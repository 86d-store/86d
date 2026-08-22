import { createStoreEndpoint } from "@86d-app/core/api";
import { orderPurchaseVerifyCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ReviewController } from "../../service";

const imageSchema = z.object({
	url: z.string().url().max(2000),
	caption: z.string().max(500).transform(sanitizeText).optional(),
});

export const submitReview = createStoreEndpoint(
	"/reviews",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			authorName: z.string().max(200).transform(sanitizeText),
			authorEmail: z.string().email().max(320),
			rating: z.number().int().min(1).max(5),
			title: z.string().max(500).transform(sanitizeText).optional(),
			body: z.string().max(10000).transform(sanitizeText),
			images: z.array(imageSchema).max(5).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const customerId = ctx.context.session?.user.id;

		// Prevent duplicate reviews from authenticated customers
		if (customerId) {
			const alreadyReviewed = await controller.hasReviewedProduct(
				customerId,
				ctx.body.productId,
			);
			if (alreadyReviewed) {
				return {
					error: "You have already reviewed this product",
					status: 409,
				};
			}
		}

		// Authenticated users must use session email — never fall back to body
		const authorEmail = ctx.context.session
			? ctx.context.session.user.email
			: ctx.body.authorEmail;

		// Check if this customer has purchased the product to mark as verified.
		// Best-effort: if orders module is not installed, isVerifiedPurchase stays false.
		let isVerifiedPurchase = false;
		if (customerId) {
			try {
				const verification = await ctx.context.capabilities.invoke(
					orderPurchaseVerifyCapability,
					{ customerId, productId: ctx.body.productId },
				);
				if (verification.ok) {
					isVerifiedPurchase = verification.decision.verified;
				}
			} catch {
				// Best-effort: verification failure does not block the review
			}
		}

		const review = await controller.createReview({
			productId: ctx.body.productId,
			authorName: ctx.body.authorName,
			authorEmail,
			rating: ctx.body.rating,
			title: ctx.body.title,
			body: ctx.body.body,
			customerId,
			isVerifiedPurchase,
			images: ctx.body.images,
		});
		void ctx.context.events?.emit("review.submitted", {
			reviewId: review.id,
			productId: review.productId,
			customerId: review.customerId,
			authorEmail: review.authorEmail,
			rating: review.rating,
		});
		return { review };
	},
);
