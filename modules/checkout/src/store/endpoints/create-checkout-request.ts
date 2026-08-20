import { createStoreEndpoint } from "@86d-app/core/api";
import { cartSnapshotCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import {
	checkoutRequestContactSchema,
	checkoutRequestReasonSchema,
	createCheckoutRequestStore,
} from "../../checkout-request";
import {
	checkoutRequestProofDigest,
	deriveCheckoutRequestProof,
	publicCheckoutRequest,
	setCheckoutRequestProofCookie,
} from "./checkout-request-access";

function authenticatedShopperOwner(id: string): {
	type: "authenticated_shopper";
	id: string;
} {
	return { type: "authenticated_shopper", id };
}

function guestRequestOwner(id: string): { type: "guest"; id: string } {
	return { type: "guest", id };
}

export const createCheckoutRequest = createStoreEndpoint(
	"/checkout/requests",
	{
		method: "POST",
		body: z
			.object({
				operationKey: z.string().trim().min(8).max(200),
				cartId: z.string().min(1).max(200),
				reason: checkoutRequestReasonSchema,
				contact: checkoutRequestContactSchema,
			})
			.strict(),
	},
	async (ctx) => {
		const authenticatedOwner = ctx.context.session?.user.id;
		const guestOwner = authenticatedOwner
			? undefined
			: ctx.getCookie("cart_guest_id");
		const cartOwner = authenticatedOwner
			? { customerId: authenticatedOwner }
			: guestOwner
				? { guestId: guestOwner }
				: undefined;
		if (!cartOwner) return { error: "Cart not found", status: 404 };

		const snapshot = await ctx.context.capabilities.invoke(
			cartSnapshotCapability,
			{ cartId: ctx.body.cartId, ...cartOwner },
		);
		if (!snapshot.ok) {
			if (
				snapshot.failure.code === "CART_NOT_FOUND" ||
				snapshot.failure.code === "CART_NOT_OWNED"
			) {
				return { error: "Cart not found", status: 404 };
			}
			if (snapshot.failure.code === "CART_NOT_ACTIVE") {
				return { error: "Cart is not active", status: 409 };
			}
			return {
				code: "CHECKOUT_REQUEST_CART_UNAVAILABLE",
				error: "An authoritative Cart snapshot is unavailable.",
				status: 503,
			};
		}
		if (snapshot.decision.items.length === 0) {
			return { error: "Cart is empty", status: 400 };
		}

		const owner = authenticatedOwner
			? authenticatedShopperOwner(authenticatedOwner)
			: guestOwner
				? guestRequestOwner(guestOwner)
				: undefined;
		if (!owner) return { error: "Cart not found", status: 404 };
		const proof =
			owner.type === "guest"
				? await deriveCheckoutRequestProof(owner.id, ctx.body.operationKey)
				: undefined;
		const storedOwner =
			owner.type === "guest"
				? guestRequestOwner(
						await checkoutRequestProofDigest(
							`checkout-request-owner:v1:${owner.id}`,
						),
					)
				: owner;
		const contact = {
			...ctx.body.contact,
			email: ctx.context.session?.user.email ?? ctx.body.contact.email,
		};
		const result = await createCheckoutRequestStore(
			ctx.context.transactions,
		).create({
			operationKey: ctx.body.operationKey,
			owner: storedOwner,
			...(proof
				? { accessProofDigest: await checkoutRequestProofDigest(proof) }
				: {}),
			reason: ctx.body.reason,
			contact,
			cartSnapshot: {
				cartId: snapshot.decision.cartId,
				revision: snapshot.decision.revision,
				lines: snapshot.decision.items,
			},
			auditActor: storedOwner,
		});
		if (!result.ok) {
			return {
				code: `CHECKOUT_REQUEST_${result.code}`,
				error: result.message,
				status: result.code === "IDEMPOTENCY_KEY_REUSED" ? 409 : 503,
			};
		}
		if (proof) setCheckoutRequestProofCookie(ctx, result.request, proof);
		return {
			request: publicCheckoutRequest(result.request),
			replayed: result.replayed,
		};
	},
);
