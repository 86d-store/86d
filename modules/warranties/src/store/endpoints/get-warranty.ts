import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const getWarranty = createStoreEndpoint(
	"/warranties/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.warranties as WarrantyController;
		const registration = await controller.getRegistration(ctx.params.id);

		if (!registration) {
			return { error: "Warranty not found", status: 404 };
		}
		if (registration.customerId !== userId) {
			return { error: "Warranty not found", status: 404 };
		}

		return { registration };
	},
);
