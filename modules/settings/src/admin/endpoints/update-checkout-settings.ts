import { createAdminEndpoint } from "@86d-store/core/api";
import { z } from "zod";
import {
	FULFILLMENT_METHOD_VALUES,
	SETTING_KEYS,
	type SettingsController,
} from "../../service";

const fulfillmentMethodEnum = z.enum(FULFILLMENT_METHOD_VALUES);

const updateCheckoutSettingsSchema = z
	.object({
		fulfillmentMethodsOffered: z
			.array(fulfillmentMethodEnum)
			.min(1)
			.max(2)
			.optional(),
		defaultFulfillmentType: fulfillmentMethodEnum.optional(),
		sessionTtlMinutes: z.number().int().min(5).max(1440).optional(),
		defaultCurrency: z.string().length(3).toUpperCase().optional(),
	})
	.refine(
		(data) => {
			if (
				data.defaultFulfillmentType !== undefined &&
				data.fulfillmentMethodsOffered !== undefined
			) {
				return data.fulfillmentMethodsOffered.includes(
					data.defaultFulfillmentType,
				);
			}
			return true;
		},
		{
			message:
				"defaultFulfillmentType must be one of the fulfillmentMethodsOffered",
			path: ["defaultFulfillmentType"],
		},
	);

export const updateCheckoutSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/checkout",
	{
		method: "POST",
		body: updateCheckoutSettingsSchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const updates = ctx.body;

		const settingsToUpdate: Array<{
			key: string;
			value: string;
			group: "checkout";
		}> = [];

		if (updates.fulfillmentMethodsOffered !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.fulfillmentMethodsOffered,
				value: JSON.stringify(updates.fulfillmentMethodsOffered),
				group: "checkout",
			});
		}

		if (updates.defaultFulfillmentType !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.defaultFulfillmentType,
				value: updates.defaultFulfillmentType,
				group: "checkout",
			});
		}

		if (updates.sessionTtlMinutes !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.checkoutSessionTtlMinutes,
				value: String(updates.sessionTtlMinutes),
				group: "checkout",
			});
		}

		if (updates.defaultCurrency !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.defaultCurrency,
				value: updates.defaultCurrency,
				group: "checkout",
			});
		}

		if (settingsToUpdate.length > 0) {
			await controller.setBulk(settingsToUpdate);
		}

		return { success: true, updated: settingsToUpdate.length };
	},
);
