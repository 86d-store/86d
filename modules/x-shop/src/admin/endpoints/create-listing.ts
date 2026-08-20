import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const createListingEndpoint = createAdminEndpoint(
	"/admin/x-shop/listings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200).transform(sanitizeText),
			externalProductId: z.string().max(200).transform(sanitizeText).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText),
			status: z
				.enum(["draft", "pending", "active", "rejected", "suspended"])
				.optional(),
			syncStatus: z
				.enum(["pending", "synced", "failed", "outdated"])
				.optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const listing = await controller.createListing({
			localProductId: ctx.body.localProductId,
			externalProductId: ctx.body.externalProductId,
			title: ctx.body.title,
			status: ctx.body.status,
			syncStatus: ctx.body.syncStatus,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
