import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderNotesController } from "../../service";

export const listAllNotes = createAdminEndpoint(
	"/admin/order-notes",
	{
		method: "GET",
		query: z.object({
			orderId: z.string().max(200).optional(),
			authorType: z.enum(["customer", "admin", "system"]).optional(),
			isInternal: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			take: z.coerce.number().min(1).max(100).optional(),
			skip: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;
		return controller.listAll({
			orderId: ctx.query.orderId,
			authorType: ctx.query.authorType,
			isInternal: ctx.query.isInternal,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
	},
);
