import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QrCodeController } from "../../service";

export const createBatchEndpoint = createAdminEndpoint(
	"/admin/qr-codes/batch",
	{
		method: "POST",
		body: z.object({
			items: z
				.array(
					z.object({
						label: z.string().min(1).max(200),
						targetUrl: z.string().url().max(2000),
						targetType: z
							.enum(["product", "collection", "page", "order", "custom"])
							.optional(),
						targetId: z.string().max(200).optional(),
						format: z.enum(["svg", "png"]).optional(),
						size: z.number().int().min(32).max(4096).optional(),
						errorCorrection: z.enum(["L", "M", "Q", "H"]).optional(),
						metadata: z.record(z.string().max(100), z.unknown()).optional(),
					}),
				)
				.min(1)
				.max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const qrCodes = await controller.createBatch(ctx.body.items);
		return { qrCodes, count: qrCodes.length };
	},
);
