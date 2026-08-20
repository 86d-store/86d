import {
	type CapabilityDecision,
	type CapabilityFailure,
	type CapabilityRequest,
	type CapabilityResult,
	provideCapability,
} from "@86d-app/core/capabilities";
import { cartSnapshotCapability } from "@86d-app/core/commerce-capabilities";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { createCartControllers } from "./service-impl";

export { cartSnapshotCapability };

type CartSnapshotRequest = CapabilityRequest<typeof cartSnapshotCapability>;
type CartSnapshotResult = CapabilityResult<
	CapabilityDecision<typeof cartSnapshotCapability>,
	CapabilityFailure<typeof cartSnapshotCapability>
>;

async function resolveCartSnapshot(
	data: ModuleDataService,
	request: CartSnapshotRequest,
): Promise<CartSnapshotResult> {
	const controller = createCartControllers(data);
	const cart = await controller.getById(request.cartId);
	if (!cart) {
		return {
			ok: false,
			failure: {
				code: "CART_NOT_FOUND",
				message: "The Cart does not exist.",
			},
		};
	}
	if (cart.status !== "active" || cart.expiresAt.getTime() <= Date.now()) {
		return {
			ok: false,
			failure: {
				code: "CART_NOT_ACTIVE",
				message: "The Cart is not active.",
			},
		};
	}

	const ownedByCustomer =
		request.customerId !== undefined && cart.customerId === request.customerId;
	const ownedByGuest =
		request.guestId !== undefined && cart.guestId === request.guestId;
	if (!ownedByCustomer && !ownedByGuest) {
		return {
			ok: false,
			failure: {
				code: "CART_NOT_OWNED",
				message: "The Cart is not owned by this shopper.",
			},
		};
	}

	const items = await controller.getCartItems(cart.id);
	const revision = new Date(
		Math.max(
			cart.updatedAt.getTime(),
			...items.map((item) => new Date(item.updatedAt).getTime()),
		),
	);
	return {
		ok: true,
		decision: {
			cartId: cart.id,
			revision: revision.toISOString(),
			items: items.map(({ productId, variantId, quantity }) => ({
				productId,
				...(variantId ? { variantId } : {}),
				quantity,
			})),
		},
	};
}

export const cartSnapshotProvider = provideCapability(
	cartSnapshotCapability,
	async (ctx, request) => {
		if (ctx.transactions) {
			return ctx.transactions.transaction((transaction) =>
				resolveCartSnapshot(transaction, request),
			);
		}
		return resolveCartSnapshot(ctx.data, request);
	},
);
