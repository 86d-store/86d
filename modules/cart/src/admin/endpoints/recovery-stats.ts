import { createAdminEndpoint } from "@86d-app/core/api";
import { createCartControllers } from "../../service-impl";

export const getRecoveryStats = createAdminEndpoint(
	"/admin/carts/recovery-stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const context = ctx.context;
		const controller = createCartControllers(context.data);

		const stats = await controller.getRecoveryStats();

		const recoveryRate =
			stats.recoverySent > 0
				? Math.round((stats.recovered / stats.recoverySent) * 100)
				: 0;

		return {
			...stats,
			recoveryRate,
		};
	},
);
