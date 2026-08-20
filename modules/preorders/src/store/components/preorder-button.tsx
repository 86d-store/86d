"use client";

import { useState } from "react";
import { usePreordersApi } from "./_hooks";
import { extractError, formatCurrency, formatDate } from "./_utils";
import PreorderButtonTemplate from "./preorder-button.mdx";

interface CampaignAvailability {
	id: string;
	paymentType: string;
	depositAmount?: number;
	depositPercent?: number;
	price: number;
	estimatedShipDate?: string;
	message?: string;
	remainingQuantity: number | null;
}

export function PreorderButton({
	productId,
	productName,
	customerEmail,
}: {
	productId: string;
	productName: string;
	customerEmail?: string | undefined;
}) {
	const api = usePreordersApi();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [quantity, setQuantity] = useState(1);

	const { data: availData, isLoading: checking } =
		api.checkAvailability.useQuery({
			params: { productId },
		}) as {
			data:
				| { available: boolean; campaign: CampaignAvailability | null }
				| undefined;
			isLoading: boolean;
		};

	const available = availData?.available ?? false;
	const campaign = availData?.campaign ?? null;

	const placeMutation = api.placePreorder.useMutation({
		onSettled: () => {
			void api.checkAvailability.invalidate();
			void api.myPreorders.invalidate();
		},
		onSuccess: () => {
			setSuccess(true);
			setError("");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to place pre-order."));
		},
	});

	if (checking) {
		return null;
	}

	if (!available || !campaign) {
		return null;
	}

	const depositLabel =
		campaign.paymentType === "deposit"
			? campaign.depositPercent
				? `${campaign.depositPercent}% deposit`
				: campaign.depositAmount
					? `${formatCurrency(campaign.depositAmount)} deposit`
					: null
			: null;

	const handlePlace = () => {
		setError("");
		placeMutation.mutate({
			campaignId: campaign.id,
			quantity,
		});
	};

	return (
		<PreorderButtonTemplate
			productName={productName}
			price={formatCurrency(campaign.price)}
			depositLabel={depositLabel}
			estimatedShipDate={
				campaign.estimatedShipDate
					? formatDate(campaign.estimatedShipDate)
					: null
			}
			message={campaign.message ?? null}
			remainingQuantity={campaign.remainingQuantity}
			quantity={quantity}
			onQuantityChange={setQuantity}
			onPlace={handlePlace}
			isPending={placeMutation.isPending}
			success={success}
			error={error}
			isLoggedIn={!!customerEmail}
		/>
	);
}
