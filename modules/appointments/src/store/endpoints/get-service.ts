import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const getService = createStoreEndpoint(
	"/appointments/services/:slug",
	{
		method: "GET",
		params: z.object({ slug: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const service = await controller.getServiceBySlug(ctx.params.slug);
		if (service?.status !== "active") {
			return { error: "Service not found", status: 404 };
		}

		const staff = await controller.getServiceStaff(service.id);
		const activeStaff = staff.filter((s) => s.status === "active");

		return { service, staff: activeStaff };
	},
);
