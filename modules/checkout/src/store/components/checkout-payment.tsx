"use client";

import { observer } from "@86d-app/core/state";
import { useEffect, useState } from "react";
import { checkoutState } from "../../state";
import { useCheckoutApi } from "./_hooks";
import { formatPrice } from "./_utils";
import CheckoutPaymentTemplate from "./checkout-payment.mdx";

interface PaymentData {
	id: string;
	status: string;
	amount: number;
	currency: string;
	clientSecret?: string;
	paypalOrderId?: string;
	braintreeClientToken?: string;
	squarePayment?: boolean;
}

interface SessionData {
	id: string;
	total: number;
	currency: string;
	paymentIntentId?: string | null;
	paymentStatus?: string | null;
	discountCode?: string | null;
	giftCardCode?: string | null;
}

/** Step 3: Create or display the payment intent. */
export const CheckoutPayment = observer(() => {
	const api = useCheckoutApi();
	const sessionId = checkoutState.sessionId;

	const { data: sessionData } = api.getSession.useQuery(
		sessionId ? { params: { id: sessionId } } : undefined,
		{ enabled: !!sessionId },
	) as { data: { session: SessionData } | undefined };

	const session = sessionData?.session;

	const [payment, setPayment] = useState<PaymentData | null>(null);
	const [error, setError] = useState("");

	const confirmMutation = api.confirmSession.useMutation({
		onError: () => {
			setError("Failed to confirm order. Please try again.");
			checkoutState.setProcessing(false);
		},
	});

	const paymentMutation = api.createPayment.useMutation({
		onSuccess: (result) => {
			const p = (result as { payment: PaymentData }).payment;
			setPayment(p);

			if (p.status === "succeeded") {
				checkoutState.setStep("review");
			}
		},
		onError: () => {
			setError("Failed to process payment. Please try again.");
			checkoutState.setProcessing(false);
		},
	});

	// Auto-confirm and create payment when arriving at this step
	useEffect(() => {
		if (!sessionId || checkoutState.isProcessing) return;
		if (payment) return;

		// If payment already succeeded (e.g. navigating back), skip to review
		if (session?.paymentStatus === "succeeded" && session?.paymentIntentId) {
			checkoutState.setStep("review");
			return;
		}

		checkoutState.setProcessing(true);
		setError("");

		// First confirm the session (validates fields, reserves inventory)
		confirmMutation.mutate(
			{ params: { id: sessionId } },
			{
				onSuccess: () => {
					// Then create the payment intent
					paymentMutation.mutate({ params: { id: sessionId } });
					checkoutState.setProcessing(false);
				},
			},
		);
	}, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleRetry = () => {
		if (!sessionId) return;
		setError("");
		checkoutState.setProcessing(true);
		paymentMutation.mutate({ params: { id: sessionId } });
		checkoutState.setProcessing(false);
	};

	const handleBack = () => {
		checkoutState.setStep("shipping");
	};

	const loading =
		confirmMutation.isPending ||
		paymentMutation.isPending ||
		checkoutState.isProcessing;

	const paymentProvider = payment?.clientSecret
		? "stripe"
		: payment?.paypalOrderId
			? "paypal"
			: payment?.braintreeClientToken
				? "braintree"
				: payment?.squarePayment
					? "square"
					: null;

	return (
		<CheckoutPaymentTemplate
			loading={loading}
			error={error}
			payment={payment}
			total={session ? formatPrice(session.total) : ""}
			hasClientSecret={!!payment?.clientSecret}
			paymentProvider={paymentProvider}
			onRetry={handleRetry}
			onBack={handleBack}
		/>
	);
});
