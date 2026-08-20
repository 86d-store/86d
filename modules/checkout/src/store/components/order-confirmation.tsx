"use client";

import { useEffect, useState } from "react";
import OrderConfirmationTemplate from "./order-confirmation.mdx";

/**
 * Standalone order confirmation page rendered at /checkout/confirmation.
 * Reads the orderId from the URL query string (?orderId=...) so it survives
 * page refreshes and can be bookmarked or shared.
 */
export const OrderConfirmation = () => {
	const [orderId, setOrderId] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setOrderId(params.get("order"));
		setMounted(true);
	}, []);

	return <OrderConfirmationTemplate orderId={orderId} mounted={mounted} />;
};
