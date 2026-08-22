import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { XShopController } from "../../service";

export const updateListingEndpoint = createAdminEndpoint(
	"/admin/x-shop/listings/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
		body: z.object({
			localProductId: z
				.string()
				.min(1)
				.max(200)
				.transform(sanitizeText)
				.optional(),
			externalProductId: z.string().max(200).transform(sanitizeText).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			status: z
				.enum(["draft", "pending", "active", "rejected", "suspended"])
				.optional(),
			syncStatus: z
				.enum(["pending", "synced", "failed", "outdated"])
				.optional(),
			error: z.string().max(1000).transform(sanitizeText).optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const listing = await controller.updateListing(ctx.params.id, {
			localProductId: ctx.body.localProductId,
			externalProductId: ctx.body.externalProductId,
			title: ctx.body.title,
			status: ctx.body.status,
			syncStatus: ctx.body.syncStatus,
			error: ctx.body.error,
			metadata: ctx.body.metadata,
		});
		if (!listing) {
			return { error: "Listing not found" };
		}
		return { listing };
	},
);
