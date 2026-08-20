"use client";

import { useState } from "react";
import { useBackordersApi } from "./_hooks";
import { extractError } from "./_utils";
import BackorderButtonTemplate from "./backorder-button.mdx";

interface EligibilityData {
	eligible: boolean;
	reason?: string;
	estimatedLeadDays?: number;
	message?: string;
}

export function BackorderButton({
	productId,
	productName,
	variantId,
	variantLabel,
	customerEmail,
	quantity: initialQuantity = 1,
	maxQuantityPerOrder,
}: {
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
	customerEmail?: string | undefined;
	quantity?: number | undefined;
	maxQuantityPerOrder?: number | undefined;
}) {
	const api = useBackordersApi();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [quantity, setQuantity] = useState(initialQuantity);

	const { data: eligibility, isLoading: checking } =
		api.checkEligibility.useQuery({
			params: { productId },
			quantity: String(quantity),
		}) as {
			data: EligibilityData | undefined;
			isLoading: boolean;
		};

	const eligible = eligibility?.eligible ?? false;
	const estimatedLeadDays = eligibility?.estimatedLeadDays;
	const policyMessage = eligibility?.message;

	const createMutation = api.createBackorder.useMutation({
		onSettled: () => {
			void api.checkEligibility.invalidate();
			void api.myBackorders.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to place backorder."));
		},
		onSuccess: () => {
			setSuccess(true);
			setError("");
		},
	});

	const handleBackorder = () => {
		setError("");
		setSuccess(false);
		createMutation.mutate({
			productId,
			productName,
			variantId,
			variantLabel,
			quantity,
		});
	};

	if (checking) return null;
	if (!eligible) return null;

	return (
		<BackorderButtonTemplate
			eligible={eligible}
			estimatedLeadDays={estimatedLeadDays}
			policyMessage={policyMessage}
			quantity={quantity}
			onQuantityChange={setQuantity}
			maxQuantityPerOrder={maxQuantityPerOrder}
			onBackorder={handleBackorder}
			isPending={createMutation.isPending}
			success={success}
			error={error}
			customerEmail={customerEmail}
		/>
	);
}
