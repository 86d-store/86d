import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuctionController } from "../../service";

export const deleteAuction = createAdminEndpoint(
	"/admin/auctions/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const deleted = await controller.deleteAuction(ctx.params.id);
		if (!deleted) {
			return { error: "Auction not found", status: 404 };
		}
		return { deleted };
	},
);
