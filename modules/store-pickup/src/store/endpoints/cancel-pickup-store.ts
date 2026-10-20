import { createStoreEndpoint } from "@86d-store/core/api";
import { z } from "zod";
import { readPickupSettings } from "../../pickup-settings";
import type { StorePickupController } from "../../service";

export const cancelPickupStore = createStoreEndpoint(
	"/store-pickup/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const settingsController = ctx.context.controllers.settings as
			| { getValue(key: string): Promise<string | null> }
			| undefined;
		const settings = await readPickupSettings(settingsController);
		const cancelLockState = settings?.cancelLockState ?? "started";
		const cancelBlockedMessage = settings?.cancelBlockedMessage;

		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const existing = await controller.getPickup(ctx.params.id);
		if (!existing) {
			return { error: "Pickup not found", status: 404 };
		}

		if (existing.customerId && existing.customerId !== session.user.id) {
			return { error: "Pickup not found", status: 404 };
		}

		try {
			const pickup = await controller.customerCancelPickupWithPolicy(
				ctx.params.id,
				cancelLockState,
				cancelBlockedMessage,
			);
			if (!pickup) {
				return { error: "Pickup not found", status: 404 };
			}
			return { pickup };
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes("preparation has started")) {
					return {
						error: error.message,
						code: "PICKUP_CANCEL_BLOCKED",
						status: 422,
					};
				}
				if (error.message.includes("already cancelled")) {
					return {
						error: error.message,
						code: "PICKUP_ALREADY_CANCELLED",
						status: 422,
					};
				}
				if (error.message.includes("completed pickup")) {
					return {
						error: error.message,
						code: "PICKUP_ALREADY_COMPLETED",
						status: 422,
					};
				}
				if (error.message.includes("no-show pickup")) {
					return {
						error: error.message,
						code: "PICKUP_NO_SHOW",
						status: 422,
					};
				}
			}
			throw error;
		}
	},
);
