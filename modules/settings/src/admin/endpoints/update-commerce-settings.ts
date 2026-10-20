import { createAdminEndpoint } from "@86d-store/core/api";
import { sanitizeText } from "@86d-store/core/sanitize";
import { z } from "zod";
import {
	SETTING_KEYS,
	type SettingsController,
	STORE_STATUS_VALUES,
} from "../../service";

const updateCommerceSettingsSchema = z.object({
	storeStatus: z.enum(STORE_STATUS_VALUES).optional(),
	comingSoonMessage: z
		.string()
		.max(500)
		.transform(sanitizeText)
		.optional()
		.nullable(),
	pausedMessage: z
		.string()
		.max(500)
		.transform(sanitizeText)
		.optional()
		.nullable(),
});

export const updateCommerceSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/commerce",
	{
		method: "POST",
		body: updateCommerceSettingsSchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const updates = ctx.body;

		const settingsToUpdate: Array<{
			key: string;
			value: string;
			group: "commerce";
		}> = [];

		if (updates.storeStatus !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.storeStatus,
				value: updates.storeStatus,
				group: "commerce",
			});
		}

		if (updates.comingSoonMessage !== undefined) {
			if (updates.comingSoonMessage === null) {
				await controller.delete(SETTING_KEYS.comingSoonMessage);
			} else {
				settingsToUpdate.push({
					key: SETTING_KEYS.comingSoonMessage,
					value: updates.comingSoonMessage,
					group: "commerce",
				});
			}
		}

		if (updates.pausedMessage !== undefined) {
			if (updates.pausedMessage === null) {
				await controller.delete(SETTING_KEYS.pausedMessage);
			} else {
				settingsToUpdate.push({
					key: SETTING_KEYS.pausedMessage,
					value: updates.pausedMessage,
					group: "commerce",
				});
			}
		}

		if (settingsToUpdate.length > 0) {
			await controller.setBulk(settingsToUpdate);
		}

		return { success: true, updated: settingsToUpdate.length };
	},
);
