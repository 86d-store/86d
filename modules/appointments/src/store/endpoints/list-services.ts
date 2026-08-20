import { createStoreEndpoint } from "@86d-app/core/api";
import type { AppointmentController } from "../../service";

export const listServices = createStoreEndpoint(
	"/appointments/services",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const services = await controller.listServices({ status: "active" });

		return { services };
	},
);
