import { createAdminEndpoint } from "@86d-app/core/api";
import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import { customerContactResolveCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { OrderController, OrderWithDetails } from "../../service";

export const adminUpdateOrder = createAdminEndpoint(
	"/admin/orders/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z
				.enum([
					"pending",
					"processing",
					"on_hold",
					"completed",
					"cancelled",
					"refunded",
				])
				.optional(),
			paymentStatus: z
				.enum(["unpaid", "paid", "partially_paid", "refunded", "voided"])
				.optional(),
			notes: z.string().max(5000).transform(sanitizeText).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;

		let order = await controller.getById(ctx.params.id);
		if (!order) {
			return { error: "Order not found", status: 404 };
		}

		const previousStatus = order.status;
		const { status, paymentStatus, notes, metadata } = ctx.body;
		if (status === "completed" || status === "refunded") {
			return {
				code: "ORDER_CLOSURE_OPERATION_REQUIRED",
				error:
					"Order closure requires the versioned closure operation and cannot be asserted by a status edit.",
				status: 409,
			};
		}
		if (status === "cancelled" && previousStatus !== "cancelled") {
			return {
				code: "ORDER_CANCELLATION_OPERATION_UNAVAILABLE",
				error:
					"Order cancellation is unavailable until Payment, Inventory, tax, loyalty, and Shipping effects are coordinated durably.",
				status: 503,
			};
		}
		if (paymentStatus !== undefined) {
			return {
				code: "PAYMENT_OPERATION_REQUIRED",
				error: "Payment state must be changed by the owning payment operation.",
				status: 409,
			};
		}

		if (status) {
			const updated = await controller.updateStatus(ctx.params.id, status);
			if (updated) order = { ...order, ...updated };
		}

		if (notes !== undefined || metadata !== undefined) {
			const updated = await controller.update(ctx.params.id, {
				...(notes !== undefined ? { notes } : {}),
				...(metadata !== undefined ? { metadata } : {}),
			});
			if (updated) order = { ...order, ...updated };
		}

		// Emit events for status transitions that trigger email notifications
		if (ctx.context.events && status && status !== previousStatus) {
			const { email, customerName } = await resolveContactInfo(
				order,
				ctx.context.capabilities,
			);

			if (status === "cancelled") {
				await ctx.context.events.emit("order.cancelled", {
					orderId: order.id,
					orderNumber: order.orderNumber,
					customerId: order.customerId,
					email,
					customerName,
					reason: order.notes,
				});
			}
		}

		return { order };
	},
);

/**
 * Resolve the customer email and display name from the order.
 * For registered customers: resolve contact data through the customers capability.
 * For guests: use guestEmail and shipping address name.
 */
async function resolveContactInfo(
	order: OrderWithDetails,
	capabilities: CapabilityInvoker,
): Promise<{ email: string; customerName: string }> {
	// Try looking up the registered customer
	if (order.customerId) {
		try {
			const result = await capabilities.invoke(
				customerContactResolveCapability,
				{
					customerId: order.customerId,
				},
			);
			if (result.ok) {
				const name = [result.decision.firstName, result.decision.lastName]
					.filter(Boolean)
					.join(" ");
				return {
					email: result.decision.email,
					customerName: name || "Customer",
				};
			}
		} catch {
			// Fall through to address / guest fallbacks
		}
	}

	// Fall back to guest email
	const email = order.guestEmail ?? "";

	// Try to derive name from shipping address
	const shipping = order.addresses?.find((a) => a.type === "shipping");
	if (shipping) {
		const name = [shipping.firstName, shipping.lastName]
			.filter(Boolean)
			.join(" ");
		if (name) return { email, customerName: name };
	}

	return { email, customerName: "Customer" };
}
