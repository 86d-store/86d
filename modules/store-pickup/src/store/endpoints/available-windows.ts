import { createStoreEndpoint } from "@86d-store/core/api";
import { z } from "zod";
import { readPickupSettings } from "../../pickup-settings";
import type { StorePickupController } from "../../service";

export const availableWindows = createStoreEndpoint(
	"/store-pickup/locations/:locationId/windows",
	{
		method: "GET",
		params: z.object({
			locationId: z.string().min(1).max(100),
		}),
		query: z.object({
			date: z
				.string()
				.max(10)
				.regex(/^\d{4}-\d{2}-\d{2}$/),
		}),
	},
	async (ctx) => {
		const settingsController = ctx.context.controllers.settings as
			| { getValue(key: string): Promise<string | null> }
			| undefined;
		const settings = await readPickupSettings(settingsController);

		if (!settings?.timezone) {
			return {
				error: "Store timezone is not configured",
				status: 503,
			};
		}

		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const windows = await controller.getAvailableWindowsWithTimezone(
			{
				locationId: ctx.params.locationId,
				date: ctx.query.date,
			},
			settings.timezone,
		);
		return { windows };
	},
);
