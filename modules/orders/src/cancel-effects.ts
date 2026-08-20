import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import {
	inventoryCheckoutCapability,
	paymentIntentCapability,
} from "@86d-app/core/commerce-capabilities";
import type {
	InventoryReleaseController,
	OrderController,
	OrderWithDetails,
	PaymentRefundController,
} from "./service";

interface CancelEffectsParams {
	order: OrderWithDetails;
	orderController: OrderController;
	capabilities?: CapabilityInvoker | undefined;
	/** @deprecated Test-only compatibility seam. Runtime callers use capabilities. */
	paymentController?: PaymentRefundController | undefined;
	/** @deprecated Test-only compatibility seam. Runtime callers use capabilities. */
	inventoryController?: InventoryReleaseController | undefined;
	cancelledBy: string;
}

interface CancelEffectsResult {
	refundCreated: boolean;
	inventoryReleased: boolean;
	refundAmount: number;
}

/**
 * Performs side effects when an order is cancelled:
 * 1. Refunds payment if the order was paid
 * 2. Releases reserved inventory for all order items
 * 3. Updates the order's payment status
 * 4. Adds a system note documenting the cancellation
 */
export async function performCancellationEffects(
	params: CancelEffectsParams,
): Promise<CancelEffectsResult> {
	const {
		order,
		orderController,
		capabilities,
		paymentController,
		inventoryController,
		cancelledBy,
	} = params;

	async function createRefund(intentId: string, reason: string) {
		if (capabilities) {
			const result = await capabilities.invoke(paymentIntentCapability, {
				operation: "refund",
				intentId,
				reason,
			});
			return result.ok && result.decision.operation === "refund"
				? result.decision.refund
				: undefined;
		}
		return paymentController?.createRefund({ intentId, reason });
	}

	async function findSucceededIntent() {
		if (capabilities) {
			const result = await capabilities.invoke(paymentIntentCapability, {
				operation: "list",
				orderId: order.id,
				status: "succeeded",
				take: 1,
			});
			return result.ok && result.decision.operation === "list"
				? result.decision.intents[0]
				: undefined;
		}
		return (
			await paymentController?.listIntents({
				orderId: order.id,
				status: "succeeded",
			})
		)?.[0];
	}

	let refundCreated = false;
	let refundAmount = 0;

	// 1. Refund payment if it was paid
	if ((capabilities || paymentController) && order.paymentStatus === "paid") {
		const paymentIntentId = resolvePaymentIntentId(order);
		const reason = `Order ${order.orderNumber} cancelled by ${cancelledBy}`;

		if (paymentIntentId) {
			try {
				const refund = await createRefund(paymentIntentId, reason);
				if (refund) {
					refundCreated = true;
					refundAmount = refund.amount;
				}
			} catch {
				// If the direct refund fails, try finding the intent by orderId
				const intent = await findSucceededIntent();
				if (intent) {
					try {
						const refund = await createRefund(intent.id, reason);
						if (refund) {
							refundCreated = true;
							refundAmount = refund.amount;
						}
					} catch {
						// Refund failed — will be noted below
					}
				}
			}
		} else {
			// No direct intent ID in metadata — search by orderId
			const intent = await findSucceededIntent();
			if (intent) {
				try {
					const refund = await createRefund(intent.id, reason);
					if (refund) {
						refundCreated = true;
						refundAmount = refund.amount;
					}
				} catch {
					// Refund failed — will be noted below
				}
			}
		}
		// Capability failures are values, not exceptions. If the metadata intent
		// was stale or unavailable, resolve the current succeeded intent by order.
		if (!refundCreated && paymentIntentId) {
			const intent = await findSucceededIntent();
			if (intent && intent.id !== paymentIntentId) {
				try {
					const refund = await createRefund(intent.id, reason);
					if (refund) {
						refundCreated = true;
						refundAmount = refund.amount;
					}
				} catch {
					// Refund failed — recorded in the system note below.
				}
			}
		}

		// Update order payment status
		if (refundCreated) {
			await orderController.updatePaymentStatus(order.id, "refunded");
		}
	}

	// 2. Release reserved inventory for all order items
	let inventoryReleased = false;
	if ((capabilities || inventoryController) && order.items.length > 0) {
		inventoryReleased = true;
		for (const item of order.items) {
			if (capabilities) {
				const released = await capabilities.invoke(
					inventoryCheckoutCapability,
					{
						operation: "release",
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
						quantity: item.quantity,
					},
				);
				if (!released.ok) inventoryReleased = false;
			} else {
				await inventoryController?.release({
					productId: item.productId,
					variantId: item.variantId,
					quantity: item.quantity,
				});
			}
		}
	}

	// 3. Add a system note documenting what happened
	const noteParts = [`Order cancelled by ${cancelledBy}.`];
	if (refundCreated) {
		noteParts.push(
			`Refund of ${formatCurrency(refundAmount, order.currency)} initiated.`,
		);
	} else if (
		order.paymentStatus === "paid" &&
		(capabilities || paymentController)
	) {
		noteParts.push("Automatic refund could not be processed.");
	}
	if (inventoryReleased) {
		noteParts.push(
			`Reserved inventory released for ${order.items.length} item(s).`,
		);
	}

	await orderController.addNote({
		orderId: order.id,
		type: "system",
		content: noteParts.join(" "),
	});

	return { refundCreated, inventoryReleased, refundAmount };
}

/** Extract the payment intent ID from order metadata (set during checkout). */
function resolvePaymentIntentId(order: OrderWithDetails): string | undefined {
	const meta = order.metadata as Record<string, unknown> | undefined;
	if (typeof meta?.paymentIntentId === "string") {
		return meta.paymentIntentId;
	}
	return undefined;
}

/** Simple currency formatting for system notes. */
function formatCurrency(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
		}).format(amount / 100);
	} catch {
		return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
	}
}
