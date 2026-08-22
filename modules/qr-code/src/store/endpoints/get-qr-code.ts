import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QrCodeController } from "../../service";

export const getQrCodeEndpoint = createStoreEndpoint(
	"/qr-codes/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const qrCode = await controller.get(ctx.params.id);
		if (!qrCode?.isActive) return { qrCode: null };
		return { qrCode };
	},
);
