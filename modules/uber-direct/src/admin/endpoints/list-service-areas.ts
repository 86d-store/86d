import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { UberDirectController } from "../../service";

export const listServiceAreasEndpoint = createAdminEndpoint(
	"/admin/uber-direct/service-areas",
	{
		method: "GET",
		query: z.object({
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const areas = await controller.listServiceAreas({
			isActive: ctx.query.isActive,
		});
		return { areas };
	},
);
