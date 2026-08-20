"use client";

import { observer } from "@86d-app/core/state";
import { useEffect, useState } from "react";
import type { CalculatedRate } from "../../service";
import { useShippingApi } from "./_hooks";
import { formatPrice } from "./_utils";
import ShippingOptionsTemplate from "./shipping-options.mdx";

export interface ShippingOptionsProps {
	/** ISO 3166-1 alpha-2 country code. */
	country: string;
	/** Cart total in cents. */
	orderAmount: number;
	/** Total weight in grams (optional). */
	weight?: number;
	/** Called when a rate is selected. */
	onSelect?: (rate: CalculatedRate) => void;
	/** Pre-selected rate ID. */
	selectedRateId?: string;
}

/** Displays available shipping rates as selectable options. */
export const ShippingOptions = observer((props: ShippingOptionsProps) => {
	const api = useShippingApi();
	const [selectedId, setSelectedId] = useState(props.selectedRateId ?? "");

	const calculateMutation = api.calculateRates.useMutation({
		onSuccess: (data: { rates: CalculatedRate[] }) => {
			if (data.rates.length > 0 && !selectedId) {
				setSelectedId(data.rates[0].id);
				props.onSelect?.(data.rates[0]);
			}
		},
	});

	useEffect(() => {
		if (props.country && props.orderAmount >= 0) {
			calculateMutation.mutate({
				country: props.country,
				orderAmount: props.orderAmount,
				weight: props.weight,
			});
		}
		// Recalculate when inputs change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.country, props.orderAmount, props.weight]);

	const rates: CalculatedRate[] =
		(calculateMutation.data as { rates: CalculatedRate[] } | undefined)
			?.rates ?? [];

	const handleSelect = (rateId: string) => {
		setSelectedId(rateId);
		const rate = rates.find((r) => r.id === rateId);
		if (rate) {
			props.onSelect?.(rate);
		}
	};

	const formattedRates = rates.map((r) => ({
		rateId: r.id,
		zoneName: r.zoneName,
		rateName: r.name,
		formattedPrice: r.price === 0 ? "Free" : formatPrice(r.price),
	}));

	return (
		<ShippingOptionsTemplate
			rates={formattedRates}
			selectedId={selectedId}
			loading={calculateMutation.isPending}
			error={
				calculateMutation.isError ? "Unable to load shipping options." : ""
			}
			onSelect={handleSelect}
		/>
	);
});
