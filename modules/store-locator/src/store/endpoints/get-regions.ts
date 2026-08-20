import { createStoreEndpoint } from "@86d-app/core/api";
import type { StoreLocatorController } from "../../service";

export const getRegions = createStoreEndpoint(
	"/locations/regions",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const regions = await controller.listRegions();
		const countries = await controller.listCountries();

		return { regions, countries };
	},
);
