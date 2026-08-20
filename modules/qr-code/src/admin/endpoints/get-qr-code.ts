import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QrCodeController } from "../../service";

export const getQrCodeEndpoint = createAdminEndpoint(
	"/admin/qr-codes/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const qrCode = await controller.get(ctx.params.id);
		return { qrCode };
	},
);
