import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const bookAppointment = createStoreEndpoint(
	"/appointments/book",
	{
		method: "POST",
		body: z.object({
			serviceId: z.string().min(1).max(200),
			staffId: z.string().min(1).max(200),
			customerName: z.string().min(1).max(200).transform(sanitizeText),
			customerEmail: z.string().email().max(320),
			customerPhone: z.string().max(50).transform(sanitizeText).optional(),
			startsAt: z.coerce.date(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.createAppointment>[0] = {
			serviceId: ctx.body.serviceId,
			staffId: ctx.body.staffId,
			customerName: ctx.body.customerName,
			customerEmail: ctx.body.customerEmail,
			startsAt: ctx.body.startsAt,
		};
		if (ctx.context.session?.user.id) {
			params.customerId = ctx.context.session.user.id;
		}
		if (ctx.body.customerPhone != null)
			params.customerPhone = ctx.body.customerPhone;
		if (ctx.body.notes != null) params.notes = ctx.body.notes;

		const appointment = await controller.createAppointment(params);

		void ctx.context.events?.emit("appointment.created", {
			appointmentId: appointment.id,
			serviceId: appointment.serviceId,
			customerId: appointment.customerId,
			customerEmail: appointment.customerEmail,
			customerName: appointment.customerName,
			startsAt: appointment.startsAt,
		});
		return { appointment };
	},
);
