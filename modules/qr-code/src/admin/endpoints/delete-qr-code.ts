import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QrCodeController } from "../../service";

export const deleteQrCodeEndpoint = createAdminEndpoint(
	"/admin/qr-codes/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const deleted = await controller.delete(ctx.params.id);
		return { deleted };
	},
);
