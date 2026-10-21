import { provideCapability } from "@86d-store/core/capabilities";
import { storePickupScheduleCapability } from "@86d-store/core/commerce-capabilities";
import { createStorePickupController } from "./service-impl";

export const storePickupScheduleProvider = provideCapability(
	storePickupScheduleCapability,
	async (ctx, request) => {
		const controller = createStorePickupController(ctx.data);

		const timezone =
			typeof ctx.options.timezone === "string" ? ctx.options.timezone : null;

		if (!timezone) {
			return {
				ok: false,
				failure: {
					code: "SCHEDULE_FAILED" as const,
					message:
						"Store timezone is not configured. Please configure timezone in store settings.",
				},
			};
		}

		try {
			const pickup = await controller.schedulePickupWithTimezone(
				{
					orderId: request.orderId,
					locationId: request.locationId,
					windowId: request.windowId,
					scheduledDate: request.scheduledDate,
					...(request.customerId ? { customerId: request.customerId } : {}),
					...(request.notes ? { notes: request.notes } : {}),
				},
				timezone,
			);

			return {
				ok: true,
				decision: {
					pickupOrderId: pickup.id,
					locationName: pickup.locationName,
					locationAddress: pickup.locationAddress,
					scheduledDate: pickup.scheduledDate,
					startTime: pickup.startTime,
					endTime: pickup.endTime,
				},
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Schedule failed";
			let code: (typeof storePickupScheduleCapability.failure._output)["code"] =
				"SCHEDULE_FAILED";

			if (message.includes("timezone is required")) {
				code = "SCHEDULE_FAILED";
			} else if (message.includes("location not found")) {
				code = "LOCATION_NOT_FOUND";
			} else if (message.includes("location is not available")) {
				code = "LOCATION_NOT_ACTIVE";
			} else if (message.includes("window not found")) {
				code = "WINDOW_NOT_FOUND";
			} else if (message.includes("window is not available")) {
				code = "WINDOW_NOT_ACTIVE";
			} else if (message.includes("does not belong to")) {
				code = "WINDOW_LOCATION_MISMATCH";
			} else if (message.includes("day of week")) {
				code = "DATE_DAY_MISMATCH";
			} else if (message.includes("already passed")) {
				code = "SLOT_ALREADY_PASSED";
			} else if (message.includes("not available at this location")) {
				code = "BLACKOUT_DATE";
			} else if (message.includes("already has an active pickup")) {
				code = "ORDER_ALREADY_HAS_PICKUP";
			} else if (message.includes("fully booked")) {
				code = "WINDOW_FULLY_BOOKED";
			}

			return {
				ok: false,
				failure: { code, message },
			};
		}
	},
);
