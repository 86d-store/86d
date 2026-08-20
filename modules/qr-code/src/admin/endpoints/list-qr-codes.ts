import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QrCodeController, QrCodeTargetType } from "../../service";

export const listQrCodesEndpoint = createAdminEndpoint(
	"/admin/qr-codes",
	{
		method: "GET",
		query: z.object({
			targetType: z
				.enum(["product", "collection", "page", "order", "custom"])
				.optional(),
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.list({
			targetType: ctx.query.targetType as QrCodeTargetType | undefined,
			isActive: ctx.query.isActive,
		});
		const total = all.length;
		const qrCodes = all.slice(skip, skip + limit);
		return { qrCodes, total };
	},
);
