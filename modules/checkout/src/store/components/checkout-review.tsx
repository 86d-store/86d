"use client";

import { observer } from "@86d-app/core/state";
import { useState } from "react";
import type { CheckoutAddress, CheckoutLineItem } from "../../service";
import { checkoutState } from "../../state";
import { useCheckoutApi } from "./_hooks";
import { formatPrice } from "./_utils";
import CheckoutReviewTemplate from "./checkout-review.mdx";

interface ReviewSession {
	id: string;
	guestEmail?: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	discountCode?: string | null;
	giftCardCode?: string | null;
	shippingAddress?: CheckoutAddress | null;
	billingAddress?: CheckoutAddress | null;
}

/** Step 4: Review order details and place the order. */
export const CheckoutReview = observer(() => {
	const api = useCheckoutApi();
	const sessionId = checkoutState.sessionId;

	const { data: sessionData } = api.getSession.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId },
	) as {
		data: { session: ReviewSession; lineItems: CheckoutLineItem[] } | undefined;
	};

	const [error, setError] = useState("");

	const completeMutation = api.completeSession.useMutation({
		onSuccess: (result) => {
			const s = (result as { session: { orderId?: string } }).session;
			checkoutState.reset();
			const orderId = s.orderId;
			const dest = orderId
				? `/checkout/confirmation?order=${encodeURIComponent(orderId)}`
				: "/checkout/confirmation";
			window.location.href = dest;
		},
		onError: () => {
			setError("Failed to place order. Please try again.");
		},
	});

	const session = sessionData?.session;
	const lineItems = sessionData?.lineItems ?? [];

	const handlePlaceOrder = () => {
		if (!sessionId) return;
		setError("");

		// Generate a simple order ID (the backend will use it)
		const newOrderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
		completeMutation.mutate({
			params: { id: sessionId },
			orderId: newOrderId,
		});
	};

	const handleBack = () => {
		checkoutState.setStep("payment");
	};

	const formatAddress = (addr: CheckoutAddress | null | undefined) => {
		if (!addr) return null;
		return `${addr.firstName} ${addr.lastName}, ${addr.line1}${addr.line2 ? ` ${addr.line2}` : ""}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`;
	};

	return (
		<CheckoutReviewTemplate
			orderPlaced={false}
			orderId={null}
			session={session ?? null}
			lineItems={lineItems}
			formattedItems={lineItems.map((item) => ({
				...item,
				formattedPrice: formatPrice(item.price),
				formattedTotal: formatPrice(item.price * item.quantity),
			}))}
			shippingAddress={
				session?.shippingAddress ? formatAddress(session.shippingAddress) : null
			}
			error={error}
			loading={completeMutation.isPending}
			onPlaceOrder={handlePlaceOrder}
			onBack={handleBack}
			formatPrice={formatPrice}
		/>
	);
});
