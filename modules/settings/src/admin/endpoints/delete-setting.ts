import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SettingsController } from "../../service";

export const deleteSettingEndpoint = createAdminEndpoint(
	"/admin/settings/:key/delete",
	{
		method: "POST",
		params: z.object({ key: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const deleted = await controller.delete(ctx.params.key);
		if (!deleted) return { error: "Setting not found" };
		return { success: true };
	},
);
